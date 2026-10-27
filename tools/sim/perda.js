// Perder um stakeholder dói? (L2.3) O especialista de paz joga a mesma partida (mesmas sementes), mas na rodada R o stakeholder escolhido cai
// para 10 de confiança (abaixo do limite de 15: ele é "perdido" ao fim da rodada). O especialista continua jogando e pode tentar recuperá-lo.
// Mostra o custo da perda: diferença de nota pareada, mortos, ordem política (só o prefeito) e quanto da verba o banco corta.
// uso: node tools/sim/perda.js [N] [rodada]
const { B, summary, pct, f1, batch, paired, signed } = require('./lib');
const E = require('./experts');
const N = +process.argv[2] || 300, R0 = +process.argv[3] || 3;
const A = B.load(1);
const perde = (k, pol) => Object.assign({}, pol, { decide(Ax, rn) { if (rn === R0) Ax.G.stk[k].sat = Math.min(Ax.G.stk[k].sat, 10); return pol.decide(Ax, rn); } });
console.log(`stakeholder derrubado para 10 na rodada ${R0}, especialista de paz, N=${N} por célula\n`);
console.log('dificuldade  stakeholder   nota   Δ pareada    mortos  ordem política  perdido ao fim  verba cortada');
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  const base = batch(A, diff, () => E.expert('paz'), N);
  console.log(diff.padEnd(12), 'nenhum'.padEnd(12), f1(summary(base).score).padStart(5), '      —      ', summary(base).dead.toFixed(2).padStart(6));
  for (const k of A.STK_KEYS) {
    const rows = batch(A, diff, () => perde(k, E.expert('paz')), N), s = summary(rows), d = paired(rows, base);
    const ordem = rows.filter(r => r.key.includes('intervencao') && r.round >= 6 && r.stk && r.stk.prefeito <= 15).length;
    const fim = rows.filter(r => r.stk && r.stk[k] <= 15).length;
    console.log(''.padEnd(12), k.padEnd(12), f1(s.score).padStart(5), (signed(d.d) + ' ±' + d.ci.toFixed(1)).padStart(12), s.dead.toFixed(2).padStart(6), pct(ordem, N, 14), pct(fim, N, 14), k === 'banco' ? '   60 créditos' : '');
  }
}
