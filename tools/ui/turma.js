// Código da turma no navegador (L2.5 refeita).
// 1. O código digitado no menu vale ao clicar direto em "Iniciar" (sem tirar o foco do campo), e um código em branco é jogo sem código.
// 2. Duas equipes em navegadores separados, com o mesmo código escrito de jeitos diferentes, jogando as mesmas decisões, terminam na mesma
//    partida, carta por carta, mesmo que uma delas recarregue a página no meio e passe o mouse pelos agentes (nada disso pode gastar o
//    sorteio do jogo).
// 3. "Continuar partida" e a tela de nota mostram a turma; nenhuma das partidas tem erro de console.
//   PERI_HTML=<standalone> NODE_PATH=$(npm root -g) node tools/ui/turma.js
const { chromium } = require('playwright');
const path = require('path');
const FILE = process.env.PERI_HTML || path.join(__dirname, '..', '..', 'perimetro-standalone.html');
const PLAN = { team: ['paulo', 'marina', 'renata', 'carla', 'lucas'], gear: ['negofone', 'kit'] };
let fails = 0, checks = 0;
const ok = (c, msg, extra) => { checks++; if (!c) { fails++; console.log('  ✗ FALHA: ' + msg + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); } return !!c; };

async function abrir(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } }), page = await ctx.newPage(), problemas = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problemas.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => problemas.push('pageerror: ' + e.message));
  await page.goto('file://' + FILE);
  return { ctx, page, problemas };
}
const S = page => page.evaluate(() => { const G = window.PERIMETRO.G; return G ? { phase: G.phase, stage: G.stage, round: G.round, step: G.nego.step, credits: Math.round(G.credits), cut: !!window.PERIMETRO.UI.cut, code: G.code, ev: G.pendingEvent } : null; });
const clicar = async (page, sel) => { const el = page.locator(sel).first(); if (!(await el.count())) return false; if ((await el.getAttribute('aria-disabled')) === 'true') return false; await el.click({ timeout: 4000 }); return true; };

/* Uma partida inteira com a política negociadora do e2e. op.recarrega: rodada em que a página é recarregada no painel; op.mouse: passa o
   mouse pelos agentes e dicas do painel a cada rodada. Devolve a assinatura da partida. */
async function jogar(sess, codigo, op = {}) {
  let { page } = sess;
  const cartas = [];
  await clicar(page, '[data-act=diff][data-v=complexo]');
  await page.locator('#turma').fill(codigo);   // o campo continua com o foco: o clique em Iniciar tem de valer mesmo assim
  await clicar(page, '[data-act=start]');
  await page.waitForTimeout(120);
  let s = await S(page);
  if (!ok(s && s.phase === 'briefing', 'o clique em Iniciar com o foco no campo do código se perdeu', s)) return null;
  await clicar(page, '[data-act=tobrief]'); await page.waitForTimeout(80);
  for (const id of PLAN.team) await clicar(page, `[data-act=hire][data-id=${id}]`);
  for (const id of PLAN.gear) await clicar(page, `[data-act=buygear][data-id=${id}]`);
  await clicar(page, '[data-act=torecruit]'); await page.waitForTimeout(80);
  if ((await S(page)).cut) await clicar(page, '[data-act=cutgo]');
  await clicar(page, '[data-act=autoplace]');
  await clicar(page, '[data-act=p1intel][data-id=rota]');
  await clicar(page, '[data-act=tosiege]'); await page.waitForTimeout(80);
  if ((await S(page)).cut) await clicar(page, '[data-act=cutgo]');
  let guard = 0, recarregou = false;
  while (guard++ < 80) {
    s = await S(page);
    if (!s) { ok(false, 'estado nulo no meio da partida'); return null; }
    if (s.phase === 'outcome') { await clicar(page, '[data-act=toscore]'); continue; }
    if (s.phase === 'post') break;
    if (s.stage === 'update') { await clicar(page, '[data-act=takepanel]'); continue; }
    if (s.stage === 'panel') {
      if (op.recarrega === s.round && !recarregou) {
        recarregou = true;
        await page.reload(); await page.waitForTimeout(150);
        const rot = await page.locator('[data-act=continue]').innerText().catch(() => '');
        ok(/turma HBSTURMAA/.test(rot), '"Continuar partida" deveria mostrar a turma', rot);
        await clicar(page, '[data-act=continue]'); await page.waitForTimeout(250);
        const s2 = await S(page); ok(s2 && s2.code === 'HBSTURMAA' && s2.round === s.round, 'a partida retomada perdeu o código ou a rodada', s2);
        continue;
      }
      if (op.mouse) {
        for (const sel of ['[data-ag]', '.hastip', '.bsc']) { const n = Math.min(3, await page.locator(sel).count()); for (let i = 0; i < n; i++) { await page.locator(sel).nth(i).hover({ timeout: 2000 }).catch(() => {}); } }
        await clicar(page, '[data-act=tab][data-t=intel]'); await clicar(page, '[data-act=tab][data-t=tatica]');
      }
      await clicar(page, '[data-act=tab][data-t=nego]');
      await clicar(page, `[data-act=addnego][data-t="${Math.min(5, s.step)}"]`);
      if (s.round === 1) { await clicar(page, '[data-act=tab][data-t=intel]'); await clicar(page, '[data-act=addintel][data-id=perfil]'); }
      await clicar(page, '[data-act=tab][data-t=com]'); await clicar(page, `[data-act=addcom][data-id=${['acolhe', 'coletiva', 'prefeito', 'gerente'][(s.round - 1) % 4]}]`);
      await clicar(page, '[data-act=execute]'); await page.waitForTimeout(50);
      continue;
    }
    if (s.stage === 'event') {
      cartas.push(`r${s.round}:${s.ev}`);
      const n = await page.locator('.evcard [data-act=evchoice]').count(); let foi = false;
      for (let i = 0; i < n && !foi; i++) { await clicar(page, `.evcard [data-act=evchoice][data-i="${i}"]`); await page.waitForTimeout(40); foi = (await S(page)).stage !== 'event'; }
      if (!ok(foi, 'nenhuma escolha da carta avançou', s)) return null;
      continue;
    }
    if (s.stage === 'result' || s.stage === 'resolving') { await clicar(page, '[data-act=cont]'); continue; }
    ok(false, 'estágio inesperado', s); return null;
  }
  const fim = await page.evaluate(() => { const G = window.PERIMETRO.G; return { round: G.round, code: G.code, perfil: G.profile, rota: G.route, end: G.end, total: G.score.total, grade: G.score.grade, eventos: G.usedEvents, log: G.log.map(R => R.lines.map(l => l.text)), eyebrow: (document.querySelector('.scorehead .eyebrow') || {}).innerText }; });
  return { cartas, fim };
}

(async () => {
  const browser = await chromium.launch();
  // equipe 1: recarrega a página na rodada 3 e passa o mouse pelo painel
  const e1 = await abrir(browser);
  const ph = await e1.page.locator('#turma').getAttribute('placeholder');
  ok(ph === 'opcional', 'o campo do código da turma deveria estar no menu', ph);
  const a = await jogar(e1, 'hbs turma a', { recarrega: 3, mouse: true });
  // equipe 2: outro navegador, o código escrito de outro jeito, nada além das decisões
  const e2 = await abrir(browser);
  const b = await jogar(e2, 'HBS-Turma-A');
  if (a && b) {
    console.log(`  equipe 1: ${a.fim.perfil}, rota ${a.fim.rota}, cartas ${a.cartas.join(' ') || 'nenhuma'}, ${a.fim.end.type}${a.fim.end.variant ? ':' + a.fim.end.variant : ''} na rodada ${a.fim.round}, nota ${a.fim.grade} ${a.fim.total}`);
    console.log(`  equipe 2: ${b.fim.perfil}, rota ${b.fim.rota}, cartas ${b.cartas.join(' ') || 'nenhuma'}, ${b.fim.end.type}${b.fim.end.variant ? ':' + b.fim.end.variant : ''} na rodada ${b.fim.round}, nota ${b.fim.grade} ${b.fim.total}`);
    ok(a.fim.code === 'HBSTURMAA' && b.fim.code === 'HBSTURMAA', 'as duas equipes deveriam estar na turma HBSTURMAA', [a.fim.code, b.fim.code]);
    ok(JSON.stringify(a.cartas) === JSON.stringify(b.cartas), 'as duas equipes deveriam receber as mesmas cartas', [a.cartas, b.cartas]);
    ok(JSON.stringify(a.fim.log) === JSON.stringify(b.fim.log) && a.fim.total === b.fim.total, 'mesmo código e mesmas decisões deveriam dar a mesma partida, linha por linha', [a.fim.total, b.fim.total]);
    ok(/turma HBSTURMAA/i.test(a.fim.eyebrow || ''), 'a tela de nota deveria mostrar a turma', a.fim.eyebrow);
  }
  // sem código
  const e3 = await abrir(browser);
  await clicar(e3.page, '[data-act=start]'); await e3.page.waitForTimeout(100);
  const g3 = await e3.page.evaluate(() => { const G = window.PERIMETRO.G; return G && { code: G.code, rng: G.rng }; });
  ok(g3 && g3.code === null && g3.rng === null, 'sem código, a partida deveria ser sorteada pelo Math.random', g3);
  for (const [n, e] of [['equipe 1', e1], ['equipe 2', e2], ['sem código', e3]]) ok(!e.problemas.length, `${n}: erros de console`, e.problemas.slice(0, 5));
  await browser.close();
  console.log(`\n${checks} verificações, ${fails} falhas.`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
