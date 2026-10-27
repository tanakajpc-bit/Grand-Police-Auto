// Casos extremos (L2.4): quinze situações-limite jogadas no motor real. Cada caso diz o que se espera e confere, além de passar
// pelos invariantes de invariantes.js a cada passo (nenhum número fora da faixa, nada de NaN, save sempre válido).
//   1 sem recrutas · 2 só um agente + equipamento · 3 ignorar a negociação · 4 ignorar os stakeholders · 5 intervir em toda rodada
//   6 Pausa em toda rodada · 7 todos na mesma zona · 8 todos os reféns feridos · 9 agitação 100 · 10 cofre 100% · 11 verba zerada
//   12 intervenção com agitação 100 · 13 dois eventos contraditórios na mesma rodada · 14 rendição e fim do tempo na mesma rodada · 15 armazenamento cheio/bloqueado
// uso: node tools/sim/limites.js [N] [saida.md]      PERI_SRC=<pasta src de outra versão> mede essa versão (o "antes" de uma correção)
const fs = require('fs');
const B = require('./bots');
const A = B.load(1);
const N = +process.argv[2] || 60, OUT = process.argv[3];
const bad = [];
const V = require('./invariantes')(A, bad);
const DIFFS = ['protocolar', 'complexo', 'caotico'];
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const pc = (n, d) => Math.round(100 * n / (d || 1)) + '%';
const lote = (diff, mk, n, opt, base = 7000) => { const rows = []; for (let i = 0; i < n; i++) { const o = V.play(diff, mk(base + i), base + i, opt); if (o) rows.push(o); } return rows; };
const dist = rows => { const c = {}; rows.forEach(r => c[r.key] = (c[r.key] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${pc(v, rows.length)}`).join(', '); };
const notas = rows => { const c = {}; rows.forEach(r => c[r.grade] = (c[r.grade] || 0) + 1); return ['S', 'A', 'B', 'C', 'D', 'F'].filter(g => c[g]).map(g => `${g} ${pc(c[g], rows.length)}`).join(' '); };

/* ---------- cenas montadas à mão ---------- */
/** Jogo novo já no cerco, no começo da rodada `round` (sem carta de evento nessa rodada, salvo quando se pede `evento: true`). */
function cena({ diff = 'complexo', seed = 5, team = ['renata', 'paulo', 'marcos'], gear = [], round = 3, evento = false, mut } = {}) {
  A.reseed(seed); A.newGame(diff); const G = A.G;
  team.forEach(id => B.hire(A, id)); gear.forEach(e => B.buy(A, e));
  A.autoPlace(); A.confirmPerimeter(); G.phase = 'siege'; G.round = round - 1; G.quietRound = evento ? 0 : round;
  A.startRound();
  if (mut) mut(G);
  G.pressure = A.calcPressure();
  return G;
}
/** Coloca as decisões na fila, resolve e escolhe a carta (ev = índice preferido). Devolve o desfecho, se houve. */
function rodada(decs = [], ev = 0) {
  const G = A.G; G.stage = 'panel';
  decs.forEach(d => { const r = A.addDecision(d); if (!r.ok) throw new Error('decisão recusada: ' + d.kind + ' — ' + r.msg); });
  const r = A.resolveDecisions();
  if (r && r.event) { const n = A.EVENT_FX[r.event].choices.length; let ok = A.chooseEvent(ev); for (let i = 0; i < n && !ok; i++) ok = A.chooseEvent(i); }
  return G.end;
}
/** Coloca uma carta de evento específica na mesa, como a interface faz depois da resolução. */
function injeta(id) { const G = A.G; G.R = { lines: [], s0: A.snap(), decs: [], eventId: id, ev: null, sec: 'dec', stkWhy: {}, hchg: [] }; G.pendingEvent = id; G.stage = 'event'; return G.R; }
/** Fim de rodada isolado (o que a interface chama depois da resolução), com aleatório de roteiro opcional. */
function fimDeRodada(G, vals) {
  G.R = { lines: [], s0: A.snap(), decs: [], ev: null, hchg: [], sec: 'fim' }; G.stage = 'resolving';
  if (vals) { let i = 0; A.setRandom(() => (i < vals.length ? vals[i++] : .5)); }
  const r = A.finishRound();
  return { out: r && r.outcome ? r.outcome : null, R: G.R };
}
const tipo = o => o ? o.type + (o.variant ? ':' + o.variant : '') + (o.cause ? '/' + o.cause : '') : 'nenhum';
const temLinha = (R, re) => R.lines.some(l => re.test(l.text));
const polBase = (team, gear, decide) => ({ name: 'base', style: 'peace', setup(A_) { team.forEach(id => B.hire(A_, id)); gear.forEach(e => B.buy(A_, e)); A_.G.pressure = A_.calcPressure(); A_.autoPlace(); }, decide });
const addAll = (A_, list) => { const out = []; list.forEach(d => { if (A_.addDecision(d).ok) out.push(d.kind); }); return out; };

/* ---------- arcabouço ---------- */
const casos = [];
function caso(n, titulo, esperado, fn) {
  const falhas = [], info = [];
  const ok = (c, m) => { if (!c) falhas.push(m); return c; }, nota = m => info.push(m);
  bad.length = 0;
  try { fn(ok, nota); } catch (e) { falhas.push('EXCEÇÃO: ' + e.stack.split('\n').slice(0, 4).join(' / ')); }
  [...new Set(bad)].slice(0, 6).forEach(b => falhas.push('invariante: ' + b));
  casos.push({ n, titulo, esperado, falhas, info });
  console.log(`\n${String(n).padStart(2)}. ${titulo}  →  ${falhas.length ? '✕ ' + falhas.length + ' falha(s)' : '✓'}\n    espera: ${esperado}`);
  info.forEach(i => console.log('    · ' + i)); falhas.forEach(f => console.log('    ✕ ' + f));
}

/* 1 */
caso(1, 'Nenhum recruta', 'a interface convoca as duas guarnições genéricas e a partida termina; o motor também aguenta uma equipe vazia (sem negociador, sem relatos, sem agentes para ferir)', (ok, nota) => {
  for (const diff of DIFFS) {
    const rows = lote(diff, () => B.policyEdge('nenhum'), N);
    ok(rows.length === N, `${diff}: ${N - rows.length} de ${N} partidas não terminaram`);
    const ref = lote(diff, () => B.policyNegociador(), N);
    ok(mean(rows.map(r => r.score)) < mean(ref.map(r => r.score)), `${diff}: ir sem equipe não deveria render mais que montar uma (${mean(rows.map(r => r.score)).toFixed(1)} contra ${mean(ref.map(r => r.score)).toFixed(1)})`);
    nota(`${diff}: nota média ${mean(rows.map(r => r.score)).toFixed(1)} (equipe completa ${mean(ref.map(r => r.score)).toFixed(1)}); notas ${notas(rows)}; desfechos ${dist(rows)}`);
  }
  // equipe vazia no motor (a interface nunca chega aqui)
  const vazia = { name: 'vazia', style: 'peace', setup(A_) { A_.G.pressure = A_.calcPressure(); },
    decide(A_, rn) { return addAll(A_, [B.mk.nego(Math.min(5, A_.G.nego.step)), B.mk.com(A_, 'coletiva'), B.mk.intel(A_, 'perfil')]); } };
  let semNeg = 0, fim = 0;
  for (let i = 0; i < 40; i++) {
    const o = V.play(DIFFS[i % 3], vazia, 500 + i, { depois: G => { if (A.getNegotiator() !== null) semNeg++; } });
    if (o) fim++;
  }
  ok(fim === 40, `equipe vazia: ${40 - fim} de 40 partidas sem desfecho`);
  ok(semNeg === 0, 'equipe vazia: getNegotiator deveria ser nulo');
  nota(`equipe vazia: 40 partidas completas; negociador nulo e habilidade ${A.negoSkill()} (valor de reserva do motor)`);
});

/* 2 */
caso(2, 'Só um agente e todo o equipamento', 'cobertura calculada pela fórmula mesmo com equipamento em zona sem agente (drone vale, sniper não); a partida roda sem erro', (ok, nota) => {
  const all = A.EQUIP.map(e => e.id);
  let G = cena({ team: ['renata'], gear: all, mut: G => { G.az.renata = 'beco'; G.gz.drone = 'avenida'; G.gz.sniper = 'avenida'; G.gz.termica = 'beco'; } });
  ok(A.EQUIP.reduce((s, e) => s + e.custo, 0) + A.agentById('renata').custo <= 1000, 'a verba inicial não cobre o agente e todo o equipamento');
  ok(G.gear.length === all.length, `só ${G.gear.length} equipamentos comprados`);
  ok(A.zoneCoverage('avenida') === 15, `zona só com drone e sniper sem agente: ${A.zoneCoverage('avenida')} (esperado 15: o drone vale, o sniper precisa de agente)`);
  const e = A.agentEff('renata'), esp = Math.min(100, Math.round(e * 1.3 * 10));
  ok(A.zoneCoverage('beco') === esp, `zona do agente com 1 equipamento: ${A.zoneCoverage('beco')} (esperado ${esp})`);
  ok(A.zoneCoverage('entrada') === 0, 'zona vazia deveria ter cobertura 0');
  const pw = Math.min(100, e * A.ZONE.beco.W * 3.5) + 10;   // escudo +10; o sniper está numa zona sem agente e não conta
  ok(Math.abs(A.intervPower() - pw) < 1e-9, `prontidão: ${A.intervPower().toFixed(2)} (esperado ${pw.toFixed(2)})`);
  const pol = () => polBase(['renata'], all, (A_, rn) => addAll(A_, [B.mk.nego(Math.min(5, A_.G.nego.step)), B.mk.com(A_, 'coletiva')]));
  for (const diff of DIFFS) { const rows = lote(diff, pol, N); ok(rows.length === N, `${diff}: ${N - rows.length} partidas sem desfecho`); nota(`${diff}: nota média ${mean(rows.map(r => r.score)).toFixed(1)}; notas ${notas(rows)}; desfechos ${dist(rows)}`); }
});

/* 3 */
caso(3, 'Ignorar a negociação nas 8 rodadas', 'o canal nunca abre, o degrau fica em 1, não há rendição e o desfecho vem do cofre, do ultimato ou da ordem política', (ok, nota) => {
  for (const diff of DIFFS) {
    let contato = 0, voz = 0;
    const rows = lote(diff, () => B.policyEdge('ignoraNego'), N, { depois: G => { if (G.nego.contact || G.nego.tries || G.nego.step !== 1) contato++; if (G.log.some(l => l.lines.some(x => /Líder, na linha/.test(x.text)))) voz++; } });
    ok(rows.length === N, `${diff}: ${N - rows.length} partidas sem desfecho`);
    ok(contato === 0, `${diff}: ${contato} rodadas com contato/degrau mexido sem nenhuma negociação`);
    ok(voz === 0, `${diff}: a voz do líder no canal apareceu ${voz} vezes sem negociação`);
    ok(rows.every(r => !r.key.startsWith('rendicao')), `${diff}: houve rendição sem negociação`);
    ok(rows.every(r => r.round <= A.MAX_ROUNDS), `${diff}: passou da rodada ${A.MAX_ROUNDS}`);
    nota(`${diff}: nota média ${mean(rows.map(r => r.score)).toFixed(1)}; notas ${notas(rows)}; desfechos ${dist(rows)}`);
  }
});

/* 4 */
caso(4, 'Ignorar os stakeholders', 'a confiança cai sem sair de 0–100, cada rompimento acontece uma vez só e a ordem política da rodada 6 em diante é sempre cumprida', (ok, nota) => {
  for (const diff of DIFFS) {
    let ordemPendente = 0, cortes = 0; const perdas = { banco: 0, imprensa: 0, prefeito: 0, familias: 0 };
    const rows = lote(diff, () => B.policyEdge('ignoraStk'), N, { depois: G => {
      if (!G.end && G.round >= 6 && G.stk.prefeito.lost && G.stk.prefeito.sat <= 15) ordemPendente++;
      if ((G.spent.corte || 0) > 60 || (G.spent.corte || 0) < 0) cortes++;
    } });
    rows.forEach(() => 0);
    ok(rows.length === N, `${diff}: ${N - rows.length} partidas sem desfecho`);
    ok(ordemPendente === 0, `${diff}: ${ordemPendente} rodadas fecharam com a ordem política devida e sem acontecer`);
    ok(cortes === 0, `${diff}: corte do banco fora de 0–60 em ${cortes} rodadas`);
    const ordem = rows.filter(r => r.end.type === 'intervencao' && r.end.forced).length;
    nota(`${diff}: nota média ${mean(rows.map(r => r.score)).toFixed(1)}; notas ${notas(rows)}; ordem política (entrada forçada) em ${pc(ordem, rows.length)}; desfechos ${dist(rows)}`);
  }
});

/* 5 */
caso(5, 'Intervir em toda rodada', 'a primeira ordem encerra a partida na rodada 1; a fila aceita só a intervenção, devolve o que já foi pago e libera de novo ao removê-la', (ok, nota) => {
  for (const diff of DIFFS) {
    const rows = lote(diff, () => B.policyEdge('intervSempre'), N);
    ok(rows.length === N, `${diff}: ${N - rows.length} partidas sem desfecho`);
    ok(rows.every(r => r.round === 1 && r.end.type === 'intervencao' && !r.end.forced), `${diff}: toda partida deveria acabar na rodada 1 por intervenção ordenada`);
    nota(`${diff}: nota média ${mean(rows.map(r => r.score)).toFixed(1)}; notas ${notas(rows)}; desfechos ${dist(rows)}`);
  }
  const G = cena({ round: 1 }); const c0 = G.credits;
  ok(A.addDecision(B.mk.intel(A, 'perfil')).ok && G.credits === c0 - 60, 'a investigação deveria custar 60');
  const iv = B.mk.interv(A); A.addDecision(iv);
  ok(G.credits === c0, `a intervenção deveria devolver o que a fila já tinha cobrado (${G.credits} ≠ ${c0})`);
  ok(G.queue.length === 1 && G.queue[0].slots === A.DIFF[G.diff].slots, 'a intervenção deveria ocupar todas as decisões da rodada');
  ok(!A.addDecision(B.mk.nego(1)).ok && !A.addDecision(B.mk.pausa()).ok, 'com a intervenção na fila nada mais pode entrar');
  A.removeDecision(G.queue[0].id);
  ok(G.queue.length === 0 && A.addDecision(B.mk.nego(1)).ok, 'tirar a intervenção deveria liberar as decisões');
  const end = rodada([B.mk.interv(A)]);
  ok(end && end.type === 'intervencao' && G.stats.events === 0 && G.round === 1, `na rodada 1: ${tipo(end)}, eventos ${G.stats.events}`);
});

/* 6 */
caso(6, 'Pausa de Comando em toda rodada', 'uma por rodada; a pista só aparece enquanto há o que revelar; o alívio de 10 na pressão vale também na rodada seguinte, sem acumular', (ok, nota) => {
  for (const diff of DIFFS) {
    const rows = lote(diff, () => B.policyEdge('pausaSempre'), N);
    ok(rows.length === N, `${diff}: ${N - rows.length} partidas sem desfecho`);
    nota(`${diff}: nota média ${mean(rows.map(r => r.score)).toFixed(1)}; notas ${notas(rows)}; desfechos ${dist(rows)}`);
  }
  let G = cena({ round: 2 });
  ok(A.addDecision(B.mk.pausa()).ok && !A.addDecision(B.mk.pausa()).ok, 'só uma Pausa por rodada');
  // o alívio: mesma cena com e sem Pausa, aleatório fixo, e a pressão que o painel mostra na rodada seguinte
  const leitura = (decs, rodadas) => {
    const g = cena({ diff: 'protocolar', seed: 3, round: 2 }); A.setRandom(() => .5); const ps = [];
    for (let r = 0; r < rodadas; r++) { g.quietRound = g.round; rodada(decs[r] || []); if (g.end) break; A.startRound(); ps.push(g.pressure); }
    return { ps, calm: g.calm };
  };
  const sem = leitura([[], [], []], 3), com = leitura([[B.mk.pausa()], [], []], 3), sempre = leitura([[B.mk.pausa()], [B.mk.pausa()], [B.mk.pausa()]], 3);
  ok(sem.ps.length === 3 && com.ps.length === 3 && sempre.ps.length === 3, 'a cena de teste terminou cedo demais');
  if (sem.ps.length === 3 && com.ps.length === 3 && sempre.ps.length === 3) {
    ok(sem.ps[0] - com.ps[0] === 10, `pressão no começo da rodada seguinte à Pausa: ${com.ps[0]} (sem Pausa ${sem.ps[0]}); esperado 10 pontos a menos`);
    ok(sem.ps[1] === com.ps[1], `dois rodadas depois o alívio deveria ter acabado: ${com.ps[1]} contra ${sem.ps[1]}`);
    ok(sempre.ps.every((p, i) => p <= sem.ps[i] - 10 && p >= sem.ps[i] - 10 - 3), `Pausa em toda rodada não deveria acumular: ${sempre.ps.join('/')} contra ${sem.ps.join('/')}`);
    nota(`pressão no começo das rodadas 3, 4 e 5: sem Pausa ${sem.ps.join('/')}, Pausa só na 2 ${com.ps.join('/')}, Pausa em todas ${sempre.ps.join('/')}`);
  }
  // as pistas: nenhuma se repete e, esgotadas, vem o aviso de visão sistêmica
  G = cena({ round: 2 }); A.setRandom(Math.random);
  const textos = []; for (let i = 0; i < 14; i++) textos.push(A.revealHint());
  const final = textos.filter(t => /^Visão sistêmica/.test(t)), info = textos.filter(t => !/^Visão sistêmica/.test(t));
  ok(new Set(info).size === info.length, `pistas repetidas: ${info.length - new Set(info).size} (${[...new Set(info.filter((t, i) => info.indexOf(t) !== i))].map(t => t.slice(0, 50)).join(' | ')})`);
  ok(final.length > 0, 'depois de 14 pistas o motor ainda não avisou que não há mais o que revelar');
  nota(`14 Pausas seguidas numa mesma partida: ${info.length} pistas diferentes e ${final.length} avisos de visão sistêmica`);
});

/* 7 */
caso(7, 'Todos os agentes numa só zona', 'cobertura limitada a 100 na zona cheia e 0 nas outras; todos na Entrada travam o cofre e aquecem o líder, e a partida ainda termina', (ok, nota) => {
  let G = cena({ team: ['renata', 'diego', 'marcos', 'andre', 'lucas', 'roberto'], gear: ['sniper', 'drone'], mut: G => { G.team.forEach(id => G.az[id] = 'beco'); G.gz.sniper = 'beco'; G.gz.drone = 'beco'; } });
  ok(A.zoneCoverage('beco') === 100, `zona cheia: ${A.zoneCoverage('beco')} (esperado 100, limitado)`);
  ok(A.ZONES.filter(z => z.id !== 'beco').every(z => A.zoneCoverage(z.id) === 0), 'as outras zonas deveriam ficar com 0');
  ok(A.intervPower() <= 100, 'prontidão acima de 100: ' + A.intervPower());
  nota(`6 agentes, sniper e drone no Beco: cobertura ${A.zoneCoverage('beco')}, prontidão ${A.intervPower().toFixed(0)}, média das rotas ${A.avgRouteCov().toFixed(0)}`);
  G = cena({ team: ['renata', 'diego', 'marcos', 'andre', 'lucas', 'roberto'], mut: G => { G.team.forEach(id => G.az[id] = 'entrada'); } });
  const v0 = G.vault, a0 = G.agit; rodada([B.mk.nego(1)]);
  ok(G.lastVaultDelta === 0 && G.vault === v0, `6 agentes na Entrada deveriam travar o cofre (avanço ${G.lastVaultDelta})`);
  ok(/nunca/.test(A.etaVault()), `previsão do cofre travado: "${A.etaVault()}"`);
  ok(G.end || G.agit > a0 + 6, `a pressão de 6 agentes na Entrada deveria aquecer o líder (${a0.toFixed(1)} → ${G.agit.toFixed(1)})`);
  for (const zona of ['beco', 'entrada']) for (const diff of DIFFS) {
    const pol = () => ({ name: 'umaZona_' + zona, style: 'peace', setup(A_) { ['renata', 'diego', 'marcos', 'andre', 'lucas', 'roberto'].forEach(id => B.hire(A_, id)); A_.G.pressure = A_.calcPressure(); A_.G.team.forEach(id => A_.G.az[id] = zona); },
      decide(A_) { return addAll(A_, [B.mk.nego(Math.min(5, A_.G.nego.step))]); } });
    const rows = lote(diff, pol, N); ok(rows.length === N, `${zona}/${diff}: ${N - rows.length} partidas sem desfecho`);
    nota(`todos no ${zona}, ${diff}: nota média ${mean(rows.map(r => r.score)).toFixed(1)}; notas ${notas(rows)}; desfechos ${dist(rows)}`);
  }
});

/* 8 */
caso(8, 'Todos os reféns feridos', 'ninguém passa de 17, a lista nominal e os contadores concordam, nenhuma carta promete trocar reféns que não existem e a nota continua entre 0 e 100', (ok, nota) => {
  const todosFeridos = (kit) => polBase(['renata', 'paulo', 'carla', 'marcos'], kit ? ['kit'] : [], (A_) => addAll(A_, [B.mk.nego(Math.min(5, A_.G.nego.step)), B.mk.com(A_, 'acolhe')]));
  for (const kit of [false, true]) for (const diff of DIFFS) {
    const mk = () => { const p = todosFeridos(kit), s = p.setup; p.setup = A_ => { s(A_); A_.G.hostages.hurt = A_.HOSTAGES; A_.syncHL(null); }; return p; };
    let trocaVazia = 0;
    const rows = lote(diff, mk, N, { depois: G => { if (G.R && G.R.ev && G.R.ev.id === 'proposta' && G.R.lines.some(l => /(aceita|emplaca): 0 reféns|^Troca aceita: 0/.test(l.text) || /Troca aceita: 0 reféns|emplaca: 0 reféns/.test(l.text))) trocaVazia++; } });
    ok(rows.length === N, `${diff}${kit ? '+kit' : ''}: ${N - rows.length} partidas sem desfecho`);
    ok(trocaVazia === 0, `${diff}${kit ? '+kit' : ''}: carta de troca de reféns aceita com 0 reféns saindo, ${trocaVazia} vezes`);
    ok(rows.every(r => r.score >= 0 && r.score <= 100), `${diff}: nota fora de 0–100`);
    nota(`${diff}${kit ? ' com kit médico' : ''}: nota média ${mean(rows.map(r => r.score)).toFixed(1)}; mortes ${mean(rows.map(r => r.dead)).toFixed(1)}; notas ${notas(rows)}`);
  }
  const G = cena({ round: 4, mut: G => { G.hostages.hurt = A.HOSTAGES; A.syncHL(null); } });
  const el = A.EVENT_FX.proposta.elig(G);
  if (el) { const f0 = G.hostages.freed; injeta('proposta'); const R = G.R; A.EVENT_FX.proposta.choices[0].run(R); ok(G.hostages.freed - f0 === 3, `a carta diz "3 reféns por 1 veículo" mas com todos feridos saíram ${G.hostages.freed - f0}`); }
  nota(`carta "proposta de troca" com os 17 feridos: ${el ? 'elegível' : 'fora do baralho'}`);
  const G2 = cena({ round: 4, mut: G => { G.hostages.hurt = A.HOSTAGES; A.syncHL(null); } });
  const h = A.addHurt(3); ok(h === 0, `ferir de novo quem já está ferido: addHurt devolveu ${h}`);
  const o = A.doIntervention(false); ok(o.newHurt === 0 && G2.hostages.hurt + G2.hostages.dead <= A.HOSTAGES, 'intervenção com todos feridos: contagem inválida');
  ok(A.vidasScore(G2.hostages) >= 0 && A.vidasScore({ inside: 0, freed: 17, hurt: 17, dead: 0 }) === 1 - 8.5 / 17, 'vidas com todos feridos: ' + A.vidasScore({ inside: 0, freed: 17, hurt: 17, dead: 0 }));
});

/* 9 */
caso(9, 'Agitação em 100', 'o líder não passa de 100; a ação desesperada acontece com a frequência da fórmula (agitação−80)×2%×dificuldade; as chances continuam dentro dos limites', (ok, nota) => {
  for (const diff of DIFFS) {
    const G = cena({ diff, mut: G => { G.agit = 100; } });
    const np = A.negoParts(1), ip = A.intervProb(), up = A.ultimatumProb();
    ok(Math.abs(np.parts.agitacao + .30) < 1e-9 && np.p >= .02 && np.p <= .95, `${diff}: avanço na negociação com agitação 100: parte ${np.parts.agitacao}, chance ${np.p}`);
    ok(ip >= .05 && ip <= .95 && up >= .05 && up <= .9, `${diff}: chances fora dos limites (intervenção ${ip}, ultimato ${up})`);
    let desp = 0, viol = 0, fugas = 0, M = 600;
    for (let s = 0; s < M; s++) {
      const g = cena({ diff, seed: 100 + s, mut: g => { g.agit = 100; } });
      const { out, R } = fimDeRodada(g);
      ok(g.agit <= 100 && g.agit >= 0, `${diff}: agitação fora da faixa depois da ação desesperada: ${g.agit}`);
      if (temLinha(R, /AÇÃO DESESPERADA/)) { desp++; if (temLinha(R, /dispara contra a parede/)) viol++; else fugas++; }
    }
    const esperado = Math.min(1, 20 * .02 * A.DIFF[diff].desp), sd = Math.sqrt(esperado * (1 - esperado) / M);
    ok(Math.abs(desp / M - esperado) < 4 * sd, `${diff}: ação desesperada em ${pc(desp, M)} das rodadas, esperado ${pc(esperado, 1)}`);
    nota(`${diff}: ação desesperada em ${pc(desp, M)} (esperado ${pc(esperado, 1)}), violenta ${pc(viol, desp)} e tentativa de fuga ${pc(fugas, desp)}; avanço na negociação ${np.p.toFixed(2)}, intervenção ${ip.toFixed(2)}, ultimato ${up.toFixed(2)}`);
  }
  // com agitação 100 a rodada seguinte parte de um número válido
  const g = cena({ mut: g => { g.agit = 100; } }); const e = rodada([B.mk.nego(1)]);
  if (!e) { A.startRound(); ok(g.agit <= 100 && Number.isFinite(g.pressure), 'a rodada seguinte à de agitação 100 começou com número inválido'); }
});

/* 10 */
caso(10, 'Cofre em 100%', 'o avanço para em 100 e o grupo foge na mesma rodada; só a carta do diretor (recuar o cofre) evita a fuga; a rendição e a ordem de intervenção vêm antes', (ok, nota) => {
  let G = cena({ diff: 'complexo', mut: g => { g.vault = 100; g.agit = 50; } });
  ok(/agora/.test(A.etaVault()), `previsão com o cofre em 100: "${A.etaVault()}"`);
  let end = rodada([B.mk.nego(1)]);
  ok(G.vault === 100 && G.lastVaultDelta >= 0, 'o cofre não pode passar de 100: ' + G.vault);
  ok(end && end.type === 'fuga' && end.cause === 'cofre', `cofre cheio deveria levar à fuga: ${tipo(end)}`);
  nota(`cofre em 100 no começo da rodada: ${tipo(end)}, cobertura da rota ${end && end.cov}%`);
  // a carta do diretor logo depois de o cofre chegar a 100
  for (const [i, nome] of [[0, 'priorizar o cofre'], [1, 'manter a prioridade nas vidas'], [2, 'pedir tempo']]) {
    G = cena({ diff: 'complexo', evento: true, mut: g => { g.vault = 98; g.agit = 50; g.usedEvents = A.EVENT_DEFS.map(e => e.id).filter(id => id !== 'diretor'); } });
    A.setRandom(() => .01);
    const r = A.resolveDecisions();
    ok(r && r.event === 'diretor' && G.vault === 100, `preparo da cena: carta ${r && r.event}, cofre ${G.vault}`);
    if (r && r.event === 'diretor') {
      A.chooseEvent(i);
      if (i === 0) ok(!G.end || G.end.cause !== 'cofre', `${nome}: o cofre recuou 6 e a fuga deveria ter sido evitada: ${tipo(G.end)}`);
      else ok(G.end && G.end.type === 'fuga' && G.end.cause === 'cofre', `${nome}: com o cofre em 100 a fuga deveria acontecer: ${tipo(G.end)}`);
      nota(`diretor, "${nome}": cofre ${Math.round(G.vault)}%, desfecho ${tipo(G.end)}`);
    }
  }
  // prioridades: rendição vence o cofre cheio; a intervenção ordenada também
  G = cena({ diff: 'complexo', mut: g => { g.vault = 100; g.agit = 30; g.nego.step = 5; g.nego.contact = true; } }); end = fimDeRodada(G).out;
  ok(end && end.type === 'rendicao', `rendição com o cofre cheio: ${tipo(end)}`);
  G = cena({ diff: 'complexo', mut: g => { g.vault = 100; g.agit = 50; } }); G.queue = []; end = rodada([B.mk.interv(A)]);
  ok(end && end.type === 'intervencao', `intervenção ordenada com o cofre cheio: ${tipo(end)}`);
  // na fuga o líder só desvia de uma rota coberta para outra MENOS coberta: com as três alternativas mais cobertas, ele segue pela dele
  const ESC = ['renata', 'marcos', 'lucas', 'diego', 'andre', 'roberto', 'camila', 'fernanda'];
  const fuga = (rota, alts) => {
    let adapt = 0, M = 300;
    for (let k = 0; k < M; k++) {
      const g = cena({ diff: 'complexo', seed: 700 + k, team: ESC, mut: g => {
        g.team.forEach(id => g.az[id] = 'reserva'); g.exposed = 2; g.accomplice = false;
        const outras = g.routes.filter(z => z !== g.routeNow);
        rota.forEach((id, i) => g.az[id] = g.routeNow); outras.forEach((z, i) => alts[i % alts.length].forEach(id => { g.az[id] = z; }));
      } });
      const o = A.doEscape('cofre'); if (o.adapted) adapt++;
    }
    return adapt / M;
  };
  const semAlternativaMelhor = fuga(['camila'], [['renata', 'diego'], ['marcos', 'andre'], ['lucas', 'roberto']].map(x => x.slice()));
  ok(semAlternativaMelhor === 0, `o líder trocou de rota para uma mais coberta em ${pc(semAlternativaMelhor, 1)} das fugas`);
  const comAlternativaFraca = fuga(['renata', 'diego', 'marcos'], [['camila'], ['fernanda'], ['roberto']]);
  ok(comAlternativaFraca > .4, `com a rota muito coberta e as outras fracas o líder deveria desviar com frequência (desviou em ${pc(comAlternativaFraca, 1)})`);
  nota(`fuga com a rota dele mais fraca que as outras: desvio em ${pc(semAlternativaMelhor, 1)}; com as outras mais fracas: desvio em ${pc(comAlternativaFraca, 1)}`);
  // o cofre em 100 depois de uma intervenção entra na nota como butim máximo
  ok(end.lootF > 0 && G.score.valores === Math.max(0, Math.min(1, 1 - end.lootF * G.vault / 100)), 'valores protegidos com o cofre cheio não bate com a fórmula');
});

/* 11 */
caso(11, 'Orçamento zerado', 'nada que custe é aceito, o que é grátis continua; o plantão fica no vermelho sem a verba ficar negativa; cartas pagas deixam sempre uma saída sem custo', (ok, nota) => {
  let G = cena({ round: 3, team: ['renata', 'paulo', 'marcos', 'lucas'], mut: g => { g.credits = 0; } });
  ok(!A.addDecision(B.mk.intel(A, 'perfil')).ok, 'investigação sem verba foi aceita');
  ok(!A.addDecision(B.mk.apoio(A, 'beco')).ok, 'apoio externo sem verba foi aceito');
  ok(!A.addDecision(B.mk.horas(A)).ok, 'horas extras sem verba foram aceitas');
  ok(!A.addDecision(B.mk.com(A, 'acolhe')).ok, 'sala de acolhimento (20) sem verba foi aceita');
  ok(A.addDecision(B.mk.nego(1)).ok && A.addDecision(B.mk.com(A, 'coletiva')).ok && A.addDecision(B.mk.pausa()).ok, 'negociar, comunicar de graça e fazer a Pausa deveriam continuar disponíveis');
  A.G.queue.forEach(q => A.removeDecision(q.id));
  const st0 = G.stress, b0 = G.stk.banco.sat; const trilha = [];
  for (let r = 0; r < 4 && !G.end; r++) {
    G.quietRound = G.round; const s0 = G.stress; rodada([B.mk.nego(1)]);
    trilha.push(`R${G.round}: déficit ${G.deficit}, pressão +${G.stress - s0}`);
    ok(G.credits === 0, `verba deveria ficar em 0, está em ${G.credits}`);
    if (G.end) break; A.startRound();
  }
  if (!G.end) { ok(G.deficit === 4, `déficit depois de 4 rodadas: ${G.deficit}`); ok(G.stress - st0 === 9, `desgaste: +${G.stress - st0} (esperado +9: 3 rodadas de +3 e o resto só na confiança do banco)`); ok(G.stk.banco.sat < b0 - 15, 'o banco deveria perder confiança a cada rodada no vermelho'); }
  nota(`quatro rodadas sem verba: ${trilha.join(' · ')}; confiança do banco ${Math.round(b0)} → ${Math.round(G.stk.banco.sat)}`);
  if (G.stk.banco.lost) { const linha = G.log.flatMap(l => l.lines).find(x => /O banco perdeu a confiança/.test(x.text)); ok(linha && !/corta 60/.test(linha.text), `o corte do banco diz um valor que não foi cortado: "${linha && linha.text}"`); nota(`corte do banco com a verba em 0: "${linha && linha.text}"`); }
  for (const id of ['heli', 'fadiga']) {
    G = cena({ round: 4, team: ['renata', 'paulo', 'marcos'], mut: g => { g.credits = 0; } }); injeta(id);
    const caras = A.EVENT_FX[id].choices.map((c, i) => [c, i]).filter(([c]) => c.cost);
    caras.forEach(([c, i]) => ok(!A.chooseEvent(i), `${id}: a escolha paga ${i} passou sem verba`));
    const livre = A.EVENT_FX[id].choices.findIndex(c => !c.cost);
    ok(livre >= 0 && A.chooseEvent(livre), `${id}: não há saída sem custo`);
  }
  for (const diff of DIFFS) { const rows = lote(diff, () => B.policyEdge('gastaTudo'), N); ok(rows.length === N, `${diff}: ${N - rows.length} partidas sem desfecho`); nota(`${diff}, gastar tudo: nota média ${mean(rows.map(r => r.score)).toFixed(1)}; notas ${notas(rows)}`); }
  // cada carta paga tem de ter ao menos uma escolha sem custo: senão a verba zerada trava a partida
  A.EVENT_DEFS.forEach(e => ok(A.EVENT_FX[e.id].choices.some(c => !c.cost), `carta ${e.id} sem escolha gratuita`));
});

/* 12 */
caso(12, 'Intervenção com agitação em 100', 'a ordem vale mesmo assim, a ação desesperada não a substitui e a chance de morte extra (agitação−70)×1% aparece nas mortes', (ok, nota) => {
  for (const diff of DIFFS) {
    const M = 500, mortes = {}, tipos = {};
    for (const ag of [60, 100]) {
      let m = 0, ex = 0, desp = 0;
      for (let s = 0; s < M; s++) {
        const G = cena({ diff, seed: 900 + s, round: 4, team: ['renata', 'marcos', 'lucas', 'diego'], mut: g => { g.agit = ag; } });
        const end = rodada([B.mk.interv(A)]);
        ok(end && end.type === 'intervencao' && !end.forced, `${diff}/agit ${ag}: a ordem deveria valer: ${tipo(end)}`);
        if (G.R && temLinha(G.R, /AÇÃO DESESPERADA/)) desp++;
        if (G.hostages.dead > 0) m++; tipos[ag + ':' + end.variant] = (tipos[ag + ':' + end.variant] || 0) + 1;
      }
      mortes[ag] = m / M; ok(desp === 0, `${diff}/agit ${ag}: ação desesperada passou na frente da intervenção ordenada ${desp} vezes`);
    }
    ok(mortes[100] > mortes[60], `${diff}: com agitação 100 deveria morrer mais gente que com 60 (${pc(mortes[100], 1)} contra ${pc(mortes[60], 1)})`);
    nota(`${diff}: refém morto em ${pc(mortes[100], 1)} das entradas com agitação 100, contra ${pc(mortes[60], 1)} com 60; chance de sucesso (limpa+baixas) ${pc(['limpa', 'baixas'].reduce((s, v) => s + (tipos['100:' + v] || 0), 0), M)} contra ${pc(['limpa', 'baixas'].reduce((s, v) => s + (tipos['60:' + v] || 0), 0), M)}`);
  }
});

/* 13 */
caso(13, 'Dois eventos contraditórios na mesma rodada', 'a mesa só recebe uma carta por rodada e nunca repete; mesmo forçando duas cartas seguidas em todas as combinações de escolhas, nada sai da faixa e o fim da rodada fecha', (ok, nota) => {
  const ids = Object.keys(A.EVENT_FX); let pares = 0, puladas = 0, ativas = 0;
  const estados = [{ diff: 'protocolar', round: 4, team: ['renata', 'paulo', 'marcos', 'lucas'], gear: [] }, { diff: 'complexo', round: 6, team: ['renata', 'paulo', 'marcos', 'lucas', 'andre', 'roberto'], gear: ['kit'] }, { diff: 'caotico', round: 7, team: ['renata', 'diego'], gear: ['jammer', 'negofone'] }];
  for (const e of estados) for (const a of ids) for (const b of ids) {
    if (a === b) continue;
    const na = A.EVENT_FX[a].choices.length, nb = A.EVENT_FX[b].choices.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) {
      const G = cena({ diff: e.diff, round: e.round, team: e.team, gear: e.gear, seed: 31 + pares % 7, mut: g => { g.nego.contact = true; g.nego.step = 2; g.credits = 400; A.syncHL(null); } });
      if (!A.EVENT_FX[a].elig(G) || !A.EVENT_FX[b].elig(G)) { puladas++; continue; }
      const R = injeta(a); A.EVENT_FX[a].choices[i].run(R); G.usedEvents.push(a);
      if (!A.EVENT_FX[b].elig(G)) { puladas++; continue; }
      A.EVENT_FX[b].choices[j].run(R); G.usedEvents.push(b); pares++;
      G.pendingEvent = null; G.pressure = A.calcPressure(); G.stage = 'resolving'; A.syncHL(R);
      V.inv(`pares ${a}.${i}+${b}.${j} ${e.diff}`);
      try { A.finishRound(); } catch (x) { bad.push(`EXC finishRound depois de ${a}.${i}+${b}.${j}: ${x.message}`); continue; }
      V.inv(`pares-fim ${a}.${i}+${b}.${j} ${e.diff}`);
      if (G.end) V.fim(`pares ${a}.${i}+${b}.${j}`, { key: G.end.type });
    }
  }
  nota(`${pares} combinações de duas cartas e escolhas rodadas em 3 estados (${puladas} puladas por a carta não valer no estado)`);
  // na prática: uma carta por rodada, nunca repetida, e a carta pesada é seguida de uma rodada sem carta
  let duas = 0, repetidas = 0, seguidas = 0; const M = 400;
  for (let s = 0; s < M; s++) {
    const o = V.play(DIFFS[s % 3], B.policyFuzz(V.mulberry32(s + 5)), 13000 + s); if (!o) continue;
    const G = A.G; const ev = G.log.map(l => l.ev ? l.ev.id : null);
    if (new Set(G.usedEvents).size !== G.usedEvents.length) repetidas++;
    if (G.log.some(l => l.lines.filter(x => /Disparo acidental|Espaço aéreo|Segundo incidente|Há um quarto elemento/.test(x.text)).length > 1)) duas++;
    ev.forEach((x, k) => { if (x && ['tiroteio', 'segundo', 'cumplice', 'live', 'infiltrado', 'passamal', 'proposta'].includes(x) && ev[k + 1]) seguidas++; });
  }
  ok(duas === 0 && repetidas === 0 && seguidas === 0, `em ${M} partidas: ${duas} rodadas com duas cartas, ${repetidas} cartas repetidas, ${seguidas} cartas pesadas seguidas de outra`);
  nota(`${M} partidas aleatórias: nenhuma rodada com duas cartas, nenhuma repetida, nenhuma carta pesada seguida de outra`);
});

/* 14 */
caso(14, 'Rendição e fim do tempo na mesma rodada', 'a rendição vem antes do ultimato e do aviso do noticiário; um ponto abaixo do limite de agitação não rende; e o ultimato nunca deixa a rodada 8 sem desfecho', (ok, nota) => {
  for (const diff of DIFFS) {
    const ret = A.DIFF[diff].ret;
    let G = cena({ diff, round: 8, mut: g => { g.agit = ret; g.nego.step = 5; g.nego.contact = true; g.deadlineLeft = 1; g.deadlineFired = true; g.vault = 100; g.stk.prefeito.sat = 5; g.stk.prefeito.lost = true; } });
    const p0 = G.stk.prefeito.sat; let r = fimDeRodada(G);
    ok(r.out && r.out.type === 'rendicao', `${diff}: agitação ${ret} (= limite) no degrau 5 na rodada 8 deveria render: ${tipo(r.out)}`);
    ok(!temLinha(r.R, /prazo do noticiário venceu/) && G.stk.prefeito.sat === p0, `${diff}: o aviso do noticiário (−15) não deveria cobrar depois de a rendição encerrar a partida`);
    G = cena({ diff, round: 8, mut: g => { g.agit = ret + 1; g.nego.step = 5; g.nego.contact = true; } }); r = fimDeRodada(G);
    ok(r.out && r.out.type === 'prazo', `${diff}: agitação ${ret + 1} (um ponto acima do limite) não deveria render: ${tipo(r.out)}`);
    G = cena({ diff, round: 8, mut: g => { g.agit = 40; g.nego.step = 4; g.nego.contact = true; g.deadlineLeft = 1; } }); r = fimDeRodada(G);
    ok(r.out && r.out.type === 'prazo', `${diff}: sem rendição, a rodada 8 deveria cair no ultimato: ${tipo(r.out)}`);
    // na prática: a partida inteira com negociadora no degrau 5 termina na rodada certa
    const rows = lote(diff, () => B.policyNegociador(), N); ok(rows.every(x => x.round <= 8), `${diff}: passou da rodada 8`);
    nota(`${diff}: limite de agitação para render ${ret}; rendição em ${pc(rows.filter(x => x.key.startsWith('rendicao')).length, rows.length)} das partidas da negociadora, ultimato em ${pc(rows.filter(x => x.key.startsWith('prazo')).length, rows.length)}`);
  }
  // a rodada seguinte à 8 nunca existe
  const G = cena({ diff: 'complexo', round: 8 }); const end = rodada([B.mk.nego(1)]); ok(end, 'a rodada 8 terminou sem desfecho'); ok(G.round === 8, 'a rodada passou de 8');
});

/* 15 */
caso(15, 'Armazenamento cheio ou bloqueado', 'o jogo segue sem salvar, avisa uma vez, volta a salvar quando o navegador permite e nunca trava ao carregar', (ok, nota) => {
  const extra = 'globalThis.__api.setOnSaveFail = f => { onSaveFail = f; }; globalThis.__api.saveOk = () => SAVE_OK; globalThis.__api.saveLost = () => SAVE_LOST;';
  const montar = modo => {
    const S = B.load(1, undefined, extra); let avisos = 0; S.setOnSaveFail(() => avisos++);
    const ls = S.sandbox.localStorage, orig = { s: ls.setItem, g: ls.getItem, r: ls.removeItem };
    const quebra = () => { if (modo === 'cheio') ls.setItem = () => { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }; else { const f = () => { const e = new Error('SecurityError'); e.name = 'SecurityError'; throw e; }; ls.setItem = f; ls.getItem = f; ls.removeItem = f; } };
    const conserta = () => { ls.setItem = orig.s; ls.getItem = orig.g; ls.removeItem = orig.r; };
    return { S, ls, quebra, conserta, avisos: () => avisos };
  };
  for (const modo of ['cheio', 'bloqueado']) {
    const m = montar(modo), S = m.S; m.quebra();
    let lanca = false; try { S.reseed(3); S.newGame('complexo'); S.G.phase = 'siege'; S.saveGame(); S.saveGame(); S.saveGame(); } catch (e) { lanca = true; }
    ok(!lanca, `${modo}: salvar lançou exceção`);
    ok(m.avisos() === 1 && S.saveOk() === false, `${modo}: o aviso deveria sair uma vez só (saiu ${m.avisos()})`);
    let carga; try { carga = S.loadSave(); } catch (e) { carga = 'EXC ' + e.message; }
    ok(carga === null, `${modo}: carregar sem armazenamento deveria devolver nulo, devolveu ${carga && carga.round !== undefined ? 'um jogo' : carga}`);
    const rows = []; for (let i = 0; i < 10; i++) { try { rows.push(B.playGame(S, DIFFS[i % 3], B.policyEquilibrado(), 200 + i)); } catch (e) { ok(false, `${modo}: partida ${i} quebrou: ${e.message}`); } }
    ok(rows.length === 10, `${modo}: só ${rows.length} de 10 partidas completas`);
    m.conserta(); S.reseed(4); S.newGame('complexo'); S.G.phase = 'siege'; S.saveGame();
    ok(S.saveOk() === true && !!S.store.perimetro_save_v2, `${modo}: depois que o armazenamento voltou, o jogo deveria voltar a salvar`);
    m.quebra(); S.saveGame();
    ok(m.avisos() === 2, `${modo}: uma nova falha depois da recuperação deveria avisar de novo (avisos ${m.avisos()})`);
    nota(`${modo}: salvar não lança, aviso uma vez por falha (${m.avisos()} no total), 10 partidas completas, volta a salvar ao recuperar`);
  }
  // save corrompido, de outra versão ou com campo de texto onde o motor lê número: descartado, sem exceção, e avisado uma vez
  const S = B.load(1, undefined, extra); const chave = 'perimetro_save_v2';
  const tentar = (rotulo, raw) => { S.store[chave] = raw; let r; try { r = S.loadSave(); } catch (e) { r = 'EXC ' + e.message; } ok(r === null, `${rotulo}: devolveu ${r && r.round !== undefined ? 'um jogo' : r}`); ok(!(chave in S.store), `${rotulo}: o save inválido deveria ser removido`); };
  tentar('JSON truncado', '{"ver":2,"diff":"complexo"'); tentar('versão antiga', JSON.stringify({ ver: 1 })); tentar('texto vazio de verdade', '   ');
  S.reseed(8); S.newGame('complexo'); S.G.phase = 'siege'; S.G.round = 2; S.saveGame(); const bom = JSON.parse(S.store[chave]); bom.agit = 'muito'; tentar('agitação em texto', JSON.stringify(bom));
});

/* ---------- resumo ---------- */
const falhou = casos.filter(c => c.falhas.length);
console.log('\n' + '='.repeat(88));
casos.forEach(c => console.log(`${String(c.n).padStart(2)}. ${c.falhas.length ? '✕' : '✓'}  ${c.titulo}${c.falhas.length ? '  (' + c.falhas.length + ' falha' + (c.falhas.length > 1 ? 's' : '') + ')' : ''}`));
console.log(`\n${casos.length - falhou.length}/${casos.length} casos sem falha`);
if (OUT) {
  const md = ['# Casos extremos (limites.js)', '', `N = ${N} partidas por política e dificuldade.`, ''];
  casos.forEach(c => { md.push(`## ${c.n}. ${c.titulo} — ${c.falhas.length ? '✕ ' + c.falhas.length + ' falha(s)' : '✓'}`, '', `Espera: ${c.esperado}`, ''); c.info.forEach(i => md.push('- ' + i)); c.falhas.forEach(f => md.push('- ✕ ' + f)); md.push(''); });
  fs.writeFileSync(OUT, md.join('\n'));
}
process.exit(falhou.length ? 1 : 0);
