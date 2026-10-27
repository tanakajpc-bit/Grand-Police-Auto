// Casos de borda (as políticas extremas de bots.js) + fuzz, com os invariantes de invariantes.js verificados a cada passo e no fim
const B = require('./bots'); const { mulberry32 } = require('./engine-loader');
const A = B.load(1);
const N = +process.argv[2] || 200, NF = +process.argv[3] || 2000;
const pct = (n, d) => (100 * n / d).toFixed(0).padStart(3) + '%';
const bad = [];
const V = require('./invariantes')(A, bad);   // invariantes a cada passo e no fim (faixas, NaN, tetos de nota, save válido)
const play = V.play;
const kinds = ['nenhum', 'gastaTudo', 'ignoraNego', 'ignoraStk', 'soNego', 'soTatica', 'soIntel', 'soCom', 'passivo', 'intervSempre', 'pausaSempre', 'umaZona', 'soReserva'];
console.log('caso            nivel       score  S/A/B/C/D/F (%)            mortos  desfechos');
for (const k of kinds) for (const diff of ['protocolar', 'complexo', 'caotico']) {
  const rows = []; for (let i = 0; i < N; i++) { const o = play(diff, B.policyEdge(k), 7000 + i); if (o) rows.push(o); }
  const g = x => pct(rows.filter(r => r.grade === x).length, rows.length);
  const cnt = {}; rows.forEach(r => cnt[r.key] = (cnt[r.key] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([kk, v]) => kk + ' ' + pct(v, rows.length).trim()).join(' · ');
  console.log(k.padEnd(15), diff.padEnd(11), (rows.reduce((s, r) => s + r.score, 0) / rows.length).toFixed(1).padStart(5), ['S', 'A', 'B', 'C', 'D', 'F'].map(g).join(' '), ' ', (rows.reduce((s, r) => s + r.dead, 0) / rows.length).toFixed(2).padStart(5), ' ', top);
}
// fuzz
let fr = 0; const rng = mulberry32(99);
for (let i = 0; i < NF; i++) { const diff = ['protocolar', 'complexo', 'caotico'][i % 3]; const o = play(diff, B.policyFuzz(mulberry32(1000 + i)), 9000 + i); if (o) fr++; }
console.log('\nfuzz: ' + fr + '/' + NF + ' partidas completas');
console.log(bad.length ? 'VIOLAÇÕES (' + bad.length + '):\n' + [...new Set(bad)].slice(0, 25).join('\n') : 'nenhuma violação de invariantes');
