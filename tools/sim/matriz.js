// Matriz geral: níveis de jogador × dificuldade
const B = require('./bots'); const E = require('./experts'); const T = require('./tiers');
const N = +process.argv[2] || 600; const only = process.argv[3];
const A = B.load(1);
const pct = (n, d) => (100 * n / d).toFixed(0).padStart(3) + '%';
const tiers = [
  ['novato', seed => T.novato(seed)],
  ['mid', seed => T.competente(seed)],
  ['mid+', seed => T.competente(seed, { sloppy: .1, name: 'mid+' })],
  ['exp_paz', () => E.expert('paz')], ['exp_eq', () => E.expert('eq')], ['exp_agr', () => E.expert('agr')]
];
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  console.log('\n== ' + diff + ' ==');
  console.log('tier      score  S    A    B    C    D    F  | B+   dead>=1  dead  hurt | rend  intv(ok)  fuga  prazo(cedeu) | cred  rnds');
  for (const [nm, mkp] of tiers) {
    if (only && !nm.startsWith(only)) continue;
    const rows = [];
    for (let i = 0; i < N; i++) rows.push(B.playGame(A, diff, mkp(30000 + i), 30000 + i));
    const g = x => pct(rows.filter(r => r.grade === x).length, rows.length);
    const mean = k => rows.reduce((s, r) => s + r[k], 0) / rows.length;
    const t = k => pct(rows.filter(r => r.type === k).length, rows.length);
    const ok = pct(rows.filter(r => r.type === 'intervencao' && ['limpa', 'baixas'].includes(r.variant)).length, rows.length);
    const ced = pct(rows.filter(r => r.type === 'prazo' && r.variant === 'cedeu').length, rows.length);
    console.log(nm.padEnd(9), mean('score').toFixed(1).padStart(5), ['S', 'A', 'B', 'C', 'D', 'F'].map(g).join(' '), '|', pct(rows.filter(r => 'SAB'.includes(r.grade)).length, rows.length), pct(rows.filter(r => r.dead > 0).length, rows.length).padStart(7), mean('dead').toFixed(2).padStart(5), mean('hurt').toFixed(2).padStart(5), '|', t('rendicao'), (t('intervencao') + '(' + ok.trim() + ')').padStart(10), t('fuga'), (t('prazo') + '(' + ced.trim() + ')').padStart(10), '|', mean('credits').toFixed(0).padStart(4), mean('round').toFixed(1));
  }
}
