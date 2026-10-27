// Perfis do líder (L2.3): as mesmas políticas jogadas contra cada perfil, nas três dificuldades. As sementes são separadas por perfil
// (o perfil é o primeiro sorteio de cada partida), então cada coluna usa partidas diferentes mas do mesmo tamanho.
// Mostra se os perfis são distintos, se o Desesperado é o mais difícil e qual política rende mais contra cada um.
// uso: node tools/sim/perfil.js [N]
const { B, summary, f1, pct, mean } = require('./lib');
const E = require('./experts'), T = require('./tiers');
const N = +process.argv[2] || 200;
const A = B.load(1);
const PROFS = Object.keys(A.PROFILES);
function seedsPorPerfil(diff, n) {
  const out = Object.fromEntries(PROFS.map(p => [p, []])); let s = 30000;
  while (PROFS.some(p => out[p].length < n) && s < 200000) { A.reseed(s); A.newGame(diff); const p = A.G.profile; if (out[p].length < n) out[p].push(s); s++; }
  return out;
}
const pols = [
  ['novato', s => T.novato(s)], ['mid+', s => T.competente(s, { sloppy: .1 })],
  ['exp_paz', () => E.expert('paz')], ['exp_eq', () => E.expert('eq')], ['exp_agr', () => E.expert('agr')],
  ['enxuta 2', () => B.policyComunicador(['paulo', 'fernanda'], ['negofone'])],
  ['agr_r3', () => B.policyAgressivo(3, .5)]
];
console.log(`nota média por perfil do líder, N=${N} partidas por célula\n`);
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  const seeds = seedsPorPerfil(diff, N);
  console.log('== ' + diff);
  console.log('política'.padEnd(10), PROFS.map(p => A.PROFILES[p].nome.padStart(12)).join(' '), '   amplitude  pior perfil');
  const colMean = Object.fromEntries(PROFS.map(p => [p, []]));
  for (const [nm, mk] of pols) {
    const cells = PROFS.map(p => { const rows = seeds[p].map(s => B.playGame(A, diff, mk(s), s)); return summary(rows); });
    cells.forEach((c, i) => colMean[PROFS[i]].push(c.score));
    const sc = cells.map(c => c.score), worst = PROFS[sc.indexOf(Math.min(...sc))];
    console.log(nm.padEnd(10), cells.map(c => (f1(c.score) + ' ' + pct(c.rend, 1, 3)).padStart(12)).join(' '), '   ', f1(Math.max(...sc) - Math.min(...sc)).padStart(5), '    ', A.PROFILES[worst].nome);
  }
  console.log('média'.padEnd(10), PROFS.map(p => f1(mean(colMean[p])).padStart(12)).join(' '), '\n(cada célula: nota média e % de rendição)\n');
}
