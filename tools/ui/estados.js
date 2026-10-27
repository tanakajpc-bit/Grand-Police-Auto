// Fluxo de estados no navegador (L2.2): alcançabilidade, retomada em cada ponto, saves corrompidos, armazenamento indisponível,
// "Jogar novamente", cronômetro e ouvintes, duplo clique. Cada teste usa um contexto novo (localStorage limpo) e Math.random com semente.
//   NODE_PATH=$(npm root -g) node tools/ui/estados.js [grupo]        grupos: grafo retomada corrompido armazenamento reinicio timers cliques menu
const { chromium } = require('playwright');
const path = require('path');
const FILE = process.env.PERI_HTML || path.join(__dirname, '..', '..', 'perimetro-standalone.html');
const WHICH = process.argv[2] || 'todos';
const want = g => WHICH === 'todos' || WHICH === g;
const SAVE = 'perimetro_save_v2';
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('    ✕ ' + m); } return !!c; };
const sec = t => console.log('\n## ' + t);

const INIT = seed => `(function(){
  let a = ${seed}; Math.random = function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const ivs = new Set(), si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setInterval = (f, ms, ...r) => { const id = si(f, ms, ...r); ivs.add(id); return id; };
  window.clearInterval = id => { ivs.delete(id); return ci(id); };
  window.__iv = ivs;
  const cnt = {}, ael = EventTarget.prototype.addEventListener, rel = EventTarget.prototype.removeEventListener;
  const nm = t => t === document ? 'document' : t === window ? 'window' : t === document.body ? 'body' : (t && t.id === 'app') ? '#app' : null;
  EventTarget.prototype.addEventListener = function (type, fn, o) { const n = nm(this); if (n) cnt[n + ':' + type] = (cnt[n + ':' + type] || 0) + 1; return ael.call(this, type, fn, o); };
  EventTarget.prototype.removeEventListener = function (type, fn, o) { const n = nm(this); if (n) cnt[n + ':' + type] = (cnt[n + ':' + type] || 0) - 1; return rel.call(this, type, fn, o); };
  window.__listeners = cnt;
})();`;

async function abrir(browser, { seed = 11, storage = null, viewport = { width: 1366, height: 800 } } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(INIT(seed));
  if (storage) await ctx.addInitScript(storage);
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + (process.env.PERI_STACK ? ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ') : '')));
  await page.goto('file://' + FILE);
  return { ctx, page, errs };
}
const S = page => page.evaluate(() => { const P = window.PERIMETRO, G = P && P.G; return G ? { phase: G.phase, stage: G.stage, round: G.round, end: G.end ? G.end.type : null, queue: G.queue.length, credits: Math.round(G.credits), post: P.UI.post, cut: !!P.UI.cut } : null; });
const key = s => s ? `${s.phase}/${s.phase === 'siege' ? s.stage : '-'}/r${s.round}${s.phase === 'post' ? '/' + s.post : ''}` : 'menu';
async function act(page, sel) {
  const el = page.locator(sel).first(); if (!(await el.count())) return false;
  if ((await el.getAttribute('aria-disabled')) === 'true') return false;
  try { await el.click({ timeout: 3000 }); } catch (e) { return false; }
  await page.waitForTimeout(25); return true;
}
const PLAN = { team: ['renata', 'paulo', 'carla', 'marcos', 'lucas'], gear: ['negofone', 'kit'] };
/* Uma ação da estratégia padrão. Devolve o rótulo do estado em que agiu, ou null se a partida acabou (pós-jogo) ou travou. */
async function avancar(page, st = {}) {
  const s = await S(page);
  if (!s) { await act(page, `[data-act=diff][data-v=${st.diff || 'complexo'}]`); return (await act(page, '[data-act=start]')) ? 'menu' : null; }
  if (s.cut) { await act(page, '[data-act=cutgo]'); return 'cut'; }
  if (s.phase === 'briefing') return (await act(page, '[data-act=tobrief]')) ? 'briefing' : null;
  if (s.phase === 'recruit') { for (const id of PLAN.team) await act(page, `[data-act=hire][data-id=${id}]`); for (const id of PLAN.gear) await act(page, `[data-act=buygear][data-id=${id}]`); return (await act(page, '[data-act=torecruit]')) ? 'recruit' : null; }
  if (s.phase === 'perimeter') { await act(page, '[data-act=autoplace]'); return (await act(page, '[data-act=tosiege]')) ? 'perimeter' : null; }
  if (s.phase === 'outcome') return (await act(page, '[data-act=toscore]')) ? 'outcome' : null;
  if (s.phase === 'post') return null;
  if (s.phase !== 'siege') return null;
  if (s.stage === 'update') return (await act(page, '[data-act=takepanel]')) ? 'update' : null;
  if (s.stage === 'panel') {
    if (s.queue === 0) { await act(page, '[data-act=tab][data-t=nego]'); const step = await page.evaluate(() => Math.min(5, window.PERIMETRO.G.nego.step)); return (await act(page, `[data-act=addnego][data-t="${step}"]`)) ? 'panel+nego' : 'panel?'; }
    if (s.queue === 1) { await act(page, '[data-act=tab][data-t=com]'); const cid = ['acolhe', 'coletiva', 'prefeito', 'gerente'][s.round % 4]; return (await act(page, `[data-act=addcom][data-id=${cid}]`)) ? 'panel+com' : (await act(page, '[data-act=execute]')) ? 'panel>exec' : null; }
    return (await act(page, '[data-act=execute]')) ? 'panel>exec' : null;
  }
  if (s.stage === 'event') { const n = await page.locator('.evcard [data-act=evchoice]').count(); for (let i = 0; i < n; i++) { if (await act(page, `.evcard [data-act=evchoice][data-i="${i}"]`)) { const s2 = await S(page); if (s2.stage !== 'event') return 'event'; } } return null; }
  if (s.stage === 'result' || s.stage === 'resolving') return (await act(page, '[data-act=cont]')) ? 'result' : null;
  return null;
}
/* Um passo com nova tentativa: devolve o rótulo, null se a partida acabou (pós-jogo) ou undefined se travou de verdade (e não só um clique perdido). */
async function passo(page, st) {
  for (let t = 0; t < 4; t++) { const r = await avancar(page, st); if (r) return r; const s = await S(page); if (s && s.phase === 'post') return null; await page.waitForTimeout(120); }
  return undefined;
}
async function jogarAte(page, fim, max = 200) { let n = 0; while (n++ < max) { const s = await S(page); if (fim(s)) return true; if (!(await passo(page))) return fim(await S(page)); } return false; }

/* Termina a partida chamando as ações da interface direto na página (cada ação já redesenha a tela): rápido, e acusa qualquer exceção de desenho. */
const jogarRapido = page => page.evaluate(() => {
  const P = window.PERIMETRO, A = P.ACT;
  try {
    for (let g = 0; g < 600; g++) {
      const G = P.G; if (!G) return 'menu';
      if (G.phase === 'post') return 'ok';
      if (P.UI.cut) { A.cutgo(); continue; }
      if (G.phase === 'briefing') { A.tobrief(); continue; }
      if (G.phase === 'recruit') { if (!G.team.length) { ['renata', 'paulo', 'carla'].forEach(id => A.hire({ id })); } A.torecruit(); continue; }
      if (G.phase === 'perimeter') { A.autoplace(); A.tosiege(); continue; }
      if (G.phase === 'outcome') { A.toscore(); continue; }
      if (G.phase !== 'siege') return 'fase ' + G.phase;
      if (G.stage === 'update') { A.takepanel(); continue; }
      if (G.stage === 'panel') { if (!G.queue.length) A.addnego({ t: String(Math.min(5, G.nego.step)) }); A.execute(); continue; }
      if (G.stage === 'event') { for (let i = 0; i < 4 && P.G.stage === 'event'; i++) A.evchoice({ i: String(i) }); if (P.G.stage === 'event') return 'evento sem escolha possível'; continue; }
      if (G.stage === 'result' || G.stage === 'resolving') { A.cont(); continue; }
      return 'estágio ' + G.stage;
    }
    return 'não terminou';
  } catch (e) { return 'exceção: ' + e.message; }
});
const noPost = s => s && s.phase === 'post';

(async () => {
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });

  /* ---------------------------------------------------------------- 1 */
  if (want('grafo')) {
    sec('1. Grafo de estados: todos alcançáveis, nenhum beco sem saída, ordem das transições');
    const { ctx, page, errs } = await abrir(browser, { seed: 21 });
    const visited = new Set(), edges = new Set(); let prev = null, dead = 0;
    for (let i = 0; i < 400; i++) {
      const s = await S(page), k = key(s); if (prev !== k) { if (prev) edges.add(prev.replace(/\/r\d+/, '/rN') + ' → ' + k.replace(/\/r\d+/, '/rN')); visited.add(k.replace(/\/r\d+/, '/rN')); prev = k; }
      const acts = await page.evaluate(() => [...document.querySelectorAll('#app [data-act]')].filter(e => !e.disabled && e.offsetParent !== null).length);
      if (!acts) { dead++; console.log('    beco sem saída em ' + k); }
      if (s && s.phase === 'post') { for (const t of ['score', 'news', 'badges', 'replay', 'debrief']) { await act(page, `[data-act=ptab][data-t=${t}]`); const s2 = await S(page); visited.add(key(s2).replace(/\/r\d+/, '/rN')); } break; }
      if (!(await passo(page))) break;
    }
    const esperados = ['menu', 'briefing/rN', 'recruit/rN', 'perimeter/rN', 'siege/update/rN', 'siege/panel/rN', 'siege/result/rN', 'outcome/rN', 'post/rN/score', 'post/rN/news', 'post/rN/badges', 'post/rN/replay', 'post/rN/debrief']
      .map(x => x.replace('briefing/rN', 'briefing/-/rN').replace('recruit/rN', 'recruit/-/rN').replace('perimeter/rN', 'perimeter/-/rN').replace('outcome/rN', 'outcome/-/rN').replace('post/rN/', 'post/-/rN/'));
    const faltam = esperados.filter(e => ![...visited].some(v => v.replace('siege/', 'siege/') === e.replace('siege/', 'siege/')));
    ok(faltam.length === 0, 'estados não alcançados: ' + faltam.join(', ') + ' (visitados: ' + [...visited].join(' | ') + ')');
    ok(dead === 0, dead + ' telas sem nenhuma ação disponível');
    ok(errs.length === 0, 'erros de console: ' + errs.slice(0, 3).join(' | '));
    const ordem = [...edges].sort(); console.log('    transições observadas (' + ordem.length + '):'); ordem.forEach(e => console.log('      ' + e));
    // transições vindas de fora da ordem prevista
    const perm = /^(menu → briefing|briefing\/-\/rN → recruit|recruit\/-\/rN → perimeter|perimeter\/-\/rN → siege\/update|siege\/update\/rN → siege\/panel|siege\/panel\/rN → siege\/(result|event)|siege\/event\/rN → siege\/result|siege\/result\/rN → (siege\/update|outcome)|outcome\/-\/rN → post\/-\/rN\/score|post\/-\/rN\/\w+ → post\/-\/rN\/\w+)/;
    const fora = ordem.filter(e => !perm.test(e)); ok(fora.length === 0, 'transições fora da ordem prevista: ' + fora.join('; '));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 2 */
  if (want('retomada')) {
    sec('2. Retomada: recarregar a página a cada passo de uma partida e continuar de onde parou');
    // uma partida contínua por dificuldade; a cada passo a página é recarregada, "Continuar partida" é clicado e o estado restaurado é comparado com o salvo
    let pontos = 0, diverge = 0, travou = 0, erros = 0, fins = 0;
    for (const [seed, diff] of [[31, 'protocolar'], [32, 'complexo'], [33, 'caotico']]) {
      const { ctx, page, errs } = await abrir(browser, { seed });
      const st = { diff }; let evolta = 0;
      for (let n = 0; n < 160; n++) {
        const antes = await S(page);
        if (antes && !(antes.stage === 'event' && evolta >= 2)) {   // se o evento volta ao painel, deixa passar depois de duas vezes para a partida terminar
          const raw = await page.evaluate(k2 => localStorage.getItem(k2), SAVE);
          const rotulo = `${diff} ${key(antes)} q${antes.queue}`;
          await page.reload(); await page.waitForTimeout(30);
          pontos++;
          if (!ok((await page.locator('[data-act=continue]').count()) === 1, rotulo + ': "Continuar partida" ausente depois de recarregar')) { if (process.env.DUMP_FAIL) require('fs').writeFileSync(process.env.DUMP_FAIL, raw || ''); break; }
          await act(page, '[data-act=continue]'); await page.waitForTimeout(30);
          const depois = await S(page), raw2 = await page.evaluate(() => JSON.stringify(window.PERIMETRO.G));
          // o tempo que sobrava no relógio (tleft) é regravado ao sair da página; o resto tem de voltar idêntico
          const semT = j => JSON.stringify(j, (k2, v) => k2 === 'tleft' ? 0 : v);
          if (!raw || semT(JSON.parse(raw)) !== semT(JSON.parse(raw2))) { diverge++; console.log('    ' + rotulo + ': o estado restaurado difere do salvo'); }
          if (!depois || key(depois) !== key(antes)) { diverge++; if (antes.stage === 'event') evolta++; console.log(`    ${rotulo}: voltou em ${depois ? key(depois) : 'menu'}`); }
          if (errs.length) { erros++; console.log('    ' + rotulo + ': ' + errs[0]); errs.length = 0; }
        }
        const r = await passo(page, st);
        if (r === undefined) { travou++; console.log(`    ${diff}: travou depois do passo ${n}`); break; }
        if (r === null) { fins++; break; }
      }
      await ctx.close();
    }
    ok(diverge === 0, diverge + ' retomadas com estado diferente do salvo');
    ok(travou === 0, travou + ' partidas que travaram depois de retomar');
    ok(erros === 0, erros + ' retomadas com erro de console');
    ok(fins === 3, 'as três partidas deveriam chegar ao pós-jogo recarregando a cada passo (chegaram ' + fins + ')');
    console.log('    ' + pontos + ' retomadas verificadas (briefing, recrutamento, perímetro, atualização, painel com 0/1/2 ordens, evento, resultado, desfecho, pós-jogo)');
  }

  /* ---------------------------------------------------------------- 3 */
  if (want('corrompido')) {
    sec('3. Saves corrompidos: nada derruba a página, o jogador sempre consegue seguir');
    // partida de referência: salva em um ponto do meio do cerco
    const ref = await abrir(browser, { seed: 41 });
    await jogarAte(ref.page, s => s && s.phase === 'siege' && s.stage === 'panel' && s.round === 3 && s.queue === 1);
    const base = await ref.page.evaluate(k => localStorage.getItem(k), SAVE); await ref.ctx.close();
    const baseObj = JSON.parse(base);
    const res = await abrir(browser, { seed: 42 });
    let descartadosAoContinuar = 0, rejeitadosNaLeitura = 0;
    const rodar = async (nome, valor) => {
      const antes = res.errs.length;
      await res.page.evaluate(([k, v]) => { if (v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); }, [SAVE, valor]);
      await res.page.reload(); await res.page.waitForTimeout(25);
      const menuOk = await res.page.locator('[data-act=start]').count();
      let detalhe = '';
      if (!menuOk) detalhe = 'menu não apareceu';
      const cont = await res.page.locator('[data-act=continue]').count();
      if (!cont) rejeitadosNaLeitura++;
      let seguiu = true;
      if (cont) {
        await act(res.page, '[data-act=continue]'); await res.page.waitForTimeout(25);
        const acts = await res.page.evaluate(() => [...document.querySelectorAll('#app [data-act]')].filter(e => !e.disabled && e.offsetParent !== null).length);
        const txt = await res.page.evaluate(() => document.getElementById('app').innerText);
        if (!acts) { seguiu = false; detalhe = 'tela sem ação depois de Continuar'; }
        else if (/undefined|NaN|\[object Object\]|Infinity/.test(txt)) { seguiu = false; detalhe = 'texto quebrado: ' + (txt.match(/undefined|NaN|\[object Object\]|Infinity/) || [''])[0]; }
        else if (await res.page.locator('[data-act=fatalmenu]').count()) { seguiu = false; detalhe = 'tela de falha depois de Continuar'; }
        else {
          const f = await jogarRapido(res.page);
          // save que passou na validação mas não monta a tela é descartado ao Continuar, com aviso no menu: é a saída certa
          if (f === 'menu' && (await res.page.locator('.menu .insight.warn').count())) { descartadosAoContinuar++; }
          else if (f !== 'ok') { seguiu = false; detalhe = 'não terminou a partida depois de Continuar: ' + f; }
        }
      }
      const novos = res.errs.slice(antes);
      const bom = menuOk && seguiu && !novos.length;
      if (!bom) { fails++; console.log(`    ✕ ${nome}: ${detalhe || ''}${novos.length ? ' | ' + novos[0] : ''}`); }
      checks++;
      return bom;
    };
    // casos fixos
    const fixos = [['JSON inválido', '{{{'], ['texto', '"x"'], ['null', 'null'], ['lista vazia', '[]'], ['número', '123'], ['objeto vazio', '{}'], ['vazio', ''], ['versão antiga', JSON.stringify(Object.assign({}, baseObj, { ver: 1 }))], ['versão futura', JSON.stringify(Object.assign({}, baseObj, { ver: 3 }))]];
    for (const [n, v] of fixos) await rodar(n, v);
    const mut = (fn, nome) => { const o = JSON.parse(base); fn(o); return rodar(nome, JSON.stringify(o)); };
    await mut(o => { o.stage = 'result'; o.R = null; }, 'cerco em resultado sem registro da rodada');
    await mut(o => { o.stage = 'update'; o.update = null; }, 'atualização sem dados');
    await mut(o => { o.stage = 'event'; o.pendingEvent = null; }, 'evento sem carta');
    await mut(o => { o.stage = 'event'; o.pendingEvent = 'inexistente'; }, 'evento desconhecido');
    await mut(o => { o.stage = null; }, 'cerco sem estágio');
    await mut(o => { o.stage = 'xyz'; }, 'estágio inválido');
    await mut(o => { o.phase = 'outcome'; o.end = null; }, 'desfecho sem fim');
    await mut(o => { o.phase = 'post'; o.score = null; o.end = null; }, 'pós-jogo sem nota');
    await mut(o => { o.nego.step = 0; }, 'degrau 0');
    await mut(o => { o.nego.step = 9; }, 'degrau 9');
    await mut(o => { o.round = 9; }, 'rodada 9');
    await mut(o => { o.round = -1; }, 'rodada negativa');
    await mut(o => { o.routes = ['x', 'y', 'z', 'w']; }, 'rotas desconhecidas');
    await mut(o => { o.route = 'zzz'; o.routeNow = 'zzz'; }, 'rota real desconhecida');
    await mut(o => { o.team = []; }, 'equipe vazia em pleno cerco');
    await mut(o => { o.team.push('fantasma'); }, 'agente inexistente');
    await mut(o => { o.az = { renata: 'lua' }; }, 'zona inexistente');
    await mut(o => { o.gz = { drone: 'lua' }; }, 'zona de equipamento inexistente');
    await mut(o => { o.gear = ['canhao']; }, 'equipamento inexistente');
    await mut(o => { o.queue = [{ kind: 'xyz', p: {}, slots: 1, label: 'x', front: 'tatica' }]; }, 'ordem de tipo desconhecido');
    await mut(o => { o.queue = [{ kind: 'repos', p: { agent: 'fantasma', zone: 'lua' }, slots: 1, label: 'x', front: 'tatica' }]; }, 'reposicionamento inválido na fila');
    await mut(o => { o.hostages = { inside: 99, freed: -3, hurt: 50, dead: 40 }; }, 'reféns incoerentes');
    await mut(o => { o.hl = []; }, 'lista nominal de reféns vazia');
    await mut(o => { o.credits = -500; }, 'crédito negativo');
    await mut(o => { o.credits = 1e12; }, 'crédito enorme');
    await mut(o => { o.agit = 500; o.media = -40; o.vault = 'x'; }, 'indicadores fora da faixa');
    await mut(o => { o.pressure = null; }, 'pressão nula');
    await mut(o => { delete o.K.zrev; delete o.K.cleared; }, 'conhecimento sem listas');
    await mut(o => { o.log = new Array(3000).fill(o.log[0] || { r: 1, time: '14h07', decs: [], lines: [], s0: {}, s1: {} }); }, 'histórico gigante');
    await mut(o => { o.stk.prefeito = null; }, 'stakeholder nulo');
    await mut(o => { o.diff = 'facil'; }, 'dificuldade inexistente');
    await mut(o => { o.profile = 'bandido'; }, 'perfil inexistente');
    await mut(o => { o.frame = 'x'; o.hints = 'x'; o.radio = 5; }, 'listas com tipo errado');
    // fuzz de mutações aleatórias sobre o save real
    function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    const rng = mulberry(77), caminhos = [];
    (function walk(o, p) { if (o && typeof o === 'object') for (const k of Object.keys(o)) { caminhos.push(p.concat(k)); walk(o[k], p.concat(k)); } })(baseObj, []);
    const NF = +process.env.FUZZ_SAVES || 150;
    const vals = [() => null, () => 'x', () => -1, () => 0, () => 9999, () => [], () => ({}), () => true, () => undefined, () => 1e15, () => '', () => 'lua'];
    let nbad = 0;
    for (let i = 0; i < NF; i++) {
      const o = JSON.parse(base), nm = 1 + Math.floor(rng() * 3), desc = [];
      for (let j = 0; j < nm; j++) {
        const p = caminhos[Math.floor(rng() * caminhos.length)]; let t = o; let okp = true;
        for (let q = 0; q < p.length - 1; q++) { t = t && t[p[q]]; if (t == null || typeof t !== 'object') { okp = false; break; } }
        if (!okp) continue; const v = vals[Math.floor(rng() * vals.length)](); desc.push(p.join('.') + '=' + JSON.stringify(v)); if (v === undefined) delete t[p[p.length - 1]]; else t[p[p.length - 1]] = v;
      }
      if (!(await rodar('fuzz ' + i + ': ' + desc.join(' ; ').slice(0, 150), JSON.stringify(o)))) nbad++;
    }
    console.log('    ' + (fixos.length + 33) + ' casos fixos e ' + NF + ' mutações aleatórias; ' + nbad + ' mutações aleatórias que quebraram o jogo; ' + rejeitadosNaLeitura + ' saves rejeitados na leitura e ' + descartadosAoContinuar + ' descartados ao Continuar (a tela não montou)');
    await res.ctx.close();
  }

  /* ---------------------------------------------------------------- 4 */
  if (want('armazenamento')) {
    sec('4. Armazenamento indisponível, bloqueado ou cheio: o jogo segue sem salvar');
    const cenarios = {
      'localStorage lança SecurityError ao ser acessado': `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('bloqueado', 'SecurityError'); }, configurable: true });`,
      'setItem lança QuotaExceededError (disco cheio)': `Storage.prototype.setItem = function () { throw new DOMException('cheio', 'QuotaExceededError'); };`,
      'getItem lança erro': `Storage.prototype.getItem = function () { throw new Error('falha de leitura'); };`,
      'removeItem lança erro': `Storage.prototype.removeItem = function () { throw new Error('falha'); };`,
      'getItem devolve lixo': `Storage.prototype.getItem = function () { return '\\u0000\\ud800{'; };`
    };
    for (const [nome, code] of Object.entries(cenarios)) {
      const { ctx, page, errs } = await abrir(browser, { seed: 51, storage: code });
      const temCont = await page.locator('[data-act=continue]').count();
      const semGravar = /SecurityError|QuotaExceeded/.test(code);   // quando não dá para gravar, o jogador é avisado (uma vez)
      const f = await jogarAte(page, semGravar ? s => s && s.phase === 'siege' && s.stage === 'panel' : noPost, 200);
      if (semGravar) { const avisos = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].filter(t => /salvar a partida/.test(t.textContent)).length); ok(avisos === 1, nome + ': o aviso de que não dá para salvar deveria aparecer uma vez (apareceu ' + avisos + ')'); }
      if (semGravar) await jogarAte(page, noPost, 200);
      if (f) { await act(page, '[data-act=again]'); await page.waitForTimeout(40); }
      ok(!temCont, nome + ': mostrou "Continuar partida" sem save'); ok(f, nome + ': a partida não chegou ao fim');
      ok((await page.locator('[data-act=start]').count()) === 1, nome + ': "Jogar novamente" não voltou ao menu'); ok(errs.length === 0, nome + ': erro de console: ' + errs.slice(0, 2).join(' | '));
      console.log('    ' + nome + ': partida completa e reinício sem erro');
      await ctx.close();
    }
  }

  /* ---------------------------------------------------------------- 5 */
  if (want('reinicio')) {
    sec('5. "Jogar novamente" e novo jogo: nada do jogo anterior sobra');
    const { ctx, page, errs } = await abrir(browser, { seed: 61 });
    const padrao = await page.evaluate(() => JSON.stringify(window.PERIMETRO.UI, (k, v) => typeof v === 'function' ? undefined : v));
    // joga uma partida, deixando rastros na interface (agente e zona escolhidos para reposicionar, aba, nível, zona do mapa, replay)
    await jogarAte(page, s => s && s.phase === 'siege' && s.stage === 'panel' && s.round === 2);
    await act(page, '[data-act=tab][data-t=tatica]');
    await page.selectOption('#repoAgent', { index: 1 }); await page.selectOption('#repoZone', { index: 2 });
    await act(page, '[data-act=lvl][data-t="3"]'); await act(page, '[data-act=zonepick][data-z=beco]');
    const ag = await page.evaluate(() => window.PERIMETRO.UI.repoAgent);
    ok(!!ag, 'preparação: o agente de reposicionamento não foi escolhido');
    await jogarAte(page, noPost);
    await act(page, '[data-act=ptab][data-t=replay]'); await act(page, '[data-act=rnode] >> nth=1'); await act(page, '[data-act=ptab][data-t=debrief]');
    await act(page, '[data-act=again]'); await page.waitForTimeout(50);
    let s = await S(page); ok(s === null, 'Jogar novamente deixou um jogo ativo: ' + JSON.stringify(s));
    ok((await page.evaluate(k => localStorage.getItem(k), SAVE)) === null, 'Jogar novamente não apagou o save');
    ok((await page.locator('[data-act=continue]').count()) === 0, 'o menu ainda oferece "Continuar partida" depois de Jogar novamente');
    const apos = await page.evaluate(() => JSON.parse(JSON.stringify(window.PERIMETRO.UI, (k, v) => typeof v === 'function' ? undefined : v)));
    const pad = JSON.parse(padrao); const difer = Object.keys(pad).filter(k => JSON.stringify(pad[k]) !== JSON.stringify(apos[k]) && !['diffSel', 'noLimit', 'tkPause', 'timerRound', 'deadline'].includes(k));
    ok(difer.length === 0, 'estado da interface não voltou ao inicial depois de Jogar novamente: ' + difer.map(k => `${k}=${JSON.stringify(apos[k])}`).join(', '));
    // novo jogo com outra equipe: o seletor de reposicionamento não pode oferecer ninguém de fora
    await act(page, '[data-act=diff][data-v=caotico]'); await act(page, '[data-act=start]'); await act(page, '[data-act=tobrief]');
    for (const id of ['sofia', 'diego']) await act(page, `[data-act=hire][data-id=${id}]`);
    await act(page, '[data-act=torecruit]'); await act(page, '[data-act=cutgo]'); await act(page, '[data-act=autoplace]'); await act(page, '[data-act=tosiege]'); await act(page, '[data-act=cutgo]'); await act(page, '[data-act=takepanel]');
    await act(page, '[data-act=tab][data-t=tatica]');
    const seletor = await page.evaluate(() => ({ ui: window.PERIMETRO.UI.repoAgent, opts: [...document.querySelectorAll('#repoAgent option')].map(o => o.value).filter(Boolean), team: window.PERIMETRO.G.team }));
    ok(seletor.ui === '' || seletor.team.includes(seletor.ui), `a interface lembra um agente do jogo anterior (${seletor.ui}) que não está na equipe nova (${seletor.team.join(',')})`);
    const st = await page.evaluate(() => { const G = window.PERIMETRO.G; return { log: G.log.length, hist: G.hist.length, queue: G.queue.length, credits: Math.round(G.credits), round: G.round, comms: G.stats.comms, diff: G.diff }; });
    ok(st.log === 0 && st.hist === 0 && st.queue === 0 && st.comms === 0 && st.diff === 'caotico', 'jogo novo com resíduo do anterior: ' + JSON.stringify(st));
    ok(errs.length === 0, 'erros de console: ' + errs.slice(0, 2).join(' | '));
    // iniciar um jogo novo por cima de um save existente
    await act(page, '[data-act=tomenu]'); // só existe no pós-jogo; no cerco usa-se o botão do menu, se houver
    const menuBtn = await page.locator('[data-act=tomenu]').count();
    console.log('    botão de voltar ao menu durante o cerco: ' + (menuBtn ? 'presente' : 'ausente'));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 6 */
  if (want('timers')) {
    sec('6. Cronômetro, ouvintes e memória');
    {
      const { ctx, page, errs } = await abrir(browser, { seed: 71 });
      const ivs = () => page.evaluate(() => window.__iv.size);   // sem relógio falso: o rastreador de setInterval da página fica intacto
      const por = {};
      for (let i = 0; i < 400; i++) {
        const s = await S(page); const k = s ? s.phase + '/' + s.stage : 'menu'; (por[k] = por[k] || new Set()).add(await ivs());
        if (s && s.phase === 'post') break; if (!(await avancar(page))) break;
      }
      const painel = por['siege/panel'] ? [...por['siege/panel']] : [];
      ok(painel.length && painel.every(n => n === 1), 'no painel deveria haver exatamente 1 cronômetro, houve: ' + painel.join(','));
      const fora = Object.entries(por).filter(([k]) => k !== 'siege/panel').filter(([k, v]) => [...v].some(n => n !== 0)).map(([k, v]) => k + '=' + [...v].join('/'));
      ok(fora.length === 0, 'cronômetro ativo fora do painel: ' + fora.join(', '));
      console.log('    cronômetros por estado: ' + Object.entries(por).map(([k, v]) => k + '=' + [...v].join('/')).join(' · '));
      // expira: o plano atual é executado uma única vez e a rodada avança
      await page.evaluate(() => { const P = window.PERIMETRO; P.UI.noLimit = false; });
      const { ctx: c2, page: p2, errs: e2 } = await abrir(browser, { seed: 72 });
      await p2.clock.install();
      await jogarAte(p2, s => s && s.phase === 'siege' && s.stage === 'panel' && s.round === 3);
      const antes = await S(p2);
      await p2.clock.fastForward(400000); await p2.waitForTimeout(80);
      const depois = await S(p2);
      ok(depois && (depois.stage === 'result' || depois.stage === 'event' || depois.phase === 'outcome') && depois.round === 3, 'ao expirar o tempo a rodada 3 deveria ser executada uma vez: ' + key(antes) + ' → ' + key(depois));
      ok(((await p2.evaluate(() => window.__iv.size))) === 0, 'cronômetro continuou rodando depois de expirar');
      await c2.close();
      // pausa com a aba oculta
      const { ctx: c3, page: p3, errs: e3 } = await abrir(browser, { seed: 73 });
      await p3.clock.install();
      await jogarAte(p3, s => s && s.phase === 'siege' && s.stage === 'panel' && s.round === 4);
      await p3.clock.runFor(20000);
      const rest0 = await p3.evaluate(() => document.getElementById('clock').textContent);
      await p3.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await p3.clock.runFor(300000);
      const s3 = await S(p3);
      ok(s3 && s3.stage === 'panel', 'a rodada foi executada enquanto a aba estava oculta: ' + key(s3));
      await p3.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      await p3.clock.runFor(1000); const rest1 = await p3.evaluate(() => document.getElementById('clock').textContent);
      const sec2 = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
      ok(Math.abs(sec2(rest0) - sec2(rest1)) <= 3, `o tempo restante deveria continuar de onde parou ao voltar à aba (${rest0} → ${rest1})`);
      await c3.close();
      // retomada preserva o tempo que sobrava
      const { ctx: c4, page: p4 } = await abrir(browser, { seed: 74 });
      await p4.clock.install();
      await jogarAte(p4, s => s && s.phase === 'siege' && s.stage === 'panel' && s.round === 4);
      await p4.clock.runFor(40000);
      const r0 = await p4.evaluate(() => document.getElementById('clock').textContent);
      await p4.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await p4.reload(); await p4.clock.install(); await act(p4, '[data-act=continue]'); await p4.waitForTimeout(60);
      const r1 = await p4.evaluate(() => document.getElementById('clock') && document.getElementById('clock').textContent);
      ok(r1 && Math.abs(sec2(r0) - sec2(r1)) <= 3, `recarregar a página devolveu o tempo cheio da rodada (${r0} → ${r1}); deveria continuar de onde parou`);
      await c4.close();
      ok(errs.length + e2.length + e3.length === 0, 'erros de console: ' + errs.concat(e2, e3).slice(0, 2).join(' | '));
      await ctx.close();
    }
    // ouvintes e memória: seis partidas na mesma página
    {
      const { ctx, page, errs } = await abrir(browser, { seed: 81 });
      const cdp = await ctx.newCDPSession(page);
      const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); return (await page.evaluate(() => performance.memory.usedJSHeapSize)) / 1048576; };
      const nos = () => page.evaluate(() => document.getElementsByTagName('*').length);
      const ouv = () => page.evaluate(() => JSON.stringify(window.__listeners));
      const medidas = [];
      for (let g = 0; g < 6; g++) {
        if (!(await S(page))) await act(page, '[data-act=start]');
        const f = await jogarRapido(page); ok(f === 'ok', `partida ${g + 1} não terminou: ${f}`);
        await act(page, '[data-act=again]'); await page.waitForTimeout(50);
        medidas.push({ heap: await heap(), nos: await nos(), ouv: await ouv() });
      }
      const h0 = medidas[1].heap, h5 = medidas[5].heap, n0 = medidas[1].nos, n5 = medidas[5].nos;
      ok(h5 - h0 < 3, `a memória cresce entre as partidas 2 e 6: ${h0.toFixed(1)} → ${h5.toFixed(1)} MB`);
      ok(Math.abs(n5 - n0) <= 5, `o número de nós da página cresce: ${n0} → ${n5}`);
      ok(medidas.every(m => m.ouv === medidas[0].ouv), 'os ouvintes do documento mudam entre as partidas: ' + medidas.map(m => m.ouv).join(' / '));
      console.log(`    memória após cada partida (MB): ${medidas.map(m => m.heap.toFixed(1)).join(', ')} · nós: ${medidas.map(m => m.nos).join(', ')} · ouvintes persistentes: ${medidas[0].ouv}`);
      ok(errs.length === 0, 'erros de console: ' + errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  }

  /* ---------------------------------------------------------------- 7 */
  if (want('cliques')) {
    sec('7. Duplo clique e ações fora de hora não pulam etapas');
    const { ctx, page, errs } = await abrir(browser, { seed: 91 });
    await jogarAte(page, s => s && s.phase === 'siege' && s.stage === 'panel' && s.round === 2);
    await act(page, '[data-act=tab][data-t=nego]'); await act(page, '[data-act=addnego][data-t="1"]');
    await page.locator('[data-act=execute]').first().dblclick(); await page.waitForTimeout(60);
    let s = await S(page);
    ok(s && (s.stage === 'result' || s.stage === 'event') && s.round === 2, 'duplo clique em "Executar rodada" pulou o resultado: ' + key(s));
    if (s.stage === 'event') { await act(page, '.evcard [data-act=evchoice][data-i="0"]'); }
    s = await S(page);
    if (s.stage === 'result') { await page.locator('[data-act=cont]').first().dblclick(); await page.waitForTimeout(60); s = await S(page); ok(s && s.stage === 'update' && s.round === 3, 'duplo clique em "Seguir para a rodada" pulou a atualização: ' + key(s)); }
    // ações chamadas fora do estágio certo (por exemplo, um clique atrasado) não podem mexer no jogo
    const fora = await page.evaluate(() => {
      const P = window.PERIMETRO, G = P.G, out = {}; const snap = () => JSON.stringify([G.phase, G.stage, G.round, G.credits, G.queue.length]);
      const t = (nome, fn) => { const a = snap(); try { fn(); } catch (e) { out[nome] = 'exceção ' + e.message; return; } out[nome] = snap() === a ? 'ignorada' : 'MUDOU ' + a + ' → ' + snap(); };
      G.stage = 'update';
      t('execute no estágio update', () => P.ACT.execute({}));
      t('cont no estágio update', () => P.ACT.cont({}));
      t('evchoice no estágio update', () => P.ACT.evchoice({ i: 0 }));
      G.stage = 'panel';
      t('takepanel no estágio panel', () => P.ACT.takepanel({}));
      t('cont no estágio panel', () => P.ACT.cont({}));
      t('toscore no cerco', () => P.ACT.toscore({}));
      t('tosiege no cerco', () => P.ACT.tosiege({}));
      t('torecruit no cerco', () => P.ACT.torecruit({}));
      t('tobrief no cerco', () => P.ACT.tobrief({}));
      G.stage = 'result';
      t('takepanel no estágio result', () => P.ACT.takepanel({}));
      t('execute no estágio result', () => P.ACT.execute({}));
      return out;
    });
    for (const [k, v] of Object.entries(fora)) ok(v === 'ignorada', `${k}: ${v}`);
    console.log('    ações fora de hora: ' + Object.entries(fora).map(([k, v]) => k + '=' + v).join(' · '));
    ok(errs.length === 0, 'erros de console: ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 8 */
  if (want('menu')) {
    sec('8. Menu no meio da partida, nova partida sobre um save e aviso de save descartado');
    const { ctx, page, errs } = await abrir(browser, { seed: 101 });
    await page.clock.install();
    const txt = sel => page.evaluate(q => { const e = document.querySelector(q); return e ? e.textContent : null; }, sel);
    const seg = t => { const [m, s2] = t.split(':').map(Number); return m * 60 + s2; };
    const tem = sel => page.locator(sel).count();
    // 1. o botão existe em todas as fases da partida e abre uma janela que Esc fecha
    const fases = [['briefing', s => s.phase === 'briefing'], ['recruit', s => s.phase === 'recruit'], ['perimeter', s => s.phase === 'perimeter' && !s.cut],
      ['siege/update', s => s.phase === 'siege' && s.stage === 'update' && !s.cut], ['siege/panel', s => s.phase === 'siege' && s.stage === 'panel' && s.round === 2], ['siege/result', s => s.phase === 'siege' && s.stage === 'result' && s.round === 2]];
    for (const [nome, pred] of fases) {
      await jogarAte(page, s => !!s && pred(s));
      const s0 = await S(page), k0 = key(s0);
      ok((await tem('[data-act=menu]')) === 1, nome + ': sem botão Menu');
      await act(page, '[data-act=menu]');
      ok((await tem('[data-act=menuyes]')) === 1 && (await tem('[data-act=menuno]')) === 1, nome + ': a janela de confirmação não abriu');
      await page.keyboard.press('Escape'); await page.waitForTimeout(40);
      ok((await tem('[data-act=menuyes]')) === 0 && key(await S(page)) === k0, nome + ': Esc deveria fechar a janela e manter a partida em ' + k0 + ', ficou em ' + key(await S(page)));
    }
    // 2. no painel o relógio para enquanto a janela está aberta e volta quando se cancela
    await jogarAte(page, s => s.phase === 'siege' && s.stage === 'panel' && s.round === 3);
    await page.clock.runFor(10000);
    await act(page, '[data-act=menu]');
    const c0 = await txt('#clock'); await page.clock.runFor(60000);
    const c1 = await txt('#clock'); ok(c0 === c1, `o relógio correu com a janela de menu aberta (${c0} → ${c1})`);
    ok(key(await S(page)).startsWith('siege/panel'), 'a rodada foi executada enquanto a janela de menu estava aberta: ' + key(await S(page)));
    await act(page, '[data-act=menuno]'); await page.clock.runFor(5000);
    const c2 = await txt('#clock'); ok(seg(c0) - seg(c2) >= 3 && seg(c0) - seg(c2) <= 7, `o relógio deveria voltar a correr depois de cancelar (${c0} → ${c2})`);
    // 3. voltar ao menu guarda a partida, e Continuar devolve o mesmo ponto com o tempo que sobrava
    const antes = await S(page), restava = await txt('#clock');
    await act(page, '[data-act=menu]'); await act(page, '[data-act=menuyes]'); await page.waitForTimeout(40);
    ok((await S(page)) === null, 'Voltar ao menu deveria sair da partida');
    ok((await tem('[data-act=continue]')) === 1, 'o menu deveria oferecer Continuar partida depois de Voltar ao menu');
    await page.clock.runFor(120000);
    await act(page, '[data-act=continue]'); await page.waitForTimeout(40);
    const depois = await S(page), restou = await txt('#clock');
    ok(depois && key(depois) === key(antes) && depois.queue === antes.queue, `Continuar deveria voltar ao mesmo ponto: ${key(antes)} → ${depois ? key(depois) : 'menu'}`);
    ok(Math.abs(seg(restava) - seg(restou)) <= 3, `o tempo que sobrava na rodada mudou enquanto a partida ficava no menu (${restava} → ${restou})`);
    // 4. iniciar por cima de um save em andamento pede confirmação
    await act(page, '[data-act=menu]'); await act(page, '[data-act=menuyes]'); await page.waitForTimeout(40);
    const raw0 = await page.evaluate(k => localStorage.getItem(k), SAVE);
    await act(page, '[data-act=start]');
    ok((await S(page)) === null && (await tem('[data-act=newyes]')) === 1 && (await tem('[data-act=newno]')) === 1, 'Iniciar sobre um save em andamento deveria pedir confirmação');
    ok((await page.evaluate(k => localStorage.getItem(k), SAVE)) === raw0, 'o save mudou antes da confirmação');
    await page.keyboard.press('Escape'); await page.waitForTimeout(40);
    ok((await tem('[data-act=newyes]')) === 0 && (await S(page)) === null && (await tem('[data-act=continue]')) === 1, 'Esc deveria cancelar e manter o save');
    await act(page, '[data-act=start]'); await act(page, '[data-act=newno]');
    ok((await page.evaluate(k => localStorage.getItem(k), SAVE)) === raw0, 'Manter a partida salva alterou o save');
    await act(page, '[data-act=start]'); await act(page, '[data-act=newyes]'); await page.waitForTimeout(40);
    const nova = await S(page);
    ok(nova && nova.phase === 'briefing' && nova.round === 0, 'Apagar e iniciar deveria abrir um jogo novo no briefing: ' + JSON.stringify(nova));
    const rawN = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), SAVE);
    ok(rawN && rawN.phase === 'briefing' && rawN.log.length === 0, 'o save deveria ser o do jogo novo');
    // 5. depois de uma partida terminada não há o que confirmar
    const f = await jogarRapido(page); ok(f === 'ok', 'partida não terminou: ' + f);
    await act(page, '[data-act=tomenu]'); await act(page, '[data-act=start]'); await page.waitForTimeout(40);
    const s5 = await S(page); ok(s5 && s5.phase === 'briefing', 'depois de uma partida terminada, Iniciar deveria começar direto: ' + JSON.stringify(s5));
    ok(errs.length === 0, 'erros de console: ' + errs.slice(0, 2).join(' | '));
    await ctx.close();
    // 6. save ilegível: o menu avisa uma vez e descarta
    const ctx2 = await abrir(browser, { seed: 102 });
    await ctx2.page.evaluate(k => localStorage.setItem(k, '{{{'), SAVE); await ctx2.page.reload(); await ctx2.page.waitForTimeout(40);
    const aviso = await ctx2.page.locator('.menu .insight.warn').count();
    ok(aviso === 1, 'o menu deveria avisar que a partida salva foi descartada (avisos: ' + aviso + ')');
    ok((await ctx2.page.locator('[data-act=continue]').count()) === 0 && (await ctx2.page.evaluate(k => localStorage.getItem(k), SAVE)) === null, 'o save ilegível deveria ter sido removido');
    await act(ctx2.page, '[data-act=diff][data-v=caotico]'); await ctx2.page.waitForTimeout(30);
    ok((await ctx2.page.locator('.menu .insight.warn').count()) === 0, 'o aviso de save descartado deveria aparecer só uma vez');
    ok(ctx2.errs.length === 0, 'erros de console: ' + ctx2.errs.slice(0, 2).join(' | '));
    await ctx2.ctx.close();
  }

  await browser.close();
  console.log('\n' + (fails ? fails + ' FALHAS em ' + checks + ' verificações' : checks + ' verificações, 0 falhas'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FALHA DO TESTE', e); process.exit(2); });
