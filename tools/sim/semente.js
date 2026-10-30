// Código da turma (L2.5 refeita). O documento pede uma semente definida pelo facilitador, para que todas as equipes da turma enfrentem a
// mesma sequência de choques e para que a mesma partida possa ser reproduzida. Esta bancada prova, com o motor real:
//   1. o código: só letras e dígitos contam, e um código vazio é jogo sem código;
//   2. o mesmo código dá o mesmo cenário (perfil, rotas candidatas, rota planejada, cúmplice) em qualquer dificuldade, qualquer que seja o
//      Math.random, e códigos diferentes sorteiam cenários com a mesma distribuição do jogo sem código;
//   3. o mesmo código com as mesmas decisões repete a partida inteira, e salvar e recarregar no meio dela não muda o que vem depois;
//   4. a carta de cada rodada é exatamente a da regra (sorteio próprio da rodada, vence a menor −ln(1 − u)/peso entre as que cabem), e por
//      isso equipes com políticas diferentes recebem a mesma carta sempre que ela cabe no estado das duas;
//   5. o save só aceita código e gerador coerentes;
//   6. com código, a nota média e o número de cartas por partida são os do jogo sem código (o código não muda o equilíbrio).
// Que sem código o jogo é o de antes, bit a bit, prova o comparar.js contra a versão anterior (zero divergência).
//   node tools/sim/semente.js [N]      → N partidas por política e dificuldade (padrão 120); sai com código 1 se alguma verificação falhar
const B = require('./bots'); const E = require('./experts'); const T = require('./tiers'); const { mulberry32 } = require('./engine-loader');
const N = +process.argv[2] || 120;
const A = B.load(1);
let fails = 0, checks = 0;
const ok = (cond, msg, extra) => { checks++; if (!cond) { fails++; if (fails <= 25) console.log('  ✗ FALHA: ' + msg + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); } return !!cond; };
const sec = t => console.log('\n## ' + t);
const DIFFS = ['protocolar', 'complexo', 'caotico'];
const POLS = [['negociadora', () => B.policyNegociador()], ['agressiva', () => B.policyAgressivo(3, .5)], ['equilibrada', () => B.policyEquilibrado()],
  ['especialista', () => E.expert('paz')], ['novato', s => T.novato(s)], ['fuzz', s => B.policyFuzz(mulberry32(s + 5))]];
const pc = (n, d) => (100 * n / (d || 1)).toFixed(1) + '%';
const cenario = G => JSON.stringify([G.profile, G.routes, G.route, G.accomplice, G.frame]);

/* Uma partida inteira, rodada a rodada, guardando o que a carta de cada rodada precisa para ser conferida.
   math: semente do Math.random (as decisões da política seguem a semente da partida). corte: rodada em que a partida é salva, recarregada
   do save e o Math.random trocado. Com código, nem o Math.random nem o save podem mudar o resto. */
function jogar(diff, mkPol, seed, code, math = seed, corte = 0) {
  A.reseed(math); A.newGame(diff, { code }); const pol = mkPol(seed);
  pol.setup(A); A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound();
  const rod = []; let guard = 0;
  while (!A.G.end && guard++ < 12) {
    if (corte && A.G.round === corte) { A.saveGame(); const s = A.loadSave(); ok(!!s, 'o save do meio da partida não voltou', { diff, seed, code }); if (s) A.G = s; A.reseed(seed + 7777); }
    const G = A.G; G.stage = 'panel';
    const quieta = G.quietRound === G.round, usadas = G.usedEvents.slice();
    pol.decide(A, G.round);
    const r = A.resolveDecisions(), ev = r && r.event || null;
    const x = { r: G.round, quieta, sorteou: !G.R.interv && G.round >= 2 && !quieta, ev };
    if (x.sorteou) x.esperada = esperada(G, usadas);   // o estado agora é o do instante do sorteio (drawEvent é a última coisa antes do retorno)
    rod.push(x);
    if (ev) {
      const idx = pol.event ? pol.event(A, ev) : B.eventChoice(A, ev, pol.style);
      if (!A.chooseEvent(idx)) { const n = A.EVENT_FX[ev].choices.length; let feito = false; for (let i = 0; i < n && !feito; i++) feito = A.chooseEvent(i); }
    }
    if (!A.G.end) A.startRound();
  }
  const G = A.G;
  return { rod, nota: G.score.total, cartas: G.usedEvents.length, fim: JSON.stringify([G.end, G.score, G.hostages, G.stk, G.credits, G.vault, G.agit, G.usedEvents, G.log.map(R => R.lines.map(l => l.text))]) };
}
/* A regra da carta refeita do zero, fora do motor: o mesmo sorteio da rodada, os mesmos pesos, a menor chave entre as que cabem. */
function esperada(G, usadas) {
  if (!G.code) return undefined;
  const st = { s: A.hashCode(G.code + '/carta/' + G.round) }, u0 = A.mulberry(st);
  if (u0 > A.DIFF[G.diff].evChance) return null;
  const pool = A.EVENT_DEFS.filter(e => !usadas.includes(e.id) && A.EVENT_FX[e.id].elig(G));
  if (!pool.length) return null;
  const dep = A.deployed(), avgFat = dep.length ? dep.reduce((s, id) => s + (G.fat[id] || 0), 0) / dep.length : 0;
  const w = x => (x.id === 'heli' || x.id === 'live') && G.media > 60 ? 2 : x.id === 'fadiga' ? (avgFat >= 2 ? 3 : .5) : x.id === 'deadline' ? 4 : x.id === 'prefeito' && G.round >= 4 ? 2 : 1;
  const u = A.EVENT_DEFS.map(() => A.mulberry(st));
  let best = null, bk = Infinity;
  pool.forEach(e => { const k = -Math.log(1 - u[A.EVENT_DEFS.indexOf(e)]) / w(e); if (k < bk) { bk = k; best = e.id; } });
  return best;
}

/* ---------- 1. o código ---------- */
sec('1. O código');
const iguais = ['hbs turma a', 'HBS-Turma-A', 'HBSTURMAA', '  h.b.s/turma a '].map(A.normCode);
ok(iguais.every(c => c === 'HBSTURMAA'), 'variações de escrita deveriam dar o mesmo código', iguais);
ok(A.normCode('Ação 1') === 'ACAO1', 'acento não conta', A.normCode('Ação 1'));
ok([undefined, null, '', '   ', '---', '!!'].every(c => A.normCode(c) === null), 'código vazio deveria ser jogo sem código');
ok(A.normCode('A'.repeat(30)).length === 16, 'o código tem no máximo 16 caracteres');
A.reseed(5); A.newGame('complexo', { code: '  ' }); ok(A.G.code === null && A.G.rng === null, 'código em branco deveria jogar com Math.random');
console.log('  variações de escrita, acentos, código vazio e limite de tamanho conferidos');

/* ---------- 2. cenário ---------- */
sec('2. O mesmo código, o mesmo cenário');
let mesmos = 0;
for (let i = 0; i < 300; i++) {
  const c = 'TURMA' + i, vistos = new Set();
  DIFFS.forEach((d, j) => { A.reseed(1000 + 31 * i + j); A.newGame(d, { code: c }); vistos.add(cenario(A.G)); });
  A.reseed(99); A.newGame('complexo', { code: c.toLowerCase() }); vistos.add(cenario(A.G));
  if (ok(vistos.size === 1, 'o mesmo código deu cenários diferentes', { c, vistos: [...vistos] })) mesmos++;
}
console.log(`  300 códigos × 3 dificuldades × Math.random diferente (e o código em minúsculas): cenário idêntico em ${mesmos}/300`);
// distribuição: perfis e rota planejada com código (2.000 códigos) contra sem código (2.000 sementes)
const freq = (comCodigo) => { const f = { p: {}, r: {} }; for (let i = 0; i < 2000; i++) { A.reseed(50000 + i); A.newGame('complexo', comCodigo ? { code: 'C' + i } : {}); f.p[A.G.profile] = (f.p[A.G.profile] || 0) + 1; f.r[A.G.route] = (f.r[A.G.route] || 0) + 1; } return f; };
const fc = freq(true), fs = freq(false);
const linha = (k, o) => Object.keys(Object.assign({}, fc[k], fs[k])).sort().map(x => `${x} ${pc(fc[k][x] || 0, 2000)}/${pc(fs[k][x] || 0, 2000)}`).join(' · ');
const desvio = k => Math.max(...Object.keys(Object.assign({}, fc[k], fs[k])).map(x => Math.abs((fc[k][x] || 0) - (fs[k][x] || 0)) / 2000));
console.log('  perfil do líder (com código / sem código): ' + linha('p'));
console.log('  rota planejada (com código / sem código): ' + linha('r'));
ok(desvio('p') < .05 && desvio('r') < .05, 'a distribuição com código deveria ser a mesma do jogo sem código (desvio < 5 pontos)', { p: desvio('p'), r: desvio('r') });
const distintos = new Set(); for (let i = 0; i < 200; i++) { A.newGame('complexo', { code: 'X' + i }); distintos.add(JSON.stringify([A.G.profile, A.G.route])); }
ok(distintos.size >= 20, 'códigos diferentes deveriam dar cenários variados', distintos.size);
console.log(`  200 códigos diferentes dão ${distintos.size} combinações distintas de perfil e rota planejada (de 28 possíveis)`);

/* ---------- 3 e 4. partidas ---------- */
sec('3. A mesma partida, inteira, e o save no meio dela');
let repet = 0, salvas = 0, total = 0, regra = 0, rodadasRegra = 0;
const porCodigo = {}, notas = { com: {}, sem: {} };   // código → dificuldade → política → rodadas; notas e cartas por dificuldade e política
const anota = (lado, d, nm, x) => { const k = d + '|' + nm; (notas[lado][k] = notas[lado][k] || []).push(x); };
for (const d of DIFFS) for (const [nm, mk] of POLS) for (let i = 0; i < N; i++) {
  const c = 'HBS' + i, seed = 70000 + i;
  const a = jogar(d, mk, seed, c), b = jogar(d, mk, seed, c, seed + 1), s = jogar(d, mk, seed, c, seed + 2, 2 + (i % 4));
  total++;
  if (ok(a.fim === b.fim, 'mesmo código e mesmas decisões deveriam repetir a partida', { d, nm, c })) repet++;
  if (ok(a.fim === s.fim, 'salvar e recarregar no meio da partida mudou o resto dela', { d, nm, c })) salvas++;
  a.rod.filter(x => x.sorteou).forEach(x => { rodadasRegra++; if (ok(x.ev === x.esperada, 'a carta da rodada não é a da regra', { d, nm, c, r: x.r, ev: x.ev, esperada: x.esperada })) regra++; });
  ((porCodigo[c] = porCodigo[c] || {})[d] = porCodigo[c][d] || {})[nm] = a.rod;
  anota('com', d, nm, a);
}
console.log(`  ${total} partidas (${POLS.length} políticas × 3 dificuldades × ${N} códigos), cada uma jogada com outro Math.random: idênticas em ${repet}/${total}`);
console.log(`  as mesmas partidas salvas e recarregadas do save numa rodada entre a 2 e a 5, com o Math.random trocado: idênticas em ${salvas}/${total}`);

sec('4. As mesmas cartas para a turma inteira');
console.log(`  ${rodadasRegra} rodadas com sorteio de carta: a carta (ou a falta dela) é exatamente a da regra em ${regra}/${rodadasRegra}`);
// equipes diferentes, mesmo código: em cada rodada que as duas sortearam, a mesma carta?
const comparar = (fonte) => {
  let pares = 0, mesmoHa = 0, ambas = 0, mesmaCarta = 0;
  for (const c in fonte) for (const d in fonte[c]) {
    const nms = Object.keys(fonte[c][d]);
    for (let x = 0; x < nms.length; x++) for (let y = x + 1; y < nms.length; y++) {
      const ra = fonte[c][d][nms[x]], rb = fonte[c][d][nms[y]];
      ra.forEach(p => { const q = rb.find(z => z.r === p.r); if (!q || !p.sorteou || !q.sorteou) return; pares++; if (!!p.ev === !!q.ev) mesmoHa++; if (p.ev && q.ev) { ambas++; if (p.ev === q.ev) mesmaCarta++; } });
    }
  }
  return { pares, mesmoHa, ambas, mesmaCarta };
};
const sem = {};
for (const d of DIFFS) for (const [nm, mk] of POLS) for (let i = 0; i < N; i++) { const k = 'S' + i, x = jogar(d, mk, 70000 + i); ((sem[k] = sem[k] || {})[d] = sem[k][d] || {})[nm] = x.rod; anota('sem', d, nm, x); }
const cc = comparar(porCodigo), cs = comparar(sem);
console.log(`  pares de equipes na mesma rodada (políticas diferentes): ${cc.pares} com código, ${cs.pares} sem código`);
console.log(`  as duas recebem carta, ou as duas não recebem: ${pc(cc.mesmoHa, cc.pares)} com código · ${pc(cs.mesmoHa, cs.pares)} sem código (mesma semente)`);
console.log(`  quando as duas recebem carta, é a mesma: ${pc(cc.mesmaCarta, cc.ambas)} com código · ${pc(cs.mesmaCarta, cs.ambas)} sem código`);
console.log('  (com código, a carta só difere quando a da vez já saiu para uma das equipes ou não cabe no estado dela; a chance de haver carta só');
console.log('  difere quando uma das equipes já não tem carta possível, ou quando uma carta pesada da rodada anterior lhe deu uma rodada de respiro)');
ok(cc.mesmoHa / cc.pares > .97, 'com código, a chance de haver carta deveria ser a mesma para a turma', cc);
ok(cc.mesmaCarta / cc.ambas > .85, 'com código, as equipes deveriam receber a mesma carta na grande maioria das rodadas', cc);
ok(cs.mesmaCarta / cs.ambas < .3, 'sem código, as cartas não deveriam coincidir (a bancada perdeu a referência)', cs);

/* ---------- 5. save ---------- */
sec('5. O save só aceita código e gerador coerentes');
A.reseed(3); A.newGame('complexo', { code: 'HBS1' }); B.policyNegociador().setup(A); A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound(); A.G.stage = 'panel';
A.saveGame(); const base = JSON.parse(A.store[A.SAVE_KEY]);
const tenta = (rotulo, f, esperado) => { const s = JSON.parse(JSON.stringify(base)); f(s); ok(A.validSave(s) === esperado, rotulo, { esperado }); };
tenta('save com código válido', () => {}, true);
tenta('save sem código (os dois nulos)', s => { s.code = null; s.rng = null; }, true);
tenta('código sem gerador', s => { s.rng = null; }, false);
tenta('gerador sem código', s => { s.code = null; }, false);
tenta('código fora do formato', s => { s.code = 'hbs 1'; }, false);
tenta('gerador com estado fracionário', s => { s.rng.s = 1.5; }, false);
tenta('gerador com estado em texto', s => { s.rng.s = '12'; }, false);
tenta('gerador fora de 32 bits', s => { s.rng.s = 2 ** 40; }, false);
const antigo = JSON.parse(JSON.stringify(base)); delete antigo.code; delete antigo.rng; A.migrateSave(antigo);
ok(antigo.code === null && antigo.rng === null && A.validSave(antigo), 'um save de antes do código deveria continuar valendo, sem código');
console.log('  8 saves adulterados ou coerentes e um save de antes do código conferidos');

/* ---------- 6. equilíbrio ---------- */
sec('6. O código não muda o equilíbrio');
const media = a => a.reduce((t, x) => t + x, 0) / (a.length || 1);
console.log('  nota média e cartas por partida, com código / sem código (' + N + ' partidas por célula)');
for (const d of DIFFS) {
  const cel = POLS.map(([nm]) => { const c = notas.com[d + '|' + nm], s = notas.sem[d + '|' + nm]; return `${nm} ${media(c.map(x => x.nota)).toFixed(1)}/${media(s.map(x => x.nota)).toFixed(1)}`; });
  const todas = lado => POLS.flatMap(([nm]) => notas[lado][d + '|' + nm]);
  const nc = media(todas('com').map(x => x.nota)), ns = media(todas('sem').map(x => x.nota)), cc2 = media(todas('com').map(x => x.cartas)), cs2 = media(todas('sem').map(x => x.cartas));
  console.log(`  ${d.padEnd(10)} todas ${nc.toFixed(1)}/${ns.toFixed(1)} · cartas ${cc2.toFixed(2)}/${cs2.toFixed(2)} · ${cel.join(' · ')}`);
  ok(Math.abs(nc - ns) < 2.5, `${d}: a nota média com código deveria ser a do jogo sem código (diferença < 2,5)`, { nc, ns });
  ok(Math.abs(cc2 - cs2) < .25, `${d}: o número de cartas por partida com código deveria ser o do jogo sem código`, { cc2, cs2 });
}

console.log(`\n${checks} verificações, ${fails} falhas.`);
process.exit(fails ? 1 : 0);
