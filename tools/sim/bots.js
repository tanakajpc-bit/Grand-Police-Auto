// Bots e corredor de partidas (headless). Cada bot replica o que a interface faz, chamando o motor.
const { load } = require('./engine-loader');

/* ---------- ações equivalentes às da interface ---------- */
function hire(A, id) { const G = A.G, a = A.agentById(id); if (!a || G.team.includes(id) || G.credits < a.custo) return false; G.team.push(id); G.credits -= a.custo; G.spent.rec += a.custo; G.az[id] = 'reserva'; return true; }
function buy(A, id) { const G = A.G, e = A.EQUIP.find(x => x.id === id); if (!e || G.gear.includes(id) || G.credits < e.custo) return false; G.gear.push(id); G.credits -= e.custo; G.spent.equip += e.custo; G.gz[id] = 'reserva'; return true; }
function ensureTeam(A) { const G = A.G; if (!G.team.length) { G.team = ['g1', 'g2']; G.stats.noRecruit = true; G.team.forEach(id => G.az[id] = 'reserva'); } }
function beginSiege(A) { const G = A.G; ensureTeam(A); G.pressure = A.calcPressure(); }
function startSiege(A) { A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound(); }

/* ---------- colocação ---------- */
const PRIOR = { beco: 2.25, avenida: 2.125, garagem: 1.875, metro: 1.875, entrada: 1.75, vizinho: 1.25, telhado: 1.0 };
function placeSmart(A, opts = {}) {
  const G = A.G;
  G.team.forEach(id => G.az[id] = 'reserva');
  const field = G.team.filter(id => A.stat(id, 'tat') >= 5).sort((a, b) => A.stat(b, 'tat') - A.stat(a, 'tat'));
  const zones = Object.keys(PRIOR).sort((a, b) => PRIOR[b] - PRIOR[a]);
  const route = opts.route || null;
  const order = route ? [route].concat(zones.filter(z => z !== route)) : zones;
  field.forEach((id, i) => { G.az[id] = order[i % order.length]; });
  // equipamentos de zona: drone/térmica/sniper na zona mais coberta/provável
  const occupied = order.filter(z => A.agentsIn(z).length);
  G.gear.forEach(e => {
    if (e === 'drone') G.gz[e] = occupied[1] || occupied[0] || 'entrada';
    else if (e === 'sniper') G.gz[e] = route && A.agentsIn(route).length ? route : (occupied[0] || 'entrada');
    else if (e === 'termica') G.gz[e] = 'beco';
    else G.gz[e] = 'reserva';
  });
}

/* ---------- decisões ---------- */
const mk = {
  nego: (t) => ({ front: 'nego', kind: 'nego', p: { tech: t }, label: 'nego', slots: 1 }),
  intel: (A, id) => ({ front: 'intel', kind: 'intel', p: { id }, label: id, slots: 1, cost: A.intelCost(id) }),
  com: (A, cid) => ({ front: 'com', kind: 'com', p: { cid }, label: cid, slots: 1, cost: A.COMMS.find(c => c.id === cid).custo }),
  pausa: () => ({ front: 'tatica', kind: 'pausa', p: {}, label: 'pausa', slots: 1 }),
  horas: (A) => ({ front: 'tatica', kind: 'horas', p: {}, label: 'horas', slots: 1, cost: A.horasCost() }),
  apoio: (A, z) => ({ front: 'tatica', kind: 'apoio', p: { zone: z }, label: 'apoio', slots: 1, cost: A.apoioCost() }),
  repos: (id, z) => ({ front: 'tatica', kind: 'repos', p: { agent: id, zone: z }, label: 'repos', slots: 1 }),
  interv: (A) => ({ front: 'tatica', kind: 'interv', p: {}, label: 'INTERV', slots: A.DIFF[A.G.diff].slots })
};
const KEY = { perfil: 'profile', rota: 'route', efetivo: 'count', cofre: 'vault', refens: 'hostages', cumplice: 'accomplice' };
const known = (A, id) => !!A.G.K[KEY[id]];
const pending = (A, id) => A.G.pendingIntel.some(o => o.id === id);
const COMM_FOR = { imprensa: 'coletiva', prefeito: 'prefeito', banco: 'gerente', familias: 'acolhe' };
function neglected(A) { const G = A.G; return A.STK_KEYS.slice().sort((a, b) => (G.stk[b].sem * 10 - G.stk[b].sat) - (G.stk[a].sem * 10 - G.stk[a].sat))[0]; }
function negoTech(A) { const G = A.G; return Math.min(5, G.nego.step); }

/* escolha de evento por política */
function eventChoice(A, id, style) {
  const G = A.G, fx = A.EVENT_FX[id], n = fx.choices.length;
  const afford = i => !(fx.choices[i].cost && G.credits < fx.choices[i].cost);
  let i = 0;
  const peace = style !== 'agressivo';
  switch (id) {
    case 'heli': i = G.credits >= 90 && peace ? 0 : 1; break;
    case 'prefeito': i = 1; break;
    case 'live': i = 0; break;
    case 'proposta': i = peace ? 2 : 1; break;
    case 'fadiga': i = G.credits >= A.horasCost() + 60 ? 0 : 1; break;
    case 'energia': i = peace ? 1 : 0; break;
    case 'infiltrado': i = peace ? 1 : 0; break;
    case 'diretor': i = 1; break;
    case 'familia': i = 0; break;
    case 'divisao': i = A.negoSkill() >= 6 ? 0 : 1; break;
    case 'passamal': i = 0; break;
    default: i = 0;
  }
  if (i >= n) i = 0;
  if (!afford(i)) i = [...Array(n).keys()].find(afford);
  return i;
}

/* ---------- políticas ---------- */
function policyNegociador(diff) {
  return {
    name: 'negociador', style: 'peace',
    setup(A) {
      ['paulo', 'marina', 'carla', 'renata', 'lucas', 'fernanda'].forEach(id => hire(A, id));
      ['negofone', 'kit'].forEach(id => buy(A, id));
      if (A.G.credits >= 70) buy(A, 'termica');
      beginSiege(A); placeSmart(A);
    },
    decide(A, rn) { return negoGeneric(A, rn, { intelPlan: ['perfil', 'efetivo', 'rota'], interv: false }); }
  };
}
function negoGeneric(A, rn, o) {
  const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
  const add = d => { if (out.length >= slots) return false; const r = A.addDecision(d); if (r.ok) out.push(d.kind); return r.ok; };
  // 1) negociação em todo turno
  add(mk.nego(negoTech(A)));
  // 2) inteligência prevista (uma por rodada, enquanto sobrar dinheiro)
  if (rn <= 4 && o.intelPlan) { const id = o.intelPlan.find(i => !known(A, i) && !pending(A, i)); if (id && G.credits > A.plantaoCost() * (8 - G.round) + A.intelCost(id) + 20) add(mk.intel(A, id)); }
  // 3) comunicação ao mais negligenciado
  const k = neglected(A);
  if (G.stk[k].sem >= 1 || G.stk[k].sat < 55) { const cid = COMM_FOR[k]; if (!(cid === 'acolhe' && G.credits < 20)) add(mk.com(A, cid)); }
  // 4) horas extras se muito cansados
  if (out.length < slots && A.deployed().some(id => A.ff(id) < .75) && G.credits > A.horasCost() + 80) add(mk.horas(A));
  return out;
}

function policyAgressivo(round = 3, thr = .5) {
  return {
    name: 'agressivo_r' + round, style: 'agressivo',
    setup(A) {
      ['andre', 'marcos', 'diego', 'renata', 'roberto', 'lucas'].forEach(id => hire(A, id));
      ['escudo', 'sniper', 'viatura'].forEach(id => buy(A, id));
      beginSiege(A); placeSmart(A);
    },
    decide(A, rn) {
      const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
      const add = d => { if (out.length >= slots) return false; const r = A.addDecision(d); if (r.ok) out.push(d.kind); return r.ok; };
      if (rn >= round && (A.intervProb() >= thr || rn >= round + 2)) { A.addDecision(mk.interv(A)); return ['interv']; }
      // antes de entrar: reunir informação sobre o interior e reféns
      const need = ['efetivo', 'refens', 'rota'].find(i => !known(A, i) && !pending(A, i));
      if (need && G.credits > A.intelCost(need) + 30) add(mk.intel(A, need));
      if (!known(A, 'refens') && G.credits >= 20 && !G.queue.some(q => q.p && q.p.cid === 'acolhe')) add(mk.com(A, 'acolhe'));
      const k = neglected(A); if (G.stk[k].sem >= 2) add(mk.com(A, COMM_FOR[k]));
      return out;
    }
  };
}

function policyEquilibrado() {
  return {
    name: 'equilibrado', style: 'equilibrado',
    setup(A) {
      ['renata', 'paulo', 'carla', 'marcos', 'lucas', 'fernanda'].forEach(id => hire(A, id));
      ['negofone', 'drone'].forEach(id => buy(A, id));
      beginSiege(A);
      placeSmart(A);
      // inteligência prévia: a rota decide a aposta
      if (A.G.credits > 260) A.phase1Intel('rota');
      if (A.G.K.route) placeSmart(A, { route: A.G.K.route });
    },
    decide(A, rn) {
      const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
      const add = d => { if (out.length >= slots) return false; const r = A.addDecision(d); if (r.ok) out.push(d.kind); return r.ok; };
      add(mk.nego(negoTech(A)));
      const reserveOK = G.credits > A.plantaoCost() * (8 - G.round) + 60;
      const plan = ['perfil', 'efetivo', 'refens', 'cofre', 'rota', 'cumplice'];
      if (rn <= 5 && reserveOK) { const id = plan.find(i => !known(A, i) && !pending(A, i)); if (id) add(mk.intel(A, id)); }
      const k = neglected(A);
      if (G.stk[k].sem >= 1 || G.stk[k].sat < 50) add(mk.com(A, COMM_FOR[k]));
      if (out.length < slots && A.deployed().some(id => A.ff(id) < .72) && G.credits > A.horasCost() + 60) add(mk.horas(A));
      // reforço à rota conhecida
      if (out.length < slots && G.K.route && A.zoneCoverage(G.K.route) < A.ADEQ && G.credits > A.apoioCost() + 80) add(mk.apoio(A, G.K.route));
      // intervenção só se muito provável e negociação travada nas últimas rodadas
      if (rn >= 6 && G.nego.step < 4 && A.intervProb() >= .72) { A.G.queue.forEach(q => 0); return (A.addDecision(mk.interv(A)), ['interv']); }
      return out;
    }
  };
}

/* Comunicador: negocia todo turno, fala com quem está mais esquecido e não gasta em inteligência. Serve para medir o que
   a equipe enxuta consegue só com negociação e comunicação (equipe e equipamento escolhidos de fora). */
function policyComunicador(team, gear, thr = 75) {
  return {
    name: 'comunicador', style: 'peace',
    setup(A) { team.forEach(id => hire(A, id)); gear.forEach(id => buy(A, id)); beginSiege(A); A.autoPlace(); },
    decide(A, rn) {
      const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
      const add = d => { if (out.length >= slots) return false; const r = A.addDecision(d); if (r.ok) out.push(d.kind); return r.ok; };
      add(mk.nego(negoTech(A)));
      for (const k of A.STK_KEYS.slice().sort((a, b) => G.stk[a].sat - G.stk[b].sat)) {
        if (out.length >= slots) break;
        if (G.stk[k].sat < thr || G.stk[k].sem >= 1) { const cid = COMM_FOR[k]; if (!(cid === 'acolhe' && G.credits < 20)) add(mk.com(A, cid)); }
      }
      return out;
    }
  };
}

/* ---------- bots de borda ---------- */
function policyEdge(kind) {
  const base = {
    nenhum: { rec: [], gear: [] },
    gastaTudo: { rec: ['diego', 'renata', 'marcos', 'andre', 'lucas', 'roberto', 'camila'], gear: ['sniper', 'drone'] },
    ignoraNego: { rec: ['renata', 'marcos', 'lucas', 'andre', 'diego'], gear: ['escudo', 'drone'] },
    ignoraStk: { rec: ['paulo', 'renata', 'carla', 'marcos', 'lucas'], gear: ['negofone'] },
    soNego: { rec: ['paulo', 'marina', 'renata'], gear: ['negofone'] },
    soTatica: { rec: ['renata', 'diego', 'marcos', 'andre', 'lucas'], gear: ['drone', 'escudo'] },
    soIntel: { rec: ['sofia', 'carla', 'renata'], gear: [] },
    soCom: { rec: ['fernanda', 'camila', 'renata'], gear: [] },
    passivo: { rec: ['renata', 'paulo', 'marcos', 'lucas'], gear: ['drone'] },
    intervSempre: { rec: ['renata', 'diego', 'andre', 'marcos', 'lucas'], gear: ['escudo'] },
    pausaSempre: { rec: ['renata', 'paulo', 'carla', 'marcos'], gear: [] },
    umaZona: { rec: ['renata', 'diego', 'marcos', 'andre', 'lucas', 'roberto'], gear: ['sniper'] },
    soReserva: { rec: ['renata', 'paulo', 'marcos'], gear: [] }
  }[kind];
  return {
    name: 'edge_' + kind, style: 'peace',
    setup(A) {
      base.rec.forEach(id => hire(A, id)); base.gear.forEach(id => buy(A, id));
      beginSiege(A);
      if (kind === 'umaZona') { A.G.team.forEach(id => A.G.az[id] = 'beco'); A.G.gear.forEach(e => A.G.gz[e] = 'beco'); }
      else if (kind === 'soReserva') { A.G.team.forEach(id => A.G.az[id] = 'reserva'); }
      else A.autoPlace();
    },
    decide(A, rn) {
      const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
      const add = d => { if (out.length >= slots) return false; const r = A.addDecision(d); if (r.ok) out.push(d.kind); return r.ok; };
      switch (kind) {
        case 'soNego': add(mk.nego(negoTech(A))); break;
        case 'ignoraNego': { const id = ['perfil', 'rota', 'efetivo', 'refens', 'cofre'].find(i => !known(A, i) && !pending(A, i)); if (id && G.credits > A.intelCost(id)) add(mk.intel(A, id)); const k = neglected(A); add(mk.com(A, COMM_FOR[k])); break; }
        case 'ignoraStk': add(mk.nego(negoTech(A))); { const id = ['perfil', 'efetivo', 'rota'].find(i => !known(A, i) && !pending(A, i)); if (id && G.credits > A.intelCost(id)) add(mk.intel(A, id)); } break;
        case 'soTatica': { if (A.deployed().some(id => A.ff(id) < .75) && G.credits > A.horasCost()) add(mk.horas(A)); add(mk.pausa()); break; }
        case 'soIntel': { const id = ['perfil', 'rota', 'efetivo', 'refens', 'cofre', 'cumplice'].find(i => !known(A, i) && !pending(A, i)); if (id && G.credits > A.intelCost(id)) add(mk.intel(A, id)); break; }
        case 'soCom': { A.STK_KEYS.forEach(k => add(mk.com(A, COMM_FOR[k]))); break; }
        case 'passivo': break;
        case 'intervSempre': A.addDecision(mk.interv(A)); return ['interv'];
        case 'pausaSempre': add(mk.pausa()); break;
        case 'umaZona': add(mk.nego(negoTech(A))); break;
        case 'soReserva': add(mk.nego(negoTech(A))); break;
        case 'gastaTudo': case 'nenhum': { add(mk.nego(negoTech(A))); const k = neglected(A); if (G.stk[k].sem >= 1) add(mk.com(A, COMM_FOR[k])); break; }
      }
      return out;
    }
  };
}

/* ---------- fuzz: decisões aleatórias válidas ---------- */
function policyFuzz(rng) {
  return {
    name: 'fuzz', style: 'peace',
    setup(A) {
      const ag = A.AGENTS.map(a => a.id).sort(() => rng() - .5), n = Math.floor(rng() * 9);
      ag.slice(0, n).forEach(id => hire(A, id));
      A.EQUIP.map(e => e.id).sort(() => rng() - .5).slice(0, Math.floor(rng() * 5)).forEach(id => buy(A, id));
      beginSiege(A);
      if (rng() < .5) A.autoPlace(); else A.G.team.forEach(id => A.G.az[id] = ['reserva', ...A.ZONES.map(z => z.id)][Math.floor(rng() * 8)]);
      A.G.gear.forEach(e => A.G.gz[e] = ['reserva', ...A.ZONES.map(z => z.id)][Math.floor(rng() * 8)]);
      if (rng() < .5) A.phase1Intel(['perfil', 'rota', 'efetivo'][Math.floor(rng() * 3)]);
    },
    decide(A, rn) {
      const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
      const tries = 6;
      for (let t = 0; t < tries && out.length < slots; t++) {
        const r = rng(); let d;
        if (r < .25) d = mk.nego(rng() < .15 ? 'press' : 1 + Math.floor(rng() * 5));
        else if (r < .45) d = mk.intel(A, A.INTEL[Math.floor(rng() * 6)].id);
        else if (r < .65) d = mk.com(A, A.COMMS[Math.floor(rng() * 5)].id);
        else if (r < .72) d = mk.pausa();
        else if (r < .78) d = mk.horas(A);
        else if (r < .84) d = mk.apoio(A, A.ZONES[Math.floor(rng() * 7)].id);
        else if (r < .95 && G.team.length) { const id = G.team[Math.floor(rng() * G.team.length)]; d = mk.repos(id, ['reserva', ...A.ZONES.map(z => z.id)][Math.floor(rng() * 8)]); }
        else if (rng() < .3) d = mk.interv(A);
        else continue;
        if (A.addDecision(d).ok) out.push(d.kind);
      }
      return out;
    },
    event(A, id) { const fx = A.EVENT_FX[id]; return Math.floor(rng() * fx.choices.length); }
  };
}

/* ---------- corredor ---------- */
function playGame(A, diff, pol, seed, opt = {}) {
  A.reseed(seed);
  A.newGame(diff);
  const G = A.G;
  pol.setup(A);
  startSiege(A);
  let guard = 0;
  while (!G.end && guard++ < 12) {
    G.stage = 'panel';
    pol.decide(A, G.round);
    const r = A.resolveDecisions();
    if (r && r.event) {
      let idx = pol.event ? pol.event(A, r.event) : eventChoice(A, r.event, pol.style);
      if (!A.chooseEvent(idx)) { // sem crédito: tenta as outras
        const n = A.EVENT_FX[r.event].choices.length; let ok = false;
        for (let i = 0; i < n && !ok; i++) ok = A.chooseEvent(i);
        if (!ok) throw new Error('evento sem escolha possível: ' + r.event);
      }
    }
    if (!G.end) A.startRound();
  }
  if (!G.end) throw new Error('jogo não terminou após 12 rodadas');
  return summarize(A, pol, diff);
}
function summarize(A, pol, diff) {
  const G = A.G, E = G.end, S = G.score, H = G.hostages;
  return {
    pol: pol.name, diff, profile: G.profile, type: E.type, variant: E.variant || '', sub: E.sub || '', key: E.type + (E.variant ? ':' + E.variant : '') + (E.sub ? '>' + E.sub : ''),
    dead: H.dead, hurt: H.hurt, score: S.total, raw: S.raw, grade: S.grade, capped: S.capped, round: G.round, credits: G.credits, deficit: G.deficit,
    maxStep: G.nego.maxStep, lost: A.STK_KEYS.filter(k => G.stk[k].lost).length, vault: G.vault, agit: G.agit,
    vidas: S.vidas, captura: S.captura, valores: S.valores, efic: S.eficiencia, conf: S.confianca,
    known: A.knownCount(), intervs: G.stats.intervs, pausas: G.stats.pausas, tries: G.nego.tries, stk: Object.fromEntries(A.STK_KEYS.map(k => [k, G.stk[k].sat]))
  };
}

module.exports = { load, playGame, policyNegociador, policyAgressivo, policyEquilibrado, policyComunicador, policyEdge, policyFuzz, hire, buy, mk, placeSmart };
