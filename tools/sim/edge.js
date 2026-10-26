// Casos de borda + fuzz com invariantes verificados a cada rodada e no fim
const B = require('./bots'); const { mulberry32 } = require('./engine-loader');
const A = B.load(1);
const N = +process.argv[2] || 200, NF = +process.argv[3] || 2000;
const pct = (n, d) => (100 * n / d).toFixed(0).padStart(3) + '%';
const bad = [];
function chk(cond, msg, ctx) { if (!cond) { bad.push(msg + ' | ' + ctx); } }
function inv(tag) {
  const G = A.G, H = G.hostages; const ctx = tag + ' d=' + G.diff + ' r=' + G.round;
  const nums = { agit: G.agit, media: G.media, vault: G.vault, credits: G.credits, pressure: G.pressure, calm: G.calm, stress: G.stress };
  for (const [k, v] of Object.entries(nums)) chk(Number.isFinite(v), 'NaN ' + k + '=' + v, ctx);
  chk(G.agit >= 0 && G.agit <= 100, 'agit fora', ctx + ' ' + G.agit); chk(G.media >= 0 && G.media <= 100, 'media fora', ctx);
  chk(G.vault >= 0 && G.vault <= 100, 'vault fora', ctx); chk(G.credits >= 0, 'credito negativo ' + G.credits, ctx);
  chk(G.pressure >= 0 && G.pressure <= 100, 'pressao fora ' + G.pressure, ctx);
  A.STK_KEYS.forEach(k => chk(Number.isFinite(G.stk[k].sat) && G.stk[k].sat >= 0 && G.stk[k].sat <= 100, 'stk fora ' + k + '=' + G.stk[k].sat, ctx));
  chk(H.dead >= 0 && H.hurt >= 0 && H.inside >= 0 && H.freed >= 0, 'refens negativos ' + JSON.stringify(H), ctx);
  chk(H.dead + H.hurt <= A.HOSTAGES, 'mortos+feridos > total ' + JSON.stringify(H), ctx);
  chk(H.inside + H.freed === A.HOSTAGES || H.inside + H.freed + 0 === A.HOSTAGES, 'inside+freed != total ' + JSON.stringify(H), ctx);
  chk(G.round >= 0 && G.round <= A.MAX_ROUNDS, 'rodada fora ' + G.round, ctx);
  chk(G.nego.step >= 1 && G.nego.step <= 5, 'degrau fora ' + G.nego.step, ctx);
  const s = JSON.stringify(G); chk(!/NaN|undefined|Infinity/.test(s.replace(/"undefined"/g, '')), 'estado serializa NaN/undefined', ctx);
}
function endChecks(tag, r) {
  const G = A.G, S = G.score; const ctx = tag + ' ' + r.key;
  chk(!!G.end, 'sem desfecho', ctx);
  chk(S && Number.isFinite(S.total) && S.total >= 0 && S.total <= 100, 'score fora ' + (S && S.total), ctx);
  ['vidas', 'captura', 'valores', 'eficiencia', 'confianca'].forEach(k => chk(Number.isFinite(S[k]) && S[k] >= 0 && S[k] <= 1, 'comp ' + k + '=' + S[k], ctx));
  chk(['S', 'A', 'B', 'C', 'D', 'F'].includes(S.grade), 'nota inválida', ctx);
  if (G.hostages.dead >= 4) chk(S.total <= 49, 'teto de mortes violado', ctx);
  else if (G.hostages.dead >= 2) chk(S.total <= 64, 'teto de mortes 2 violado', ctx);
  else if (G.hostages.dead >= 1) chk(S.total <= 79, 'teto de mortes 1 violado', ctx);
  // salvar/recarregar não pode perder nada
  A.saveGame(); const raw = A.store['perimetro_save_v2']; chk(!!raw, 'sem save', ctx);
  try { const sv = JSON.parse(raw); chk(A.validSave(sv), 'save inválido', ctx); } catch (e) { chk(false, 'save não parseia: ' + e.message, ctx); }
}
function play(diff, pol, seed) {
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
    if (!G.end) { try { A.startRound(); } catch (e) { bad.push('EXC startRound: ' + e.stack.split('\n').slice(0, 3).join(' / ')); return null; } }
  }
  if (!G.end) { bad.push('travou: sem desfecho em 12 rodadas ' + pol.name); return null; }
  const o = { key: G.end.type + (G.end.variant ? ':' + G.end.variant : ''), score: G.score ? G.score.total : NaN, grade: G.score && G.score.grade, dead: G.hostages.dead, round: G.round };
  endChecks(pol.name + ' s' + seed, o); return o;
}
const kinds = ['nenhum', 'gastaTudo', 'ignoraNego', 'ignoraStk', 'soNego', 'soTatica', 'soIntel', 'soCom', 'passivo', 'intervSempre', 'pausaSempre', 'umaZona', 'soReserva'];
console.log('caso            nivel       score  S/A/B/C/D/F (%)            mortos  desfechos');
for (const k of kinds) for (const diff of ['protocolar', 'complexo', 'caotico']) {
  const rows = []; for (let i = 0; i < N; i++) { const o = play(diff, B.policyEdge(k), 7000 + i); if (o) rows.push(o); }
  const g = x => pct(rows.filter(r => r.grade === x).length, rows.length);
  const cnt = {}; rows.forEach(r => cnt[r.key] = (cnt[r.key] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([kk, v]) => kk + ' ' + pct(v, rows.length).trim()).join(' · ');
  console.log(k.padEnd(15), diff.padEnd(11), (rows.reduce((s, r) => s + r.score, 0) / rows.length).toFixed(1).padStart(5), ['S', 'A', 'B', 'C', 'D', 'F'].map(g).join(' '), ' ', (rows.reduce((s, r) => s + r.dead, 0) / rows.length).toFixed(2).padStart(5), ' ', top);
}
// fuzz
let fr = 0; const rng = mulberry32(99);
for (let i = 0; i < NF; i++) { const diff = ['protocolar', 'complexo', 'caotico'][i % 3]; const o = play(diff, B.policyFuzz(mulberry32(1000 + i)), 9000 + i); if (o) fr++; }
console.log('\nfuzz: ' + fr + '/' + NF + ' partidas completas');
console.log(bad.length ? 'VIOLAÇÕES (' + bad.length + '):\n' + [...new Set(bad)].slice(0, 25).join('\n') : 'nenhuma violação de invariantes');
