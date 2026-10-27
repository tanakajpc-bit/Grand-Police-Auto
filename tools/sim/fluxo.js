// Fluxo e estados do motor (L2.2), sem navegador:
//  1) prioridade dos desfechos no fim da rodada (intervenção > ação desesperada > rendição > cofre > ordem política > ultimato);
//  2) salvar e restaurar em TODO ponto de uma partida e seguir jogando dá exatamente o mesmo resultado (nada vive fora de G);
//  3) novo jogo não herda nada do jogo anterior e as tabelas de dados nunca são alteradas;
//  4) save de versão anterior (sem os campos que entraram depois) sobe com a migração e a partida segue;
//  5) limites das rodadas: de 1 a 8, intervenção na 1ª, ultimato na 8ª, nunca uma 9ª;
//  6) o aviso de ordem política do painel prevê exatamente a conta do fim da rodada (L2.3).
const B = require('./bots'); const { mulberry32 } = require('./engine-loader');
const A = B.load(1);
const N = +process.argv[2] || 108;
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { falhas++; console.log('  ✕ ' + m); } };
const sec = t => console.log('\n## ' + t);

/* aleatório com roteiro: devolve os valores em ordem e, no fim, 0,5 */
const script = (...v) => { let i = 0; A.setRandom(() => (i < v.length ? v[i++] : .5)); };
function cena(diff, round, fn, vals) {
  A.reseed(5); A.newGame(diff); const G = A.G;
  G.team = ['renata', 'paulo', 'marcos']; G.team.forEach(id => { G.az[id] = 'reserva'; G.fat[id] = 0; G.transit[id] = 0; G.away[id] = 0; });
  G.phase = 'siege'; G.round = round; G.stage = 'resolving'; G.nego.contact = true; G.K.profile = true;
  G.quietRound = round + 1;
  G.R = { lines: [], s0: A.snap(), decs: [], ev: null, hchg: [], sec: 'fim' };
  fn(G); script(...(vals || []));
  const r = A.finishRound();
  return { G, out: r && r.outcome ? r.outcome : null, R: G.R };
}
const tipo = o => o ? o.type + (o.variant ? ':' + o.variant : '') + (o.cause ? '/' + o.cause : '') : 'nada';

sec('1. Prioridade dos desfechos no fim da rodada');
{
  // 1 intervenção ordenada vence tudo
  let r = cena('complexo', 3, G => { G.R.interv = true; G.agit = 95; G.vault = 100; G.nego.step = 5; }, [0, 0, 0]);
  ok(r.out && r.out.type === 'intervencao' && !r.out.forced, 'intervenção ordenada deveria vencer ação desesperada, cofre e rendição: ' + tipo(r.out));
  // 2 ação desesperada (ramo de fuga) vence rendição e cofre
  r = cena('complexo', 3, G => { G.agit = 95; G.vault = 100; G.nego.step = 5; }, [0, .9]);
  ok(r.out && r.out.type === 'fuga' && r.out.cause === 'desespero', 'ação desesperada com fuga deveria vir antes do cofre: ' + tipo(r.out));
  // 3 ação desesperada violenta não encerra: o cofre cheio ainda leva à fuga na mesma rodada, e o refém ferido fica registrado
  r = cena('complexo', 3, G => { G.agit = 95; G.vault = 100; }, [0, 0, .9, .9]);
  ok(r.out && r.out.type === 'fuga' && r.out.cause === 'cofre' && r.G.hostages.hurt >= 1, 'ação violenta deveria ferir e seguir para a fuga pelo cofre: ' + tipo(r.out) + ' feridos ' + r.G.hostages.hurt);
  // 4 rendição vence cofre cheio
  r = cena('complexo', 3, G => { G.agit = 30; G.vault = 100; G.nego.step = 5; });
  ok(r.out && r.out.type === 'rendicao', 'rendição (degrau 5, agitação baixa) deveria vencer o cofre cheio: ' + tipo(r.out));
  // 5 rendição vence a ordem política
  r = cena('complexo', 6, G => { G.agit = 30; G.nego.step = 5; G.stk.prefeito.sat = 5; G.stk.prefeito.lost = true; });
  ok(r.out && r.out.type === 'rendicao', 'rendição deveria vencer a ordem política: ' + tipo(r.out));
  // 6 cofre vence a ordem política
  r = cena('complexo', 6, G => { G.agit = 50; G.vault = 100; G.stk.prefeito.sat = 5; G.stk.prefeito.lost = true; });
  ok(r.out && r.out.type === 'fuga' && r.out.cause === 'cofre', 'cofre cheio deveria vencer a ordem política: ' + tipo(r.out));
  // 7 ordem política na rodada 8 vence o ultimato
  r = cena('complexo', 8, G => { G.agit = 50; G.stk.prefeito.sat = 5; G.stk.prefeito.lost = true; });
  ok(r.out && r.out.type === 'intervencao' && r.out.forced, 'a ordem política da rodada 8 deveria vir antes do ultimato: ' + tipo(r.out));
  // 8 rendição vence o ultimato na rodada 8
  r = cena('complexo', 8, G => { G.agit = 30; G.nego.step = 5; });
  ok(r.out && r.out.type === 'rendicao', 'rendição na rodada 8 deveria vencer o ultimato: ' + tipo(r.out));
  // 9 rodada 8 sem nada: ultimato (nunca fica sem desfecho)
  r = cena('complexo', 8, G => { G.agit = 50; });
  ok(r.out && r.out.type === 'prazo', 'rodada 8 deveria terminar no ultimato: ' + tipo(r.out));
  // 10 ordem política só da rodada 6 em diante e só com o prefeito perdido e confiança ≤ 15
  r = cena('complexo', 5, G => { G.agit = 50; G.stk.prefeito.sat = 5; G.stk.prefeito.lost = true; });
  ok(!r.out, 'ordem política antes da rodada 6: ' + tipo(r.out));
  r = cena('complexo', 6, G => { G.agit = 50; G.stk.prefeito.sat = 16; G.stk.prefeito.lost = true; });
  ok(!r.out, 'ordem política com confiança do prefeito acima de 15: ' + tipo(r.out));
  r = cena('complexo', 6, G => { G.agit = 50; G.stk.prefeito.sat = 15; G.stk.prefeito.lost = true; });
  ok(r.out && r.out.type === 'intervencao' && r.out.forced, 'ordem política com confiança exatamente 15 deveria disparar: ' + tipo(r.out));
  // 11 limites: agitação 80 não dispara a ação desesperada; 80,1 pode disparar; rendição em agitação = limite
  r = cena('complexo', 3, G => { G.agit = 80; }, [0, 0]);
  ok(!r.out, 'agitação exatamente 80 não deveria disparar ação desesperada: ' + tipo(r.out));
  r = cena('complexo', 3, G => { G.agit = 45; G.nego.step = 5; });
  ok(r.out && r.out.type === 'rendicao', 'degrau 5 com agitação igual ao limite (45 no Complexo) deveria render');
  r = cena('complexo', 3, G => { G.agit = 45.1; G.nego.step = 5; });
  ok(!r.out, 'degrau 5 com agitação acima do limite não deveria render');
  r = cena('complexo', 3, G => { G.agit = 30; G.nego.step = 4; });
  ok(!r.out, 'degrau 4 não deveria render, mesmo com agitação baixa');
  // 12 intervenção já na rodada 1
  r = cena('protocolar', 1, G => { G.R.interv = true; });
  ok(r.out && r.out.type === 'intervencao' && r.G.stage === 'result' && r.G.score && r.G.round === 1, 'intervenção na rodada 1 deveria encerrar com nota: ' + tipo(r.out));
  // 13 cada desfecho deixa G.end, G.score, stage result e phase siege (a interface passa para o desfecho com ACT.cont)
  for (const [nome, fn, vals] of [['rendicao', G => { G.agit = 30; G.nego.step = 5; }], ['fuga', G => { G.vault = 100; }], ['prazo', G => { }, []]]) {
    r = cena('complexo', nome === 'prazo' ? 8 : 4, fn, vals);
    ok(r.out && r.G.end === r.out && r.G.stage === 'result' && r.G.phase === 'siege' && r.G.score && ['S', 'A', 'B', 'C', 'D', 'F'].includes(r.G.score.grade), 'desfecho ' + nome + ' sem estado final completo');
  }
  // 14 nenhuma carta de evento é beco sem saída: toda carta tem ao menos uma escolha sem custo (com a reserva zerada o jogador ainda segue)
  A.reseed(5); A.newGame('complexo'); A.G.team = ['renata', 'paulo']; A.G.team.forEach(id => { A.G.az[id] = 'entrada'; }); A.G.credits = 0;
  const semGratis = Object.keys(A.EVENT_FX).filter(id => !A.EVENT_FX[id].choices.some(c => !c.cost));
  ok(semGratis.length === 0 && Object.keys(A.EVENT_FX).length === Object.keys(A.EVDEF).length, 'carta de evento sem escolha gratuita ou sem efeito: ' + semGratis.join(', '));
  console.log('  prioridades verificadas; as ' + Object.keys(A.EVENT_FX).length + ' cartas de evento têm escolha sem custo');
}

sec('2. Salvar e restaurar em todo ponto da partida: o resto da partida não muda');
{
  /* 5 políticas gerais + 13 de borda: cada uma joga nas três dificuldades (o save de qualquer jogo, por estranho que seja, tem de passar na validação) */
  const edges = ['soNego', 'ignoraNego', 'ignoraStk', 'soTatica', 'soIntel', 'soCom', 'passivo', 'intervSempre', 'pausaSempre', 'umaZona', 'soReserva', 'gastaTudo', 'nenhum'];
  const pols = [() => B.policyEquilibrado(), () => B.policyNegociador(), () => B.policyAgressivo(3, .4), () => B.policyEdge('gastaTudo'), () => B.policyFuzz(mulberry32(7))].concat(edges.map(k => () => B.policyEdge(k)));
  let pontos = 0, dif = 0;
  for (let i = 0; i < N; i++) {
    const diff = ['protocolar', 'complexo', 'caotico'][Math.floor(i / pols.length) % 3], seed = 4400 + i, mk = pols[i % pols.length];
    const jogar = restaura => {
      A.reseed(seed); A.newGame(diff); const pol = mk(); pol.setup(A); A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound();
      let guard = 0; const trace = [];
      const pt = tag => { if (!restaura) return; const antes = JSON.stringify(A.G); A.saveGame(); const s = A.loadSave(); pontos++; if (!s) { dif++; trace.push('save ausente em ' + tag); return; } if (JSON.stringify(s) !== antes) { dif++; trace.push('save/restauro difere em ' + tag); } A.G = s; };
      while (!A.G.end && guard++ < 12) {
        A.G.stage = 'update'; pt('update r' + A.G.round);
        A.G.stage = 'panel'; pol.decide(A, A.G.round); pt('painel r' + A.G.round);
        const r = A.resolveDecisions();
        if (r && r.event) { pt('evento r' + A.G.round); const n = A.EVENT_FX[r.event].choices.length; let ok2 = false; for (let k = 0; k < n && !ok2; k++) ok2 = A.chooseEvent(k === 0 && pol.event ? pol.event(A, r.event) : k); }
        pt('resultado r' + A.G.round);
        if (!A.G.end) A.startRound();
      }
      pt('fim');
      return { fim: JSON.stringify(A.G, (k, v) => (k === 'id' && typeof v === 'number' ? 0 : v)), trace };   // o id numérico das ordens vem de Date.now(): não faz parte do jogo
    };
    const base = jogar(false), rest = jogar(true);
    if (base.fim !== rest.fim) { dif++; trace: console.log('  partida ' + diff + ' s' + seed + ' diverge após restaurar: ' + rest.trace.slice(0, 2).join('; ')); }
    rest.trace.forEach(t => console.log('  ' + diff + ' s' + seed + ': ' + t));
  }
  ok(dif === 0, dif + ' divergências em ' + pontos + ' pontos de salvamento');
  console.log('  ' + N + ' partidas, ' + pontos + ' pontos de salvar e restaurar, ' + dif + ' divergências');
}

sec('3. Novo jogo não herda nada e as tabelas de dados ficam intactas');
{
  const tabelas = () => JSON.stringify([A.DIFF, A.PROFILES, A.AGENTS, A.GENERICS, A.EQUIP, A.INTEL, A.COMMS, A.POSTURES, A.STEPS, A.STK, A.ZONES, A.BADGES, A.HOSTAGE_LIST, A.TOCS, A.APOIO_PRECOS]);
  const t0 = tabelas();
  let herdou = 0;
  for (let i = 0; i < Math.min(N, 40); i++) {
    const diff = ['protocolar', 'complexo', 'caotico'][i % 3];
    A.reseed(900 + i); A.newGame(diff); const nova = JSON.stringify(A.G);
    B.playGame(A, ['protocolar', 'complexo', 'caotico'][(i + 1) % 3], i % 2 ? B.policyAgressivo(2, .3) : B.policyEquilibrado(), 3000 + i);   // suja tudo
    A.reseed(900 + i); A.newGame(diff);
    if (JSON.stringify(A.G) !== nova) { herdou++; console.log('  jogo ' + i + ' herdou estado do anterior'); }
  }
  ok(herdou === 0, herdou + ' jogos novos diferentes de um jogo novo com a mesma semente');
  ok(tabelas() === t0, 'alguma tabela de dados (DIFF, PROFILES, AGENTS, EQUIP…) foi alterada durante as partidas');
  console.log('  jogo novo idêntico em todas as sementes; tabelas de dados intactas depois de ' + Math.min(N, 40) * 2 + ' partidas');
}

sec('4. Save de versão anterior (sem os campos que entraram depois) sobe com a migração e a partida segue');
{
  let migr = 0, falhou = 0;
  for (let i = 0; i < 24; i++) {
    const diff = ['protocolar', 'complexo', 'caotico'][i % 3];
    A.reseed(8100 + i); A.newGame(diff); const pol = i % 2 ? B.policyNegociador() : B.policyEquilibrado(); pol.setup(A); A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound();
    for (let r = 0; r < 1 + (i % 4) && !A.G.end; r++) { A.G.stage = 'panel'; pol.decide(A, A.G.round); const x = A.resolveDecisions(); if (x && x.event) A.chooseEvent(0); if (!A.G.end) A.startRound(); }
    if (A.G.end) continue;
    const o = JSON.parse(JSON.stringify(A.G));
    ['spent', 'deficit', 'tocLog', 'spendLog', 'creditsHist', 'hPref', 'quietRound', 'tleft', 'exposed', 'powerCut', 'calm', 'stress', 'deadlineLeft', 'supportUsed', 'commMedia', 'lastVaultDelta', 'fatCrit', 'deadlineFired', 'mayorPromise', 'vehicleGiven', 'defector', 'frame', 'hl'].forEach(k => delete o[k]);
    delete o.K.at; Object.keys(o.transit).forEach(id => { o.transit[id] = !!o.transit[id]; });
    A.store[A.SAVE_KEY] = JSON.stringify(o);
    const s2 = A.loadSave(); migr++;
    if (!s2) { falhou++; console.log('  save antigo ' + diff + ' s' + (8100 + i) + ' rejeitado'); continue; }
    A.G = s2; let g = 0; try { while (!A.G.end && g++ < 12) { A.G.stage = 'panel'; pol.decide(A, A.G.round); const x = A.resolveDecisions(); if (x && x.event) A.chooseEvent(0); if (!A.G.end) A.startRound(); } if (!A.G.score || !isFinite(A.G.score.total)) { falhou++; console.log('  save antigo sem nota válida'); } }
    catch (e) { falhou++; console.log('  save antigo ' + diff + ': exceção ' + e.message); }
  }
  ok(falhou === 0, falhou + ' saves antigos que não subiram ou não terminaram');
  console.log('  ' + migr + ' saves sem os campos novos migrados e jogados até o fim');
}

sec('5. Limites das rodadas');
{
  let max = 0, r8 = 0, r1 = 0, tot = 0, naoTermina = 0;
  for (let i = 0; i < N * 4; i++) {
    const diff = ['protocolar', 'complexo', 'caotico'][i % 3];
    const pol = [B.policyEdge('passivo'), B.policyEdge('pausaSempre'), B.policyEdge('soNego'), B.policyEdge('nenhum')][i % 4];
    try { const o = B.playGame(A, diff, pol, 7000 + i); tot++; max = Math.max(max, o.round); if (o.round === 8) r8++; if (o.round === 1) r1++; } catch (e) { naoTermina++; }
  }
  ok(max <= 8, 'rodada acima de 8: ' + max); ok(naoTermina === 0, naoTermina + ' partidas sem desfecho');
  console.log('  ' + tot + ' partidas passivas: rodada máxima ' + max + ', ' + r8 + ' chegaram ao ultimato da rodada 8, nenhuma sem desfecho');
}
sec('6. O aviso da ordem política bate com o que o fim da rodada faz');
{
  // Para cada situação do prefeito (rodada, confiança, rodadas sem atenção, prazo do noticiário), a previsão do painel (ordemPolitica) é comparada com a
  // conta real: a confiança com que ele sai da rodada sem ninguém falar com ele e, da rodada 6 em diante, se a intervenção é ordenada.
  let n = 0, errPrev = 0, errOrdem = 0, errAviso = 0;
  for (const diff of ['protocolar', 'complexo', 'caotico']) for (let r = 4; r <= 8; r++) for (const dl of [0, 2]) for (let sem = 0; sem <= 3; sem++) for (let sat = 0; sat <= 60; sat += 3) {
    A.reseed(5); A.newGame(diff); const G = A.G;
    G.team = ['renata', 'paulo', 'marcos']; G.team.forEach(id => { G.az[id] = 'reserva'; G.fat[id] = 0; G.transit[id] = 0; G.away[id] = 0; });
    G.phase = 'siege'; G.round = r; G.stage = 'panel'; G.nego.contact = true; G.K.profile = true; G.quietRound = r; G.vault = 20; G.agit = 50; G.deadlineLeft = dl;
    G.stk.prefeito.sat = sat; G.stk.prefeito.sem = sem; G.stk.prefeito.lost = false;
    const f = A.ordemPolitica(); n++;
    if (r < 6) { if (!!f !== (r >= 4 && sat <= 40)) { errAviso++; console.log(`  ✕ aviso antes da rodada 6: ${diff} r${r} sat ${sat}`); } continue; }
    script(); A.resolveDecisions();
    const sai = G.stk.prefeito.sat, ordem = !!(G.end && G.end.type === 'intervencao' && G.end.forced);
    if (f && Math.round(sai) !== f.sem) { errPrev++; if (errPrev < 4) console.log(`  ✕ previsão ${f.sem}, real ${sai}: ${diff} r${r} sat ${sat} sem ${sem} prazo ${dl}`); }
    if (ordem !== !!f) { errOrdem++; if (errOrdem < 4) console.log(`  ✕ ordem política ${ordem}, aviso ${!!f}: ${diff} r${r} sat ${sat} sem ${sem} prazo ${dl}; saiu com ${sai}; fim ${tipo(G.end)}`); }
  }
  ok(errPrev === 0, errPrev + ' previsões de confiança que não batem com a conta do fim da rodada');
  ok(errOrdem === 0, errOrdem + ' casos em que o aviso e a ordem política real discordam');
  ok(errAviso === 0, errAviso + ' avisos antes da rodada 6 fora da regra (rodada 4 em diante, confiança até 40)');
  console.log('  ' + n + ' situações do prefeito conferidas');
}
console.log('\n' + (falhas ? falhas + ' FALHAS em ' + total + ' verificações' : total + ' verificações, 0 falhas'));
process.exit(falhas ? 1 : 0);
