/* =====================================================================
   INTERFACE — Cerco (fase 2)
   ===================================================================== */
const ROUND_TITLE = ['', 'A primeira hora', 'O silêncio do outro lado', 'O cansaço chega', 'Metade do caminho', 'Fim de tarde', 'A cobrança', 'A última luz', 'Ultimato'];
const FRONT_IC = { tatica: 'shield', nego: 'phone', intel: 'eye', com: 'mic' };

function bscValues() {
  const H = G.hostages, pv = perceivedVault();
  const avg = ZONES.reduce((s, z) => s + zoneCoverage(z.id), 0) / ZONES.length;
  return [
    { k: 'Vidas', v: G.K.hostages ? clamp(1 - (H.dead * 2 + H.hurt * .5) / HOSTAGES, 0, 1) * 100 : 100, unk: !G.K.hostages, cls: 'g' },
    { k: 'Prisões', v: avg, cls: 'b', unk: false },
    { k: 'Valores', v: 100 - pv.v, unk: !pv.exact, cls: 'a' },
    { k: 'Eficiência', v: clamp(G.credits / 300 * 100, 0, 100), unk: false, cls: 'v' },
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
    <div class="stat"><small>Créditos</small><b style="color:var(--amber)">${fmt(G.credits)}</b></div>
    <div class="bsc" title="Projeção dos cinco objetivos (placar equilibrado)">${b.map(x => `<div>${x.k}<b>${x.unk ? '?' : Math.round(x.v)}</b>${meter(x.v, x.cls)}</div>`).join('')}</div>
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
  L2.push(ins('warn', 'light', `<b>Restrição atual: ${toc.label}.</b> ${toc.why}`));
  L2.push(ins(G.pressure > 75 || G.pressure < 30 ? 'bad' : G.pressure > 62 ? 'warn' : 'good', 'bolt', `Pressão operacional ${G.pressure}: ${zone}. Eficiência média dos agentes ${Math.round(fpAvg * 100)}% do potencial (curva de Yerkes-Dodson).`));
  const st = STEPS[G.nego.step - 1];
  L2.push(ins('info', 'phone', `Negociação no degrau ${G.nego.step} (${st.nome}). ${K.profile ? `Líder ${P.nome}: ${P.tip}` : G.nego.signalShown ? `Sinal do canal: “${P.sign}”` : 'O perfil do líder ainda é desconhecido, e a postura certa depende dele.'}`));
  const topEv = Object.entries(G.ev).sort((a, b) => b[1] - a[1])[0];
  const adq = adequateCount();
  L2.push(ins(adq >= 4 ? 'good' : 'warn', 'map', `${adq} de 7 zonas com cobertura adequada. ${topEv && topEv[1] >= 1.5 ? `Os relatos convergem para <b>${ZONE[topEv[0]].nome}</b> (${topEv[1].toFixed(1)} indícios ponderados).${G.team.includes('carla') ? ' A Det. Mendes correlacionou os relatos.' : ''}` : 'Os relatos ainda não apontam uma rota com clareza.'}`));
  const tired = deployed().filter(id => ff(id) < .8), away = G.team.filter(isAway);
  if (tired.length) L2.push(ins('warn', 'tired', `Fadiga: ${tired.map(id => shortName(agentById(id).nome)).join(', ')} abaixo de 80% de eficiência. Rodízio custa cobertura temporária.`));
  if (away.length) L2.push(ins('bad', 'alert', `${away.map(id => shortName(agentById(id).nome)).join(', ')} reconvocado${away.length > 1 ? 's' : ''} pela cidade por ${Math.max(...away.map(id => G.away[id]))} rodada(s).`));
  const bad = STK_KEYS.filter(k => G.stk[k].sem >= 2 || G.stk[k].sat < 40);
  if (bad.length) L2.push(ins('bad', 'family', `Risco com stakeholders: ${bad.map(k => `${STK[k].nome} (${Math.round(G.stk[k].sat)}${G.stk[k].sem >= 2 ? `, ${G.stk[k].sem} rodadas sem atenção` : ''})`).join('; ')}.`));
  if (G.round >= 6) L2.push(ins('bad', 'mayor', 'O prefeito está em modo de urgência: perdas de confiança dele são ampliadas até o fim.'));
  G.hints.slice(-2).forEach(h => L2.push(ins('info', 'light', `Pista (rodada ${h.r}): ${h.t}`)));
  // Nível 3
  const hist = G.hist, ag = hist.map(h => h.agit), md = hist.map(h => h.media), vl = hist.map(h => h.vault);
  const agNow = [...ag, Math.round(G.agit)], mdNow = [...md, Math.round(G.media)], vlNow = [...vl, Math.round(G.vault)];
  const trendA = agNow.length > 1 ? agNow[agNow.length - 1] - agNow[agNow.length - 2] : 0;
  const mProj = clamp(Math.round(G.media + Array.from({ length: MAX_ROUNDS - G.round }, (_, i) => (8 + (G.round + 1 + i) * 2) * D_().media).reduce((a, b) => a + b, 0)), 0, 100);
  const best = POSTURES.map(p => negoParts(p.t).p).reduce((a, b) => Math.max(a, b), 0), pc = negoParts(G.nego.step).p;
  const roundsLeft = G.nego.step >= 5 ? 0 : Math.ceil((5 - G.nego.step) / Math.max(.05, pc));
  const ip = intervProb(), band = .16 * (1 - infoFrac());
  const L3 = `
    <div class="grid" style="gap:8px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <div><div class="eyebrow">Agitação aparente</div>${spark(agNow, '#ff5468', true)}</div>
      <div><div class="eyebrow">Pressão da mídia</div>${spark(mdNow, '#f6a623', true)}</div>
      <div><div class="eyebrow">Atividade no cofre</div>${spark(vlNow.map(v => perceivedVault(v).exact ? v : perceivedVault(v).v), '#4da6ff', true)}</div>
    </div>
    ${ins('info', 'radar', `Tendência da agitação: ${trendA > 2 ? 'subindo' : trendA < -2 ? 'caindo' : 'estável'}${G.nego.contact ? '' : ' (estimativa grosseira: sem canal aberto)'}. ${G.agit > 70 ? 'Acima de 80 há risco de ação desesperada.' : ''}`)}
    ${ins(mProj > 85 ? 'warn' : 'info', 'mic', `Sem comunicados, a mídia chega perto de ${mProj} até a rodada ${MAX_ROUNDS}.`)}
    ${ins('info', 'bank', `Cofre: previsão de abertura em ${K.vault ? etaVault() : 'prazo desconhecido (faixa ampla, só a inteligência ou a diretoria do banco precisam)'}.`)}
    ${ins('info', 'stairs', `Negociação: com a melhor postura, a chance de avançar é ${pLabel(pc)}; chegar ao degrau 5 leva cerca de ${roundsLeft || 'zero'} rodada${roundsLeft === 1 ? '' : 's'} se negociar todo turno. ${G.nego.step === 5 ? `Rendição ocorre se a agitação cair abaixo de ${D_().ret}.` : ''}`)}
    ${ins(ip > .55 ? 'good' : ip > .3 ? 'warn' : 'bad', 'shield', `Intervenção hoje: chance estimada ${pLabel(ip)} (${Math.round(clamp(ip - band, 0, 1) * 100)}–${Math.round(clamp(ip + band, 0, 1) * 100)}%). Quanto menos você sabe, mais larga é a faixa${blindParts().length ? ', e entrar sem conhecer o interior custa ' + Math.round(-blindParts().reduce((s, b) => s + b.v, 0) * 100) + ' pontos de chance' : ''}.`)}
    ${G.round < 6 ? ins('warn', 'mayor', `A urgência do prefeito aumenta na rodada 6 (faltam ${6 - G.round}).`) : ''}`;
  return `<div class="card lvl"><h3>Painel do comandante · consciência situacional</h3>
    <div class="lvl"><span class="tag"><b>1</b> Percepção · dados brutos</span>${l1}</div>
    <hr style="border:0;border-top:1px solid var(--line);width:100%;margin:6px 0">
    <div class="lvl l2"><span class="tag"><b>2</b> Compreensão · o que significa</span>${L2.join('')}</div>
    <hr style="border:0;border-top:1px solid var(--line);width:100%;margin:6px 0">
    <div class="lvl l3"><span class="tag"><b>3</b> Projeção · para onde vai</span>${L3}</div></div>`;
}

/* ---------- Coluna A: mapa e equipe ---------- */
function colA() {
  const team = G.team.map(id => {
    const a = agentById(id), z = G.az[id] || 'reserva', f = ff(id);
    return `<div class="trow ${isAway(id) ? 'away' : ''}"><div><b>${shortName(a.nome)}</b><small>${isAway(id) ? `reconvocado (${G.away[id]} rod.)` : ZNAME(z)} · ${a.trait}</small></div>
      <div style="width:84px" title="Fator de fadiga ${f.toFixed(2)}">${meter(f * 100, f > .75 ? 'g' : f > .55 ? 'a' : 'r')}<small class="mono faint" style="font-size:10.5px">eficiência ${Math.round(fp(id) * f * 100)}%</small></div></div>`;
  }).join('');
  return `<div class="colA">${rosterCard()}<div class="card"><h3>Equipe e fadiga</h3><div class="team">${team || '<p class="faint">Sem agentes.</p>'}</div></div>${radioCard()}</div>`;
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
  return `<div class="card"><h3>Quem está lá dentro <span class="pill ${H.dead ? 'red' : inside < HOSTAGES ? 'green' : ''}">${inside} no interior</span></h3>
    <div class="roster">${G.hl.map(h => { const d = HOST[h.id], st = hstate(h); return `<span class="rp ${st.c}" title="${d.nome}, ${d.idade} anos, ${d.papel}${d.nota ? ' (' + d.nota + ')' : ''}: ${st.t}"><b>${d.nome.split(' ')[0]}</b><small>${st.c.includes('unk') || st.c === 'in' ? d.idade + ' anos' : st.t}</small></span>`; }).join('')}</div>
    <p class="faint" style="font-size:11.5px;margin-top:8px">${out ? `${out} fora do banco. ` : ''}${G.K.hostages ? 'Estado dos reféns confirmado.' : 'Borda tracejada: estado não confirmado. Você não sabe quem está ferido lá dentro; a sala de acolhimento ou uma investigação revelam.'}</p></div>`;
}

/* ---------- Coluna C: decisões ---------- */
function opt(ic, title, desc, cost, act, data, o = {}) {
  return `<button class="opt ${o.danger ? 'danger' : ''}" data-act="${act}" ${data || ''} ${o.disabled ? 'disabled' : ''} aria-pressed="${!!o.pressed}">${icon(ic, 'ico" style="width:24px;height:24px')}<span><b>${title}</b><span class="d">${desc}</span></span>${cost ? `<span class="c">${cost}</span>` : '<span></span>'}</button>`;
}
function tabTatica() {
  const ags = G.team.filter(id => !isAway(id));
  const noSlot = slotsLeft() <= 0, ivq = G.queue.some(q => q.kind === 'interv');
  const zoneOpts = ZONES.map(z => `<option value="${z.id}">${z.nome} (${zoneCoverage(z.id)}%)</option>`).join('');
  const ip = intervProb(), band = .16 * (1 - infoFrac()), blind = blindParts();
  const blindTxt = blind.length ? `<br><span style="color:var(--amber)">Às cegas: ${blind.map(b => `−${Math.round(-b.v * 100)}% porque você ${b.txt}`).join('; ')}.</span>` : '<br><span style="color:var(--green)">Você conhece o interior: sem penalidade por entrar às cegas.</span>';
  return `<div class="card flat" style="display:grid;gap:8px"><h3>Reposicionar agente</h3>
      <div class="row" style="gap:8px"><label class="field" style="flex:1;min-width:150px">Agente<select id="repoAgent" data-chg="repoagent"><option value="">escolher…</option>${ags.map(id => `<option value="${id}" ${UI.repoAgent === id ? 'selected' : ''}>${shortName(agentById(id).nome)} · ${ZNAME(G.az[id] || 'reserva')} · fad. ${(G.fat[id] || 0)}</option>`).join('')}</select></label>
      <label class="field" style="flex:1;min-width:150px">Destino<select id="repoZone" data-chg="repozone"><option value="">escolher…</option>${ZONES.map(z => `<option value="${z.id}" ${UI.repoZone === z.id ? 'selected' : ''}>${z.nome}</option>`).join('')}<option value="reserva" ${UI.repoZone === 'reserva' ? 'selected' : ''}>Reserva (descansa)</option></select></label></div>
      <button class="btn sm" data-act="addrepos" ${noSlot || ivq ? 'disabled' : ''}>Adicionar ao plano</button>
      <p class="faint" style="font-size:11.5px">Em trânsito o agente rende 50% na rodada${hasGear('viatura') ? ' (sua Viatura elimina a perda)' : ''}. A reserva descansa e zera a fadiga, mas deixa a zona descoberta.</p></div>
    <div class="optlist">
      ${opt('support', 'Apoio externo', 'Agências parceiras reforçam uma zona: +25 de cobertura por 2 rodadas. Máx. 3 vezes.', 90, 'addapoio', '', { disabled: noSlot || ivq || G.credits < 90 || G.supportUsed >= 3 })}
      <div class="row" style="padding-left:40px;margin-top:-2px"><select id="apoioZone" data-chg="apoiozone" aria-label="Zona do apoio externo"><option value="">zona do apoio…</option>${zoneOpts}</select></div>
      ${opt('pause', 'Pausa de Comando', `“Subir à sacada”: ${G.team.includes('diego') ? 'duas pistas' : 'uma pista'} sobre variáveis ocultas, visão sistêmica e −10 de pressão na equipe. Consome uma decisão; a crise continua andando.`, '', 'addpausa', '', { disabled: noSlot || ivq || G.queue.some(q => q.kind === 'pausa'), pressed: G.queue.some(q => q.kind === 'pausa') })}
      ${opt('tired', 'Horas extras', 'Recupera 2 rodadas de fadiga em campo e encerra a Fadiga crítica.', 60, 'addhoras', '', { disabled: noSlot || ivq || G.credits < 60 || G.queue.some(q => q.kind === 'horas') })}
      ${UI.ivConfirm ? `<div class="insight bad">${icon('alert', '', 1.8)}<span><b>Ordenar a intervenção agora?</b> Prontidão ${Math.round(intervPower())}%, chance estimada ${pLabel(ip)} (${Math.round(clamp(ip - band, 0, 1) * 100)}–${Math.round(clamp(ip + band, 0, 1) * 100)}%). Ocupa todas as decisões e encerra a crise nesta rodada.${blindTxt}</span></div><div class="row"><button class="btn danger" data-act="ivyes">Confirmar intervenção</button><button class="btn ghost" data-act="ivno">Cancelar</button></div>` :
        opt('shield', 'Intervenção', `Ação direta, o BATNA da força-tarefa. Prontidão ${Math.round(intervPower())}% · chance estimada <b>${pLabel(ip)}</b> (±${Math.round(band * 100)}%). Depende de inteligência, tática e agitação.${blindTxt}`, '', 'iv', '', { danger: true, pressed: ivq })}
    </div>`;
}
function tabNego() {
  const n = G.nego, cur = n.step, q = G.queue.find(x => x.kind === 'nego');
  const ags = avail(), negId = getNegotiator();
  const ladder = STEPS.map(s => `<div class="step ${s.n < cur ? 'done' : s.n === cur ? 'cur' : ''}"><b>${s.n < cur ? '✓' : s.n}</b><span>${s.nome}<br><small>${s.sub}</small></span><small>${s.n === cur ? 'você está aqui' : ''}</small></div>`).join('');
  const posts = POSTURES.map(p => {
    const np = negoParts(p.t), tag = np.compat ? '<span class="pill green">compatível</span>' : np.skip ? '<span class="pill red">pula etapa</span>' : '<span class="pill">consolidar</span>';
    return opt(p.kind === 'emp' ? 'ear' : 'stairs', `${p.t}. ${p.nome} ${tag}`, `${p.d}<br><span class="faint">Chance de avançar: <b style="color:var(--${pCls(np.p) === 'red' ? 'red' : pCls(np.p) === 'amber' ? 'amber' : pCls(np.p) === 'blue' ? 'blue' : 'green'})">${pLabel(np.p)}</b></span>`, '', 'addnego', `data-t="${p.t}"`, { pressed: !!q && q.p.tech === p.t, disabled: G.queue.some(x => x.kind === 'interv') });
  }).join('');
  const hot = `<div class="hotline"><div class="eyebrow">${icon('phone', 'ico" style="width:15px;height:15px;vertical-align:-3px;margin-right:6px;color:var(--amber)')}Linha direta</div>
    <p class="scene">${n.contact ? STEP_SCENE[cur] : NO_CONTACT}</p>
    ${n.last ? `<blockquote class="${n.last.tone}">“${n.last.t}”<cite>Líder do grupo · rodada ${n.last.r}${G.K.profile ? '' : ' · como ele fala diz quem ele é'}</cite></blockquote>` : ''}
    <p class="ask">O que seu negociador deve fazer?</p></div>`;
  return `${hot}<div class="ladder">${ladder}</div>
    <label class="field">Negociador
      <select id="negotiator" data-chg="negotiator">${ags.map(id => `<option value="${id}" ${negId === id ? 'selected' : ''}>${shortName(agentById(id).nome)} · Negoc. ${stat(id, 'neg')}${G.az[id] && G.az[id] !== 'reserva' ? ' (em campo)' : ' (comando)'}</option>`).join('') || '<option>Comandante (você)</option>'}</select></label>
    <p class="faint" style="font-size:11.5px">Postura compatível com o degrau atual: +20%. Pular etapa: −25% e metade da chance, com 20% de regredir. Pressionar sobe a agitação. Fadiga e pressão alta reduzem a habilidade do negociador (hoje ${negoSkill().toFixed(1)}).</p>
    <div class="optlist">${posts}${opt('alert', 'Pressionar (ultimato)', `Sobe a agitação em +${PR_().press} (valor real). Pode regredir a negociação.`, '', 'addnego', 'data-t="press"', { danger: true, pressed: !!q && q.p.tech === 'press', disabled: G.queue.some(x => x.kind === 'interv') })}</div>`;
}
function tabIntel() {
  const K = G.K, done = { perfil: K.profile, rota: !!K.route, efetivo: K.count, cofre: K.vault, refens: K.hostages, cumplice: K.accomplice };
  const pr = intelProb(false);
  return `<p class="faint" style="font-size:12px">Confiabilidade estimada com a sua equipe: <b>${pLabel(pr)}</b>. O resultado chega no início da próxima rodada, e você paga mesmo se der inconclusivo.</p>
    <div class="optlist">${INTEL.map(i => {
      const pend = G.pendingIntel.some(o => o.id === i.id) || G.queue.some(q => q.kind === 'intel' && q.p.id === i.id), c = intelCost(i.id);
      const disabled = done[i.id] || pend || G.credits < c || slotsLeft() <= 0 || G.queue.some(q => q.kind === 'interv');
      return opt(i.ic, `${i.nome}${done[i.id] ? ' <span class="pill green">revelado</span>' : pend ? ' <span class="pill amber">em andamento</span>' : ''}`, i.desc, c, 'addintel', `data-id="${i.id}"`, { disabled });
    }).join('')}</div>`;
}
function tabCom() {
  const rows = STK_KEYS.map(k => {
    const s = G.stk[k], c = s.sat < 35 ? 'r' : s.sat < 60 ? 'a' : 'g';
    return `<div class="stkrow"><div class="nm"><span>${STK[k].nome}</span><small>${STK[k].sub}</small></div>${meter(s.sat, c)}<span class="mono ${s.sem >= 2 ? 'alert' : ''}" title="${s.sem} rodada(s) sem atenção">${Math.round(s.sat)}</span></div>`;
  }).join('');
  return `<div class="stk">${rows}</div>
    <p class="faint" style="font-size:11.5px">Cada stakeholder ignorado perde 3 pontos × rodadas sem atenção (máx. 9 por rodada), além dos efeitos do que acontece na operação.</p>
    <div class="optlist">${COMMS.map(c => opt(c.s === 'imprensa' ? 'mic' : c.s === 'prefeito' ? 'mayor' : c.s === 'banco' ? 'bank' : c.s === 'familias' ? 'family' : 'news', c.nome, c.d, c.custo || '', 'addcom', `data-id="${c.id}"`, { disabled: slotsLeft() <= 0 || G.credits < c.custo || G.queue.some(q => q.kind === 'com' && q.p.cid === c.id) || G.queue.some(q => q.kind === 'interv'), pressed: G.queue.some(q => q.kind === 'com' && q.p.cid === c.id) })).join('')}</div>`;
}
function colC() {
  const n = D_().slots, used = n - slotsLeft();
  const tabs = [['tatica', 'Tática'], ['nego', 'Negociação'], ['intel', 'Inteligência'], ['com', 'Comunicação']];
  const body = UI.tab === 'tatica' ? tabTatica() : UI.tab === 'nego' ? tabNego() : UI.tab === 'intel' ? tabIntel() : tabCom();
  const q = G.queue.map(d => `<div class="qitem"><span>${icon(FRONT_IC[d.front], 'ico" style="width:16px;height:16px;vertical-align:-3px;margin-right:6px')}${d.label}${d.cost ? ` <span class="mono" style="color:var(--amber)">−${d.cost}</span>` : ''}</span><span class="faint" style="font-size:11px">${d.slots > 1 ? 'toda a rodada' : '1 decisão'}</span><button class="btn sm ghost" data-act="rmq" data-id="${d.id}" aria-label="Remover do plano">✕</button></div>`).join('');
  const guide = G.round === 1 ? `<div class="card guide"><h3>Primeira rodada · como ler esta tela</h3><ol>
      <li><b>Perceba</b> no centro: mapa, relatos de campo e o que ainda é desconhecido.</li>
      <li><b>Compreenda e projete</b> logo abaixo: o painel traduz os dados e aponta tendências.</li>
      <li><b>Decida</b> aqui: até ${n} ações nas quatro abas. Elas entram no plano e só acontecem quando você executa.</li></ol>
      <p class="faint" style="font-size:11.5px">Nesta rodada e na próxima o relógio dá tempo extra para você se orientar.</p></div>` : '';
  return `<div class="colC">${guide}<div class="card"><h3>Decisões da rodada <span class="slots" aria-label="${used} de ${n} decisões usadas">${Array.from({ length: n }, (_, i) => `<i class="slot ${i < used ? 'on' : ''}"></i>`).join('')}</span></h3>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab" role="tab" data-act="tab" data-t="${k}" aria-selected="${UI.tab === k}">${l}</button>`).join('')}</div>
      <div class="grid" style="gap:10px;margin-top:12px">${body}</div></div>
    <div class="card"><h3>Plano da rodada</h3><div class="queue">${q || '<p class="faint" style="font-size:12.5px">Nenhuma decisão ainda. Você pode executar sem decisões, mas o cofre e a mídia continuam andando.</p>'}</div>
      <button class="btn primary lg" style="width:100%;margin-top:12px" data-act="execute">${G.queue.length ? 'Executar rodada' : 'Aguardar (sem decisões)'}</button></div>
    <div class="card"><h3>Stakeholders</h3><div class="stk">${STK_KEYS.map(k => { const s = G.stk[k]; return `<div class="stkrow"><div class="nm"><span>${STK[k].nome}</span></div>${meter(s.sat, s.sat < 35 ? 'r' : s.sat < 60 ? 'a' : 'g')}<span class="mono ${s.sem >= 2 ? 'alert' : ''}">${Math.round(s.sat)}</span></div>`; }).join('')}</div></div></div>`;
}
function radioCard() {
  return `<div class="card"><h3>Rádio</h3><div class="radio">${G.radio.slice(0, 6).map(l => `<p class="${l.c || ''}">${l.t}</p>`).join('')}</div></div>`;
}
function renderPanel() {
  const mapCard = `<div class="card" style="padding:10px"><h3>Perímetro <span class="faint" style="text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:11.5px">clique numa zona para usá-la como destino</span></h3><div class="mapwrap" style="padding:2px">${mapSVG({ interactive: G.stage === 'panel', act: 'zonepick', sel: UI.pickZone })}</div>${legendHTML()}</div>`;
  return `${hudHTML()}<div class="siege screen">${colA()}<div class="colB">${mapCard}${endsleyHTML()}</div>${colC()}</div>`;
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
  return `<div class="card"><h3>Mesa de comando <span class="faint" style="text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:11.5px">cada um vê uma parte do problema</span></h3>
    <div class="council">${list.map(c => `<div class="adv"><div class="sil">${sil(c.id, 40)}</div><div><b>${shortName(c.nome)}</b> <span class="pill ${STANCE[c.stance][0]}">${STANCE[c.stance][1]}</span><p>“${c.t}”</p></div></div>`).join('')}</div>
    ${conflict ? ins('warn', 'split', 'Os conselhos se contradizem. Ninguém na mesa tem a informação inteira: integrar as partes é o seu trabalho.') : ''}</div>`;
}
function renderUpdate() {
  const u = G.update;
  const reps = u.reports.map(r => `<div class="report"><span class="src">${r.ag} · ${ZONE[r.z].curto}</span><span>${r.txt}. <span class="faint">Confiança ${r.conf}.</span></span></div>`).join('');
  return `${hudHTML()}<div class="resol screen">
    <div class="skyband r${G.round}">${skyline()}<i class="siren r"></i><i class="siren b"></i>
      <div class="cap"><div class="eyebrow" style="color:#c9d6ea">Atualização · rodada ${G.round} de ${MAX_ROUNDS}</div>
      <h1><span class="mono" style="color:var(--amber)">${u.time}</span> · ${ROUND_TITLE[G.round]}</h1></div></div>
    ${siegeTrack()}
    <p class="serif intro">${u.intro || roundIntro()}</p>
    ${u.quiet ? ins('good', 'wait', '<b>Calmaria.</b> Por alguns minutos, nada acontece. Pelo rádio, alguém pede café. Depois de uma rodada pesada, este é o momento de pensar, não de reagir: nenhuma carta de evento vai interromper esta rodada.') : ''}
    <div class="card"><h3>Mensagens de rádio</h3><div class="radio" style="max-height:none">${u.radio.map(l => `<p class="${l.c || ''}">${l.t}</p>`).join('')}</div></div>
    ${u.call ? `<div class="call">${icon('call', 'ico')}<div><small>Ligação recebida · ${u.call.who}</small><p>“${u.call.t}”</p></div></div>` : ''}
    ${u.intel.length ? `<div class="card"><h3>Resultados da inteligência</h3><div class="dossiers">${u.intel.map(dossierHTML).join('')}</div></div>` : ''}
    ${u.hint ? `<div class="card">${ins('info', 'light', u.hint)}</div>` : ''}
    ${councilHTML(u.council)}
    <div class="card"><h3>Relatos de campo</h3>${reps || '<p class="faint" style="font-size:13px">Nenhum relato novo. Zonas sem agentes não geram relatos.</p>'}</div>
    <div class="row"><button class="btn primary lg" data-act="takepanel">Assumir o painel</button><span class="faint" style="font-size:12.5px">${G.noLimit ? 'Sem limite de tempo.' : `Você terá ${roundTimer()} segundos${G.round <= 2 ? ' (tempo extra de orientação)' : ''} e ${D_().slots} decisões.`}</span></div></div>`;
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
    return `<div class="wfr"><span>${p.k}</span><div class="wfb"><i class="${bad ? 'bad' : 'good'}" style="${p.v > 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%"></i></div><b class="mono">${exact ? (p.v > 0 ? '+' : '−') + Math.abs(p.v).toFixed(1) : (p.v > 0 ? '↑ ' : '↓ ') + mag(p.v)}</b></div>`;
  }).join('')}<div class="wfr tot"><span>Resultado</span><div></div><b class="mono">${exact ? (tot >= 0 ? '+' : '−') + Math.abs(tot).toFixed(1) : tot > .5 ? '↑ sobe' : tot < -.5 ? '↓ desce' : '→ estável'}</b></div></div>`;
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
  return `<div class="card"><h3>Reféns nesta rodada</h3><div class="grid" style="gap:6px">${out.join('')}</div></div>`;
}
const SECS = [['dec', 'Suas decisões'], ['mundo', 'O mundo reagiu'], ['ev', 'Evento'], ['fim', 'Fim da rodada']];
function linesBySec(lines, anim = true) {
  let k = 0;
  return SECS.map(([sec, t]) => {
    const ls = lines.filter(l => (l.sec || 'dec') === sec); if (!ls.length) return '';
    return `<div class="sec"><div class="eyebrow">${t}</div>${ls.map(l => `<div class="res-line ${l.tone}" style="${anim ? `animation-delay:${(k++) * 90}ms` : 'animation:none'}">${icon(l.ic, '', 1.8)}<span>${l.text}</span></div>`).join('')}</div>`;
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
  const cause = R.agitParts ? `<div class="card"><h3>Causa e efeito</h3><div class="grid" style="gap:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      ${waterfall('Agitação do líder' + (exactA ? '' : ' (só a direção: sem perfil e canal, você não mede)'), R.agitParts, exactA)}
      ${waterfall('Pressão da mídia', R.mediaParts, true)}</div>
      <p class="faint" style="font-size:11.5px;margin-top:8px">Eventos mudam a agitação e a mídia por fora destes fatores.</p></div>` : '';
  const sw = stkWhyHTML(R, a, b);
  return `${hudHTML()}<div class="resol screen">
    <div><div class="eyebrow">Resolução · rodada ${G.round} de ${MAX_ROUNDS}</div><h1 style="font-family:var(--cond);font-size:clamp(28px,4vw,46px);letter-spacing:.03em;margin:6px 0 0">O que as suas decisões provocaram</h1></div>
    ${R.decs.length ? `<div class="row">${R.decs.map(d => `<span class="pill blue">${icon(FRONT_IC[d.front], 'ico" style="width:14px;height:14px')}${d.label}</span>`).join('')}</div>` : '<p class="muted">Você aguardou sem decisões nesta rodada. A crise não esperou.</p>'}
    <div class="grid" style="gap:14px">${linesBySec(R.lines)}</div>
    ${hchgHTML(R.hchg)}
    <div class="card"><h3>Painel de feedback</h3><div class="delta">${cells}</div></div>
    ${cause}
    ${sw ? `<div class="card"><h3>Stakeholders: por que mudaram</h3><div class="grid" style="gap:6px">${sw}</div></div>` : ''}
    <div class="row"><button class="btn primary lg" data-act="cont">${last ? 'Ver o desfecho' : G.round >= MAX_ROUNDS ? 'Encerrar' : `Seguir para a rodada ${G.round + 1}`}</button></div></div>`;
}
function eventModal() {
  const e = EVDEF[G.pendingEvent], fx = EVENT_FX[G.pendingEvent];
  return `<div class="modalback"><div class="evcard" role="dialog" aria-modal="true" aria-label="${e.titulo}">
    <div class="row" style="flex-wrap:nowrap"><div class="evico">${icon(e.ic)}</div><div><div class="eyebrow">Carta de evento</div><h2>${e.titulo}</h2></div></div>
    <p class="radio-q">${e.radio}</p><p class="d">${e.desc}</p>
    <div class="optlist">${fx.choices.map((c, i) => `<button class="opt" data-act="evchoice" data-i="${i}" ${c.cost && G.credits < c.cost ? 'disabled' : ''}><span></span><span><b>${c.label}</b><span class="d">${c.hint}</span></span>${c.cost ? `<span class="c">${c.cost}</span>` : '<span></span>'}</button>`).join('')}</div></div></div>`;
}
function renderEventStage() {
  const R = G.R;
  const lines = R.lines.map(l => `<div class="res-line ${l.tone}">${icon(l.ic, '', 1.8)}<span>${l.text}</span></div>`).join('');
  return `${hudHTML()}<div class="resol screen"><div><div class="eyebrow">Resolução · rodada ${G.round}</div><h1 style="font-family:var(--cond);font-size:clamp(28px,4vw,46px);margin:6px 0 0">Um evento interrompe a rodada</h1></div><div class="grid" style="gap:8px">${lines}</div></div>${eventModal()}`;
}
