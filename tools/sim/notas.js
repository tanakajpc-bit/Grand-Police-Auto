// Que fração das partidas passa de cada limiar de nota (S e A), por jogador e dificuldade. Mostra o que separa a equipe
// completa da enxuta: a eficiência de custo (10%) só chega perto do máximo para quem termina com verba sobrando.
// uso: node tools/sim/notas.js [N]
const B = require('./bots'); const E = require('./experts'); const T = require('./tiers');
const N = +process.argv[2] || 600;
const A = B.load(1);
const bots = [
  ['novato', s => T.novato(s)], ['mid', s => T.competente(s)], ['mid+', s => T.competente(s, { sloppy: .1, name: 'mid+' })],
  ['exp_paz', () => E.expert('paz')], ['exp_eq', () => E.expert('eq')], ['exp_agr', () => E.expert('agr')],
  ['enxuta 2 (paulo, fernanda)', () => B.policyComunicador(['paulo', 'fernanda'], ['negofone'])],
  ['enxuta 4 (+renata, marcos)', () => B.policyComunicador(['paulo', 'fernanda', 'renata', 'marcos'], ['negofone'])],
  ['cheia 6', () => B.policyComunicador(['renata', 'paulo', 'carla', 'marcos', 'lucas', 'fernanda'], ['negofone', 'drone'])]
];
const TH = [90, 88, 86, 84, 80];
console.log('bot'.padEnd(28), 'dif'.padEnd(6), 'média'.padStart(5), '  ' + TH.map(t => ('≥' + t).padStart(4)).join(' '), ' P95');
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  for (const [nm, mk] of bots) {
    const sc = []; for (let i = 0; i < N; i++) sc.push(B.playGame(A, diff, mk(30000 + i), 30000 + i).score);
    const ord = sc.slice().sort((a, b) => a - b);
    console.log(nm.padEnd(28), diff.slice(0, 5).padEnd(6), (sc.reduce((s, x) => s + x, 0) / N).toFixed(1).padStart(5), '  ' + TH.map(t => (Math.round(100 * sc.filter(x => x >= t).length / N) + '%').padStart(4)).join(' '), ' ' + ord[Math.floor(.95 * N)].toFixed(1));
  }
  console.log('');
}
