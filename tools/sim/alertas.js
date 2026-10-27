// Alertas, marcos e prévias dos painéis, sem navegador: roda as funções reais de dash.js em cada rodada de centenas de partidas.
// Verifica: nenhuma exceção, nenhum texto quebrado (undefined, NaN, [object Object], null, Infinity), gravidade e aba válidas,
// ordem dos alertas, marcos em ordem cronológica, e que NENHUMA função de leitura altera o estado do jogo.
const B = require('./bots'); const { mulberry32 } = require('./engine-loader');
const A = B.load(1);
const N = +process.argv[2] || 120;
const bad = [], seen = {}, count = { jogos: 0, rodadas: 0, chamadas: 0 };
const BAD = /undefined|NaN|\[object Object\]|\bnull\b|Infinity/;
const TABS = ['tatica', 'nego', 'intel', 'com'];
function flat(o, out = []) { if (o == null) return out; if (typeof o === 'string' || typeof o === 'number') { out.push(String(o)); return out; } if (Array.isArray(o)) { o.forEach(x => flat(x, out)); return out; } if (typeof o === 'object') Object.values(o).forEach(x => flat(x, out)); return out; }
function chk(cond, msg, ctx) { if (!cond) bad.push(msg + ' | ' + ctx); }
function call(name, fn, ctx) {
  const before = JSON.stringify(A.G); let out;
  try { out = fn(); } catch (e) { bad.push(`EXC ${name}: ${e.message} @ ${(e.stack || '').split('\n')[1]} | ${ctx}`); return undefined; }
  count.chamadas++;
  if (JSON.stringify(A.G) !== before) bad.push(`${name} ALTEROU o estado | ${ctx}`);
  const txt = flat(out).join(' '); const m = txt.match(BAD);
  if (m) bad.push(`${name}: texto quebrado "${m[0]}" → …${txt.slice(Math.max(0, txt.indexOf(m[0]) - 50), txt.indexOf(m[0]) + 30)}… | ${ctx}`);
  return out;
}
const diffs = ['protocolar', 'complexo', 'caotico'];
for (let i = 0; i < N; i++) {
  const diff = diffs[i % 3], seed = 31000 + i;
  const pols = [() => B.policyFuzz(mulberry32(seed + 5)), () => B.policyEquilibrado(), () => B.policyNegociador(), () => B.policyAgressivo(3, .4), () => B.policyEdge('gastaTudo'), () => B.policyEdge('nenhum'), () => B.policyEdge('passivo'), () => B.policyEdge('ignoraStk')];
  const pol = pols[i % pols.length]();
  A.reseed(seed); A.newGame(diff); pol.setup(A); A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound();
  const G = A.G; let guard = 0; count.jogos++;
  while (!G.end && guard++ < 12) {
    G.stage = 'panel';
    const ctx0 = `${diff}/${pol.name}/s${seed} r${G.round}`;
    // 1) alertas e marcos com o painel recém-aberto
    const al = call('siegeAlerts', A.siegeAlerts, ctx0 + ' (abre)');
    if (al) {
      al.forEach(a => { seen[a.title.replace(/\d+/g, 'N')] = (seen[a.title.replace(/\d+/g, 'N')] || 0) + 1; chk([1, 2, 3].includes(a.sev), 'gravidade inválida ' + a.sev, ctx0); chk(TABS.includes(a.tab), 'aba inválida ' + a.tab, ctx0); chk(a.title && a.text && a.label && a.ic, 'alerta incompleto ' + JSON.stringify(a), ctx0); });
      chk(al.every((a, k) => !k || al[k - 1].sev >= a.sev || al[k - 1].title === 'Última rodada'), 'alertas fora de ordem de gravidade', ctx0);
      chk(new Set(al.map(a => a.title)).size === al.length, 'alerta repetido', ctx0);
    }
    const ms = call('milestones', A.milestones, ctx0);
    if (ms) { chk(ms.every((m, k) => !k || ms[k - 1].r <= m.r), 'marcos fora de ordem', ctx0); chk(ms.every(m => Number.isFinite(m.r) && m.r >= G.round && m.r <= A.MAX_ROUNDS + 2), 'marco fora do intervalo ' + JSON.stringify(ms), ctx0); }
    call('capacityPreview', A.capacityPreview, ctx0); call('budgetForecast', () => A.budgetForecast(), ctx0); call('ultimatumView', A.ultimatumView, ctx0); call('spendBreakdown', A.spendBreakdown, ctx0); call('vaultEtaN', () => { const e = A.vaultEtaN(); return e === Infinity ? 'nunca' : e; }, ctx0);   // Infinity = o cofre não abre nesse ritmo; quem chama já trata
    G.team.slice(0, 3).forEach(id => ['entrada', 'reserva', 'cofre'].forEach(z => call('reposPreview', () => A.reposPreview(id, z), ctx0)));
    // 2) decisões do bot e prévia do plano
    pol.decide(A, G.round);
    call('planPreview', A.planPreview, ctx0 + ' (com ordens)'); call('siegeAlerts', A.siegeAlerts, ctx0 + ' (com ordens)');
    let r; try { r = A.resolveDecisions(); } catch (e) { bad.push('EXC resolve ' + e.message); break; }
    if (r && r.event) { const n = A.EVENT_FX[r.event].choices.length; let ok = false; try { ok = A.chooseEvent(pol.event ? pol.event(A, r.event) : 0); for (let k = 0; k < n && !ok; k++) ok = A.chooseEvent(k); } catch (e) { bad.push('EXC evento ' + e.message); break; } }
    count.rodadas++;
    if (!G.end) { try { A.startRound(); } catch (e) { bad.push('EXC startRound ' + e.message); break; } }
  }
}
console.log(`jogos ${count.jogos} · rodadas ${count.rodadas} · chamadas verificadas ${count.chamadas}`);
console.log('Alertas vistos (nº de vezes):'); Object.entries(seen).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log('  ' + String(n).padStart(6) + '  ' + t));
console.log(bad.length ? 'FALHAS (' + bad.length + '):\n' + [...new Set(bad)].slice(0, 30).join('\n') : 'nenhuma exceção, nenhum texto quebrado, nenhum estado alterado');
process.exit(bad.length ? 1 : 0);
