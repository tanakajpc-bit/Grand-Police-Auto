// Cartas de evento (L2.3). Duas medidas:
//   1) frequência: quantas cartas por partida e qual a distribuição, com o especialista de paz em cada dificuldade;
//   2) peso de cada carta e de cada escolha: a carta é forçada na rodada r (se elegível) e a partida é comparada, com as mesmas sementes, a
//      uma partida SEM eventos. Mostra se alguma carta é catastrófica (derruba a nota em mais de 10 pontos mesmo com a melhor escolha),
//      irrelevante (todas as escolhas valem menos de meio ponto) ou se as escolhas não têm dilema (uma sempre vence a outra).
// Com o argumento `neglige` o especialista não fala com nenhum stakeholder: as cartas que mexem em confiança aparecem com os públicos perto do
// limite de 15, onde a escolha decide se alguém é perdido.
// uso: node tools/sim/eventos.js [N] [paz|neglige]
const { B, summary, f1, batch, paired, signed, mean } = require('./lib');
const E = require('./experts');
const { load } = require('./engine-loader');
const N = +process.argv[2] || 300, MODO = process.argv[3] || 'paz';
const jogo = () => { const p = E.expert('paz'); if (MODO !== 'neglige') return p; return Object.assign({}, p, { decide(Ax, rn) { const out = p.decide(Ax, rn); Ax.G.queue.filter(q => q.kind === 'com').forEach(q => Ax.removeDecision(q.id)); return out; } }); };
const extra = `
let __force = null;
const __origDraw = drawEvent;
drawEvent = function () {
  if (!__force) return __origDraw();
  if (__force.id && G.round === __force.round && EVENT_FX[__force.id].elig(G) && !G.usedEvents.includes(__force.id)) {
    const id = __force.id; G.usedEvents.push(id); if (HEAVY.includes(id)) G.quietRound = G.round + 1; __force.done = true; return id;
  }
  return null;
};
globalThis.__api.__setForce = f => { __force = f; };
globalThis.__api.__forced = () => __force;`;
const A = load(1, undefined, extra);
const ROUND = { prefeito: 4, deadline: 6, segundo: 4, live: 4, fadiga: 4, proposta: 3, passamal: 3, divisao: 4, familia: 3, diretor: 3, infiltrado: 3, cumplice: 3, tiroteio: 3, heli: 3, energia: 3 };

console.log('— frequência das cartas (especialista de paz, 1.500 partidas por dificuldade) —');
const ids = A.EVENT_DEFS.map(e => e.id);
const chooseOrig = A.chooseEvent;
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  A.__setForce(null); const cnt = Object.fromEntries(ids.map(i => [i, 0])); let tot = 0, any = 0; const porRodada = Array(9).fill(0), porPartida = Array(6).fill(0);
  A.chooseEvent = idx => { porRodada[A.G.round]++; return chooseOrig(idx); };
  for (let i = 0; i < 1500; i++) { B.playGame(A, diff, jogo(), 30000 + i); const u = A.G.usedEvents; u.forEach(e => cnt[e]++); tot += u.length; if (u.length) any++; porPartida[Math.min(5, u.length)]++; }
  A.chooseEvent = chooseOrig;
  console.log(diff.padEnd(11), 'cartas por partida', (tot / 1500).toFixed(2), '| partidas com alguma carta', Math.round(100 * any / 1500) + '%');
  console.log('   ', ids.map(i => `${i} ${(100 * cnt[i] / 1500).toFixed(0)}%`).join(' · '));
  console.log('    por rodada (cartas por 100 partidas):', porRodada.map((n, r) => r >= 2 ? `r${r} ${(100 * n / 1500).toFixed(0)}` : '').filter(Boolean).join(' · '), '| partidas com 0/1/2/3/4/5+ cartas:', porPartida.map(n => Math.round(100 * n / 1500) + '%').join(' '));
}

console.log(`\n— peso de cada carta e escolha (N=${N}, especialista de ${MODO === 'neglige' ? 'paz que não fala com stakeholders' : 'paz'}, carta forçada na rodada indicada; Δ = nota com a carta − nota sem eventos) —`);
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  A.__setForce({ id: null, round: -1 }); const base = batch(A, diff, jogo, N);
  console.log('\n== ' + diff + ` (sem eventos: nota ${f1(summary(base).score)})`);
  for (const id of ids) {
    const fx = A.EVENT_FX[id], cells = [];
    fx.choices.forEach((ch, ci) => {
      const rows = [], bs = [];
      for (let i = 0; i < N; i++) {
        A.__setForce({ id, round: ROUND[id] });
        const pol = jogo(); pol.event = () => ci;
        const r = B.playGame(A, diff, pol, 30000 + i);
        if (A.__forced().done) { rows.push(r); bs.push(base[i]); }
      }
      if (rows.length < 20) { cells.push(`[${ci + 1}] amostra pequena (${rows.length})`); return; }
      const d = paired(rows, bs), dd = paired(rows, bs, 'dead');
      cells.push(`[${ci + 1}] ${signed(d.d).padStart(5)} ±${d.ci.toFixed(1)} (mortos ${signed(dd.d, 2)})`);
    });
    console.log(id.padEnd(11), `r${ROUND[id]}`.padEnd(3), cells.join('  |  '));
  }
}
A.__setForce(null);
