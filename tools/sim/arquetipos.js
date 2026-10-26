// Os três jogos de referência (negociadora, agressiva, equilibrada) nas três dificuldades: nota média, mortes, notas e desfechos.
const B = require('./bots');
const N = +process.argv[2] || 400;
const A = B.load(1);
const pols = [() => B.policyNegociador(), () => B.policyAgressivo(3, .5), () => B.policyAgressivo(1, 0), () => B.policyEquilibrado()];
const diffs = ['protocolar', 'complexo', 'caotico'];
const pct = (n, d) => (100 * n / d).toFixed(0).padStart(3) + '%';
for (const mkp of pols) for (const diff of diffs) {
  const rows = [];
  for (let i = 0; i < N; i++) rows.push(B.playGame(A, diff, mkp(), 1000 + i));
  const cnt = {}; rows.forEach(r => cnt[r.key] = (cnt[r.key] || 0) + 1);
  const g = {}; rows.forEach(r => g[r.grade] = (g[r.grade] || 0) + 1);
  const mean = k => (rows.reduce((s, r) => s + r[k], 0) / rows.length);
  console.log(`\n${rows[0].pol.padEnd(14)} ${diff.padEnd(10)} score ${mean('score').toFixed(1)} dead ${mean('dead').toFixed(2)} hurt ${mean('hurt').toFixed(2)} credits ${mean('credits').toFixed(0)} def ${mean('deficit').toFixed(2)} rounds ${mean('round').toFixed(1)} known ${mean('known').toFixed(1)}`);
  console.log('  grades:', ['S', 'A', 'B', 'C', 'D', 'F'].map(x => x + ' ' + pct(g[x] || 0, rows.length)).join('  '), ' | dead>=1:', pct(rows.filter(r => r.dead > 0).length, rows.length));
  console.log('  outcomes:', Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + pct(v, rows.length)).join(' · '));
}
