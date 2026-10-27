// Utilidades comuns da bancada de equilíbrio (L2.3): estatística e corredor de partidas em lote.
const B = require('./bots');
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length || 1)); };
const ci = a => 1.96 * sd(a) / Math.sqrt(a.length || 1);
const pct = (n, d, w = 3) => (Math.round(100 * n / (d || 1)) + '%').padStart(w);
const f1 = x => x.toFixed(1);
/** Joga `n` partidas (sementes base..base+n-1) com a política criada por mk(seed) e devolve os resumos. */
function batch(A, diff, mk, n, base = 30000) { const rows = []; for (let i = 0; i < n; i++) rows.push(B.playGame(A, diff, mk(base + i), base + i)); return rows; }
/** Diferença pareada (mesmas sementes) de uma coluna entre dois lotes: média e intervalo de 95%. */
function paired(rowsA, rowsB, k = 'score') { const d = rowsA.map((r, i) => r[k] - rowsB[i][k]); return { d: mean(d), ci: ci(d) }; }
const signed = (x, p = 1) => (x >= 0 ? '+' : '') + x.toFixed(p);
const GR = ['S', 'A', 'B', 'C', 'D', 'F'];
function summary(rows) {
  const n = rows.length, m = k => mean(rows.map(r => r[k])), cnt = f => rows.filter(f).length;
  return {
    n, score: m('score'), sdv: sd(rows.map(r => r.score)), S: cnt(r => r.grade === 'S') / n, A: cnt(r => r.grade === 'A') / n, Bp: cnt(r => 'SAB'.includes(r.grade)) / n,
    Ap: cnt(r => 'SA'.includes(r.grade)) / n, D: cnt(r => r.grade === 'D') / n, F: cnt(r => r.grade === 'F') / n, dead: m('dead'), hurt: m('hurt'), dead1: cnt(r => r.dead > 0) / n, rend: cnt(r => r.type === 'rendicao') / n,
    interv: cnt(r => r.type === 'intervencao') / n, intervOk: cnt(r => r.type === 'intervencao' && ['limpa', 'baixas'].includes(r.variant)) / n, fracasso: cnt(r => r.key.includes('fracasso')) / n,
    fuga: cnt(r => r.type === 'fuga') / n, prazo: cnt(r => r.type === 'prazo') / n, credits: m('credits'), rounds: m('round')
  };
}
module.exports = { B, mean, sd, ci, pct, f1, batch, paired, signed, GR, summary };
