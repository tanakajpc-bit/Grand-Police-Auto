// Políticas "especialistas": gerem reserva, colocam com critério e jogam o estilo com disciplina.
const B = require('./bots');
const { hire, buy, mk } = B;
const KEY = { perfil: 'profile', rota: 'route', efetivo: 'count', cofre: 'vault', refens: 'hostages', cumplice: 'accomplice' };
const known = (A, id) => !!A.G.K[KEY[id]];
const pending = (A, id) => A.G.pendingIntel.some(o => o.id === id);
const COMM_FOR = { imprensa: 'coletiva', prefeito: 'prefeito', banco: 'gerente', familias: 'acolhe' };
const PRIOR = { beco: 2.25, avenida: 2.125, garagem: 1.875, metro: 1.875, entrada: 1.75, vizinho: 1.25, telhado: 1.0 };

const TEAMS = {
  paz:   { rec: ['paulo', 'marina', 'renata', 'marcos', 'lucas'], gear: ['negofone', 'kit'] },
  agr:   { rec: ['diego', 'renata', 'andre', 'marcos', 'lucas'], gear: ['escudo', 'sniper'] },
  eq:    { rec: ['renata', 'paulo', 'carla', 'marcos', 'lucas'], gear: ['negofone', 'drone'] },
  eq2:   { rec: ['paulo', 'sofia', 'renata', 'marcos', 'camila'], gear: ['negofone', 'kit'] },
};
function neglected(A) { const G = A.G; return A.STK_KEYS.slice().sort((a, b) => (G.stk[b].sem * 10 - G.stk[b].sat) - (G.stk[a].sem * 10 - G.stk[a].sat))[0]; }
function place(A, o = {}) {
  const G = A.G; G.team.forEach(id => G.az[id] = 'reserva');
  const field = G.team.filter(id => A.stat(id, 'tat') >= 5).sort((a, b) => A.stat(b, 'tat') - A.stat(a, 'tat'));
  const route = G.K.route;
  let zones = Object.keys(PRIOR).sort((a, b) => PRIOR[b] - PRIOR[a]);
  // 1 agente na porta (segura o cofre), o resto nas rotas prováveis
  const order = [];
  if (o.door !== false) order.push('entrada');
  if (route && !order.includes(route)) order.push(route);
  zones.forEach(z => { if (!order.includes(z)) order.push(z); });
  field.forEach((id, i) => { G.az[id] = order[i % order.length]; });
  G.gear.forEach(e => {
    const occ = order.filter(z => A.agentsIn(z).length);
    if (e === 'drone') G.gz[e] = (route && A.agentsIn(route).length) ? route : (occ[1] || occ[0] || 'entrada');
    else if (e === 'sniper') G.gz[e] = (route && A.agentsIn(route).length) ? route : (occ[0] || 'entrada');
    else if (e === 'termica') G.gz[e] = 'beco';
    else G.gz[e] = 'reserva';
  });
}
function expert(style, o = {}) {
  const team = o.team || TEAMS[style];
  const th = o.thr != null ? o.thr : style === 'agr' ? .60 : style === 'eq' ? .72 : .85;
  const r0 = o.r0 != null ? o.r0 : style === 'agr' ? 3 : style === 'eq' ? 6 : 7;
  return {
    name: 'exp_' + style + (o.tag || ''), style: style === 'agr' ? 'agressivo' : 'paz',
    setup(A) {
      team.rec.forEach(id => hire(A, id)); team.gear.forEach(id => buy(A, id));
      A.G.pressure = A.calcPressure();
      A.autoPlace(); place(A, { door: o.door });
      if (o.p1 !== false && A.G.credits > 230) { A.phase1Intel('rota'); }
      if (o.p1b && A.G.credits > 250) { A.phase1Intel('perfil'); }
      if (A.G.K.route) place(A, { door: o.door });
    },
    decide(A, rn) {
      const G = A.G, D = A.DIFF[G.diff], slots = D.slots, out = [];
      const add = d => { if (out.length >= slots) return false; const r = A.addDecision(d); if (r.ok) out.push(d.kind); return r.ok; };
      const left = 8 - G.round, reserveNeed = A.plantaoCost() * left * .6;
      // intervenção
      const thNow = style === 'agr' ? Math.max(.38, th - .05 * Math.max(0, rn - r0)) : th;
      if (rn >= r0 && A.intervProb() >= thNow) { A.addDecision(mk.interv(A)); return ['interv']; }
      // negociação
      if (style !== 'agr' || rn >= 1) { if (style === 'agr' ? (rn >= 2 && G.nego.step < 5 && rn <= 6) : true) add(mk.nego(Math.min(5, G.nego.step))); }
      // informação
      const plan = style === 'agr' ? ['efetivo', 'refens', 'perfil', 'rota'] : style === 'paz' ? ['perfil', 'rota'] : ['perfil', 'efetivo', 'rota', 'refens'];
      const want = plan.find(i => !known(A, i) && !pending(A, i));
      if (want && G.credits > A.intelCost(want) + reserveNeed && rn <= 5) add(mk.intel(A, want));
      // comunicação ao negligenciado (as gratuitas primeiro)
      const k = neglected(A);
      if (G.stk[k].sem >= 1 || G.stk[k].sat < 52) { const cid = COMM_FOR[k]; if (!(cid === 'acolhe' && G.credits < 20)) add(mk.com(A, cid)); }
      // cansaço
      if (out.length < slots && A.deployed().some(id => A.ff(id) < .72) && G.credits > A.horasCost() + 50) add(mk.horas(A));
      // rota conhecida sem cobertura
      if (out.length < slots && G.K.route && A.zoneCoverage(G.K.route) < A.ADEQ && G.credits > A.apoioCost() + reserveNeed) add(mk.apoio(A, G.K.route));
      return out;
    }
  };
}
module.exports = { expert, TEAMS };
