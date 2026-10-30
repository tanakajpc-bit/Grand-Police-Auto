// L2.1 refeita (auditoria do motor de resolução): a contabilidade das baixas, conferida pessoa por pessoa.
// O audit.js já cobre as fórmulas (faixas, curvas, pesos, cenários extremos). Esta bancada cobre o que ele não alcança:
// quem se fere, quem morre e por quê, em cada caminho do motor que mexe com reféns.
//   1 "Entrada limpa" nunca mata ninguém na própria entrada (a variante é o que a história, o jornal e o selo contam)
//   2 Morte por agravamento só entre quem já estava ferido, e o caso de Dona Lúcia (estado crítico) não conta a mesma morte duas vezes
//   3 A entrada não fere nem mata quem já tinha sido libertado antes dela
//   4 Depois de qualquer desfecho, as contagens fecham com a lista nominal dos 17 reféns
// uso: node tools/sim/motor.js [N]        PERI_SRC=<pasta src de outra versão> mede essa versão (o "antes" da correção)
const B = require('./bots');
const A = B.load(1);
const N = +process.argv[2] || 4000;
const DIFFS = ['protocolar', 'complexo', 'caotico'];
const TEAMS = [['renata', 'paulo', 'marcos'], ['andre', 'diego', 'lucas', 'renata'], ['paulo', 'carla', 'fernanda'], [], ['marcos', 'lucas', 'sofia', 'camila', 'diego']];
let fails = 0, checks = 0;
const out = [];
const C = (ok, id, det) => { checks++; if (!ok) { fails++; if (out.filter(x => x.id === id).length < 3) out.push({ id, det }); } return ok; };
const tally = {};
const conta = (k, v = 1) => { tally[k] = (tally[k] || 0) + v; };

/** Cerco já aberto, no começo da rodada `round`, sem carta de evento nessa rodada. */
function cena(seed, { diff, team, gear = [], round = 3 }) {
  A.reseed(seed); A.newGame(diff); const G = A.G;
  team.forEach(id => B.hire(A, id)); gear.forEach(e => B.buy(A, e));
  A.autoPlace(); A.confirmPerimeter(); G.phase = 'siege'; G.round = round - 1; G.quietRound = round;
  A.startRound(); G.stage = 'panel'; G.queue = [];
  return G;
}
const viva = h => h.st !== 'dead';
/** Fere `n` reféns que estão lá dentro, na contagem e na lista nominal (como o motor faria, sem sortear quem). */
function fere(G, ids) { ids.forEach(id => { const h = G.hl.find(x => x.id === id); if (h && h.in && h.st === 'ok') { h.st = 'hurt'; G.hostages.hurt++; } }); }
function liberta(G, n) {
  const c = G.hl.filter(h => h.in && h.st === 'ok').slice(-n);
  c.forEach(h => { h.in = false; G.hostages.inside--; G.hostages.freed++; });
  return c.map(h => h.id);
}
function fecha(G, tag) {
  const H = G.hostages, L = G.hl;
  C(H.inside + H.freed === 17 && H.hurt + H.dead <= 17 && [H.inside, H.freed, H.hurt, H.dead].every(v => Number.isInteger(v) && v >= 0), 'contagens válidas', `${tag} ${JSON.stringify(H)}`);
  C(L.filter(h => h.st === 'dead').length === H.dead && L.filter(h => h.st === 'hurt').length === H.hurt && L.filter(h => !h.in).length === H.freed, 'lista nominal = contagens', `${tag} ${JSON.stringify(H)} × lista ${L.filter(h => h.st === 'dead').length}/${L.filter(h => h.st === 'hurt').length}/${L.filter(h => !h.in).length}`);
}

/* ---------- 1. Entrada limpa sem morte na entrada ---------- */
for (let i = 0; i < N; i++) {
  const diff = DIFFS[i % 3], G = cena(11000 + i, { diff, team: TEAMS[i % TEAMS.length], gear: i % 4 === 0 ? ['kit'] : i % 4 === 1 ? ['escudo'] : [], round: 2 + (i % 6) });
  G.agit = (i * 37) % 101;   // a regra de morte extra só vale com agitação acima de 70: varre a faixa inteira
  const d0 = G.hostages.dead, forced = i % 5 === 0;
  const o = forced ? A.doUltimatum() : A.doIntervention(false);
  const v = o.type === 'prazo' ? o.sub : o.variant;
  if (!v) continue;   // ultimato aceito: sem entrada
  conta('entradas'); conta('entrada ' + v);
  A.syncHL(null);
  if (v === 'limpa') C(G.hostages.dead === d0 && (o.newDead || 0) === 0, 'entrada limpa não mata ninguém na entrada', `${diff} s${11000 + i} agit ${G.agit} ${forced ? 'ultimato' : 'intervenção'} → ${o.newDead} morto(s)`);
  if ((o.newDead || 0) > 0) C(v !== 'limpa', 'com morte na entrada, a variante não é "limpa"', `${v}`);
  fecha(G, `entrada ${diff} s${11000 + i}`);
}

/* ---------- 2. Agravamento e Dona Lúcia ---------- */
for (let i = 0; i < N; i++) {
  const diff = DIFFS[i % 3], G = cena(21000 + i, { diff, team: [['renata', 'paulo', 'marcos'], ['paulo', 'carla'], ['diego', 'lucas', 'renata']][i % 3], round: 2 + (i % 4) });
  const outros = G.hl.filter(h => h.in && h.st === 'ok' && h.id !== 'lucia').slice(0, i % 4).map(h => h.id);
  fere(G, ['lucia', ...outros]);
  G.pendingDeath = { left: 1, p: .40, who: 'lucia' };
  G.agit = 20 + (i % 40);   // longe da ação desesperada: só o agravamento e o estado crítico podem matar nesta rodada
  G.vault = 10;
  const antes = Object.fromEntries(G.hl.map(h => [h.id, h.st])), h0 = G.hostages.hurt, d0 = G.hostages.dead;
  A.resolveDecisions();
  if (G.stage === 'event') { const n = A.EVENT_FX[G.pendingEvent].choices.length; let ok = false; for (let k = 0; k < n && !ok; k++) ok = A.chooseEvent(k); }
  const novos = G.hl.filter(h => h.st === 'dead' && antes[h.id] !== 'dead');
  const linhas = (G.R.lines || []).map(l => l.text).join(' | ');
  conta('rodadas com estado crítico'); if (novos.length) conta('rodadas com morte'); if (novos.length > h0) conta('morte de quem não estava ferido');
  if (!G.end) {
    C(novos.length <= h0 && G.hostages.dead - d0 <= h0, 'só morre de agravamento quem já estava ferido', `${diff} s${21000 + i}: ${h0} ferido(s) no início, ${novos.length} morte(s): ${novos.map(h => h.id + ' (' + antes[h.id] + ')').join(', ')}`);
    C(novos.every(h => antes[h.id] === 'hurt'), 'quem morre de agravamento estava ferido', `${diff} s${21000 + i}: ${novos.map(h => h.id + ' estava ' + antes[h.id]).join(', ')}`);
    const lucia = G.hl.find(h => h.id === 'lucia');
    if (/se estabilizou/.test(linhas)) C(lucia.st !== 'dead', 'quando o texto diz que Dona Lúcia se estabilizou, ela está viva', `${diff} s${21000 + i}: ${linhas.slice(0, 200)}`);
    if (/Lúcia Andrade, 67 anos, não resistiu/.test(linhas)) C(lucia.st === 'dead', 'quando o texto diz que Dona Lúcia morreu, é ela quem morre', `${diff} s${21000 + i}`);
  }
  fecha(G, `crítico ${diff} s${21000 + i}`);
}

/* ---------- 3. A entrada não alcança quem já saiu ---------- */
for (let i = 0; i < N; i++) {
  const diff = DIFFS[i % 3], G = cena(31000 + i, { diff, team: TEAMS[i % TEAMS.length], round: 3 + (i % 4) });
  const fora = liberta(G, 1 + (i % 4));   // de 1 a 4 libertados antes: o máximo que o jogo permite (a troca ou a contraproposta, 3, e a troca humanitária, 1)
  const dentro = G.hl.filter(h => h.in && h.st === 'ok').map(h => h.id);
  fere(G, dentro.slice(0, Math.min(dentro.length - 1, (i * 7) % 13)));   // e de 0 a 12 feridos lá dentro (tiroteio, infiltrado, apagão, cativeiro, ações desesperadas)
  G.agit = 60 + (i % 41);
  const o = A.doIntervention(i % 3 === 0);
  A.syncHL(null);
  conta('entradas com libertados');
  const atingidos = fora.filter(id => G.hl.find(h => h.id === id).st !== 'ok');
  C(!atingidos.length, 'a entrada não fere nem mata quem já tinha saído', `${diff} s${31000 + i} ${o.variant}: ${atingidos.join(', ')} (libertados antes) agora ${atingidos.map(id => G.hl.find(h => h.id === id).st).join(', ')}`);
  fecha(G, `libertados ${diff} s${31000 + i}`);
}

/* ---------- 3b. Na fuga e no ultimato aceito, o ferido da saída estava lá dentro ---------- */
for (let i = 0; i < N; i++) {
  const diff = DIFFS[i % 3], G = cena(36000 + i, { diff, team: TEAMS[i % TEAMS.length], round: 3 + (i % 4) });
  const fora = liberta(G, 1 + (i % 4));
  const dentro = G.hl.filter(h => h.in && h.st === 'ok').map(h => h.id);
  fere(G, i % 2 ? dentro : dentro.slice(0, dentro.length - 1));   // todos (ou todos menos um) os que ficaram lá dentro já feridos
  G.agit = 50;
  const o = i % 3 === 0 ? A.doUltimatum() : A.doEscape('desespero');
  A.syncHL(null);
  conta('saídas com libertados');
  const atingidos = fora.filter(id => G.hl.find(h => h.id === id).st !== 'ok');
  C(!atingidos.length, 'na fuga ou no ultimato, o ferido da saída estava lá dentro', `${diff} s${36000 + i} ${o.type}:${o.variant}: ${atingidos.join(', ')} (libertados antes) agora feridos`);
  fecha(G, `saída ${diff} s${36000 + i}`);
}

/* ---------- 4. Partidas inteiras: contagens fecham no fim ---------- */
const POLS = [() => B.policyEquilibrado(), () => B.policyNegociador(), () => B.policyAgressivo ? B.policyAgressivo() : B.policyEquilibrado()];
for (let i = 0; i < N; i++) {
  const diff = DIFFS[i % 3]; B.playGame(A, diff, POLS[i % POLS.length](), 41000 + i);
  conta('partidas'); fecha(A.G, `partida ${diff} s${41000 + i}`);
}

console.log('## Baixas, pessoa por pessoa (L2.1)');
console.log('  ' + Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join(' · '));
out.forEach(x => console.log(`✗ ${x.id}\n    ${x.det}`));
console.log(`\n${checks} verificações, ${fails} falhas.`);
process.exit(fails ? 1 : 0);
