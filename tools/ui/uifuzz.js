// Fuzz de interface: joga centenas de partidas pelo motor real, dentro do navegador, e renderiza TODAS as telas em cada estado,
// procurando texto quebrado (undefined, NaN, [object Object], null, Infinity), exceções e telas vazias.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = process.env.PERI_HTML || path.join(__dirname, '..', '..', 'perimetro-standalone.html');
const SIM = path.join(__dirname, '..', 'sim');
const N = +process.argv[2] || 120;

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1366, height: 800 } })).newPage();
  const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto('file://' + FILE);
  const botsSrc = fs.readFileSync(path.join(SIM, 'bots.js'), 'utf8');
  await page.evaluate(({ botsSrc }) => {
    const ev = (0, eval);
    function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    const A = ev(`({
      get G() { return G; }, set G(v) { G = v; },
      newGame, startRound, resolveDecisions, chooseEvent, finishRound, addDecision, removeDecision, computeScore, zoneCoverage, intervProb, intervPower, negoParts, negoSkill, autoPlace, confirmPerimeter, phase1Intel,
      stat, agentEff, ff, fp, deployed, avail, agentsIn, plantaoCost, apoioCost, horasCost, intelCost, infoFrac, knownCount, calcPressure, gradeOf, saveGame, loadSave,
      getNegotiator, hasGear, isAway, blindParts, doIntervention, doSurrender, doEscape, doUltimatum, ultimatumProb,
      DIFF, PROFILES, AGENTS, GENERICS, EQUIP, INTEL, COMMS, POSTURES, STEPS, STK, STK_KEYS, ZONES, ZONE, EVENT_DEFS, EVENT_FX, EVDEF, BADGES, HOSTAGES, MAX_ROUNDS, agentById, clamp
    })`);
    A.reseed = s => { Math.random = mulberry32(s >>> 0); };
    const module = { exports: {} };
    new Function('module', 'require', botsSrc)(module, () => ({ load: () => A, mulberry32 }));
    const B = module.exports;
    const UIo = ev('UI');
    const R = ev(`({ renderMenu, renderBriefing, renderRecruit, renderPerimeter, renderUpdate, renderPanel, renderEventStage, renderResult, renderOutcome, renderPost, perceivedAgit, hudHTML })`);
    const bres = /undefined|NaN|\[object Object\]|\bnull\b|Infinity/;
    const fz = window.__fz = { bad: [], stats: { games: 0, renders: 0 } };
    const parser = new DOMParser();
    const check = (tag, html) => {
      if (!html || html.length < 80) { fz.bad.push(`${tag}: tela vazia/curta (${html ? html.length : 0})`); return; }
      const txt = html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ');
      let m = txt.match(bres); if (m) fz.bad.push(`${tag}: texto "${m[0]}" → …${txt.slice(Math.max(0, txt.indexOf(m[0]) - 60), txt.indexOf(m[0]) + 40).replace(/\s+/g, ' ')}…`);
      const raw = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
      m = raw.match(/="(undefined|NaN|null|Infinity|\[object Object\])"|(undefined|NaN)px|NaN%|undefined%/); if (m) fz.bad.push(`${tag}: atributo quebrado ${m[0]}`);
    };
    const safe = (tag, fn) => { try { const h = fn(); check(tag, h); return h; } catch (e) { fz.bad.push(`${tag}: EXCEÇÃO ${e.message} @ ${(e.stack || '').split('\n')[1]}`); return ''; } };
    const diffs = ['protocolar', 'complexo', 'caotico'];
    const renderPanelAll = (tag) => {
      for (const tab of ['tatica', 'nego', 'intel', 'com']) for (const lv of [1, 2, 3]) { UIo.tab = tab; UIo.lvl = lv; safe(`${tag}/panel[${tab},L${lv}]`, R.renderPanel); fz.stats.renders++; }
      UIo.ivConfirm = true; UIo.tab = 'tatica'; safe(`${tag}/panel[ivConfirm]`, R.renderPanel); UIo.ivConfirm = false; fz.stats.renders++;
    };
    fz.runBatch = (start, count) => {
      for (let i = start; i < start + count; i++) {
        const diff = diffs[i % 3], seed = 70000 + i;
        const pols = [() => B.policyFuzz(mulberry32(seed + 5)), () => B.policyEquilibrado(), () => B.policyNegociador(), () => B.policyAgressivo(3, .4), () => B.policyEdge('gastaTudo'), () => B.policyEdge('nenhum'), () => B.policyEdge('soCom')];
        const pol = pols[i % pols.length]();
        A.reseed(seed); A.newGame(diff); const G = A.G; UIo.diffSel = diff;
        const tag0 = `g${i}/${diff}/${pol.name}`;
        G.phase = 'briefing'; safe(tag0 + '/brief', R.renderBriefing);
        G.phase = 'recruit'; safe(tag0 + '/recruit', R.renderRecruit);
        pol.setup(A);
        G.phase = 'recruit'; safe(tag0 + '/recruit2', R.renderRecruit);
        G.phase = 'perimeter'; safe(tag0 + '/perim', R.renderPerimeter);
        A.confirmPerimeter(); G.phase = 'siege'; A.startRound();
        let guard = 0;
        while (!G.end && guard++ < 12) {
          const tag = `${tag0}/R${G.round}`;
          G.stage = 'update'; safe(tag + '/update', R.renderUpdate); fz.stats.renders++;
          G.stage = 'panel';
          pol.decide(A, G.round);
          renderPanelAll(tag);
          const r = A.resolveDecisions();
          if (r && r.event) {
            safe(tag + '/event', R.renderEventStage); fz.stats.renders++;
            const n = A.EVENT_FX[r.event].choices.length; const pref = pol.event ? pol.event(A, r.event) : 0; let ok = A.chooseEvent(pref); for (let k = 0; k < n && !ok; k++) ok = A.chooseEvent(k);
          }
          safe(tag + '/result', R.renderResult); fz.stats.renders++;
          if (!G.end) A.startRound();
        }
        if (!G.end) { fz.bad.push(tag0 + ': não terminou'); continue; }
        G.phase = 'outcome'; safe(tag0 + '/outcome', R.renderOutcome); fz.stats.renders++;
        G.phase = 'post';
        for (const t of ['score', 'news', 'badges', 'replay', 'debrief']) { UIo.post = t; UIo.replayR = 1 + (i % Math.max(1, G.log.length)); safe(`${tag0}/post-${t}`, R.renderPost); fz.stats.renders++; }
        fz.stats.games++;
      }
    };
  }, { botsSrc });
  const BATCH = 8;
  for (let i = 0; i < N; i += BATCH) {
    await page.evaluate(({ i, n }) => window.__fz.runBatch(i, n), { i, n: Math.min(BATCH, N - i) });
    if ((i / BATCH) % 10 === 0) { const mem = await page.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1); process.stderr.write(`  ${i}/${N} jogos, heap JS ${mem} MB\n`); }
  }
  const result = await page.evaluate(() => ({ bad: window.__fz.bad, stats: window.__fz.stats }));
  await browser.close();
  console.log(`partidas ${result.stats.games}/${N}, renders ${result.stats.renders}`);
  const uniq = [...new Set(result.bad.map(b => b.replace(/^g\d+\//, '').replace(/\/R\d+/, '/R#')))];
  console.log(uniq.length ? 'PROBLEMAS (' + result.bad.length + ' ocorrências, ' + uniq.length + ' únicos):\n' + uniq.slice(0, 40).join('\n') : 'nenhum texto quebrado');
  console.log(errs.length ? 'CONSOLE:\n' + [...new Set(errs)].slice(0, 15).join('\n') : 'console limpo');
})().catch(e => { console.error('FALHA', e); process.exit(1); });
