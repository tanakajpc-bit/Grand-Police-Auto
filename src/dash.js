/* =====================================================================
   ANÁLISE PARA OS PAINÉIS (L1.3) — funções que só leem o estado.
   Previsões e prévias usam apenas o que o comandante pode saber: nada aqui vaza variável oculta.
   Quando uma prévia precisa simular uma ordem, ela altera o estado e o restaura na mesma chamada.
   ===================================================================== */

/* ---------- Orçamento: estoque + fluxo ---------- */
const FIELD_MIN_TAT = 5;   // a distribuição automática só põe em campo quem tem Tática ≥ 5
function budgetForecast(ids = G.team) {
  const nField = ids.filter(id => stat(id, 'tat') >= FIELD_MIN_TAT).length;
  const per = plantaoCost(nField), total = per * MAX_ROUNDS, free = G.credits - total;
  const intelAvg = Math.round(INTEL.reduce((s, i) => s + i.custo, 0) / INTEL.length);
  return { nField, per, total, free, intels: Math.max(0, Math.floor(free / intelAvg)), apoios: Math.max(0, Math.floor(free / APOIO_PRECOS[0])) };
}
/* Para onde foi o dinheiro: categorias do estoque inicial de 1.000 créditos */
function spendBreakdown() {
  const sp = G.spent, cut = sp.corte || 0;
  const cats = [
    { k: 'Equipe', v: sp.rec, c: 'var(--blue)' }, { k: 'Equipamento', v: sp.equip, c: 'var(--violet)' },
    { k: 'Inteligência', v: sp.intel, c: 'var(--green)' }, { k: 'Plantão', v: sp.plantao, c: 'var(--amber)' },
    { k: 'Apoio e extras', v: sp.ops, c: 'var(--orange)' }
  ];
  if (cut > 0) cats.push({ k: 'Corte do banco', v: cut, c: 'var(--red)' });
  cats.push({ k: 'Reserva', v: Math.max(0, G.credits), c: 'var(--line2)' });
  return cats;
}

/* ---------- Capacidade da equipe: quantas zonas ela cobre bem, com a distribuição automática ---------- */
function capacityPreview() {
  if (!G.team.length) return { adq: 0, cov: ZONES.map(() => 0) };
  const sa = Object.assign({}, G.az), sg = Object.assign({}, G.gz), sp = G.pressure;
  G.pressure = calcPressure(); autoPlace();
  const zs = G.team.map(id => G.az[id]).filter(z => z && z !== 'reserva');
  G.gear.forEach((e, i) => { G.gz[e] = (['drone', 'sniper', 'termica'].includes(e) && zs.length) ? zs[i % zs.length] : 'reserva'; });
  const cov = ZONES.map(z => zoneCoverage(z.id));
  G.az = sa; G.gz = sg; G.pressure = sp;
  return { adq: cov.filter(c => c >= ADEQ).length, cov };
}

/* ---------- Cofre: previsão numérica (o painel só mostra se o jogador já souber medir) ---------- */
function vaultEtaN() {
  const vm = PR_().vault * D_().vault, n = agentsIn('entrada').length, delta = Math.max(0, 10 * vm - 4 * n);
  return delta <= 0 ? Infinity : Math.ceil((100 - G.vault) / delta);
}

/* ---------- Prévia de reposicionamento: o custo antes de assumir ---------- */
function reposPreview(id, z) {
  const from = G.az[id] || 'reserva', zones = [from, z].filter(x => x !== 'reserva');
  const snap = () => Object.fromEntries(zones.map(x => [x, zoneCoverage(x)]));
  const before = snap(), oldAz = G.az[id], oldTr = G.transit[id];
  const free = z === 'reserva' || hasGear('viatura') || id === 'lucas';
  G.az[id] = z; G.transit[id] = free ? 0 : 2; const now = snap();
  G.transit[id] = free ? 0 : 1; const next = snap();
  G.az[id] = oldAz; G.transit[id] = oldTr;
  return { from, z, before, now, next, free };
}

/* ---------- Prévia do plano da rodada (o que as ordens vão mudar, só com números que o jogador já enxerga) ---------- */
function planPreview() {
  const q = G.queue; if (!q.length) return [];
  const rows = [], D = D_(), spent = q.reduce((s, d) => s + (d.cost || 0), 0), pl = plantaoCost();
  const avgCov = () => ZONES.reduce((s, z) => s + zoneCoverage(z.id), 0) / ZONES.length;
  // aplica as ordens táticas, mede, e desfaz
  const sAz = Object.assign({}, G.az), sTr = Object.assign({}, G.transit), sSup = JSON.parse(JSON.stringify(G.support));
  const c0 = ZONES.map(z => zoneCoverage(z.id)), a0 = avgCov();
  q.filter(d => d.kind === 'repos').forEach(d => {
    const free = d.p.zone === 'reserva' || hasGear('viatura') || d.p.agent === 'lucas';
    G.az[d.p.agent] = d.p.zone; G.transit[d.p.agent] = free ? 0 : 2;
  });
  q.filter(d => d.kind === 'apoio').forEach(d => { G.support[d.p.zone] = { v: 25, left: 2 }; });
  const c1 = ZONES.map(z => zoneCoverage(z.id)), a1 = avgCov(), nEnt = agentsIn('entrada').length;
  const vm = PR_().vault * D.vault, vd = Math.max(0, 10 * vm - 4 * nEnt), moved = q.filter(d => d.kind === 'repos').length;
  G.az = sAz; G.transit = sTr; G.support = sSup;
  rows.push({ k: 'Créditos', a: G.credits + spent, b: G.credits - pl, f: v => Math.round(v), goodUp: true, note: `${spent ? '−' + spent + ' das ordens, ' : ''}−${pl} de plantão` });
  if (moved || q.some(d => d.kind === 'apoio')) {
    const worst = ZONES.map((z, i) => ({ z, d: c1[i] - c0[i], a: c0[i], b: c1[i] })).filter(x => Math.abs(x.d) >= 5).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
    rows.push({ k: 'Cobertura média (7 zonas)', a: a0, b: a1, f: v => Math.round(v) + '%', goodUp: true, note: worst.map(w => `${w.z.curto} ${w.a}→${w.b}%`).join(' · ') + (moved ? ' · quem se desloca rende 50%' : '') });
  }
  const cm = q.filter(d => d.kind === 'com').reduce((s, d) => s + (d.p.cid === 'geral' ? -3 : d.p.cid === 'coletiva' ? -5 : 0), 0);
  const mg = (8 + G.round * 2) * D.media + cm - (hasGear('jammer') ? 2 : 0);
  rows.push({ k: 'Pressão da mídia', a: G.media, b: clamp(G.media + mg, 0, 100), f: v => Math.round(v), goodUp: false, note: cm ? `comunicado ${cm}` : 'sem comunicado, a mídia sobe sozinha' });
  if (G.K.vault) rows.push({ k: 'Cofre', a: G.vault, b: clamp(G.vault + vd, 0, 100), f: v => Math.round(v) + '%', goodUp: false, note: nEnt ? `${nEnt} na Entrada segura o ritmo` : 'sem ninguém na Entrada' });
  const nd = q.find(d => d.kind === 'nego');
  if (nd && nd.p.tech !== 'press') { const np = negoParts(nd.p.tech); rows.push({ k: 'Avanço na negociação', txt: pLabel(np.p), tone: pCls(np.p), note: np.compat ? 'postura compatível com o degrau' : np.skip ? 'pula etapa: metade da chance e risco de regredir' : 'consolida o degrau atual' }); }
  return rows;
}

/* ---------- Ultimato final (rodada 8): o que o comandante consegue estimar hoje ----------
   A faixa usa a mesma incerteza da intervenção: quanto menos se sabe, mais larga. */
function ultimatumView() {
  const p = ultimatumProb(), pf = intervProb(-.10), band = Math.max(.05, ivBand());
  return { p, pf, cede: pctRange(p, band), forca: pctRange(pf, band), tone: p >= .5 ? 'good' : p >= .25 ? 'warn' : 'bad' };
}

/* ---------- Alertas priorizados: o que olhar primeiro ---------- */
function siegeAlerts() {
  const out = [], K = G.K, r = G.round, left = MAX_ROUNDS - r, pa = perceivedAgit(), D = D_();
  const add = (sev, ic, title, text, tab, label) => out.push({ sev, ic, title, text, tab, label });
  if (!G.nego.contact && r >= 2) add(2, 'phone', 'Sem canal com o líder', `Há ${r - 1} rodada${r > 2 ? 's' : ''} ninguém fala com ele: você não mede a agitação nem sabe quem ele é.`, 'nego', 'Abrir negociação');
  if ((pa.exact && G.agit >= 70) || (!pa.exact && pa.v >= 70)) add(3, 'alert', pa.exact ? `Agitação ${Math.round(G.agit)}` : 'Agitação crítica', G.agit > 80 ? `Acima de 80 há ${Math.round((G.agit - 80) * 2 * D.desp)}% de risco por rodada de ação desesperada.` : 'Perto de 80 o líder pode agir por desespero. Pressão e movimentos bruscos pioram.', 'nego', 'Acalmar');
  if (G.credits < plantaoCost()) add(3, 'coin', 'Verba abaixo do plantão', `Reserva ${Math.round(G.credits)} para um plantão de ${plantaoCost()}. No vermelho, o banco perde 5 por rodada e, nas três primeiras, a pressão da equipe sobe 3.`, 'tatica', 'Mandar gente à reserva');
  else if (left > 0 && runway() < left) add(2, 'coin', 'A verba não vai até o fim', `Sustenta ${runway().toFixed(1).replace('.', ',')} de ${left} rodadas de plantão (falta ~${Math.round(burnToEnd() - G.credits)}). Cada ordem paga encurta mais.`, 'tatica', 'Rever efetivo');
  if (K.route && zoneCoverage(K.route) < ADEQ) add(3, 'road', `Rota provável descoberta`, `${ZONE[K.route].nome} está com ${zoneCoverage(K.route)}% de cobertura. Se o cofre ceder, é por ali que eles saem.`, 'tatica', 'Reforçar a zona');
  if (K.vault) { const e = vaultEtaN(); if (e <= 2) add(3, 'bank', 'Cofre perto de ceder', e <= 0 ? 'O cofre está a ponto de abrir.' : `Abre em ${e} rodada${e > 1 ? 's' : ''}. Agentes na Entrada seguram o ritmo, mas irritam o líder.`, 'tatica', 'Pressionar a Entrada'); else if (e <= 4) add(2, 'bank', `Cofre abre em ${e} rodadas`, 'Hoje ainda dá tempo de segurar o ritmo ou fechar a rota.', 'tatica', 'Ver a Entrada'); }
  else if (r >= 3 && G.lastVaultDelta >= 6) add(2, 'bank', 'Cofre avança sem medição', 'Há sinais de trabalho intenso, mas você não sabe quanto falta. A diretoria do banco entrega a planta.', 'com', 'Falar com o banco');
  const worst = STK_KEYS.filter(k => G.stk[k].sem >= 2 || G.stk[k].sat < 40).sort((a, b) => G.stk[a].sat - G.stk[b].sat)[0];
  if (worst) add(G.stk[worst].sat < 25 ? 3 : 2, STK[worst].ic, `${STK[worst].nome} em risco`, `Confiança ${Math.round(G.stk[worst].sat)}${G.stk[worst].sem >= 2 ? `, ${G.stk[worst].sem} rodadas sem atenção` : ''}. Perder um stakeholder tem custo imediato.`, 'com', 'Comunicar');
  const tired = deployed().filter(id => ff(id) < .75);
  if (tired.length) add(2, 'tired', 'Equipe cansada', `${tired.length} em campo abaixo de 75% pela fadiga. Horas extras custam ${horasCost()}; rodízio custa cobertura.`, 'tatica', 'Horas extras ou rodízio');
  const away = G.team.filter(isAway);
  if (away.length) add(2, 'alert', 'Agente reconvocado', `${away.map(id => shortName(agentById(id).nome)).join(', ')} fora por mais ${Math.max(...away.map(id => G.away[id]))} rodada(s). As zonas deles estão abertas.`, 'tatica', 'Cobrir as zonas');
  if (G.pressure > 75) add(2, 'bolt', 'Equipe sobrecarregada', `Pressão ${G.pressure}: acima da zona ótima (≈50) a eficiência cai. A Pausa de Comando reduz 10.`, 'tatica', 'Subir à sacada');
  if (G.deadlineLeft > 0) add(3, 'clock', 'Noticiário das 20h', `Faltam ${G.deadlineLeft} rodada${G.deadlineLeft > 1 ? 's' : ''}. Se não houver desfecho, o prefeito perde 15 pontos.`, 'com', 'Falar com o prefeito');
  else if (r === 5) add(1, 'mayor', 'Prefeito em urgência na rodada 6', 'Perdas de confiança dele passam a ser maiores. Comunicar agora é mais barato que depois.', 'com', 'Antecipar');
  if (r === MAX_ROUNDS) { const u = ultimatumView(); add(3, 'clock', 'Última rodada', `Depois desta vem o ultimato final. Como está, o líder cede com ${u.cede} de chance; se não ceder, a entrada é forçada (${u.forca} de sucesso). O que você mexer agora ainda conta.`, 'nego', 'Fechar a negociação'); }
  else if (r >= MAX_ROUNDS - 2) { const u = ultimatumView(); add(1, 'clock', `Ultimato em ${left} rodada${left > 1 ? 's' : ''}`, `Se a crise chegasse ao ultimato como está, o líder cederia com ${u.cede} de chance. Degraus a mais, rotas fechadas e agitação baixa aumentam essa chance.`, 'nego', 'Subir a escada'); }
  if (G.nego.step === 5) add(1, 'check', 'Degrau 5 alcançado', `A rendição ocorre se a agitação cair abaixo de ${D.ret}${G.K.profile && G.nego.contact ? ` (hoje ${Math.round(G.agit)})` : ''}. Mantenha a pressão baixa.`, 'nego', 'Seguir negociando');
  const u = G.update; if (u && u.r === r && u.tocPrev && u.tocPrev !== u.toc) add(1, TOCS[u.toc].ic, `A restrição mudou: ${TOCS[u.toc].nome}`, `Antes era ${TOCS[u.tocPrev].nome.toLowerCase()}. ${TOCS[u.toc].elevar}`, TOCS[u.toc].tab, 'Elevar a restrição');
  const last = out.findIndex(a => a.title === 'Última rodada'); if (last > 0) out.unshift(out.splice(last, 1)[0]);   // a última rodada é o alerta mais urgente: fica no topo entre os críticos
  return out.sort((a, b) => b.sev - a.sev);
}

/* ---------- Marcos próximos (projeção que dá para agir) ---------- */
function milestones() {
  const out = [], r = G.round, K = G.K;
  if (K.vault) { const e = vaultEtaN(); if (isFinite(e)) out.push({ r: r + e, t: 'Cofre abre', tone: e <= 2 ? 'red' : 'amber' }); }
  if (r < 6) out.push({ r: 6, t: 'Prefeito em urgência', tone: 'amber' });
  if (G.deadlineLeft > 0) out.push({ r: r + G.deadlineLeft, t: 'Jornal das 20h', tone: 'red' });
  if (G.nego.contact && G.nego.step < 5) { const pc = negoParts(G.nego.step).p, n = Math.ceil((5 - G.nego.step) / Math.max(.05, pc)); out.push({ r: r + n, t: 'Degrau 5 (se negociar todo turno)', tone: 'blue' }); }
  const bk = burnToEnd(); if (G.credits < bk && plantaoCost() > 0) out.push({ r: r + Math.floor(runway()), t: 'A verba acaba', tone: 'red' });
  { const u = ultimatumView(); out.push({ r: MAX_ROUNDS, t: `Ultimato final (cede com ${u.cede})`, tone: 'red' }); }
  return out.filter(m => m.r <= MAX_ROUNDS + 2).sort((a, b) => a.r - b.r);
}
