// Casos extremos na tela (L2.4): estados-limite forçados no jogo real, dentro do navegador, com todas as telas desenhadas em cada um.
//   feridos   todos os 17 reféns feridos desde o começo           agit100   agitação em 100 em plena rodada
//   cofre100  cofre cheio no começo da rodada                       verba0    créditos zerados (o que custa tem de estar indisponível)
//   semNeg    partidas sem uma negociação e/ou sem informação: a Gazeta e o desfecho não podem contar o que não houve
//   semEquipe nenhum recruta (as guarnições genéricas)               corrida   o tempo da rodada acaba no mesmo instante do clique em Executar
//   promessas o que o painel diz do traço da Carla e das notas dos equipamentos bate com o motor (L2.5)
// uso: NODE_PATH=$(npm root -g) node tools/ui/limites.js [caso ...]      (PERI_HTML=/outro-standalone.html testa uma cópia)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = process.env.PERI_HTML || path.join(__dirname, '..', '..', 'perimetro-standalone.html');
const SIM = path.join(__dirname, '..', 'sim');
const CASOS = process.argv.slice(2).length ? process.argv.slice(2) : ['feridos', 'agit100', 'cofre100', 'verba0', 'semNeg', 'semEquipe', 'promessas', 'corrida'];

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
      stat, agentEff, ff, fp, deployed, avail, agentsIn, plantaoCost, apoioCost, horasCost, intelCost, infoFrac, knownCount, calcPressure, gradeOf, saveGame, loadSave, syncHL, snap, siegeAlerts, perceivedAgit,
      getNegotiator, hasGear, isAway, blindParts, doIntervention, doSurrender, doEscape, doUltimatum, ultimatumProb, badgeEarned,
      DIFF, PROFILES, AGENTS, GENERICS, EQUIP, INTEL, COMMS, POSTURES, STEPS, STK, STK_KEYS, ZONES, ZONE, EVENT_DEFS, EVENT_FX, EVDEF, BADGES, HOSTAGES, MAX_ROUNDS, agentById, clamp
    })`);
    A.reseed = s => { Math.random = mulberry32(s >>> 0); };
    const module = { exports: {} };
    new Function('module', 'require', botsSrc)(module, () => ({ load: () => A, mulberry32 }));
    const B = module.exports;
    const UIo = ev('UI');
    const R = ev(`({ renderMenu, renderBriefing, renderRecruit, renderPerimeter, renderUpdate, renderPanel, renderEventStage, renderResult, renderOutcome, renderPost, outcomeStory, newsHTML, hostagesFramed, truthHTML })`);
    const falhas = [], notas = [];
    const bres = /undefined|NaN|\[object Object\]|\bnull\b|Infinity/;
    const scan = (tag, html) => {
      if (!html || html.length < 80) { falhas.push(`${tag}: tela vazia/curta (${html ? html.length : 0})`); return; }
      const txt = html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ');
      let m = txt.match(bres); if (m) falhas.push(`${tag}: texto "${m[0]}" → …${txt.slice(Math.max(0, txt.indexOf(m[0]) - 60), txt.indexOf(m[0]) + 40).replace(/\s+/g, ' ')}…`);
      const raw = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
      m = raw.match(/="(undefined|NaN|null|Infinity|\[object Object\])"|(undefined|NaN)px|NaN%|undefined%/); if (m) falhas.push(`${tag}: atributo quebrado ${m[0]}`);
      // dentro dos SVG (mapa, medidores em linha, radar, curvas) um NaN vira caminho quebrado sem aparecer em texto nenhum
      for (const sv of html.match(/<svg[\s\S]*?<\/svg>/g) || []) { const b = sv.match(/\s(?:d|points|cx|cy|x|y|x1|x2|y1|y2|r|width|height|transform|viewBox)="[^"]*(?:NaN|undefined|Infinity)[^"]*"/); if (b) { falhas.push(`${tag}: SVG com número quebrado →${b[0].slice(0, 90)}`); break; } }
      for (const w of raw.matchAll(/(?:width|--w)\s*:\s*(-?\d+(?:\.\d+)?)%/g)) if (+w[1] > 100.01 || +w[1] < -0.01) { falhas.push(`${tag}: largura fora de 0–100%: ${w[0]}`); break; }
    };
    const safe = (tag, fn) => { try { const h = fn(); scan(tag, h); return h; } catch (e) { falhas.push(`${tag}: EXCEÇÃO ${e.message} @ ${(e.stack || '').split('\n')[1]}`); return ''; } };
    const ok = (c, m) => { if (!c) falhas.push(m); return c; };
    const diffs = ['protocolar', 'complexo', 'caotico'];
    const painel = tag => {
      for (const tab of ['tatica', 'nego', 'intel', 'com']) for (const lv of [1, 2, 3]) { UIo.tab = tab; UIo.lvl = lv; safe(`${tag}/painel[${tab},L${lv}]`, R.renderPanel); }
      UIo.ivConfirm = true; UIo.tab = 'tatica'; safe(`${tag}/painel[ivConfirm]`, R.renderPanel); UIo.ivConfirm = false;
    };
    /** Cena no cerco, no começo da rodada `round`, sem carta de evento nela. */
    const cena = (diff, seed, team, gear, round, mut) => {
      A.reseed(seed); A.newGame(diff); const G = A.G; UIo.diffSel = diff;
      team.forEach(id => B.hire(A, id)); gear.forEach(e => B.buy(A, e));
      if (!G.team.length) { G.team = ['g1', 'g2']; G.stats.noRecruit = true; G.team.forEach(id => G.az[id] = 'reserva'); }
      A.autoPlace(); A.confirmPerimeter(); G.phase = 'siege'; G.round = round - 1; G.quietRound = round; A.startRound(); if (mut) mut(G);
      G.pressure = A.calcPressure(); return G;
    };
    /** Joga até o fim com a política, desenhando todas as telas de cada estado, o desfecho e as cinco abas do pós-jogo. */
    const joga = (tag, pol) => {
      const G = A.G; let guard = 0;
      while (!G.end && guard++ < 12) {
        const t = `${tag}/R${G.round}`;
        G.stage = 'update'; safe(t + '/update', R.renderUpdate);
        G.stage = 'panel'; pol.decide(A, G.round); painel(t);
        const r = A.resolveDecisions();
        if (r && r.event) { safe(t + '/evento', R.renderEventStage); const n = A.EVENT_FX[r.event].choices.length; let o = A.chooseEvent(pol.event ? pol.event(A, r.event) : 0); for (let k = 0; k < n && !o; k++) o = A.chooseEvent(k); }
        safe(t + '/resultado', R.renderResult);
        if (!G.end) A.startRound();
      }
      if (!ok(G.end, tag + ': não terminou')) return;
      G.phase = 'outcome'; safe(tag + '/desfecho', R.renderOutcome); G.phase = 'post';
      for (const k of ['score', 'news', 'badges', 'replay', 'debrief']) { UIo.post = k; UIo.replayR = 1 + (G.round - 1) % Math.max(1, G.log.length); safe(`${tag}/pos-${k}`, R.renderPost); }
    };
    const txtOf = html => html.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    const polNeg = () => B.policyNegociador();
    const CASO = {
      feridos() {
        let n = 0;
        for (const diff of diffs) for (let k = 0; k < 6; k++) {
          cena(diff, 40 + k, ['renata', 'paulo', 'carla', 'marcos'], k % 2 ? ['kit'] : [], 1, g => { g.hostages.hurt = A.HOSTAGES; A.syncHL(null); });
          const G = A.G; ok(G.hostages.hurt === 17 && G.hl.every(h => h.st === 'hurt'), 'cena dos feridos mal montada');
          UIo.tab = 'tatica'; const quadro = safe('feridos/hud', R.renderPanel);
          joga(`feridos/${diff}/${k}`, polNeg()); n++;
          const H = A.G.hostages; ok(H.hurt + H.dead <= 17 && H.inside + H.freed === 17, `feridos/${diff}/${k}: contadores fora do possível ${JSON.stringify(H)}`);
        }
        notas.push(`${n} partidas começando com os 17 reféns feridos, todas as telas desenhadas`);
      },
      agit100() {
        for (const diff of diffs) {
          const G = cena(diff, 52, ['renata', 'paulo', 'marcos'], [], 3, g => { g.agit = 100; });
          const pa = A.perceivedAgit(); ok(pa.v <= 106 && Number.isFinite(pa.v), `${diff}: agitação aparente fora da faixa ${pa.v}`);
          const al = A.siegeAlerts(); ok(al.some(x => /agita|líder/i.test(x.title + ' ' + x.txt)), `${diff}: nenhum alerta de agitação com o líder em 100 (${al.map(x => x.title).join(', ')})`);
          painel(`agit100/${diff}`); joga(`agit100/${diff}`, polNeg());
        }
        notas.push('agitação 100 em plena rodada 3, nos três níveis: alerta de agitação presente e telas inteiras desenhadas');
      },
      cofre100() {
        for (const diff of diffs) {
          const G = cena(diff, 61, ['renata', 'paulo', 'marcos'], [], 3, g => { g.vault = 100; g.agit = 50; });
          painel(`cofre100/${diff}`); joga(`cofre100/${diff}`, { decide: () => [], event: () => 0 });
          const G2 = A.G; ok(G2.end && G2.end.type === 'fuga' && G2.end.cause === 'cofre', `${diff}: cofre cheio deveria terminar em fuga: ${G2.end && G2.end.type}`);
          const o = R.outcomeStory().p.join(' ') + R.newsHTML(); ok(/cofre/i.test(o), `${diff}: o desfecho não menciona o cofre aberto`);
        }
        notas.push('cofre 100% no começo da rodada: termina em fuga pelo cofre e o desfecho conta o cofre aberto');
      },
      verba0() {
        for (const diff of diffs) {
          const G = cena(diff, 70, ['renata', 'paulo', 'marcos', 'lucas'], [], 3, g => { g.credits = 0; });
          const dis = (tab, sel) => { UIo.tab = tab; UIo.lvl = 1; const d = document.createElement('div'); d.innerHTML = R.renderPanel(); return [...d.querySelectorAll(sel)]; };
          const pago = (tab, sel, m) => dis(tab, sel).forEach(b => ok(b.getAttribute('aria-disabled') === 'true', `${diff}: ${m} está habilitado com a verba em 0`));
          pago('intel', '[data-act=addintel]', 'investigação'); pago('tatica', '[data-act=addhoras]', 'horas extras'); pago('tatica', '[data-act=addapoio]', 'apoio externo'); pago('com', '[data-act=addcom][data-id=acolhe]', 'sala de acolhimento');
          ['coletiva', 'prefeito', 'gerente', 'geral'].forEach(id => dis('com', `[data-act=addcom][data-id=${id}]`).forEach(b => ok(b.getAttribute('aria-disabled') !== 'true', `${diff}: comunicação gratuita "${id}" indisponível com a verba em 0`)));
          ok(dis('tatica', '[data-act=addpausa]').every(b => b.getAttribute('aria-disabled') !== 'true'), `${diff}: Pausa de Comando indisponível com a verba em 0`);
          // cartas pagas: a escolha cara fica indisponível e a gratuita continua à mão
          for (const id of ['heli', 'fadiga']) {
            G.R = { lines: [], s0: A.snap(), decs: [], eventId: id, ev: null, sec: 'dec', stkWhy: {}, hchg: [] }; G.pendingEvent = id; G.stage = 'event';
            const d = document.createElement('div'); d.innerHTML = R.renderEventStage(); const bs = [...d.querySelectorAll('[data-act=evchoice]')];
            A.EVENT_FX[id].choices.forEach((c, i) => { const b = bs.find(x => +x.dataset.i === i); ok(b && (b.getAttribute('aria-disabled') === 'true') === !!c.cost, `${diff}/${id}: escolha ${i} ${c.cost ? 'paga deveria estar indisponível' : 'gratuita deveria estar disponível'}`); });
            scan(`verba0/${diff}/${id}`, R.renderEventStage());
          }
          G.pendingEvent = null; G.stage = 'panel';
          joga(`verba0/${diff}`, polNeg());
        }
        notas.push('verba 0: investigação, horas, apoio e sala de acolhimento indisponíveis; comunicação gratuita e Pausa à mão; cartas pagas deixam a saída gratuita');
      },
      semNeg() {
        const FALA = /depois de (?:rodadas de )?negociação|negociação (?:conduzida|foi decisiva|que chegou)|degrau \d|rodadas de conversa|a escada foi|chegou ao degrau/i;
        const INFO = /depois de [^.]*levantamento de informações|informação reunida antes da entrada|a informação certa/i;
        let jogos = 0, semConversa = 0, semInfo = 0;
        const pols = [() => B.policyEdge('ignoraNego'), () => B.policyEdge('intervSempre'), () => B.policyEdge('passivo'), () => B.policyEdge('pausaSempre'), () => B.policyEdge('soTatica'), () => B.policyEdge('umaZona')];
        for (const diff of diffs) for (let k = 0; k < 30; k++) {
          const pol = pols[k % pols.length](), seed = 8000 + k * 7 + diffs.indexOf(diff);
          A.reseed(seed); A.newGame(diff); pol.setup(A); A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound();
          const G = A.G; let guard = 0;
          while (!G.end && guard++ < 12) { G.stage = 'panel'; pol.decide(A, G.round); const r = A.resolveDecisions(); if (r && r.event) { const n = A.EVENT_FX[r.event].choices.length; let o = A.chooseEvent(0); for (let i = 0; i < n && !o; i++) o = A.chooseEvent(i); } if (!G.end) A.startRound(); }
          if (!G.end) { falhas.push(`semNeg/${diff}/${pol.name}: não terminou`); continue; }
          jogos++;
          const st = R.outcomeStory(), tudo = st.p.join(' ') + ' ' + st.title + ' ' + txtOf(R.newsHTML());
          if (G.nego.tries === 0) { semConversa++; ok(!FALA.test(tudo), `semNeg/${diff}/${pol.name}/s${seed}: o texto fala de negociação que não houve → "${(tudo.match(FALA) || [''])[0]}" (${G.end.type}:${G.end.variant || ''})`); }
          if (!G.stats.intel && !A.knownCount()) { semInfo++; ok(!INFO.test(tudo), `semNeg/${diff}/${pol.name}/s${seed}: o texto fala de informação que não havia → "${(tudo.match(INFO) || [''])[0]}"`); }
        }
        notas.push(`${jogos} partidas, ${semConversa} sem nenhuma negociação e ${semInfo} sem nenhuma informação: o desfecho e a Gazeta não afirmam o que não aconteceu`);
      },
      promessas() {
        const painel2 = (team, ev, mut) => { cena('complexo', 33, team, [], 3, g => { g.ev = ev; if (mut) mut(g); }); UIo.tab = 'tatica'; UIo.lvl = 2; return txtOf(safe('promessas/painel', R.renderPanel)); };
        const comC = painel2(['renata', 'carla', 'paulo'], { beco: 1.0 });
        ok(/convergem para Beco de Serviço \(1[.,]0 indícios ponderados\)/.test(comC) && /Mendes correlacionou/.test(comC), 'com a Carla, 1,0 indício já converge e o painel diz que ela correlacionou');
        const semC = painel2(['renata', 'paulo', 'marcos'], { beco: 1.0 });
        ok(!/convergem para/.test(semC) && /ainda não apontam uma rota com clareza/.test(semC), 'sem a Carla, 1,0 indício ainda não converge');
        ok(/convergem para Beco de Serviço/.test(painel2(['renata', 'paulo', 'marcos'], { beco: 1.5 })), 'sem a Carla, 1,5 indício converge');
        const away = painel2(['renata', 'carla', 'paulo'], { beco: 1.0 }, g => { g.away.carla = 2; });
        ok(!/convergem para/.test(away) && !/correlacionou/.test(away), 'com a Carla reconvocada, 1,0 indício não converge e ninguém diz que ela correlacionou');
        const comAway = painel2(['renata', 'carla', 'paulo'], { beco: 1.5 }, g => { g.away.carla = 2; });
        ok(/convergem para Beco de Serviço/.test(comAway) && !/correlacionou/.test(comAway), 'com a Carla reconvocada, 1,5 indício converge, sem o crédito dela');
        // notas dos equipamentos no cartão "Equipamentos em campo"
        cena('complexo', 34, ['renata', 'paulo', 'marcos'], ['jammer', 'escudo', 'viatura', 'sniper', 'drone'], 3, g => { g.gz.sniper = 'reserva'; g.gz.drone = 'reserva'; });
        UIo.tab = 'tatica'; UIo.lvl = 1; const cartao = txtOf(safe('promessas/equip', R.renderPanel));
        ok(/mídia −2 por rodada/.test(cartao) && /agitação \+1/.test(cartao), 'o jammer diz que corta 2 de mídia e soma 1 de agitação por rodada');
        ok(/metade do risco de agente ferido na entrada/.test(cartao), 'o escudo diz que divide o risco de agente ferido');
        ok(/\+15 pontos na captura em perseguição/.test(cartao), 'a viatura diz o que dá na perseguição');
        ok(/na reserva: sem efeito/.test(cartao), 'o sniper na reserva diz "sem efeito"');
        notas.push('traço da Carla no painel (1,0 e 1,5 indício, com ela na equipe, sem ela e reconvocada) e as notas de jammer, escudo, viatura e sniper no cartão de equipamentos');
      },
      semEquipe() {
        for (const diff of diffs) for (let k = 0; k < 4; k++) {
          cena(diff, 90 + k, [], [], 1, null); const G = A.G;
          ok(G.team.join() === 'g1,g2' && G.stats.noRecruit, 'sem recrutas deveria entrar com as duas guarnições genéricas');
          UIo.tab = 'nego'; safe(`semEquipe/${diff}/${k}/painel`, R.renderPanel);
          joga(`semEquipe/${diff}/${k}`, B.policyEdge('nenhum'));
        }
        notas.push('nenhum recruta: as duas guarnições genéricas entram e todas as telas, o desfecho e o pós-jogo desenham sem erro');
      }
    };
    window.__L = { roda: nome => { falhas.length = 0; notas.length = 0; try { CASO[nome](); } catch (e) { falhas.push('EXCEÇÃO ' + e.stack.split('\n').slice(0, 3).join(' / ')); } const u = [...new Set(falhas.map(f => f.replace(/\/R\d+/, '/R#').replace(/\/\d+(\/|:)/, '/#$1')))]; return { falhas: u.slice(0, 12), total: falhas.length, notas: notas.slice() }; }, A, UIo, R, B };
  }, { botsSrc });

  let ruins = 0;
  for (const nome of CASOS) {
    if (nome === 'corrida') continue;
    const r = await page.evaluate(n => window.__L.roda(n), nome);
    console.log(`\n${nome}  →  ${r.falhas.length ? '✕ ' + r.total + ' ocorrência(s)' : '✓'}`);
    r.notas.forEach(n => console.log('    · ' + n)); r.falhas.forEach(f => console.log('    ✕ ' + f));
    if (r.falhas.length) ruins++;
  }

  if (CASOS.includes('corrida')) {
    // O tempo da rodada acaba no mesmo instante do clique em Executar: a rodada tem de ser resolvida uma vez só.
    const falhas = [], notas = [];
    const monta = (offset, rendicao) => page.evaluate(({ rendicao }) => {
      const { A, UIo, B } = window.__L;
      A.reseed(500 + (rendicao ? 1 : 0)); A.newGame('complexo'); UIo.diffSel = 'complexo'; const G = A.G;
      ['renata', 'paulo', 'marcos'].forEach(id => B.hire(A, id)); A.autoPlace(); A.confirmPerimeter(); G.phase = 'siege'; G.round = rendicao ? 7 : 2; G.quietRound = G.round + 1; G.noLimit = false; A.startRound();
      if (rendicao) { G.nego.step = 5; G.nego.contact = true; G.agit = 10; G.pressure = A.calcPressure(); }
      A.addDecision(B.mk.nego(Math.min(5, G.nego.step)));
      G.stage = 'panel'; window.PERIMETRO.render();
      return { round: G.round, log: G.log.length };
    }, { rendicao });
    const estado = () => page.evaluate(() => { const G = window.__L.A.G; return { stage: G.stage, phase: G.phase, round: G.round, log: G.log.length, end: G.end ? G.end.type : null, tries: G.nego.tries, queue: G.queue.length, timer: !!window.PERIMETRO.UI.timerId }; });
    for (const [i, off] of [150, 180, 200, 215, 230, 245].entries()) {
      for (const rendicao of [false, true]) {
        const m = await monta(off, rendicao);
        await page.evaluate(ms => { window.PERIMETRO.UI.deadline = Date.now() + ms; }, 260);
        await page.waitForTimeout(off);
        await page.locator('[data-act=execute]').first().click({ timeout: 2000, noWaitAfter: true }).catch(() => {});
        await page.waitForTimeout(700);
        const s = await estado();
        const quando = `${rendicao ? 'rodada 8 (rendição)' : 'rodada 3'}, clique ${off} ms depois`;
        if (s.log !== m.log + 1) falhas.push(`${quando}: o registro da rodada tem ${s.log - m.log} entradas novas (esperado 1)`);
        if (s.tries !== 1) falhas.push(`${quando}: a negociação foi executada ${s.tries} vezes (esperado 1)`);
        if (rendicao && s.end !== 'rendicao') falhas.push(`${quando}: com o degrau 5 e o líder calmo deveria render, e deu ${s.end}`);
        if (s.timer && s.stage !== 'panel') falhas.push(`${quando}: relógio ainda correndo depois da rodada resolvida`);
        await page.evaluate(() => { window.__L.A.G = null; window.PERIMETRO.render(); });
      }
    }
    notas.push('12 corridas entre o fim do relógio e o clique em Executar (6 instantes, rodada comum e rodada 8 com rendição): uma resolução só em cada');
    console.log(`\ncorrida  →  ${falhas.length ? '✕ ' + falhas.length : '✓'}`); notas.forEach(n => console.log('    · ' + n)); falhas.forEach(f => console.log('    ✕ ' + f));
    if (falhas.length) ruins++;
  }
  console.log(errs.length ? '\nCONSOLE:\n' + [...new Set(errs)].slice(0, 15).join('\n') : '\nconsole limpo');
  await browser.close();
  console.log(`\n${CASOS.length - ruins}/${CASOS.length} casos de tela sem falha`);
  process.exit(ruins || errs.length ? 1 : 0);
})().catch(e => { console.error('FALHA', e); process.exit(1); });
