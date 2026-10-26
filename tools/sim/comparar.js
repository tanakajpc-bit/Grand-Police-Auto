// Teste diferencial: joga as mesmas sementes com o motor de uma versão anterior (referência do git) e com o motor atual.
// Mostra quantas partidas divergem em algum campo do resultado. Serve para provar que uma mudança só de interface ou de texto
// não alterou o jogo, ou para medir o que uma mudança de regra alterou.
// uso: node tools/sim/comparar.js [referência-git (padrão HEAD)] [N por célula (padrão 200)]
const { execFileSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const ref = process.argv[2] || 'HEAD', N = +process.argv[3] || 200;
const repo = path.join(__dirname, '..', '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'peri-ref-'));
for (const f of ['data.js', 'story.js', 'engine.js', 'dash.js']) fs.writeFileSync(path.join(dir, f), execFileSync('git', ['show', `${ref}:src/${f}`], { cwd: repo }));
const B = require('./bots'); const E = require('./experts'); const T = require('./tiers');
const { mulberry32 } = require('./engine-loader');
const Aref = B.load(1, dir), Anow = B.load(1);
const pols = [
  ['negociadora', () => B.policyNegociador()], ['equilibrada', () => B.policyEquilibrado()], ['agressiva', () => B.policyAgressivo(3, .5)],
  ['enxuta 2', () => B.policyComunicador(['paulo', 'fernanda'], ['negofone', 'kit'])], ['enxuta 4', () => B.policyComunicador(['paulo', 'fernanda', 'renata', 'marcos'], ['negofone', 'kit'])],
  ['exp_paz', () => E.expert('paz')], ['exp_eq', () => E.expert('eq')], ['exp_agr', () => E.expert('agr')],
  ['novato', s => T.novato(s)], ['mid', s => T.competente(s)], ['mid+', s => T.competente(s, { sloppy: .1 })],
  ['fuzz', s => B.policyFuzz(mulberry32(s + 5))], ['borda: gasta tudo', () => B.policyEdge('gastaTudo')], ['borda: passivo', () => B.policyEdge('passivo')]
];
let tot = 0, bad = 0;
for (const [nm, mk] of pols) for (const diff of ['protocolar', 'complexo', 'caotico']) {
  let mism = 0;
  for (let i = 0; i < N; i++) {
    const seed = 40000 + i;
    const a = JSON.stringify(B.playGame(Aref, diff, mk(seed), seed)), b = JSON.stringify(B.playGame(Anow, diff, mk(seed), seed));
    tot++; if (a !== b) { mism++; bad++; }
  }
  if (mism) console.log(nm.padEnd(18), diff.padEnd(10), 'divergem', mism + '/' + N);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${ref} × atual: ${tot} partidas comparadas, ${bad} divergências.`);
