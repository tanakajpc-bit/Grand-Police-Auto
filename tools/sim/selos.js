// Frequência de cada selo por tipo de jogador e dificuldade (% das partidas que o conquistam).
// badgeEarned() mora na camada de interface (ui3.js): o script extrai a função e a roda no mesmo contexto do motor.
// uso: node tools/sim/selos.js [N]
const fs = require('fs'), path = require('path');
const B = require('./bots'); const E = require('./experts'); const T = require('./tiers');
const N = +process.argv[2] || 300;
const SRC = process.env.PERI_SRC || path.join(__dirname, '..', '..', 'src');
const ui = fs.readFileSync(path.join(SRC, 'ui3.js'), 'utf8');
const a = ui.indexOf('function badgeEarned(id)'), b = ui.indexOf('function badgesHTML');
const A = B.load(1, SRC, ui.slice(a, b) + '\nglobalThis.__api.badge = badgeEarned;');
const ids = A.BADGES.map(x => x.id);
const cols = [
  ['novato', s => T.novato(s)], ['mid+', s => T.competente(s, { sloppy: .1 })],
  ['paz', () => E.expert('paz')], ['equil', () => E.expert('eq')], ['agr', () => E.expert('agr')],
  ['frugal', () => E.expert('paz', { team: { rec: ['paulo', 'marina', 'marcos'], gear: ['negofone'] }, tag: '_f', p1: false })],
  ['comunic', () => B.policyComunicador(['paulo', 'fernanda'], ['negofone'])]
];
console.log('colunas por dificuldade:', cols.map(c => c[0]).join(' '));
const table = {};
for (const diff of ['protocolar', 'complexo', 'caotico']) for (const [nm, mk] of cols) {
  const cnt = Object.fromEntries(ids.map(i => [i, 0]));
  for (let i = 0; i < N; i++) { B.playGame(A, diff, mk(30000 + i), 30000 + i); ids.forEach(id => { if (A.badge(id)) cnt[id]++; }); }
  table[diff + '/' + nm] = cnt;
}
console.log('selo'.padEnd(11), ['protocolar', 'complexo', 'caotico'].map(d => d.padEnd(cols.length * 4 + 1)).join('| '));
for (const id of ids) {
  const row = ['protocolar', 'complexo', 'caotico'].map(d => cols.map(([nm]) => String(Math.round(100 * table[d + '/' + nm][id] / N)).padStart(3)).join(' ')).join(' | ');
  console.log(id.padEnd(11), row);
}
