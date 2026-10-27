// Quando intervir (L2.3): o jogador espera até a rodada r e então autoriza a intervenção. Mede o valor de esperar.
//   pre: 'cego'  não faz nada antes de intervir (1 clique);  'info'  investiga uma variável por rodada;  'completo'  investiga, negocia e comunica.
//   equipe: 'forte' (5 agentes táticos, escudo e sniper) ou 'enxuta' (3 agentes, escudo).
// uso: node tools/sim/rush.js [N] [forte|enxuta]
const { B, summary, pct, f1 } = require('./lib');
const N = +process.argv[2] || 300, which = process.argv[3] || 'forte';
const TEAMS = { forte: { team: ['andre', 'marcos', 'diego', 'renata', 'lucas'], gear: ['escudo', 'sniper'] }, enxuta: { team: ['renata', 'marcos', 'lucas'], gear: ['escudo'] } };
const KEY = { perfil: 'profile', rota: 'route', efetivo: 'count', cofre: 'vault', refens: 'hostages', cumplice: 'accomplice' };
const known = (A, id) => !!A.G.K[KEY[id]];
const pending = (A, id) => A.G.pendingIntel.some(o => o.id === id);
const COMM_FOR = { imprensa: 'coletiva', prefeito: 'prefeito', banco: 'gerente', familias: 'acolhe' };
function rushAt(r, pre, t) {
  return {
    name: `rush${r}_${pre}`, style: 'agressivo',
    setup(A) { t.team.forEach(id => B.hire(A, id)); t.gear.forEach(id => B.buy(A, id)); A.G.pressure = A.calcPressure(); B.placeSmart(A); },
    decide(A, rn) {
      const G = A.G, slots = A.DIFF[G.diff].slots, out = [];
      const add = d => { if (out.length >= slots) return false; const x = A.addDecision(d); if (x.ok) out.push(d.kind); return x.ok; };
      if (rn >= r) { A.addDecision(B.mk.interv(A)); return ['interv']; }
      if (pre === 'cego') return out;
      if (pre === 'completo') add(B.mk.nego(Math.min(5, G.nego.step)));
      const want = ['efetivo', 'refens', 'rota', 'perfil'].find(i => !known(A, i) && !pending(A, i));
      if (want && G.credits > A.intelCost(want) + 40) add(B.mk.intel(A, want));
      if (pre === 'completo') {
        const k = A.STK_KEYS.slice().sort((a, b) => (G.stk[b].sem * 10 - G.stk[b].sat) - (G.stk[a].sem * 10 - G.stk[a].sat))[0];
        if (G.stk[k].sem >= 1) { const cid = COMM_FOR[k]; if (!(cid === 'acolhe' && G.credits < 20)) add(B.mk.com(A, cid)); }
      }
      return out;
    }
  };
}
const A = B.load(1);
console.log(`intervenção na rodada r, equipe ${which}, N=${N}   (nota média | A ou S | fracasso | sucesso limpo ou com baixas | mortos)`);
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  console.log('\n== ' + diff);
  for (const pre of ['cego', 'info', 'completo']) {
    const cells = [];
    for (const r of [1, 2, 3, 4, 5, 6, 8]) {
      const rows = []; for (let i = 0; i < N; i++) rows.push(B.playGame(A, diff, rushAt(r, pre, TEAMS[which]), 30000 + i));
      const s = summary(rows);
      cells.push(`r${r}: ${f1(s.score).padStart(4)} | ${pct(s.Ap, 1)} | ${pct(s.fracasso, 1)} | ${pct(s.intervOk, 1)} | ${s.dead.toFixed(1)}`);
    }
    console.log(pre.padEnd(9));
    cells.forEach(c => console.log('   ' + c));
  }
}
