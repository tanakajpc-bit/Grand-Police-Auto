// Verificador de invariantes do estado (L2.4). Serve ao fuzz do edge.js e aos casos extremos do limites.js:
// depois de cada passo da partida, nenhum número sai da faixa, nenhuma conta dá NaN e o save continua válido.
//   const V = require('./invariantes')(A, bad);   V.inv(tag)  V.fim(tag, resumo)  V.play(diff, política, semente, { depois(G) })
const { mulberry32 } = require('./engine-loader');
module.exports = function criar(A, bad) {
  const chk = (cond, msg, ctx) => { if (!cond) bad.push(msg + ' | ' + ctx); };
  function inv(tag) {
    const G = A.G, H = G.hostages; const ctx = tag + ' d=' + G.diff + ' r=' + G.round;
    const nums = { agit: G.agit, media: G.media, vault: G.vault, credits: G.credits, pressure: G.pressure, calm: G.calm, stress: G.stress };
    for (const [k, v] of Object.entries(nums)) chk(Number.isFinite(v), 'NaN ' + k + '=' + v, ctx);
    chk(G.agit >= 0 && G.agit <= 100, 'agit fora', ctx + ' ' + G.agit); chk(G.media >= 0 && G.media <= 100, 'media fora', ctx);
    chk(G.vault >= 0 && G.vault <= 100, 'vault fora', ctx); chk(G.credits >= 0, 'credito negativo ' + G.credits, ctx);
    chk(G.pressure >= 0 && G.pressure <= 100, 'pressao fora ' + G.pressure, ctx);
    chk(G.calm >= 0 && G.calm <= 10, 'calma fora ' + G.calm, ctx); chk(G.stress >= 0, 'estresse negativo ' + G.stress, ctx);
    A.STK_KEYS.forEach(k => chk(Number.isFinite(G.stk[k].sat) && G.stk[k].sat >= 0 && G.stk[k].sat <= 100, 'stk fora ' + k + '=' + G.stk[k].sat, ctx));
    chk(H.dead >= 0 && H.hurt >= 0 && H.inside >= 0 && H.freed >= 0, 'refens negativos ' + JSON.stringify(H), ctx);
    chk(H.dead + H.hurt <= A.HOSTAGES, 'mortos+feridos > total ' + JSON.stringify(H), ctx);
    chk(H.inside + H.freed === A.HOSTAGES, 'inside+freed != total ' + JSON.stringify(H), ctx);
    chk(G.round >= 0 && G.round <= A.MAX_ROUNDS, 'rodada fora ' + G.round, ctx);
    chk(G.nego.step >= 1 && G.nego.step <= 5, 'degrau fora ' + G.nego.step, ctx);
    chk(new Set(G.usedEvents).size === G.usedEvents.length, 'evento repetido ' + G.usedEvents.join(','), ctx);
    chk(G.supportUsed >= 0 && G.supportUsed <= A.APOIO_PRECOS.length, 'apoios fora ' + G.supportUsed, ctx);
    chk(G.deficit >= 0 && (G.stats.minFF > 0 && G.stats.minFF <= 1), 'deficit/fadiga fora ' + G.deficit + '/' + G.stats.minFF, ctx);
    chk(G.log.length <= A.MAX_ROUNDS && G.log.length <= G.round, 'log maior que as rodadas ' + G.log.length, ctx);
    A.ZONES.forEach(z => { const c = A.zoneCoverage(z.id); chk(Number.isFinite(c) && c >= 0 && c <= 100, 'cobertura fora ' + z.id + '=' + c, ctx); });
    G.team.forEach(id => { const e = A.agentEff(id); chk(Number.isFinite(e) && e >= 0 && e <= 10, 'eficiência fora ' + id + '=' + e, ctx); });
    const ip = A.intervProb(); chk(ip >= .05 && ip <= .95, 'chance de intervenção fora ' + ip, ctx);
    const np = A.negoParts(Math.min(5, G.nego.step)).p; chk(np >= .02 && np <= .95, 'chance de avanço fora ' + np, ctx);
    const s = JSON.stringify(G); chk(!/NaN|undefined|Infinity/.test(s.replace(/"undefined"/g, '')), 'estado serializa NaN/undefined', ctx);
    // a lista nominal de reféns concorda com os contadores depois que a rodada fecha
    if (G.stage !== 'panel' && G.stage !== 'update' && G.stage !== 'event') {
      const dead = G.hl.filter(h => h.st === 'dead').length, hurt = G.hl.filter(h => h.st === 'hurt').length, ins = G.hl.filter(h => h.in).length;
      chk(dead === H.dead && hurt === H.hurt && ins === H.inside, `lista nominal ≠ contadores (mortos ${dead}/${H.dead}, feridos ${hurt}/${H.hurt}, dentro ${ins}/${H.inside})`, ctx);
    }
  }
  function fim(tag, r) {
    const G = A.G, S = G.score; const ctx = tag + ' ' + r.key;
    chk(!!G.end, 'sem desfecho', ctx);
    chk(S && Number.isFinite(S.total) && S.total >= 0 && S.total <= 100, 'score fora ' + (S && S.total), ctx);
    ['vidas', 'captura', 'valores', 'eficiencia', 'confianca'].forEach(k => chk(Number.isFinite(S[k]) && S[k] >= 0 && S[k] <= 1, 'comp ' + k + '=' + S[k], ctx));
    chk(['S', 'A', 'B', 'C', 'D', 'F'].includes(S.grade), 'nota inválida', ctx);
    chk(S.grade === A.gradeOf(S.total), 'faixa ≠ nota ' + S.grade + ' ' + S.total, ctx);
    if (G.hostages.dead >= 4) chk(S.total <= 49, 'teto de mortes violado', ctx);
    else if (G.hostages.dead >= 2) chk(S.total <= 64, 'teto de mortes 2 violado', ctx);
    else if (G.hostages.dead >= 1) chk(S.total <= 79, 'teto de mortes 1 violado', ctx);
    // salvar/recarregar não pode perder nada
    A.saveGame(); const raw = A.store['perimetro_save_v2']; chk(!!raw, 'sem save', ctx);
    try { const sv = JSON.parse(raw); chk(A.validSave(sv), 'save inválido', ctx); } catch (e) { chk(false, 'save não parseia: ' + e.message, ctx); }
  }
  /* Joga uma partida inteira com a política, conferindo os invariantes a cada passo. Devolve o resumo ou null (e registra o motivo em bad). */
  function play(diff, pol, seed, opt = {}) {
    A.reseed(seed); A.newGame(diff); pol.setup(A); A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound(); inv('start');
    let guard = 0; const G = A.G;
    while (!G.end && guard++ < 12) {
      G.stage = 'panel'; pol.decide(A, G.round); inv('apos-decidir');
      let r; try { r = A.resolveDecisions(); } catch (e) { bad.push('EXC resolve: ' + e.stack.split('\n').slice(0, 3).join(' / ')); return null; }
      if (r && r.event) {
        const n = A.EVENT_FX[r.event].choices.length; let ok = false;
        const pref = pol.event ? pol.event(A, r.event) : 0;
        try { ok = A.chooseEvent(pref); for (let i = 0; i < n && !ok; i++) ok = A.chooseEvent(i); } catch (e) { bad.push('EXC evento ' + r.event + ': ' + e.stack.split('\n').slice(0, 3).join(' / ')); return null; }
        if (!ok) bad.push('evento sem escolha possível ' + r.event);
      }
      inv('apos-resolver');
      if (opt.depois) opt.depois(G);
      if (!G.end) { try { A.startRound(); } catch (e) { bad.push('EXC startRound: ' + e.stack.split('\n').slice(0, 3).join(' / ')); return null; } }
    }
    if (!G.end) { bad.push('travou: sem desfecho em 12 rodadas ' + pol.name); return null; }
    const o = { key: G.end.type + (G.end.variant ? ':' + G.end.variant : ''), score: G.score ? G.score.total : NaN, grade: G.score && G.score.grade, dead: G.hostages.dead, round: G.round, end: G.end };
    fim(pol.name + ' s' + seed, o); return o;
  }
  return { chk, inv, fim, play, mulberry32 };
};
