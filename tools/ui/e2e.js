// Fluxo completo no navegador: menu → briefing → recrutamento → perímetro → 8 rodadas → desfecho → pós-jogo (5 abas) → jogar de novo.
// Verifica: erros de console, textos quebrados (undefined/NaN/[object Object]), becos sem saída (nenhum botão de avanço), Continuar partida.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const os = require('os');
const FILE = process.env.PERI_HTML || path.join(__dirname, '..', '..', 'perimetro-standalone.html');
const OUT = process.env.PERI_SHOTS || path.join(os.tmpdir(), 'perimetro-e2e'); fs.mkdirSync(OUT, { recursive: true });

const PLANS = {
  negociadora: { team: ['paulo', 'marina', 'renata', 'carla', 'lucas'], gear: ['negofone', 'kit'], style: 'paz' },
  agressiva: { team: ['andre', 'diego', 'marcos', 'renata', 'roberto', 'lucas'], gear: ['escudo', 'sniper', 'viatura'], style: 'agr' },
  equilibrada: { team: ['renata', 'paulo', 'carla', 'marcos', 'lucas', 'fernanda'], gear: ['negofone', 'drone'], style: 'eq' },
  semEquipe: { team: [], gear: [], style: 'paz' },
  lento: { team: ['paulo', 'renata', 'marcos', 'lucas'], gear: ['negofone'], style: 'lento' },
  gastaTudo: { team: ['diego', 'renata', 'marcos', 'andre', 'lucas', 'roberto', 'camila', 'sofia'], gear: ['drone', 'sniper', 'termica', 'escudo'], style: 'paz' }
};

async function main() {
  const which = process.argv[2] || 'negociadora', diff = process.argv[3] || 'complexo', shots = process.argv[4] !== 'noshots';
  const plan = PLANS[which];
  const browser = await chromium.launch();
  const VW = +process.env.PERI_VW || 1366, ctx = await browser.newContext({ viewport: { width: VW, height: 800 } });   // PERI_VW=1024 (o mínimo de desktop) ou 390 (celular) refaz o fluxo nessa largura
  const page = await ctx.newPage();
  const problems = [], log = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  await page.goto('file://' + FILE);
  const S = () => page.evaluate(() => { const G = window.PERIMETRO.G; return G ? { phase: G.phase, stage: G.stage, round: G.round, end: G.end ? G.end.type + ':' + (G.end.variant || '') : null, step: G.nego.step, credits: Math.round(G.credits), cut: !!window.PERIMETRO.UI.cut, K: Object.keys(G.K).filter(k => G.K[k] === true || (G.K[k] && !Array.isArray(G.K[k]) && typeof G.K[k] !== 'object')).length } : null; });
  const clickAct = async (sel, opt = {}) => { const el = page.locator(sel).first(); if (!(await el.count())) return false; if ((await el.getAttribute('aria-disabled')) === 'true') return false; await el.click({ timeout: 4000, ...opt }); return true; };
  const shot = async n => { if (shots) await page.screenshot({ path: path.join(OUT, `${which}-${diff}-${n}.png`) }); };
  const checkText = async tag => {
    const t = await page.evaluate(() => document.getElementById('app').innerText);
    const bad = t.match(/undefined|NaN|\[object Object\]|\bnull\b|Infinity/g);
    if (bad) problems.push(`texto quebrado em ${tag}: ${[...new Set(bad)].join(',')}`);
    // alguma ação disponível?
    const acts = await page.evaluate(() => [...document.querySelectorAll('#app [data-act]')].filter(e => !e.disabled && e.offsetParent !== null).length);
    if (!acts) problems.push(`beco sem saída em ${tag}: nenhuma ação visível`);
    // a página nunca rola na horizontal (só tabelas e diagramas, cada um dentro do seu próprio contêiner)
    const ov = await page.evaluate(() => { const d = document.documentElement, w = window.innerWidth; if (d.scrollWidth <= w + 1) return null; const out = []; document.querySelectorAll('#app *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > w + 1 && !e.closest('.scroll-x, svg')) out.push((e.className && e.className.baseVal === undefined ? '.' + String(e.className).split(' ')[0] : e.tagName.toLowerCase()) + ' +' + Math.round(r.right - w)); }); return { sw: d.scrollWidth, w, quem: [...new Set(out)].slice(0, 6) }; });
    if (ov) problems.push(`rolagem horizontal em ${tag}: página com ${ov.sw}px numa janela de ${ov.w}px (${ov.quem.join(', ')})`);
    return t;
  };

  await checkText('menu');
  if (shots) await shot('00-menu');
  // dificuldade
  await clickAct(`[data-act=diff][data-v=${diff}]`);
  await clickAct('[data-act=start]');
  await page.waitForTimeout(150);
  await checkText('briefing');
  await clickAct('[data-act=tobrief]');
  await page.waitForTimeout(100);
  const recT = await checkText('recrutamento');
  if (shots) await shot('01-recruit');
  for (const id of plan.team) await clickAct(`[data-act=hire][data-id=${id}]`);
  for (const id of plan.gear) await clickAct(`[data-act=buygear][data-id=${id}]`);
  const st0 = await S();
  log.push(`após recrutar: créditos ${st0.credits}`);
  await clickAct('[data-act=torecruit]');
  if (!plan.team.length) { await page.waitForTimeout(80); await checkText('recrutamento-vazio-confirma'); await clickAct('[data-act=torecruit]'); }
  await page.waitForTimeout(100);
  const minDe = h => { const m = String(h || '').match(/(\d{2})h(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
  let cut1 = null, cut2 = null;
  if ((await S()).cut) { const t = await checkText('cut-1'); cut1 = (t.match(/\b\d{2}h\d{2}\b/) || [])[0]; await clickAct('[data-act=cutgo]'); }
  await checkText('perimetro');
  await clickAct('[data-act=autoplace]');
  if (st0.credits > 260) await clickAct('[data-act=p1intel][data-id=rota]');
  if (shots) await shot('02-perimetro');
  await clickAct('[data-act=tosiege]');
  await page.waitForTimeout(100);
  if ((await S()).cut) { const t = await checkText('cut-2'); cut2 = (t.match(/\b\d{2}h\d{2}\b/) || [])[0]; await clickAct('[data-act=cutgo]'); }
  // o relógio nunca volta no tempo: verba (recrutamento) → chegada da equipe (15 min depois) → perímetro fechado → rodada 1
  await page.waitForTimeout(100);
  const verba = (recT.match(/(\d{2}h\d{2})\. A Secretaria/) || [])[1], hud1 = await page.evaluate(() => { const e = [...document.querySelectorAll('.stat')].find(x => /hora/i.test(x.innerText)); return e ? (e.innerText.match(/\d{2}h\d{2}/) || [])[0] : null; });
  log.push(`relógio: verba ${verba} · equipe chega ${cut1} · perímetro fechado ${cut2} · rodada 1 ${hud1}`);
  if (minDe(verba) == null || minDe(cut1) == null || minDe(cut2) == null || minDe(hud1) == null) problems.push(`relógio ausente: ${verba}/${cut1}/${cut2}/${hud1}`);
  else {
    if (minDe(cut1) - minDe(verba) !== 15) problems.push(`a equipe "chega em quinze minutos" da verba (${verba}), mas a cena diz ${cut1}`);
    if (!(minDe(cut2) > minDe(cut1))) problems.push(`o perímetro fecha (${cut2}) antes de a equipe chegar (${cut1})`);
    if (hud1 !== cut2) problems.push(`a rodada 1 mostra ${hud1}, mas a cena do perímetro fechado diz ${cut2}: o relógio voltou no tempo`);
  }

  // loop do cerco
  let guard = 0, lastKey = '';
  const ladderTech = async () => (await S()).step;
  while (guard++ < 80) {
    const s = await S();
    if (!s) { problems.push('estado nulo no meio da partida'); break; }
    const key = `${s.phase}/${s.stage}/${s.round}`;
    if (key === lastKey && guard > 3) { /* pode repetir após cliques que re-renderizam; só alerta se ficar preso */ }
    lastKey = key;
    if (s.phase === 'outcome') { await checkText('desfecho'); if (shots) await shot(`30-outcome`); await clickAct('[data-act=toscore]'); continue; }
    if (s.phase === 'post') break;
    if (s.phase !== 'siege') { problems.push('fase inesperada ' + s.phase); break; }
    if (s.stage === 'update') { await checkText(`update-r${s.round}`); if (shots && [1, 5, 8].includes(s.round)) await shot(`10-update-r${s.round}`); await clickAct('[data-act=takepanel]'); continue; }
    if (s.stage === 'panel') {
      await checkText(`painel-r${s.round}`);
      const rn = s.round;
      // decisões segundo o estilo
      const addNego = async () => { await clickAct('[data-act=tab][data-t=nego]'); const t = Math.min(5, s.step); await clickAct(`[data-act=addnego][data-t="${t}"]`); };
      const addIntel = async id => { await clickAct('[data-act=tab][data-t=intel]'); await clickAct(`[data-act=addintel][data-id=${id}]`); };
      const addCom = async id => { await clickAct('[data-act=tab][data-t=com]'); await clickAct(`[data-act=addcom][data-id=${id}]`); };
      if (plan.style === 'lento') {
        if (rn === 2) await addNego();
        await addCom(['acolhe', 'coletiva', 'prefeito', 'gerente'][(rn - 1) % 4]);
      } else if (plan.style === 'agr') {
        if (rn >= 3) { await clickAct('[data-act=tab][data-t=tatica]'); await clickAct('[data-act=iv]'); await page.waitForTimeout(60); await checkText('confirma-interv'); if (shots && rn === 3) await shot('21-interv-confirm'); await clickAct('[data-act=ivyes]'); }
        else { await addIntel(rn === 1 ? 'efetivo' : 'refens'); await addCom('acolhe'); }
      } else if (plan.style === 'eq') {
        await addNego();
        if (rn <= 4) await addIntel(['perfil', 'rota', 'efetivo', 'refens'][rn - 1]);
        await addCom(['coletiva', 'prefeito', 'gerente', 'acolhe'][(rn - 1) % 4]);
      } else {
        await addNego();
        if (rn === 1) await addIntel('perfil');
        await addCom(['acolhe', 'coletiva', 'prefeito', 'gerente'][(rn - 1) % 4]);
      }
      if (shots && (rn === 1 || rn === 7 || rn === 8)) { await page.waitForTimeout(700); await shot(`11-painel-r${rn}-top`); await clickAct('[data-act=lvl][data-t="3"]'); await page.waitForTimeout(900); await page.evaluate(() => document.querySelector('.endsley') && document.querySelector('.endsley').scrollIntoView({ block: 'start' })); await page.waitForTimeout(300); await shot(`11-painel-r${rn}-L3`); await clickAct('[data-act=lvl][data-t="1"]'); }
      await clickAct('[data-act=execute]');
      await page.waitForTimeout(60);
      continue;
    }
    if (s.stage === 'event') {
      await checkText(`evento-r${s.round}`);
      if (shots) await shot(`13-evento-r${s.round}`);
      const n = await page.locator('.evcard [data-act=evchoice]').count();
      let ok = false;
      for (let i = 0; i < n && !ok; i++) { await clickAct(`.evcard [data-act=evchoice][data-i="${i}"]`); await page.waitForTimeout(40); const s2 = await S(); ok = s2.stage !== 'event'; }
      if (!ok) { problems.push(`evento r${s.round}: nenhuma escolha avançou`); break; }
      continue;
    }
    if (s.stage === 'result' || s.stage === 'resolving') {
      await checkText(`resultado-r${s.round}`);
      if (shots && s.round === 8) await shot('14-result-r8');
      if (!(await clickAct('[data-act=cont]'))) { problems.push(`resultado r${s.round}: sem botão de continuar`); break; }
      continue;
    }
    problems.push('estágio inesperado ' + s.stage); break;
  }
  const fin = await S();
  log.push(`fim: ${fin && fin.phase} ${fin && fin.end} rodada ${fin && fin.round}`);
  // pós-jogo: 5 abas
  if (fin && fin.phase === 'post') {
    const tabs = await page.evaluate(() => [...document.querySelectorAll('[data-act=ptab]')].map(b => b.dataset.t));
    log.push('abas: ' + tabs.join(','));
    for (const t of tabs) {
      await clickAct(`[data-act=ptab][data-t=${t}]`); await page.waitForTimeout(120);
      const txt = await checkText('pos-' + t);
      log.push(`  aba ${t}: ${txt.length} caracteres`);
      if (txt.length < 200) problems.push(`aba ${t} quase vazia (${txt.length})`);
      if (shots) await shot(`40-pos-${t}`);
      if (t === 'replay') {
        const nodes = await page.locator('[data-act=rnode]').count(); log.push(`  replay: ${nodes} nós`); if (!nodes) problems.push('replay sem nós');
        // R0: a preparação (equipe, equipamentos, investigação prévia, cobertura inicial e reserva) é o primeiro nó e mostra o que foi escolhido
        const n0 = page.locator('[data-act=rnode][data-r="0"]');
        if (!(await n0.count())) problems.push('replay sem a Preparação (R0)');
        else {
          await n0.click(); await page.waitForTimeout(80); const t0 = await checkText('replay-R0'); if (shots) await shot('41-replay-R0');
          const esperado = await page.evaluate(() => { const G = window.PERIMETRO.G; return { zonas: Object.keys(G.stats.initCov).length }; });
          for (const k of ['Preparação', 'Equipe contratada', 'Equipamentos', 'Investigação antes do cerco', 'Cobertura de cada zona ao fechar o perímetro', 'Reserva ao iniciar o cerco']) if (!t0.toLowerCase().includes(k.toLowerCase())) problems.push('R0 sem "' + k + '"');
          const celulas = await page.locator('#postp .dcell').count(); if (celulas !== esperado.zonas) problems.push(`R0 mostra ${celulas} zonas em vez de ${esperado.zonas}`);
          const sel = await page.locator('[data-act=rnode][data-r="0"]').getAttribute('aria-selected'); if (sel !== 'true') problems.push('R0 não fica selecionado ao ser clicado');
          // teclado: seta para a direita vai à rodada 1 e a seta para a esquerda volta; o foco acompanha o nó
          await page.locator('[data-act=rnode][data-r="0"]').focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(80);
          const s1 = await page.locator('[data-act=rnode][data-r="1"]').getAttribute('aria-selected'), f1 = await page.evaluate(() => document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.r : null);
          if (s1 !== 'true' || f1 !== '1') problems.push(`seta → no replay não foi para a rodada 1 (selecionado ${s1}, foco ${f1})`);
          await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(80);
          const s0 = await page.locator('[data-act=rnode][data-r="0"]').getAttribute('aria-selected'); if (s0 !== 'true') problems.push('seta ← no replay não voltou à Preparação');
        }
        if (nodes > 2) { await clickAct('[data-act=rnode] >> nth=2'); await page.waitForTimeout(80); await checkText('replay-nó2'); }
      }
    }
    // continuar partida: recarrega a página e confere que o save existe
    await page.reload(); await page.waitForTimeout(150);
    const cont = await page.locator('[data-act=continue]').count();
    log.push('Continuar partida após recarregar: ' + (cont ? 'disponível' : 'AUSENTE'));
    if (!cont) problems.push('Continuar partida ausente após a partida terminar');
    else { await clickAct('[data-act=continue]'); await page.waitForTimeout(150); const s3 = await S(); log.push('  retomou em ' + s3.phase); await checkText('continuar'); }
    // jogar de novo
    await clickAct('[data-act=again]'); await page.waitForTimeout(100);
    const back = await page.locator('[data-act=start]').count();
    if (!back) problems.push('Jogar novamente não voltou ao menu');
    await checkText('menu-2');
  } else problems.push('não chegou ao pós-jogo: ' + JSON.stringify(fin));
  await browser.close();
  console.log(`[${which}/${diff}]`, log.join(' | '));
  console.log(problems.length ? 'PROBLEMAS:\n - ' + [...new Set(problems)].join('\n - ') : 'sem problemas');
}
main().catch(e => { console.error('FALHA', e); process.exit(1); });
