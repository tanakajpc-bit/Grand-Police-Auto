// Jogadores de nível médio e novato: erram, variam e gastam sem rigor.
const B = require('./bots'); const E = require('./experts');
const { mulberry32 } = require('./engine-loader');
const { hire, buy, mk } = B;
const KEY = { perfil: 'profile', rota: 'route', efetivo: 'count', cofre: 'vault', refens: 'hostages', cumplice: 'accomplice' };
const known = (A, id) => !!A.G.K[KEY[id]];
const pending = (A, id) => A.G.pendingIntel.some(o => o.id === id);
const COMM_FOR = { imprensa: 'coletiva', prefeito: 'prefeito', banco: 'gerente', familias: 'acolhe' };
function neglected(A) { const G = A.G; return A.STK_KEYS.slice().sort((a, b) => (G.stk[b].sem * 10 - G.stk[b].sat) - (G.stk[a].sem * 10 - G.stk[a].sat))[0]; }
function shuffle(rng, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* Competente: monta uma equipe plausível (precisa de alguém com negociação ≥ 6), deixa ~120–250 de reserva, negocia quase sempre
   na postura certa, investiga e comunica sem método, e só intervém quando a chance parece boa. */
function competente(gseed, o = {}) {
  const rng = mulberry32((gseed ^ 0x9e3779b9) >>> 0);
  const sloppy = o.sloppy != null ? o.sloppy : .25;
  return {
    name: o.name || 'mid', style: 'paz', rng,
    setup(A) {
      const G = A.G; const reserveTarget = 120 + Math.floor(rng() * 130);
      const ids = shuffle(rng, A.AGENTS.map(a => a.id));
      // garante um negociador razoável
      const negs = ids.filter(id => A.agentById(id).s.neg >= 6); const pickN = negs[0]; hire(A, pickN);
      for (const id of ids) { if (G.team.length >= 6) break; if (id === pickN) continue; const a = A.agentById(id); if (G.credits - a.custo >= reserveTarget + 60) hire(A, id); if (G.team.length >= 4 && rng() < .25) break; }
      const gear = shuffle(rng, A.EQUIP.map(e => e.id));
      for (const id of gear) { const e = A.EQUIP.find(x => x.id === id); if (G.gear.length >= 3) break; if (G.credits - e.custo >= reserveTarget) { if (rng() < .6) buy(A, id); } }
      G.pressure = A.calcPressure(); A.autoPlace();
      // coloca equipamentos de zona em zonas ocupadas
      const occ = A.ZONES.map(z => z.id).filter(z => A.agentsIn(z).length);
      G.gear.forEach(e => { G.gz[e] = ['drone', 'sniper', 'termica'].includes(e) ? (occ[Math.floor(rng() * occ.length)] || 'entrada') : 'reserva'; });
      if (rng() < .5 && G.credits > 150) A.phase1Intel(['perfil', 'rota', 'efetivo'][Math.floor(rng() * 3)]);
    },
    decide(A, rn) {
      const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
      const add = d => { if (out.length >= slots) return false; const r = A.addDecision(d); if (r.ok) out.push(d.kind); return r.ok; };
      if (rn >= 4 && A.intervProb() >= .55 && rng() < .35) { A.addDecision(mk.interv(A)); return ['interv']; }
      // negociação (às vezes não negocia, às vezes erra a postura)
      if (rng() > sloppy * .5) {
        const step = G.nego.step; const r = rng(); let t = Math.min(5, step);
        if (r < sloppy * .6) t = Math.min(5, step + 1); else if (r < sloppy * .8) t = Math.max(1, step - 1); else if (r < sloppy * .9 && rn >= 3) t = 'press';
        add(mk.nego(t));
      }
      if (rng() < .55) { const plan = shuffle(rng, ['perfil', 'efetivo', 'rota', 'refens', 'cofre', 'cumplice']).find(i => !known(A, i) && !pending(A, i)); if (plan && G.credits > A.intelCost(plan) + 30) add(mk.intel(A, plan)); }
      const k = rng() < .7 ? neglected(A) : A.STK_KEYS[Math.floor(rng() * 4)];
      if (rng() < .6) { const cid = COMM_FOR[k]; if (!(cid === 'acolhe' && G.credits < 20)) add(mk.com(A, cid)); }
      if (out.length < slots && rng() < .3 && A.deployed().some(id => A.ff(id) < .75) && G.credits > A.horasCost() + 40) add(mk.horas(A));
      return out;
    }
  };
}

/* Novato: decisões quase aleatórias entre as opções legais, equipe aleatória barata e sem plano. */
function novato(gseed) {
  const rng = mulberry32((gseed ^ 0x51ed270b) >>> 0);
  return {
    name: 'novato', style: 'paz', rng,
    setup(A) {
      const G = A.G; const ids = shuffle(rng, A.AGENTS.map(a => a.id)); const n = 3 + Math.floor(rng() * 4);
      for (const id of ids) { if (G.team.length >= n) break; hire(A, id); }
      shuffle(rng, A.EQUIP.map(e => e.id)).slice(0, Math.floor(rng() * 4)).forEach(id => buy(A, id));
      G.pressure = A.calcPressure(); A.autoPlace();
      G.gear.forEach(e => { G.gz[e] = ['drone', 'sniper', 'termica'].includes(e) ? A.ZONES[Math.floor(rng() * 7)].id : 'reserva'; });
    },
    decide(A, rn) {
      const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
      const add = d => { if (out.length >= slots) return false; const r = A.addDecision(d); if (r.ok) out.push(d.kind); return r.ok; };
      if (rng() < .1) { A.addDecision(mk.interv(A)); return ['interv']; }
      for (let t = 0; t < 6 && out.length < slots; t++) {
        const r = rng();
        if (r < .30) add(mk.nego(rng() < .12 ? 'press' : 1 + Math.floor(rng() * 5)));
        else if (r < .50) add(mk.intel(A, A.INTEL[Math.floor(rng() * 6)].id));
        else if (r < .75) add(mk.com(A, A.COMMS[Math.floor(rng() * 5)].id));
        else if (r < .82) add(mk.pausa());
        else if (r < .88) add(mk.horas(A));
        else if (r < .94) add(mk.apoio(A, A.ZONES[Math.floor(rng() * 7)].id));
        else if (G.team.length) add(mk.repos(G.team[Math.floor(rng() * G.team.length)], ['reserva', ...A.ZONES.map(z => z.id)][Math.floor(rng() * 8)]));
      }
      return out;
    }
  };
}
module.exports = { competente, novato };
