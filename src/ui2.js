/* =====================================================================
   INTERFACE — Cerco (fase 2)
   ===================================================================== */
const ROUND_TITLE = ['', 'A primeira hora', 'O silêncio do outro lado', 'O cansaço chega', 'Metade do caminho', 'Fim de tarde', 'A cobrança', 'A última luz', 'Ultimato'];
const FRONT_IC = { tatica: 'shield', nego: 'phone', intel: 'eye', com: 'mic' };

function bscValues() {
  const H = G.hostages, pv = perceivedVault();
  const avg = ZONES.reduce((s, z) => s + zoneCoverage(z.id), 0) / ZONES.length;
  return [
    { k: 'Vidas', v: G.K.hostages ? vidasScore(H) * 100 : 100, unk: !G.K.hostages, cls: 'g' },
    { k: 'Prisões', v: avg, cls: 'b', unk: false },
    { k: 'Valores', v: 100 - pv.v, unk: !pv.exact, cls: 'a' },
    { k: 'Eficiência', v: eficienciaCusto() * 100, unk: false, cls: 'v' },
    { k: 'Confiança', v: confidence() * 100, unk: false, cls: 'g' }
  ];
}
function hudHTML() {
  const b = bscValues();
  return `<div class="hud"><div class="hudrow">
    <span class="brand">PERÍMETRO</span>
    <div class="stat"><small>Rodada</small><b>${G.round}/${MAX_ROUNDS}</b></div>
    <div class="stat"><small>Hora</small><b>${fmtTime(G.round)}</b></div>
    ${G.stage === 'panel' ? `<div class="timer" id="clock" role="timer" aria-label="Tempo restante da rodada">${G.noLimit ? '∞' : mmss(Math.max(0, Math.ceil((UI.deadline - Date.now()) / 1000)) || D_().timer)}</div>` : ''}
    <div class="stat"><small>Créditos</small><b style="color:var(--amber)" data-k="cred" data-n="${Math.round(G.credits)}">${fmt(G.credits)}</b><em class="burn ${G.credits < plantaoCost() ? 'bad' : ''}" title="Custo de plantão cobrado ao fim de cada rodada">−${plantaoCost()}/rod.</em></div>
    <div class="stat tocchip ${TOCS[tocConstraint().k].cor}" title="Elo mais fraco do sistema agora (Teoria das Restrições)"><small>Gargalo</small><b>${TOCS[tocConstraint().k].nome}</b></div>
    <div class="bsc" title="Projeção dos cinco objetivos (placar equilibrado)">${b.map((x, i) => `<div><span>${x.k}</span><b ${x.unk ? 'title="Ainda desconhecido"' : `data-k="bscn${i}" data-n="${Math.round(x.v)}"`}>${x.unk ? '?' : Math.round(x.v)}</b>${meter(x.v, x.cls, `data-k="bsc${i}" data-val="${Math.round(x.v)}"`)}</div>`).join('')}</div>
  </div>${tickerHTML(headlines(), 'TV PORTO ALTO')}</div>`;
}

/* ---------- Sparkline ---------- */
function spark(series, color, proj) {
  const W = 220, Hh = 46, n = Math.max(series.length, 1) + (proj ? 2 : 0);
  const X = i => 6 + (W - 14) * (n <= 1 ? 0 : i / (n - 1)), Y = v => Hh - 6 - (Hh - 12) * clamp(v, 0, 100) / 100;
  if (!series.length) return `<svg class="spark" viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><path d="M6 ${Hh - 6}H${W - 8}" stroke="var(--line)" /></svg>`;
  const pts = series.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const last = series[series.length - 1], prev = series.length > 1 ? series[series.length - 2] : last;
  const tr = last - prev, pEnd = clamp(last + tr * 2, 0, 100);
  const area = `${X(0).toFixed(1)},${Hh - 6} ${pts} ${X(series.length - 1).toFixed(1)},${Hh - 6}`;
  return `<svg class="spark" viewBox="0 0 ${W} ${Hh}" aria-hidden="true"><path d="M6 ${Hh - 6}H${W - 8}M6 ${Y(50)}H${W - 8}" stroke="var(--line)" stroke-width="1"/>
    <polygon points="${area}" fill="${color}" opacity=".12"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    ${proj ? `<path d="M${X(series.length - 1).toFixed(1)} ${Y(last).toFixed(1)} L${X(series.length + 1).toFixed(1)} ${Y(pEnd).toFixed(1)}" stroke="${color}" stroke-width="2" stroke-dasharray="3 3" fill="none"/>` : ''}
    <circle cx="${X(series.length - 1).toFixed(1)}" cy="${Y(last).toFixed(1)}" r="3.5" fill="${color}"/></svg>`;
}
const ins = (tone, ic, text) => `<div class="insight ${tone}">${icon(ic, '', 1.8)}<span>${text}</span></div>`;

/* ---------- Painel de Endsley ---------- */
function endsleyHTML() {
  const K = G.K, H = G.hostages, pa = perceivedAgit(), pv = perceivedVault(), P = PR_();
  const unk = t => `<span class="unk">${t}</span>`;
  const hid = [
    ['Perfil do líder', K.profile ? P.nome : K.profileHint ? `${PROFILES[K.profileHint[0]].nome} ou ${PROFILES[K.profileHint[1]].nome}` : null],
    ['Rota de fuga', K.route ? ZONE[K.route].curto : K.cleared.length ? `${K.cleared.map(z => ZONE[z].curto).join(', ')}: improvável` : null],
    ['Armados', K.count ? G.assail : K.countHint ? `${K.countHint[0]}–${K.countHint[1]}` : null],
    ['Cofre', pv.exact ? pv.txt : null],
    ['Reféns feridos', K.hostages ? `${H.hurt} feridos · ${H.dead} mortos` : null],
    ['Cúmplice externo', K.accomplice ? (G.accomplice ? 'Sim' : 'Não') : null]
  ];
  const u = G.update, reps = u && u.r === G.round ? u.reports : [];
  const l1 = `
    <div class="kv">
      <div><small>Pressão da mídia</small><b>${Math.round(G.media)}</b></div>
      <div><small>Agitação aparente</small><b>${pa.txt}</b></div>
      <div><small>Cofre (atividade)</small>${pv.exact ? `<b>${pv.txt}</b>` : `<b>${pv.txt}</b>`}</div>
      <div><small>Degrau da negociação</small><b>${G.nego.step} / 5</b></div>
    </div>
    <p style="font-size:13.5px;margin-top:2px;font-family:var(--serif)">${hostagesFramed()}.</p>
    <div class="eyebrow">Variáveis ocultas</div>
    <div class="kv">${hid.map(([k, v]) => `<div><small>${k}</small>${v == null ? unk('desconhecido') : `<b style="font-size:14px">${v}</b>`}</div>`).join('')}</div>
    <div class="eyebrow">Relatos de campo desta rodada</div>
    <div>${reps.length ? reps.map(r => `<div class="report"><span class="src">${r.ag} · ${ZONE[r.z].curto}</span><span>${r.txt}. <span class="faint">Confiança ${r.conf}.</span></span></div>`).join('') : '<p class="faint" style="font-size:12.5px">Nenhum relato: zonas sem agentes não geram relatos. Você só ouve onde posiciona gente para ouvir.</p>'}</div>`;
  // Nível 2
  const toc = tocConstraint(), fpAvg = deployed().length ? deployed().reduce((s, id) => s + fp(id), 0) / deployed().length : pressureFactor(G.pressure);
  const zone = G.pressure < 30 ? 'baixa demais (complacência)' : G.pressure <= 62 ? 'zona ótima' : G.pressure <= 75 ? 'alta (desempenho caindo)' : 'sobrecarga';
  const L2 = [];
  L2.push(ins(G.pressure > 75 || G.pressure < 30 ? 'bad' : G.pressure > 62 ? 'warn' : 'good', 'bolt', `Pressão operacional ${G.pressure}: ${zone}. Eficiência média dos agentes ${Math.round(fpAvg * 100)}% do potencial (curva de Yerkes-Dodson).`));
  const st = STEPS[G.nego.step - 1];
  L2.push(ins('info', 'phone', `Negociação no degrau ${G.nego.step} (${st.nome}). ${K.profile ? `Líder ${P.nome}: ${P.tip}` : G.nego.signalShown ? `Sinal do canal: “${P.sign}”` : 'O perfil do líder ainda é desconhecido, e a postura certa depende dele.'}`));
  const topEv = Object.entries(G.ev).sort((a, b) => b[1] - a[1])[0];
  const adq = adequateCount();
  L2.push(ins(adq >= 4 ? 'good' : 'warn', 'map', `${adq} de 7 zonas com cobertura adequada. ${topEv && topEv[1] >= 1.5 ? `Os relatos convergem para <b>${ZONE[topEv[0]].nome}</b> (${dec(topEv[1])} indícios ponderados).${G.team.includes('carla') ? ' A Det. Mendes correlacionou os relatos.' : ''}` : 'Os relatos ainda não apontam uma rota com clareza.'}`));
  const tired = deployed().filter(id => ff(id) < .8), away = G.team.filter(isAway);
  if (tired.length) L2.push(ins('warn', 'tired', `Fadiga: ${tired.map(id => shortName(agentById(id).nome)).join(', ')} abaixo de 80% de eficiência. Rodízio custa cobertura temporária.`));
  if (away.length) L2.push(ins('bad', 'alert', `${away.map(id => shortName(agentById(id).nome)).join(', ')} reconvocado${away.length > 1 ? 's' : ''} pela cidade por ${Math.max(...away.map(id => G.away[id]))} rodada(s).`));
  const bad = STK_KEYS.filter(k => G.stk[k].sem >= 2 || G.stk[k].sat < 40);
  if (bad.length) L2.push(ins('bad', 'family', `Risco com stakeholders: ${bad.map(k => `${STK[k].nome} (${Math.round(G.stk[k].sat)}${G.stk[k].sem >= 2 ? `, ${G.stk[k].sem} rodadas sem atenção` : ''})`).join('; ')}.`));
  if (G.round >= 6) L2.push(ins('bad', 'mayor', 'O prefeito está em modo de urgência: perdas de confiança dele são ampliadas até o fim.'));
  G.hints.slice(-2).forEach(h => L2.push(ins('info', 'light', `Pista (rodada ${h.r}): ${br(h.t)}`)));
  // Nível 3
  const hist = G.hist, ag = hist.map(h => h.agit), md = hist.map(h => h.media), vl = hist.map(h => h.vault);
  const agNow = [...ag, Math.round(G.agit)], mdNow = [...md, Math.round(G.media)], vlNow = [...vl, Math.round(G.vault)];
  const trendA = agNow.length > 1 ? agNow[agNow.length - 1] - agNow[agNow.length - 2] : 0;
  const mProj = clamp(Math.round(G.media + Array.from({ length: MAX_ROUNDS - G.round }, (_, i) => (8 + (G.round + 1 + i) * 2) * D_().media).reduce((a, b) => a + b, 0)), 0, 100);
  const best = POSTURES.map(p => negoParts(p.t).p).reduce((a, b) => Math.max(a, b), 0), pc = negoParts(G.nego.step).p;
  const roundsLeft = G.nego.step >= 5 ? 0 : Math.ceil((5 - G.nego.step) / Math.max(.05, pc));
  const ip = intervProb(), band = .16 * (1 - infoFrac()), ul = ultimatumView();
  const L3 = `
    <div class="grid" style="gap:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <div><div class="eyebrow">Agitação aparente</div>${spark(agNow, '#ff5468', true)}</div>
      <div><div class="eyebrow">Pressão da mídia</div>${spark(mdNow, '#f6a623', true)}</div>
      <div><div class="eyebrow">Atividade no cofre</div>${spark(vlNow.map(v => perceivedVault(v).exact ? v : perceivedVault(v).v), '#4da6ff', true)}</div>
      <div><div class="eyebrow">Reserva de créditos (por 10)</div>${spark(creditSeries(), '#41d08f', true)}</div>
    </div>
    ${milestonesHTML()}
    ${ins('info', 'radar', `Tendência da agitação: ${trendA > 2 ? 'subindo' : trendA < -2 ? 'caindo' : 'estável'}${G.nego.contact ? '' : ' (estimativa grosseira: sem canal aberto)'}. ${G.agit > 70 ? 'Acima de 80 há risco de ação desesperada.' : ''}`)}
    ${ins(G.credits >= burnToEnd() ? 'good' : 'warn', 'coin', G.credits >= burnToEnd() ? `Reserva ${Math.round(G.credits)}: cobre o plantão até o fim (${burnToEnd()}) e sobram ${Math.round(G.credits - burnToEnd())} para investigar ou pedir apoio (próximo apoio: ${apoioCost()}).` : `Reserva ${Math.round(G.credits)}: o plantão até o fim custa ${burnToEnd()}. Faltam ${Math.round(burnToEnd() - G.credits)} créditos, e cada ordem paga aumenta o buraco.`)}
    ${ins(mProj > 85 ? 'warn' : 'info', 'mic', `Sem comunicados, a mídia chega perto de ${mProj} até a rodada ${MAX_ROUNDS}.`)}
    ${ins('info', 'bank', `Cofre: previsão de abertura em ${K.vault ? etaVault() : 'prazo desconhecido (faixa ampla, só a inteligência ou a diretoria do banco precisam)'}.`)}
    ${ins('info', 'stairs', `Negociação: com a melhor postura, a chance de avançar é ${pLabel(pc)}; chegar ao degrau 5 leva cerca de ${roundsLeft || 'zero'} rodada${roundsLeft === 1 ? '' : 's'} se negociar todo turno. ${G.nego.step === 5 ? `Rendição ocorre se a agitação cair abaixo de ${D_().ret}.` : ''}`)}
    ${ins(ip > .55 ? 'good' : ip > .3 ? 'warn' : 'bad', 'shield', `Intervenção hoje: chance estimada ${pLabel(ip)} (${Math.round(clamp(ip - band, 0, 1) * 100)}–${Math.round(clamp(ip + band, 0, 1) * 100)}%). Quanto menos você sabe, mais larga é a faixa${blindParts().length ? ', e entrar sem conhecer o interior custa ' + Math.round(-blindParts().reduce((s, b) => s + b.v, 0) * 100) + ' pontos de chance' : ''}.`)}
    ${ins(ul.tone, 'clock', `Ultimato da rodada ${MAX_ROUNDS}: se a crise chegasse lá como está, o líder cederia com chance de ${ul.cede}; se não ceder, a entrada é forçada com ${ul.forca} de sucesso. Cada degrau a mais, rota fechada e ponto de agitação a menos ajudam a cessão.`)}
    ${G.round < 6 ? ins('warn', 'mayor', `A urgência do prefeito aumenta na rodada 6 (faltam ${6 - G.round}).`) : ''}`;
  /* Os três níveis de Endsley viram abas: o mesmo conteúdo, um nível por vez (o painel tinha ~1.500 px). */
  const l2s = L2.join(''), n2 = (l2s.match(/insight (warn|bad)/g) || []).length, n3 = (L3.match(/insight (warn|bad)/g) || []).length;
  const lv = UI.lvl || 1, LV = [[1, 'Percepção', 'dados brutos', 0], [2, 'Compreensão', 'o que significa', n2], [3, 'Projeção', 'para onde vai', n3]];
  return `<div class="card endsley"><h2 class="h3">Painel do comandante <span class="faint sub">consciência situacional</span></h2>
    <div class="lvtabs" role="tablist" aria-label="Níveis de consciência situacional">${LV.map(([n, t, s, c]) => `<button class="lvtab l${n}" role="tab" id="lvt${n}" aria-controls="lvp" aria-selected="${lv === n}" tabindex="${lv === n ? 0 : -1}" data-act="lvl" data-t="${n}"><b>${n}</b><span>${t}<small>${s}</small></span>${c ? `<em title="${c} ${plural(c, 'leitura pede', 'leituras pedem')} atenção">${c}</em>` : ''}</button>`).join('')}</div>
    <div class="lvl l${lv}${UI.tabAnim ? ' swap' : ''}" id="lvp" role="tabpanel" aria-labelledby="lvt${lv}">${lv === 1 ? l1 : lv === 2 ? l2s : L3}</div></div>`;
}


/* ===================================================================
   DASHBOARDS DE OPERAÇÃO (L1.3): caixa, gargalo, alertas, prévias
   =================================================================== */
const creditSeries = () => { const h = G.creditsHist.slice(1, G.round + 1).map(v => v / 10); return h.length ? h : [G.credits / 10]; };
const TOCCLS = { violet: 'v', blue: 'b', amber: 'a' };

function cashCard() {
  const pl = plantaoCost(), left = MAX_ROUNDS - G.round, need = pl * left, run = runway();
  const status = G.credits < pl ? ['red', 'no vermelho no próximo plantão'] : G.credits >= need ? ['green', 'cobre o plantão até o fim'] : ['amber', `faltam ~${Math.round(need - G.credits)} até o fim`];
  const cats = spendBreakdown(), tot = cats.reduce((a, c) => a + c.v, 0) || 1;
  return `<div class="card cash"><h3>Caixa <span class="pill ${status[0]}">${status[1]}</span></h3>
    <div class="cashtop"><div><small>Reserva</small><b class="mono" data-k="cashres" data-n="${Math.round(G.credits)}">${fmt(G.credits)}</b></div><div><small>Plantão</small><b class="mono">−${pl}<i>/rod.</i></b></div><div><small>Cobre</small><b class="mono">${run >= 99 ? '∞' : dec(run)}<i> rod.</i></b></div></div>
    <div class="stack" role="img" aria-label="Para onde foi o dinheiro: ${cats.filter(c => c.v > 0).map(c => c.k + ' ' + Math.round(c.v)).join(', ')}">${cats.filter(c => c.v > 0).map(c => `<i style="width:${c.v / tot * 100}%;background:${c.c}" title="${c.k}: ${Math.round(c.v)}"></i>`).join('')}</div>
    <div class="stackleg">${cats.filter(c => c.v > 0).map(c => `<span><i style="background:${c.c}"></i>${c.k} <b class="mono">${Math.round(c.v)}</b></span>`).join('')}</div>
    <p class="faint" style="font-size:12px;margin-top:8px">Próximos preços: apoio externo ${G.supportUsed >= APOIO_PRECOS.length ? 'esgotado' : apoioCost(0)} · horas extras ${horasCost()} · investigação 40–70. Quem descansa na reserva ou foi reconvocado não custa plantão.</p></div>`;
}
function utilHTML() {
  const field = deployed().length, away = G.team.filter(isAway).length, rest = G.team.length - field - away;
  const tight = rest === 0 && field > 0;
  return `<div class="util" title="Utilização da equipe, como a capacidade de uma linha de produção"><span><b>${field}</b> em campo</span><span><b>${rest}</b> descansam</span><span><b>${away}</b> reconvocado${away === 1 ? '' : 's'}</span></div>
    ${tight ? '<p class="faint" style="font-size:12px;margin:-4px 0 8px">Sem folga: ninguém descansa sem abrir uma zona. O cansaço acumulado só se resolve com rodízio ou horas extras.</p>' : ''}`;
}
function gearNote(e) {
  const z = G.gz[e] || 'reserva', placed = z !== 'reserva', has = placed && agentsIn(z).length;
  switch (e) {
    case 'drone': return placed ? `+15 de cobertura em ${ZNAME(z)}` : 'na reserva: sem efeito de cobertura';
    case 'sniper': return !placed ? 'na reserva: sem efeito' : has ? `+20 em ${ZNAME(z)} e +10 de prontidão` : `${ZNAME(z)} está sem agente: sem efeito`;
    case 'termica': return placed ? `lendo ${ZNAME(z)} (revelação feita no início)` : 'na reserva: sem leitura';
    case 'escudo': return '+10 de prontidão da intervenção';
    case 'negofone': return '+10 pontos na chance de avanço';
    case 'kit': return `${G.hostages.hurt ? `${G.hostages.hurt} ${plural(G.hostages.hurt, 'ferido sob atendimento', 'feridos sob atendimento')}: ninguém piora por falta de socorro` : 'de prontidão: ferido não piora por falta de socorro'}${G.stats.kitSaves ? `; já evitou ${G.stats.kitSaves} ${plural(G.stats.kitSaves, 'morte', 'mortes')}` : ''}`;
    case 'jammer': return 'sem cúmplice coordenado nem lives; agitação +1/rodada';
    case 'viatura': return 'reposicionar não perde eficiência';
  }
  return '';
}
function gearCard() {
  if (!G.gear.length) return `<div class="card"><h3>Equipamentos</h3><p class="faint" style="font-size:12.5px">Nenhum equipamento. A equipe opera com o que tem: sem fator de cobertura nas zonas.</p></div>`;
  return `<div class="card"><h3>Equipamentos em campo</h3><div class="gearlist">${G.gear.map(e => { const idle = ['drone', 'sniper', 'termica'].includes(e) && (G.gz[e] || 'reserva') === 'reserva'; return `<div class="gl ${idle ? 'idle' : ''}">${icon(EQ[e].ic, 'ico')}<span><b>${EQ[e].nome}</b><small>${gearNote(e)}</small></span></div>`; }).join('')}</div></div>`;
}
const SEVN = { 3: 'crítico', 2: 'atenção', 1: 'aviso' };
function alertsHTML() {
  const al = siegeAlerts();
  if (!al.length) return `<div class="calmbar" role="status">${icon('check', 'ico', 2)}<span><b>Atenção agora:</b> nada exige ação imediata. Use a rodada para investir em informação, rodízio ou comunicação preventiva.</span></div>`;
  const top = al.slice(0, 3);
  return `<div class="card alerts"><h2 class="h3">Atenção agora <span class="pill ${al[0].sev === 3 ? 'red' : al[0].sev === 2 ? 'amber' : 'blue'}">${al.length} ${al.length === 1 ? 'alerta' : 'alertas'}</span></h2>
    ${top.map(a => `<div class="alert s${a.sev}">${icon(a.ic, 'ico')}<div><b>${a.title}</b> <em>${SEVN[a.sev]}</em><span>${a.text}</span></div><button class="btn sm" data-act="tab" data-t="${a.tab}">${a.label}</button></div>`).join('')}
    ${al.length > 3 ? `<small class="faint">Em segundo plano: ${al.slice(3).map(a => a.title).join(' · ')}</small>` : ''}</div>`;
}
const TABN = { tatica: 'Tática', nego: 'Negociação', intel: 'Inteligência', com: 'Comunicação' };
function tocWidget() {
  const t = tocConstraint(), keys = ['info', 'pessoal', 'tempo'], X = TOCS[t.k];
  const bars = keys.map(k => `<div class="tocb ${k === t.k ? 'lead' : ''}"><span>${icon(TOCS[k].ic, 'ico')}${TOCS[k].nome}</span>${meter(t.pct[k], TOCCLS[TOCS[k].cor], `data-k="toc${k}" data-val="${t.pct[k]}"`)}<b class="mono">${t.pct[k]}</b>${k === t.k ? '<em>gargalo</em>' : ''}</div>`).join('');
  const dots = Array.from({ length: MAX_ROUNDS }, (_, i) => { const r = i + 1, k = G.tocLog[r]; return `<i class="td ${k ? TOCS[k].cor : ''} ${r === G.round ? 'now' : ''}" title="Rodada ${r}${k ? ': ' + TOCS[k].nome : ''}"></i>`; }).join('');
  const hist = Array.from({ length: G.round }, (_, i) => G.tocLog[i + 1] ? `R${i + 1} ${TOCS[G.tocLog[i + 1]].nome}` : '').filter(Boolean).join(', ');
  return `<div class="card toc"><h2 class="h3">Gargalo do sistema <span class="faint sub" title="O elo mais fraco decide o resultado do sistema">Teoria das Restrições</span></h2>
    <div class="tocbars">${bars}</div>
    <div class="toctl"><small>Gargalo por rodada</small><span aria-hidden="true">${dots}</span><span class="sr">${hist || 'sem histórico ainda'}</span></div>
    <p class="why"><b>${X.nome}.</b> ${X.por}</p>
    <div class="elevs"><div class="elev"><small>Elevar</small>${X.elevar}</div><div class="elev stop"><small>Pare de</small>${X.parar}</div></div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="tab" data-t="${X.tab}">Ir para ${TABN[X.tab]} →</button><span class="faint" style="font-size:12px">${G.round <= 3 ? 'Esperado no início: informação.' : G.round <= 6 ? 'Esperado no meio: pessoal.' : 'Esperado no fim: tempo e fadiga.'}</span></div></div>`;
}
function reposPreviewHTML() {
  if (!UI.repoAgent || !UI.repoZone || G.az[UI.repoAgent] === UI.repoZone) return '<p class="faint" style="font-size:12px">Escolha agente e destino (ou clique numa zona do mapa) para ver o custo da mudança antes de assumi-la.</p>';
  const p = reposPreview(UI.repoAgent, UI.repoZone), nm = shortName(agentById(UI.repoAgent).nome);
  const cell = (z, a, b, c) => `<div class="rp"><b>${ZNAME(z)}</b><span class="mono">${a}% → <em class="${b < a ? 'neg' : 'pos'}">${b}%</em>${c != null ? ` → ${c}%` : ''}</span></div>`;
  return `<div class="rprev"><div class="eyebrow">Prévia · ${nm}</div>
    ${p.from !== 'reserva' ? cell(p.from, p.before[p.from], p.now[p.from]) : ''}
    ${p.z !== 'reserva' ? `<div class="rp"><b>${ZNAME(p.z)}</b><span class="mono">${p.before[p.z]}% → <em class="${p.now[p.z] < p.before[p.z] ? 'neg' : 'pos'}">${p.now[p.z]}%</em> nesta rodada → <em class="pos">${p.next[p.z]}%</em> na próxima</span></div>` : '<div class="rp"><b>Reserva</b><span>descansa: fadiga zera, a zona fica aberta</span></div>'}
    <small class="faint">${p.free ? 'Sem perda de eficiência no deslocamento.' : 'Cobertura de destino só chega ao valor cheio daqui a duas rodadas.'}</small></div>`;
}
function planPreviewHTML() {
  const rows = planPreview(); if (!rows.length) return '';
  return `<div class="card pprev"><h2 class="h3">Prévia do plano <span class="faint sub">estimativa com o que você já enxerga</span></h2>${rows.map(r => r.txt != null
    ? `<div class="pr"><span>${r.k}</span><b class="${r.tone}">${r.txt}</b><small>${r.note}</small></div>`
    : `<div class="pr"><span>${r.k}</span><b class="mono ${Math.abs(r.b - r.a) < .5 ? '' : (r.b > r.a) === r.goodUp ? 'pos' : 'neg'}">${r.f(r.a)} → ${r.f(r.b)}</b><small>${r.note}</small></div>`).join('')}</div>`;
}
function milestonesHTML() {
  const ms = milestones(); if (!ms.length) return '';
  return `<div class="miles"><div class="eyebrow">Marcos à frente (se nada mudar)</div><div class="mlist">${ms.map(m => `<span class="mile ${m.tone}"><b>R${Math.min(m.r, MAX_ROUNDS + 1)}${m.r > MAX_ROUNDS ? '+' : ''}</b>${m.t}</span>`).join('')}</div></div>`;
}

/* ---------- Coluna A: mapa e equipe ---------- */
function colA() {
  const team = G.team.map(id => {
    const a = agentById(id), z = G.az[id] || 'reserva', f = ff(id);
    const tr = +G.transit[id] || 0, eff = agentEff(id) / stat(id, 'tat');
    return `<div class="trow ${isAway(id) ? 'away' : ''}"><div><b>${shortName(a.nome)}</b><small>${isAway(id) ? `reconvocado (${G.away[id]} rod.)` : ZNAME(z)}${tr ? ` · <span class="tr${tr}">em trânsito ${tr >= 2 ? '50' : '75'}%</span>` : ''} · ${a.trait}</small></div>
      <div style="width:96px" title="Tática ${stat(id, 'tat')} × pressão ${Math.round(fp(id) * 100)}% × fadiga ${Math.round(f * 100)}%${tr ? ' × trânsito ' + (tr >= 2 ? '50' : '75') + '%' : ''}">${meter(f * 100, f > .75 ? 'g' : f > .55 ? 'a' : 'r', `data-k="ff${id}" data-val="${Math.round(f * 100)}"`)}<small class="mono faint" style="font-size:11px">rende ${Math.round(eff * 100)}%</small></div></div>`;
  }).join('');
  return `<div class="colA">${cashCard()}${rosterCard()}<div class="card"><h2 class="h3">Equipe e fadiga</h2>${utilHTML()}<div class="team">${team || '<p class="faint">Sem agentes.</p>'}</div></div>${gearCard()}${radioCard()}</div>`;
}
/* ---------- Quem está lá dentro: os 17 reféns com nome ---------- */
function hstate(h) {
  if (h.st === 'dead') return { c: 'dead', t: 'óbito' };
  if (!h.in) return { c: 'out', t: h.st === 'hurt' ? 'fora, ferimento' : 'fora' };
  if (h.st === 'hurt' && G.K.hostages) return { c: 'hurt', t: 'ferimento' };
  return { c: G.K.hostages ? 'in' : 'in unk', t: G.K.hostages ? 'lá dentro' : 'não confirmado' };
}
function rosterCard() {
  const H = G.hostages, out = G.hl.filter(h => !h.in).length, inside = H.inside - H.dead;
  /* Compacto: só o nome; idade e papel ficam na dica. Estados fora do comum ganham texto, não só cor. */
  return `<div class="card"><h2 class="h3">Quem está lá dentro <span class="pill ${H.dead ? 'red' : inside < HOSTAGES ? 'green' : ''}">${inside} no interior</span></h2>
    <div class="roster">${G.hl.map(h => { const d = HOST[h.id], st = hstate(h), plain = st.c.includes('unk') || st.c === 'in'; return `<span class="rp ${st.c}" title="${d.nome}, ${d.idade} anos, ${d.papel}${d.nota ? ' (' + d.nota + ')' : ''}: ${st.t}"><b>${d.nome.split(' ')[0]}</b>${plain ? '' : `<small>${st.t}</small>`}</span>`; }).join('')}</div>
    <p class="faint" style="font-size:12px;margin-top:8px">${out ? `${out} fora do banco. ` : ''}${G.K.hostages ? 'Estado dos reféns confirmado.' : 'Borda tracejada: estado não confirmado. A sala de acolhimento ou uma investigação revelam quem está ferido. Passe o mouse para ver idade e papel.'}</p></div>`;
}

/* ---------- Coluna C: decisões ---------- */
const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
/* Por que uma opção está indisponível. Devolve [motivo, mostrar na própria opção?].
   Plano cheio e intervenção já aparecem num aviso único no topo da aba, então não se repetem em cada opção. */
function whyNot(c = {}) {
  const n = D_().slots;
  if (G.queue.some(q => q.kind === 'interv')) return ['A intervenção ocupa a rodada inteira. Remova-a do plano para escolher outras ações.', false];
  if (c.state) return [c.state, false];
  if (c.inPlan) return ['Já está no plano. Para tirar, use o ✕ na barra do plano.', false];
  if (!c.free && slotsLeft() <= 0) return [`Plano cheio: ${n} de ${n} decisões. Remova uma ação na barra do plano para trocar.`, false];
  if (c.limit) return [c.limit, true];
  if (c.cost && G.credits < c.cost) return [`Faltam ${fmt(c.cost - G.credits)} créditos (reserva ${fmt(G.credits)}).`, true];
  return null;
}
/* Opção de decisão. Indisponível = aria-disabled: continua focável, mostra o motivo e explica no clique. */
function opt(ic, title, desc, cost, act, data, o = {}) {
  const w = o.why || null;
  return `<button class="opt ${o.danger ? 'danger' : ''}" data-act="${act}" ${data || ''} ${w ? `aria-disabled="true" data-why="${attr(w[0])}"` : ''} aria-pressed="${!!o.pressed}">${icon(ic, 'ico" style="width:24px;height:24px')}<span><b>${title}${o.pressed ? ' <span class="pill amber inplan">no plano</span>' : ''}</b><span class="d">${desc}</span>${w && w[1] ? `<span class="unav">${w[0]}</span>` : ''}</span>${cost ? `<span class="c">${cost}</span>` : '<span></span>'}</button>`;
}
function planBanner() {
  const n = D_().slots;
  if (G.queue.some(q => q.kind === 'interv')) return `<div class="planfull bad" role="status">${icon('shield', 'ico', 1.8)}<span>A intervenção ocupa a rodada inteira. Para escolher outras ações, remova-a na barra do plano.</span></div>`;
  if (slotsLeft() <= 0) return `<div class="planfull" role="status">${icon('check', 'ico', 2)}<span>Plano cheio: ${n} de ${n} decisões. Execute a rodada ou remova uma ação na barra do plano para trocar.</span></div>`;
  return '';
}
function tabTatica() {
  const ags = G.team.filter(id => !isAway(id));
  const ivq = G.queue.some(q => q.kind === 'interv');
  const zoneOpts = ZONES.map(z => `<option value="${z.id}" ${UI.apoioZone === z.id ? 'selected' : ''}>${z.nome} (${zoneCoverage(z.id)}%)</option>`).join('');
  const ip = intervProb(), band = .16 * (1 - infoFrac()), blind = blindParts();
  const blindTxt = blind.length ? `<br><span style="color:var(--amber)">Às cegas: ${blind.map(b => `−${Math.round(-b.v * 100)}% porque você ${b.txt}`).join('; ')}.</span>` : '<br><span style="color:var(--green)">Você conhece o interior: sem penalidade por entrar às cegas.</span>';
  const apostaTxt = ip < APOSTA_P ? `<br><span style="color:var(--amber)">É uma aposta: com menos de ${Math.round(APOSTA_P * 100)}% de chance, mesmo um sucesso não passa da nota A.</span>` : '';
  const apoioLeft = Math.max(0, APOIO_PRECOS.length - G.supportUsed - G.queue.filter(q => q.kind === 'apoio').length);
  const wRepos = whyNot(), wApoio = whyNot({ cost: apoioCost(), limit: apoioLeft ? null : 'Os 3 apoios externos da operação já foram usados.' });
  const pausaQ = G.queue.some(q => q.kind === 'pausa'), horasQ = G.queue.some(q => q.kind === 'horas');
  return `<div class="card flat" style="display:grid;gap:8px"><h3>Reposicionar agente</h3>
      <div class="fields2"><label class="field">Agente<select id="repoAgent" data-chg="repoagent"><option value="">escolher…</option>${ags.map(id => `<option value="${id}" ${UI.repoAgent === id ? 'selected' : ''}>${shortName(agentById(id).nome)} · ${ZNAME(G.az[id] || 'reserva')} · fad. ${(G.fat[id] || 0)}</option>`).join('')}</select></label>
      <label class="field">Destino<select id="repoZone" data-chg="repozone"><option value="">escolher…</option>${ZONES.map(z => `<option value="${z.id}" ${UI.repoZone === z.id ? 'selected' : ''}>${z.nome}</option>`).join('')}<option value="reserva" ${UI.repoZone === 'reserva' ? 'selected' : ''}>Reserva (descansa)</option></select></label></div>
      ${reposPreviewHTML()}
      <div class="row"><button class="btn sm" data-act="addrepos" ${wRepos ? `aria-disabled="true" data-why="${attr(wRepos[0])}"` : ''}>Adicionar ao plano</button></div>
      <p class="faint" style="font-size:12px">Deslocar custa: 50% de eficiência na rodada da ordem, 75% na seguinte, meia rodada de fadiga, e a zona de origem fica aberta na hora${hasGear('viatura') ? ' (sua Viatura elimina a perda de eficiência)' : ''}. A reserva descansa e zera a fadiga, mas não cobre nada.</p></div>
    <div class="optlist">
      ${opt('support', 'Apoio externo', `Agências parceiras reforçam uma zona: +25 de cobertura por 2 rodadas. Cada uso encarece (${APOIO_PRECOS.join(' → ')}); ${apoioLeft} ${plural(apoioLeft, 'restante', 'restantes')}.`, apoioCost(), 'addapoio', '', { why: wApoio })}
      <label class="subfield"><span>Zona do apoio</span><select id="apoioZone" data-chg="apoiozone"><option value="">escolher…</option>${zoneOpts}</select></label>
      ${opt('pause', 'Pausa de Comando', `“Subir à sacada”: ${G.team.includes('diego') ? 'duas pistas' : 'uma pista'} sobre variáveis ocultas, visão sistêmica e −10 de pressão na equipe. Consome uma decisão; a crise continua andando.`, '', 'addpausa', '', { why: whyNot({ inPlan: pausaQ }), pressed: pausaQ })}
      ${opt('tired', 'Horas extras', `Recupera 2 rodadas de fadiga em campo e encerra a Fadiga crítica. O preço cresce com o efetivo em campo (${deployed().length} ${plural(deployed().length, 'agente', 'agentes')}).`, horasCost(), 'addhoras', '', { why: whyNot({ inPlan: horasQ, cost: horasCost() }), pressed: horasQ })}
      ${UI.ivConfirm ? `<div class="insight bad">${icon('alert', '', 1.8)}<span><b>Ordenar a intervenção agora?</b> Prontidão ${Math.round(intervPower())}%, chance estimada ${pLabel(ip)} (${Math.round(clamp(ip - band, 0, 1) * 100)}–${Math.round(clamp(ip + band, 0, 1) * 100)}%). Ocupa todas as decisões e encerra a crise nesta rodada.${blindTxt}${apostaTxt}</span></div><div class="row"><button class="btn danger" data-act="ivyes">Confirmar intervenção</button><button class="btn ghost" data-act="ivno">Cancelar <span class="faint" style="font-weight:400">(Esc)</span></button></div>` :
        opt('shield', 'Intervenção', `Ação direta, o BATNA da força-tarefa. Prontidão ${Math.round(intervPower())}% · chance estimada <b>${pLabel(ip)}</b> (±${Math.round(band * 100)}%). Depende de inteligência, tática e agitação.${blindTxt}${apostaTxt}`, '', 'iv', '', { danger: true, pressed: ivq })}
    </div>`;
}
function tabNego() {
  const n = G.nego, cur = n.step, q = G.queue.find(x => x.kind === 'nego');
  const ags = avail(), negId = getNegotiator();
  const ladder = STEPS.map(s => `<div class="step ${s.n < cur ? 'done' : s.n === cur ? 'cur' : ''}"><b>${s.n < cur ? '✓' : s.n}</b><span>${s.nome}<br><small>${s.sub}</small></span><small>${s.n === cur ? 'você está aqui' : s.n < cur ? 'concluído' : ''}</small></div>`).join('');
  const wN = whyNot({ free: !!q });   // trocar a postura não gasta decisão nova
  const posts = POSTURES.map(p => {
    const np = negoParts(p.t), tag = np.compat ? '<span class="pill green">compatível</span>' : np.skip ? '<span class="pill red">pula etapa</span>' : '<span class="pill">consolidar</span>';
    return opt(p.kind === 'emp' ? 'ear' : 'stairs', `${p.t}. ${p.nome} ${tag}`, `${p.d}<br><span class="faint">Chance de avançar: <b style="color:var(--${pCls(np.p) === 'red' ? 'red' : pCls(np.p) === 'amber' ? 'amber' : pCls(np.p) === 'blue' ? 'blue' : 'green'})">${pLabel(np.p)}</b></span>`, '', 'addnego', `data-t="${p.t}"`, { pressed: !!q && q.p.tech === p.t, why: wN });
  }).join('');
  const hot = `<div class="hotline"><div class="eyebrow">${icon('phone', 'ico" style="width:15px;height:15px;vertical-align:-3px;margin-right:6px;color:var(--amber)')}Linha direta</div>
    <p class="scene">${n.contact ? STEP_SCENE[cur] : NO_CONTACT}</p>
    ${n.last ? `<blockquote class="${n.last.tone}">“${n.last.t}”<cite>Líder do grupo · rodada ${n.last.r}${G.K.profile ? '' : ' · como ele fala diz quem ele é'}</cite></blockquote>` : ''}
    <p class="ask">O que seu negociador deve fazer?</p></div>`;
  return `${hot}<div class="ladder">${ladder}</div>
    <label class="field">Negociador
      <select id="negotiator" data-chg="negotiator">${ags.map(id => `<option value="${id}" ${negId === id ? 'selected' : ''}>${shortName(agentById(id).nome)} · Negoc. ${stat(id, 'neg')}${G.az[id] && G.az[id] !== 'reserva' ? ' (em campo)' : ' (comando)'}</option>`).join('') || '<option>Comandante (você)</option>'}</select></label>
    <p class="faint" style="font-size:12px">Postura compatível com o degrau atual: +20%. Pular etapa: −25% e metade da chance, com 20% de regredir. Pressionar sobe a agitação. Fadiga e pressão alta reduzem a habilidade do negociador (hoje ${dec(negoSkill())}). Com o canal aberto, as famílias contam como atendidas na rodada e cada avanço de degrau dá +3 a elas, um alívio quando as decisões são poucas.</p>
    <div class="optlist">${posts}${opt('alert', 'Pressionar (ultimato)', `Sobe a agitação em +${PR_().press} (valor real). Pode regredir a negociação.`, '', 'addnego', 'data-t="press"', { danger: true, pressed: !!q && q.p.tech === 'press', why: wN })}</div>`;
}
function tabIntel() {
  const K = G.K, done = { perfil: K.profile, rota: !!K.route, efetivo: K.count, cofre: K.vault, refens: K.hostages, cumplice: K.accomplice };
  const pr = intelProb(false);
  return `<p class="faint" style="font-size:12.5px">Confiabilidade estimada com a sua equipe: <b>${pLabel(pr)}</b>. O resultado chega no início da próxima rodada, e você paga mesmo se der inconclusivo.</p>
    <div class="optlist">${INTEL.map(i => {
      const queued = G.queue.some(q => q.kind === 'intel' && q.p.id === i.id), pend = G.pendingIntel.some(o => o.id === i.id), c = intelCost(i.id);
      const w = whyNot({ state: done[i.id] ? 'Esta variável já foi revelada.' : pend ? 'Em andamento: o resultado chega no início da próxima rodada.' : null, inPlan: queued, cost: c });
      return opt(i.ic, `${i.nome}${done[i.id] ? ' <span class="pill green">revelado</span>' : pend ? ' <span class="pill amber">em andamento</span>' : ''}`, i.desc, c, 'addintel', `data-id="${i.id}"`, { why: w, pressed: queued });
    }).join('')}</div>`;
}
function stkRows(withSub) {
  return STK_KEYS.map(k => {
    const s = G.stk[k], c = s.sat < 35 ? 'r' : s.sat < 60 ? 'a' : 'g';
    return `<div class="stkrow"><div class="nm"><span>${STK[k].nome}</span>${withSub ? `<small>${STK[k].sub}</small>` : ''}</div>${meter(s.sat, c, `data-k="stk${k}" data-val="${Math.round(s.sat)}"`)}<span class="mono ${s.sem >= 2 ? 'alert' : ''}" title="${s.sem} ${plural(s.sem, 'rodada', 'rodadas')} sem atenção">${Math.round(s.sat)}${s.sem >= 2 ? ' !' : ''}</span></div>`;
  }).join('');
}
function tabCom() {
  return `<div class="stk">${stkRows(true)}</div>
    <p class="faint" style="font-size:12px">Cada stakeholder ignorado perde 3 pontos × rodadas sem atenção (máx. 9 por rodada), além dos efeitos do que acontece na operação. O sinal ! marca quem está há 2 rodadas ou mais sem atenção.</p>
    <div class="optlist">${COMMS.map(c => { const q = G.queue.some(x => x.kind === 'com' && x.p.cid === c.id), lk = leakChance(c.id);
      const lkTxt = lk > 0 ? `<br><span class="faint">Risco de vazar ou sair impreciso: <b style="color:var(--${lk >= .2 ? 'red' : lk >= .1 ? 'amber' : 'green'})">${Math.round(lk * 100)}%</b>. Cai com quem comunica bem e com o que você já sabe. Se acontecer, a mídia sobe +10 em vez de ceder e o líder se irrita.</span>` : '';
      return opt(c.s === 'imprensa' ? 'mic' : c.s === 'prefeito' ? 'mayor' : c.s === 'banco' ? 'bank' : c.s === 'familias' ? 'family' : 'news', c.nome, c.d + lkTxt, c.custo || '', 'addcom', `data-id="${c.id}"`, { why: whyNot({ inPlan: q, cost: c.custo }), pressed: q }); }).join('')}</div>`;
}
const TABS = [['tatica', 'Tática'], ['nego', 'Negociação'], ['intel', 'Inteligência'], ['com', 'Comunicação']];
function colC() {
  const n = D_().slots, used = n - slotsLeft();
  const body = UI.tab === 'tatica' ? tabTatica() : UI.tab === 'nego' ? tabNego() : UI.tab === 'intel' ? tabIntel() : tabCom();
  const guide = G.round === 1 ? `<div class="card guide"><h2 class="h3">Primeira rodada · como ler esta tela</h2><ol>
      <li><b>Perceba</b> no centro: alertas, mapa e a aba 1 do painel do comandante (relatos e o que ainda é desconhecido).</li>
      <li><b>Compreenda e projete</b> nas abas 2 e 3 do painel: o que os dados significam e para onde vão.</li>
      <li><b>Decida</b> aqui: até ${n} ações nas quatro frentes. Elas entram no plano (barra inferior) e só acontecem quando você executa.</li></ol>
      <p class="muted" style="font-size:12px">Nesta rodada e na próxima o relógio dá tempo extra para você se orientar.</p></div>` : '';
  return `<div class="colC">${guide}<div class="card decide"><h2 class="h3">Decisões da rodada <span class="slotc" aria-label="${used} de ${n} decisões no plano">${Array.from({ length: n }, (_, i) => `<i class="slot ${i < used ? 'on' : ''}"></i>`).join('')}<b class="mono">${used}/${n}</b></span></h2>
      <div class="tabs" role="tablist" aria-label="Frentes de decisão">${TABS.map(([k, l]) => `<button class="tab" role="tab" id="tab-${k}" aria-controls="tabp" data-act="tab" data-t="${k}" aria-selected="${UI.tab === k}" tabindex="${UI.tab === k ? 0 : -1}">${icon(FRONT_IC[k], 'ico')}<span>${l}</span>${G.queue.some(d => d.front === k) ? '<i class="tdot" title="Há decisão desta frente no plano"></i>' : ''}</button>`).join('')}</div>
      <div class="grid tabp${UI.tabAnim ? ' swap' : ''}" id="tabp" role="tabpanel" aria-labelledby="tab-${UI.tab}" style="gap:10px;margin-top:12px">${planBanner()}${body}</div></div>
    ${planPreviewHTML()}
    ${UI.tab === 'com' ? '' : `<div class="card"><h2 class="h3">Stakeholders</h2><div class="stk">${stkRows(false)}</div></div>`}</div>`;
}
function radioCard() {
  return `<div class="card"><h2 class="h3">Rádio</h2><div class="radio">${G.radio.slice(0, 6).map(l => `<p class="${l.c || ''}">${l.t}</p>`).join('')}</div></div>`;
}
/* Barra do plano: o que vai ser executado, quantas decisões restam e o botão de executar, sempre à vista. */
function panelBar() {
  const n = D_().slots, used = n - slotsLeft();
  const chips = G.queue.map(d => `<span class="qchip" title="${attr(d.label)}${d.cost ? ' · −' + d.cost + ' créditos' : ''}">${icon(FRONT_IC[d.front], 'ico')}<span class="ql">${d.label}</span>${d.cost ? `<span class="mono qc">−${d.cost}</span>` : ''}<button class="qx" data-act="rmq" data-id="${d.id}" aria-label="Remover ${attr(d.label)} do plano">✕</button></span>`).join('');
  return `<div class="absum"><span class="abk">Plano da rodada</span><span class="slotc">${Array.from({ length: n }, (_, i) => `<i class="slot ${i < used ? 'on' : ''}"></i>`).join('')}<b class="mono">${used}/${n}</b></span></div>
    <div class="qchips" aria-live="polite">${chips || `<span class="faint">Nenhuma decisão ainda. Escolha até ${n} nas abas; sem decisões, o cofre e a mídia seguem andando.</span>`}</div>
    <button class="btn primary lg" data-act="execute">${G.queue.length ? 'Executar rodada →' : 'Aguardar sem decisões'}</button>`;
}
function renderPanel() {
  const mapCard = `<div class="card mapcard"><h2 class="h3">Perímetro <span class="faint sub">clique numa zona para usá-la como destino</span></h2><div class="mapwrap" style="padding:2px">${mapSVG({ interactive: G.stage === 'panel', act: 'zonepick', sel: UI.pickZone })}</div>${legendHTML()}</div>`;
  setBar(panelBar());
  return `${hudHTML()}<div class="siege screen"><h1 class="sr">Rodada ${G.round} de ${MAX_ROUNDS}: painel de comando</h1>${colA()}<div class="colB">${alertsHTML()}${mapCard}${tocWidget()}${endsleyHTML()}</div>${colC()}</div>`;
}

/* ---------- Atualização da rodada ---------- */
function siegeTrack() {
  return `<div class="track" aria-label="Linha do tempo do cerco">${Array.from({ length: MAX_ROUNDS }, (_, i) => {
    const r = i + 1, l = G.log[i], cls = r < G.round ? 'past' : r === G.round ? 'now' : '';
    return `<div class="tk ${cls}" title="Rodada ${r} · ${fmtTime(r)}${l && l.ev ? ' · ' + EVDEF[l.ev.id].titulo : ''}"><i></i><small>${fmtTime(r)}</small>${l && l.ev ? `<em>${icon(EVDEF[l.ev.id].ic, 'ico" style="width:13px;height:13px')}</em>` : ''}</div>`;
  }).join('')}</div>`;
}
const STANCE = { esperar: ['green', 'pede paciência'], intervir: ['red', 'quer entrar'], 'reforçar': ['blue', 'olha o perímetro'], investigar: ['violet', 'quer saber mais'], comunicar: ['amber', 'olha os stakeholders'] };
function councilHTML(list) {
  if (!list || !list.length) return '';
  const conflict = list.some(c => c.stance === 'intervir') && list.some(c => c.stance === 'esperar');
  return `<div class="card"><h2 class="h3">Mesa de comando <span class="faint sub">cada um vê uma parte do problema</span></h2>
    <div class="council">${list.map(c => `<div class="adv"><div class="sil">${sil(c.id, 40)}</div><div><b>${shortName(c.nome)}</b> <span class="pill ${STANCE[c.stance][0]}">${STANCE[c.stance][1]}</span><p>“${c.t}”</p></div></div>`).join('')}</div>
    ${conflict ? ins('warn', 'split', 'Os conselhos se contradizem. Ninguém na mesa tem a informação inteira: integrar as partes é o seu trabalho.') : ''}</div>`;
}
function tocShiftHTML(u) {
  if (!u.toc) return '';
  const X = TOCS[u.toc], shifted = u.tocPrev && u.tocPrev !== u.toc;
  if (!shifted && G.round === 1) return `<div class="card tocshift"><h2 class="h3">O gargalo agora</h2><div class="tsrow">${icon(X.ic, 'ico')}<div><b>${X.nome}</b><p>${X.por} Em toda operação existe um elo mais fraco que decide o resultado. Ele muda ao longo do cerco: informação no início, pessoal no meio, tempo e fadiga no fim.</p></div></div></div>`;
  if (!shifted) return `<div class="card tocshift calm"><div class="tsrow">${icon(X.ic, 'ico')}<div><b>O gargalo continua: ${X.nome}.</b> ${X.elevar}</div></div></div>`;
  const P = TOCS[u.tocPrev];
  return `<div class="card tocshift"><h2 class="h3">A restrição mudou</h2><div class="tsrow">${icon('split', 'ico')}<div><b>${P.nome} → ${X.nome}</b><p>${X.por}</p><p><b>Pare de:</b> ${X.parar}</p><p><b>Eleve agora:</b> ${X.elevar}</p></div></div></div>`;
}
function renderUpdate() {
  const u = G.update;
  setBar(`<div class="absum"><span class="abk">Rodada ${G.round} de ${MAX_ROUNDS} · ${u.time}</span><span>${G.noLimit ? 'Sem limite de tempo.' : `Você terá <b class="mono">${roundTimer()}</b> segundos${G.round <= 2 ? ' (tempo extra de orientação)' : ''}`} e <b class="mono">${D_().slots}</b> decisões. O relógio só corre no painel.</span></div><span class="spacer"></span><button class="btn primary lg" data-act="takepanel">Assumir o painel →</button>`);
  const reps = u.reports.map(r => `<div class="report"><span class="src">${r.ag} · ${ZONE[r.z].curto}</span><span>${r.txt}. <span class="faint">Confiança ${r.conf}.</span></span></div>`).join('');
  return `${hudHTML()}<div class="resol screen">
    <div class="skyband r${G.round}">${skyline()}<i class="siren r"></i><i class="siren b"></i>
      <div class="cap"><div class="eyebrow" style="color:#c9d6ea">Atualização · rodada ${G.round} de ${MAX_ROUNDS}</div>
      <h1><span class="mono" style="color:var(--amber)">${u.time}</span> · ${ROUND_TITLE[G.round]}</h1></div></div>
    ${siegeTrack()}
    <p class="serif intro">${u.intro || roundIntro()}</p>
    ${tocShiftHTML(u)}
    ${G.round === 1 && (G.perimLog || []).length ? `<div class="card"><h2 class="h3">Reconhecimento do perímetro</h2><div class="grid" style="gap:6px">${G.perimLog.map(t => ins('good', 'eye', t)).join('')}</div></div>` : ''}
    ${u.quiet ? ins('good', 'wait', '<b>Calmaria.</b> Por alguns minutos, nada acontece. Pelo rádio, alguém pede café. Depois de uma rodada pesada, este é o momento de pensar, não de reagir: nenhuma carta de evento vai interromper esta rodada.') : ''}
    <div class="card"><h2 class="h3">Mensagens de rádio</h2><div class="radio live" style="max-height:none">${u.radio.map((l, i) => `<p class="${l.c || ''}" style="--i:${i}">${l.t}</p>`).join('')}</div></div>
    ${u.call ? `<div class="call">${icon('call', 'ico')}<div><small>Ligação recebida · ${u.call.who}</small><p>“${u.call.t}”</p></div></div>` : ''}
    ${u.intel.length ? `<div class="card"><h2 class="h3">Resultados da inteligência</h2><div class="dossiers">${u.intel.map(dossierHTML).join('')}</div></div>` : ''}
    ${u.hint ? `<div class="card">${ins('info', 'light', br(u.hint))}</div>` : ''}
    ${councilHTML(u.council)}
    <div class="card"><h2 class="h3">Relatos de campo</h2>${reps || '<p class="faint" style="font-size:13px">Nenhum relato novo. Zonas sem agentes não geram relatos.</p>'}</div></div>`;
}

/* ---------- Resolução / feedback ---------- */
function deltaCell(label, a, b, fmtF, goodUp, cls, noBar) {
  const diff = b - a, arrow = Math.abs(diff) < .5 ? '→' : diff > 0 ? '↑' : '↓';
  const bad = Math.abs(diff) >= .5 && ((diff > 0) !== goodUp);
  return `<div class="dcell"><div class="top"><span>${label}</span><b class="${Math.abs(diff) < .5 ? '' : bad ? 'up' : 'dn'}">${fmtF(a)} ${arrow} ${fmtF(b)}</b></div>${noBar ? '' : `<div class="meter ${cls}"><i style="width:${clamp(a, 0, 100)}%" data-to="${clamp(b, 0, 100)}"></i></div>`}</div>`;
}
/* Causa → efeito: cada fator empurra para cima (vermelho) ou para baixo (verde). Sob névoa, só a direção. */
function waterfall(title, parts, exact, upBad = true) {
  const ps = (parts || []).filter(p => Math.abs(p.v) >= .05); if (!ps.length) return '';
  const mx = Math.max(10, ...ps.map(p => Math.abs(p.v))), tot = ps.reduce((s, p) => s + p.v, 0);
  const mag = v => Math.abs(v) < 2 ? 'leve' : Math.abs(v) < 6 ? 'moderado' : 'forte';
  return `<div class="wf"><div class="eyebrow">${title}</div>${ps.map(p => {
    const w = Math.abs(p.v) / mx * 50, bad = (p.v > 0) === upBad;
    return `<div class="wfr"><span>${p.k}</span><div class="wfb"><i class="${bad ? 'bad' : 'good'}" style="${p.v > 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%"></i></div><b class="mono">${exact ? (p.v > 0 ? '+' : '−') + dec(Math.abs(p.v)) : (p.v > 0 ? '↑ ' : '↓ ') + mag(p.v)}</b></div>`;
  }).join('')}<div class="wfr tot"><span>Resultado</span><div></div><b class="mono">${exact ? (tot >= 0 ? '+' : '−') + dec(Math.abs(tot)) : tot > .5 ? '↑ sobe' : tot < -.5 ? '↓ desce' : '→ estável'}</b></div></div>`;
}
function stkWhyHTML(R, a, b) {
  return STK_KEYS.map(k => {
    const d = b.stk[k] - a.stk[k], items = (R.stkWhy && R.stkWhy[k]) || [], tracked = items.reduce((s, x) => s + x.v, 0), rest = d - tracked;
    const all = items.concat(Math.abs(rest) >= 1 ? [{ v: rest, t: 'eventos e ocorrências' }] : []);
    if (Math.abs(d) < .5 && !all.length) return '';
    return `<div class="sw"><b>${STK[k].nome}</b> <span class="mono">${Math.round(a.stk[k])} → ${Math.round(b.stk[k])}</span><small>${all.map(x => `<span class="${x.v >= 0 ? 'pos' : 'neg'}">${x.t} ${x.v >= 0 ? '+' : '−'}${Math.abs(x.v).toFixed(0)}</span>`).join(' · ')}</small></div>`;
  }).join('');
}
function hchgHTML(list) {
  if (!list || !list.length) return '';
  const by = w => list.filter(c => c.what === w).map(c => c.id);
  const fr = by('free'), hu = by('hurt'), de = by('dead'), out = [];
  if (fr.length) out.push(`<div class="hc out">${icon('check', 'ico')}<span><b>Saíram:</b> ${fr.map(id => `${HOST[id].nome} (${HOST[id].idade})`).join(', ')}.</span></div>`);
  if (hu.length) out.push(`<div class="hc hurt">${icon('heart', 'ico')}<span><b>${G.K.hostages ? 'Feridos:' : 'Ferimentos:'}</b> ${G.K.hostages ? hu.map(id => HOST[id].nome).join(', ') : `${hu.length} ${hu.length > 1 ? 'pessoas feridas' : 'pessoa ferida'} lá dentro, sem identificação confirmada`}.</span></div>`);
  if (de.length) out.push(`<div class="hc dead">${icon('heart', 'ico')}<span><b>Vidas perdidas:</b> ${de.map(id => `${HOST[id].nome}, ${HOST[id].idade} anos, ${HOST[id].papel}`).join('; ')}.</span></div>`);
  return `<div class="card"><h2 class="h3">Reféns nesta rodada</h2><div class="grid" style="gap:6px">${out.join('')}</div></div>`;
}
const SECS = [['dec', 'Suas decisões'], ['mundo', 'O mundo reagiu'], ['ev', 'Evento'], ['fim', 'Fim da rodada']];
function linesBySec(lines, anim = true) {
  let k = 0;
  return SECS.map(([sec, t]) => {
    const ls = lines.filter(l => (l.sec || 'dec') === sec); if (!ls.length) return '';
    return `<div class="sec"><div class="eyebrow">${t}</div>${ls.map(l => `<div class="res-line ${l.tone}" style="${anim ? `animation-delay:${(k++) * 90}ms` : 'animation:none'}">${icon(l.ic, '', 1.8)}<span>${br(l.text)}</span></div>`).join('')}</div>`;
  }).join('');
}
function renderResult() {
  const R = G.R, a = R.s0, b = R.s1 || snap();
  const pa0 = perceivedAgit(a.agit), pa1 = perceivedAgit(b.agit), pv0 = perceivedVault(a.vault), pv1 = perceivedVault(b.vault);
  const cells = [
    deltaCell('Agitação' + (pa1.exact ? '' : ' (aparente)'), pa0.v, pa1.v, v => pa1.exact ? Math.round(v) : (G.nego.contact ? '≈' + Math.round(v / 5) * 5 : pa1.band === perceivedAgit(a.agit).band ? pa1.band : perceivedAgit(v).band), false, 'r'),
    deltaCell('Pressão da mídia', a.media, b.media, v => Math.round(v), false, 'a'),
    deltaCell('Cofre' + (pv1.exact ? '' : ' (estimado)'), pv0.v, pv1.v, v => Math.round(v) + '%', false, 'b'),
    deltaCell('Degrau da negociação', a.step * 20, b.step * 20, v => Math.round(v / 20) + '/5', true, 'g'),
    deltaCell('Créditos', clamp(a.credits / 10, 0, 100), clamp(b.credits / 10, 0, 100), v => fmt(v * 10), true, 'a'),
    deltaCell('Pressão da equipe', a.p, b.p, v => Math.round(v), false, 'v')
  ].join('');
  const last = !!G.end, exactA = G.nego.contact && G.K.profile;
  const cause = R.agitParts ? `<div class="card"><h2 class="h3">Causa e efeito</h2><div class="grid" style="gap:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      ${waterfall('Agitação do líder' + (exactA ? '' : ' (só a direção: sem perfil e canal, você não mede)'), R.agitParts, exactA)}
      ${waterfall('Pressão da mídia', R.mediaParts, true)}</div>
      <p class="faint" style="font-size:12px;margin-top:8px">Eventos mudam a agitação e a mídia por fora destes fatores.</p></div>` : '';
  const sw = stkWhyHTML(R, a, b);
  setBar(`<div class="absum"><span class="abk">Resolução · rodada ${G.round} de ${MAX_ROUNDS}</span><span>${R.decs.length ? `${R.decs.length} ${plural(R.decs.length, 'decisão executada', 'decisões executadas')}` : 'Rodada sem decisões'}${last ? ' · a crise chegou ao fim' : ''}</span></div><span class="spacer"></span><button class="btn primary lg" data-act="cont">${last ? 'Ver o desfecho →' : G.round >= MAX_ROUNDS ? 'Encerrar →' : `Seguir para a rodada ${G.round + 1} →`}</button>`);
  return `${hudHTML()}<div class="resol screen">
    <div><div class="eyebrow">Resolução · rodada ${G.round} de ${MAX_ROUNDS}</div><h1 class="rtitle">O que as suas decisões provocaram</h1></div>
    ${R.decs.length ? `<div class="row">${R.decs.map(d => `<span class="pill blue">${icon(FRONT_IC[d.front], 'ico" style="width:14px;height:14px')}${d.label}</span>`).join('')}</div>` : '<p class="muted">Você aguardou sem decisões nesta rodada. A crise não esperou.</p>'}
    <div class="grid" style="gap:14px">${linesBySec(R.lines)}</div>
    ${hchgHTML(R.hchg)}
    <div class="card"><h2 class="h3">Painel de feedback</h2><div class="delta">${cells}</div></div>
    ${cause}
    ${sw ? `<div class="card"><h2 class="h3">Stakeholders: por que mudaram</h2><div class="grid" style="gap:6px">${sw}</div></div>` : ''}
    </div>`;
}
/* Carta de evento: escolha obrigatória. Foco vai para a carta, Tab fica preso nela e as teclas 1–3 escolhem. */
function eventModal() {
  const e = EVDEF[G.pendingEvent], fx = EVENT_FX[G.pendingEvent];
  return `<div class="modalback"><div class="evcard" role="dialog" aria-modal="true" aria-labelledby="evt" aria-describedby="evd">
    <div class="row" style="flex-wrap:nowrap"><div class="evico">${icon(e.ic)}</div><div><div class="eyebrow">Carta de evento</div><h2 id="evt">${e.titulo}</h2></div></div>
    <p class="radio-q">${e.radio}</p><p class="d" id="evd">${e.desc}</p>
    <div class="optlist">${fx.choices.map((c, i) => { const no = c.cost && G.credits < c.cost, why = no ? `Faltam ${fmt(c.cost - G.credits)} créditos (reserva ${fmt(G.credits)}).` : ''; return `<button class="opt evopt" data-act="evchoice" data-i="${i}" ${no ? `aria-disabled="true" data-why="${attr(why)}"` : ''}><span class="okey" aria-hidden="true">${i + 1}</span><span><b>${c.label}</b><span class="d">${c.hint}</span>${no ? `<span class="unav">${why}</span>` : ''}</span>${c.cost ? `<span class="c">${c.cost}</span>` : '<span></span>'}</button>`; }).join('')}</div>
    <p class="faint" style="font-size:12px">Uma escolha é obrigatória. Atalho: teclas ${fx.choices.map((_, i) => i + 1).join(', ').replace(/, (\d)$/, ' ou $1')}.</p></div></div>`;
}
function renderEventStage() {
  const R = G.R;
  const lines = R.lines.map(l => `<div class="res-line ${l.tone}">${icon(l.ic, '', 1.8)}<span>${br(l.text)}</span></div>`).join('');
  return `${hudHTML()}<div class="resol screen"><div><div class="eyebrow">Resolução · rodada ${G.round}</div><h1 class="rtitle">Um evento interrompe a rodada</h1></div><div class="grid" style="gap:8px">${lines}</div></div>${eventModal()}`;
}
