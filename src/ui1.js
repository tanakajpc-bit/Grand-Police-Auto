/* =====================================================================
   INTERFACE — helpers, menu, briefing, recrutamento, perímetro
   ===================================================================== */
const $app = document.getElementById('app');
const UI = { tab: 'tatica', sel: null, repoAgent: '', repoZone: '', apoioZone: '', post: 'score', replayR: 1, diffSel: 'complexo', noLimit: false,
  timerId: null, deadline: 0, timerRound: -1, tutor: false, ivConfirm: false, emptyConfirm: false, msg: '', pickZone: null };

const fmt = n => Math.round(n).toLocaleString('pt-BR');
const covCls = c => c >= ADEQ ? 'g' : c >= 30 ? 'a' : 'r';
const covSym = c => c >= ADEQ ? '✓' : c >= 30 ? '!' : '✕';
const covTxt = c => c >= ADEQ ? 'adequada' : c >= 30 ? 'parcial' : 'descoberta';
const initials = n => n.replace(/^(Cap\.|Sgt\.|Det\.|Neg\.|Ag\.)\s*/, '').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
const shortName = n => n.split(' ').slice(0, 2).join(' ');
const mmss = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const pLabel = p => p < .2 ? 'Baixa' : p < .45 ? 'Média' : p < .7 ? 'Boa' : 'Alta';
const pCls = p => p < .2 ? 'red' : p < .45 ? 'amber' : p < .7 ? 'blue' : 'green';

function bar(label, v, cls = 'b', max = 10) { return `<div class="attr"><span>${label}</span><div class="meter ${cls}"><i style="width:${clamp(v / max * 100, 0, 100)}%"></i></div><b>${v}</b></div>`; }
function meter(v, cls = 'b', extra = '') { return `<div class="meter ${cls}" ${extra}><i style="width:${clamp(v, 0, 100)}%"></i></div>`; }

function sil(id, big) {
  const i = ALL_AGENTS.findIndex(a => a.id === id), hue = [205, 160, 28, 265, 340, 190, 90, 310, 50, 130, 235, 10][i % 12];
  const c = `hsl(${hue} 38% 46%)`, d = `hsl(${hue} 30% 30%)`;
  const extra = [`<rect x="17" y="10" width="20" height="6" rx="3" fill="${d}"/>`, `<circle cx="27" cy="9" r="5" fill="${d}"/>`, `<path d="M17 22a10 10 0 0120 0" fill="none" stroke="${d}" stroke-width="3"/><rect x="35" y="22" width="3" height="8" rx="1.5" fill="${d}"/>`, `<path d="M16 20c2-9 20-9 22 0-6-3-16-3-22 0z" fill="${d}"/>`][i % 4];
  return `<svg viewBox="0 0 54 62" width="${big || 54}" height="${big ? big * 62 / 54 : 62}" aria-hidden="true"><path d="M5 62c0-15 9-23 22-23s22 8 22 23z" fill="${c}"/><circle cx="27" cy="23" r="10" fill="${c}"/>${extra}</svg>`;
}

/* ---------- Toasts de rádio ---------- */
function toast(title, text, tone = '') {
  const box = document.getElementById('toasts'); if (!box) return;
  if ([...box.children].some(c => c.dataset.t === text)) return;
  const el = document.createElement('div'); el.className = 'toast ' + tone; el.dataset.t = text;
  el.innerHTML = `<b>${title}</b>${text}`; box.appendChild(el);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 7000);
}
function radioToasts(list) {
  list.forEach((l, i) => setTimeout(() => toast('RÁDIO', l.t.replace(/^\[RÁDIO\]\s*/, ''), l.c), 500 + i * 1100));
}

/* ---------- Timer ---------- */
/* Pacing: as duas primeiras rodadas são de orientação e dão mais tempo para ler o painel. */
const roundTimer = () => Math.round(D_().timer * (G.round === 1 ? 1.6 : G.round === 2 ? 1.25 : 1));
function stopTimer() { if (UI.timerId) { clearInterval(UI.timerId); UI.timerId = null; } }
function startTimer() {
  stopTimer(); UI.timerRound = G.round;
  if (G.noLimit) { UI.deadline = 0; return; }
  UI.deadline = Date.now() + roundTimer() * 1000;
  UI.timerId = setInterval(tick, 250); tick();
}
function tick() {
  const el = document.getElementById('clock'); if (!el || !UI.timerId) return;
  const left = Math.max(0, Math.ceil((UI.deadline - Date.now()) / 1000));
  el.textContent = mmss(left); el.classList.toggle('low', left <= 30);
  if (left <= 0) { stopTimer(); toast('COMANDO', 'Tempo esgotado: o plano atual é executado.', 'hot'); ACT.execute({}); }
}

/* ---------- Percepção com névoa ---------- */
function perceivedAgit(a = G.agit) {
  const off = ((G.round * 13) % 11) - 5;
  const band = a < 30 ? 'Baixa' : a < 55 ? 'Média' : a < 75 ? 'Alta' : 'Crítica';
  if (G.nego.contact && G.K.profile) return { v: Math.round(a), txt: String(Math.round(a)), band, exact: true };
  if (G.nego.contact) { const v = clamp(Math.round((a + off) / 5) * 5, 0, 100); return { v, txt: '≈' + v, band, exact: false }; }
  return { v: a + off, txt: band, band, exact: false };
}
function perceivedVault(vv = G.vault) {
  if (G.K.vault) return { txt: Math.round(vv) + '%', v: vv, exact: true };
  const off = ((G.round * 37) % 21) - 10, lo = clamp(Math.round((vv + off - 12) / 5) * 5, 0, 100), hi = clamp(lo + 25, 0, 100);
  return { txt: `≈ ${lo}–${hi}%`, v: (lo + hi) / 2, exact: false };
}
const hostagesFramed = () => {
  const H = G.hostages, safe = H.inside - H.hurt - H.dead;
  if (G.K.hostages) return G.frame === 'ganho' ? `${safe} de ${H.inside} reféns ilesos` : `${H.hurt + H.dead} de ${H.inside} reféns feridos ou em risco`;
  return G.frame === 'ganho' ? `~${H.inside} reféns no interior (sem confirmar quantos estão ilesos)` : `~${H.inside} reféns no interior (sem confirmar quantos estão em risco)`;
};

/* ---------- Mapa ---------- */
function mapSVG(o = {}) {
  const sel = o.sel || null; const K = G.K;
  let s = `<svg class="map" viewBox="0 0 760 480" role="group" aria-label="Mapa esquemático do perímetro da Agência Central">
  <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="transparent"/><path d="M0 0v8" stroke="rgba(255,255,255,.07)" stroke-width="3"/></pattern></defs>
  <rect width="760" height="480" fill="#0a111d"/>
  <g stroke="#14213a" stroke-width="1">${Array.from({ length: 19 }, (_, i) => `<path d="M${i * 40} 0V480"/>`).join('')}${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${i * 40}H760"/>`).join('')}</g>`;
  // agência
  const dots = [];
  const H = G.hostages;
  for (let i = 0; i < H.inside; i++) dots.push(`<circle cx="${316 + (i % 6) * 25}" cy="${222 + Math.floor(i / 6) * 22}" r="5" fill="${'#8fb6e8'}" opacity=".85"/>`);
  const hot = G.phase === 'siege' && perceivedAgit().v > 65;
  s += `<g aria-label="Agência Central"><rect x="300" y="165" width="160" height="155" rx="6" fill="#16233b" stroke="${hot ? '#ff5468' : '#5a7bb0'}" stroke-width="2.5" ${hot ? 'class="agpulse"' : ''}/>
   <text x="380" y="186" text-anchor="middle" fill="#9fb4d4" font-size="11" font-weight="700" letter-spacing="1.5">AGÊNCIA CENTRAL</text>${dots.join('')}
   <text x="380" y="304" text-anchor="middle" fill="#7f93b2" font-size="10.5">${H.inside} reféns no interior</text></g>`;
  // stakeholders decor
  const warn = k => G.phase === 'siege' && G.stk[k].sem >= 2;
  s += `<g><rect x="585" y="208" width="155" height="62" rx="6" fill="#111b2d" stroke="${warn('imprensa') ? '#ff5468' : '#2b3d5a'}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="662" y="232" text-anchor="middle" fill="#9fb0c8" font-size="11" font-weight="600">Imprensa</text><text x="662" y="249" text-anchor="middle" fill="#6f82a0" font-size="10">Rua Marechal Deodoro</text>${G.phase === 'siege' ? `<text x="662" y="263" text-anchor="middle" fill="#9fb0c8" font-size="10" font-family="IBM Plex Mono,monospace">mídia ${Math.round(G.media)}</text>` : ''}</g>
  <g><rect x="585" y="282" width="155" height="62" rx="6" fill="#111b2d" stroke="${warn('familias') ? '#ff5468' : '#2b3d5a'}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="662" y="306" text-anchor="middle" fill="#9fb0c8" font-size="11" font-weight="600">Famílias</text><text x="662" y="323" text-anchor="middle" fill="#6f82a0" font-size="10">ponto de acolhimento</text></g>
  <g><rect x="585" y="356" width="155" height="46" rx="6" fill="#111b2d" stroke="#2b3d5a" stroke-width="1.5"/><text x="662" y="376" text-anchor="middle" fill="#9fb0c8" font-size="11" font-weight="600">Posto de comando</text><text x="662" y="392" text-anchor="middle" fill="#6f82a0" font-size="10">você está aqui</text></g>`;
  ZONES.forEach(z => {
    const cov = zoneCoverage(z.id), cl = covCls(cov);
    const fill = cl === 'g' ? '#12392b' : cl === 'a' ? '#3a3016' : '#3a1b25', stroke = cl === 'g' ? '#41d08f' : cl === 'a' ? '#f6a623' : '#ff5468';
    const ags = agentsIn(z.id), away = G.team.filter(id => G.az[id] === z.id && isAway(id));
    const isSel = sel === z.id;
    let mark = '';
    if (K.route === z.id) mark = '★ rota provável'; else if (K.zrev[z.id] === true) mark = '◆ candidata'; else if (K.zrev[z.id] === false || K.cleared.includes(z.id)) mark = '○ improvável';
    const act = o.interactive ? `data-act="${o.act || 'place'}" data-z="${z.id}" tabindex="0" role="button" aria-label="${z.nome}: cobertura ${cov}%, ${covTxt(cov)}"` : `role="img" aria-label="${z.nome}: cobertura ${cov}%, ${covTxt(cov)}"`;
    const short = z.h < 80, nm = z.w < 120 ? z.curto : z.nome;
    const agPos = i => short ? [z.x + z.w - 17 - (i % 6) * 23, z.y + 31 + Math.floor(i / 6) * 0] : [z.x + 17 + (i % 4) * 23, z.y + z.h - 15 - Math.floor(i / 4) * 21];
    s += `<g class="zone${isSel ? ' sel' : ''}" ${act}>
      <title>${z.nome} — ${z.tip}</title>
      <rect class="z" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="7" fill="${fill}" stroke="${stroke}" ${z.dash ? 'stroke-dasharray="7 4"' : ''}/>
      <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="7" fill="url(#hatch)" opacity="${cl === 'r' ? 1 : cl === 'a' ? .45 : 0}" pointer-events="none"/>
      <text x="${z.x + 9}" y="${z.y + 17}" fill="#e8edf5" font-size="12" font-weight="700">${nm}</text>
      ${short ? `<text x="${z.x + z.w - 9}" y="${z.y + 18}" text-anchor="end" fill="${stroke}" font-size="13" font-weight="700" font-family="IBM Plex Mono,monospace">${cov}%</text>` : ''}
      <text x="${z.x + 9}" y="${z.y + 33}" fill="${stroke}" font-size="10.5" font-weight="600">${covSym(cov)} ${covTxt(cov)}</text>
      ${short ? '' : `<text x="${z.x + z.w - 9}" y="${z.y + 34}" text-anchor="end" fill="${stroke}" font-size="13" font-weight="700" font-family="IBM Plex Mono,monospace">${cov}%</text>`}
      ${mark ? `<text x="${z.x + 9}" y="${z.y + 48}" fill="#cfe0ff" font-size="10.5" font-weight="600">${mark}</text>` : ''}
      ${ags.map((id, i) => { const [cx, cy] = agPos(i); return `<g><circle cx="${cx}" cy="${cy}" r="9" fill="${G.transit[id] ? '#3b4f6e' : '#27456d'}" stroke="${G.transit[id] ? '#f6a623' : '#7fb4ee'}" stroke-width="1.5" ${G.transit[id] ? 'stroke-dasharray="3 2"' : ''}/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">${initials(agentById(id).nome)}</text></g>`; }).join('')}
      ${away.map((id, i) => `<text x="${z.x + z.w - 10}" y="${z.y + z.h - 8 - i * 12}" text-anchor="end" fill="#ff9aa7" font-size="9.5">✕ ${initials(agentById(id).nome)} ausente</text>`).join('')}
      ${gearIn(z.id).map((e, i) => `<g><rect x="${z.x + z.w - 24 - i * 20}" y="${z.y + z.h - 24}" width="16" height="16" rx="3" fill="#0d1523" stroke="#4da6ff"/><text x="${z.x + z.w - 16 - i * 20}" y="${z.y + z.h - 12}" text-anchor="middle" fill="#4da6ff" font-size="10" font-weight="700">${EQ[e].nome[0]}</text></g>`).join('')}
    </g>`;
  });
  return s + '</svg>';
}
const legendHTML = () => `<div class="legend"><span><i style="background:#41d08f"></i>✓ cobertura adequada (≥${ADEQ}%)</span><span><i style="background:#f6a623"></i>! parcial (30–59%)</span><span><i style="background:#ff5468"></i>✕ descoberta (&lt;30%)</span><span><i style="background:#4da6ff"></i>equipamento</span></div>`;

/* ===================================================================
   MENU
   =================================================================== */
function skyline() {
  let seed = 7; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  let x = 0, out = '';
  while (x < 1600) {
    const w = 50 + r() * 90, h = 90 + r() * 330;
    out += `<rect x="${x}" y="${600 - h}" width="${w}" height="${h}" fill="${r() > .5 ? '#0c1527' : '#0a1220'}"/>`;
    for (let wy = 600 - h + 14; wy < 580; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) if (r() > .72) out += `<rect class="win" style="animation-delay:${(r() * 6).toFixed(1)}s" x="${wx}" y="${wy}" width="6" height="9" fill="${r() > .85 ? '#f6a623' : '#c9a85a'}" opacity="${(.35 + r() * .5).toFixed(2)}"/>`;
    if (r() > .8) out += `<rect x="${x + w / 2 - 1}" y="${600 - h - 26}" width="2" height="26" fill="#0c1527"/><circle cx="${x + w / 2}" cy="${600 - h - 28}" r="2.5" fill="#ff3b4f" class="win"/>`;
    x += w + 4 + r() * 12;
  }
  return `<svg class="skyline" viewBox="0 0 1600 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${out}</svg>`;
}
function renderMenu() {
  const save = loadSave();
  const dcards = Object.entries(DIFF).map(([k, d]) => `
    <button class="diffcard" data-act="diff" data-v="${k}" aria-pressed="${UI.diffSel === k}">
      <span class="dot"></span>
      <span><h3>${d.nome}</h3><p>${d.blurb}</p></span>
      <span class="dparams">${d.slots} decisões<br>${d.timer}s/rodada<br>eventos ${Math.round(d.evChance * 100)}%</span>
    </button>`).join('');
  return `<div class="screen menu">
    <div class="sky">${skyline()}<i class="siren r"></i><i class="siren b"></i><i class="siren r2"></i><i class="siren b2"></i>
      <div class="titleblock"><div class="clock">SEXTA-FEIRA · 14H07 · PORTO ALTO</div><h1>PERÍMETRO</h1><p class="sub">Uma simulação de gestão de crise sob restrições</p></div>
    </div>
    <div class="menubody">
      <div class="grid">
        <div><div class="eyebrow">Dificuldade</div><div class="diffs" style="margin-top:8px">${dcards}</div></div>
        <div class="row"><button class="btn primary lg" data-act="start">Iniciar simulação</button>
          ${save ? `<button class="btn lg" data-act="continue">Continuar partida <span class="faint" style="font-weight:400">(${DIFF[save.diff].nome}, ${save.phase === 'siege' ? 'rodada ' + save.round : save.phase === 'post' || save.phase === 'outcome' ? 'finalizada' : save.phase === 'recruit' ? 'recrutamento' : save.phase === 'perimeter' ? 'perímetro' : 'briefing'})</span></button>` : ''}
        </div>
        <label class="row" style="gap:8px;font-size:13px;color:var(--ink2);cursor:pointer"><input type="checkbox" id="nolimit" data-chg="nolimit" ${UI.noLimit ? 'checked' : ''}> Cronômetro sem limite (acessibilidade): o relógio aparece, mas não encerra a rodada</label>
      </div>
      <div class="card">
        <h3>Sua missão</h3>
        <p class="serif" style="font-size:16.5px;line-height:1.6;color:#dfe6f1">Você é o comandante do incidente. Em 8 rodadas, equilibre cinco objetivos que competem entre si: <b>vidas</b>, <b>prisões</b>, <b>valores</b>, <b>custo</b> e <b>confiança pública</b>. Não existe estratégia dominante.</p>
        <div class="row" style="margin-top:12px"><button class="btn sm" data-act="howto">Como funciona</button><span class="faint" style="font-size:12px">25 a 40 min · salva automaticamente no navegador</span></div>
        <p class="faint" style="font-size:11.5px;margin-top:14px">Todos os nomes, lugares e instituições são fictícios. A perspectiva é sempre a de quem protege; as ações táticas são abstratas e não há imagens explícitas.</p>
      </div>
    </div>
    ${UI.tutor ? tutorModal() : ''}
  </div>`;
}
function tutorModal() {
  return `<div class="modalback" role="dialog" aria-modal="true" aria-label="Como funciona"><div class="tutor">
    <h3>Como funciona o PERÍMETRO</h3>
    <p class="muted"><b>1. Recrute</b> uma equipe com 1.000 créditos. O que sobrar é sua reserva para investigações, apoio externo e horas extras.</p>
    <p class="muted"><b>2. Posicione</b> agentes e equipamentos em 7 zonas. Quatro delas são rotas de fuga possíveis, mas você não sabe quais. Os recursos só cobrem bem cerca de 60% das zonas: é preciso apostar, ou investir em inteligência.</p>
    <p class="muted"><b>3. Comande o cerco</b> por 8 rodadas. Em cada uma você recebe informações parciais (Percepção), lê indicadores (Compreensão) e vê tendências (Projeção). Então toma 2 ou 3 decisões em quatro frentes: <b>Tática, Negociação, Inteligência e Comunicação</b>.</p>
    <p class="muted"><b>4. A crise termina</b> por rendição negociada, intervenção, fuga ou prazo esgotado. A nota combina vidas (40%), prisões (20%), valores (15%), eficiência de custo (10%) e confiança pública (15%).</p>
    <p class="muted">Dica: a negociação sobe uma escada de 5 degraus, um por vez. Pular etapas reduz pela metade a chance de avançar.</p>
    <div class="row"><button class="btn primary" data-act="closehowto">Entendi</button></div></div></div>`;
}

/* ===================================================================
   BRIEFING
   =================================================================== */
function tickerHTML(items, label = 'AO VIVO') {
  const t = items.map(x => `<span>${x}</span>`).join('<i>◆</i>');
  return `<div class="ticker" role="marquee" aria-label="Manchetes ao vivo: ${items.join('. ')}"><b>${label}</b><div class="tk"><div class="tkin" aria-hidden="true">${t}<i>◆</i>${t}<i>◆</i></div></div></div>`;
}
function hostageStrip(cls = '') {
  return `<div class="hstrip ${cls}" aria-label="Os 17 reféns: ${HOSTAGE_LIST.map(h => h.nome).join(', ')}">${HOSTAGE_LIST.map((h, i) => `<span class="hp" style="--i:${i}" title="${h.nome}, ${h.idade} anos, ${h.papel}${h.nota ? ' (' + h.nota + ')' : ''}">${sil1()}<small>${h.nome.split(' ')[0]}</small></span>`).join('')}</div>`;
}
const sil1 = () => '<svg viewBox="0 0 20 26" aria-hidden="true"><circle cx="10" cy="7" r="5"/><path d="M1 26c0-7 4-11 9-11s9 4 9 11z"/></svg>';
function renderBriefing() {
  const w = [40, 20, 15, 10, 15], names = ['Vidas dos reféns', 'Prisão dos responsáveis', 'Valores recuperados', 'Custos operacionais', 'Confiança pública'];
  return `<div class="screen brief" data-act="skipbrief">
    ${tickerHTML(['URGENTE · Alarme dispara na Agência Central do Banco Meridiano, no centro de Porto Alto', 'Testemunhas falam em homens armados e clientes presos no interior', 'Polícia isola a Rua Marechal Deodoro; trânsito desviado', 'TV Porto Alto acompanha ao vivo'], 'URGENTE')}
    <div class="day">Sexta-feira</div><div class="time">14h07</div>
    <div class="narr">
      <p>O alarme silencioso da Agência Central do Banco Meridiano acaba de disparar. As primeiras viaturas confirmam: há pelo menos dois homens armados no interior da agência.</p>
      <p>Dezessete pessoas, entre clientes e funcionários, estão impedidas de sair. Uma aposentada que veio pagar contas. Um caixa de 24 anos no segundo mês de emprego. Uma cliente grávida de sete meses.</p>
      <p>Uma equipe da TV Porto Alto já estaciona o caminhão de transmissão na esquina da Rua Marechal Deodoro. O delegado titular está em férias. Você é o próximo na cadeia de comando. <b>A partir de agora, todas as decisões são suas.</b></p>
    </div>
    <div class="after">
      <div class="eyebrow" style="margin-top:4px">Quem está lá dentro</div>
      ${hostageStrip()}
      <p class="faint" style="font-size:12.5px;margin-top:8px">Você tem mil créditos, doze profissionais de plantão e um mapa com sete zonas. Não tem tempo, nem informação suficiente, e nenhuma decisão vai agradar a todos.</p>
      <div class="eyebrow" style="margin-top:20px">Cinco objetivos em tensão</div>
      <div class="objgrid">${w.map((p, i) => `<div class="obj" style="--w:${p * 2.2}%"><b>${p}%</b><span>${names[i]}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:26px"><button class="btn primary lg" data-act="tobrief">Assumir o comando</button><span class="faint" style="font-size:12.5px">Próximo: Fase 0, recrutamento da equipe · clique no texto para pular a animação</span></div>
    </div></div>`;
}

/* ===================================================================
   FASE 0 — RECRUTAMENTO
   =================================================================== */
function teamSummary() {
  const t = G.team; if (!t.length) return '<p class="faint" style="font-size:12.5px">Nenhum agente recrutado.</p>';
  const sum = k => t.reduce((s, id) => s + stat(id, k), 0), best = k => Math.max(...t.map(id => stat(id, k)));
  return `<div class="attrs">${bar('Tática (soma)', sum('tat'), 'b', 50)}${bar('Melhor negoc.', best('neg'), 'g')}${bar('Melhor intel.', best('int'), 'v')}${bar('Melhor comun.', best('com'), 'a')}</div>`;
}
function renderRecruit() {
  const agents = AGENTS.map(a => {
    const on = G.team.includes(a.id), can = on || G.credits >= a.custo;
    return `<button class="acard" data-act="hire" data-id="${a.id}" aria-pressed="${on}" aria-disabled="${!can}">
      ${on ? '<span class="pill green hired">Recrutado</span>' : ''}
      <div class="top"><div class="sil">${sil(a.id)}</div><div><h4>${a.nome}</h4><span class="faint" style="font-size:11.5px">${a.trait}</span></div><span class="cost">${a.custo}</span></div>
      <div class="attrs">${Object.keys(ATTR).map(k => bar(ATTR[k], stat(a.id, k), k === 'tat' ? 'r' : k === 'neg' ? 'g' : k === 'int' ? 'v' : k === 'res' ? 'a' : 'b')).join('')}</div>
      <p class="bio">${BIOS[a.id] || ''}</p>
      <div class="trait"><b>${a.trait}</b>${a.tdesc}</div></button>`;
  }).join('');
  const gear = EQUIPMENT_HTML();
  const reserve = G.credits;
  const warns = [];
  if (G.team.length && !G.team.some(id => stat(id, 'neg') >= 7)) warns.push('Nenhum negociador forte (7+): a escada de negociação será lenta.');
  if (reserve < 150) warns.push('Reserva baixa: sem créditos você não investiga, não paga apoio externo nem horas extras.');
  const cam = G.team.includes('camila') ? `<div class="card flat"><h3>Camila Araújo · Versátil</h3><div class="row" style="gap:8px">
    <label class="field">+1 em<select data-chg="camplus" id="camplus">${Object.keys(ATTR).map(k => `<option value="${k}" ${G.camAdj.plus === k ? 'selected' : ''}>${ATTR[k]}</option>`).join('')}</select></label>
    <label class="field">−1 em<select data-chg="camminus" id="camminus">${Object.keys(ATTR).map(k => `<option value="${k}" ${G.camAdj.minus === k ? 'selected' : ''}>${ATTR[k]}</option>`).join('')}</select></label></div></div>` : '';
  return `<div class="screen">
    <div class="hud"><div class="hudrow"><span class="brand">PERÍMETRO</span><span class="pill">Fase 0 · Recrutamento</span><span class="spacer"></span><div class="stat"><small>Créditos</small><b style="color:var(--amber)">${fmt(G.credits)}</b></div></div></div>
    <div class="recr">
      <div class="grid" style="gap:18px">
        <div><div class="eyebrow">Pool de profissionais</div><h2 style="font-size:22px;margin:4px 0 6px">Quem entra na sua força-tarefa?</h2><p class="serif muted" style="font-size:15.5px;margin-bottom:12px;max-width:820px">14h12. A Secretaria liberou mil créditos e doze profissionais de plantão. Quem você chamar chega em quinze minutos. O que sobrar é tudo o que você terá para investigar, pedir apoio e pagar horas extras até o fim da noite.</p><div class="agents">${agents}</div></div>
        <div><div class="eyebrow">Catálogo de equipamentos</div><div class="gear" style="margin-top:8px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${gear}</div></div>
      </div>
      <aside class="side">
        <div class="card"><h3>Orçamento</h3><div class="credits num">${fmt(G.credits)}</div><p class="muted" style="font-size:12.5px;margin-top:6px">Reserva operacional. Cada crédito gasto agora é um crédito a menos para investigar, pedir apoio externo ou pagar horas extras.</p>
          <div style="margin-top:10px">${meter(G.credits / 10, G.credits < 150 ? 'r' : G.credits < 350 ? 'a' : 'g')}</div></div>
        <div class="card"><h3>Equipe (${G.team.length})</h3>${teamSummary()}
          <div style="margin-top:10px">${G.team.map(id => `<div class="mini"><span>${shortName(agentById(id).nome)}</span><span class="mono">${agentById(id).custo}</span></div>`).join('')}${G.gear.map(id => `<div class="mini"><span>${EQ[id].nome}</span><span class="mono">${EQ[id].custo}</span></div>`).join('')}</div>
          ${warns.map(w => `<div class="insight warn" style="margin-top:8px">${icon('alert', '', 1.8)}<span>${w}</span></div>`).join('')}</div>
        ${cam}
        ${UI.emptyConfirm && !G.team.length ? `<div class="insight bad">${icon('alert', '', 1.8)}<span>Sem agentes, a guarnição local improvisa dois patrulheiros (Tática 3). A cobertura será mínima e a negociação, amadora. Confirma?</span></div>` : ''}
        <button class="btn primary lg" data-act="torecruit">${UI.emptyConfirm && !G.team.length ? 'Sim, seguir sem equipe' : 'Posicionar o perímetro'}</button>
      </aside>
    </div></div>`;
}
function EQUIPMENT_HTML() {
  return EQUIP.map(e => {
    const on = G.gear.includes(e.id), can = on || G.credits >= e.custo;
    return `<button class="gcard" data-act="buygear" data-id="${e.id}" aria-pressed="${on}" aria-disabled="${!can}">${icon(e.ic)}<span><b>${e.nome}</b><span>${e.desc}</span></span><span class="cost mono" style="color:var(--amber);font-weight:600">${e.custo}</span></button>`;
  }).join('');
}

/* ===================================================================
   FASE 1 — PERÍMETRO
   =================================================================== */
function chipHTML(kind, id) {
  const sel = UI.sel && UI.sel.t === kind && UI.sel.id === id;
  if (kind === 'a') { const a = agentById(id); return `<button class="chip" data-act="selchip" data-t="a" data-id="${id}" aria-pressed="${!!sel}" title="${a.nome}"><span class="in">${initials(a.nome)}</span>${shortName(a.nome).replace(/^(Cap\.|Sgt\.|Det\.|Neg\.|Ag\.)\s*/, '')} · T${stat(id, 'tat')}</button>`; }
  return `<button class="chip" data-act="selchip" data-t="g" data-id="${id}" aria-pressed="${!!sel}" title="${EQ[id].nome}">${icon(EQ[id].ic, 'ico" style="width:16px;height:16px')}${EQ[id].nome}</button>`;
}
function renderPerimeter() {
  const reserveA = G.team.filter(id => (G.az[id] || 'reserva') === 'reserva'), reserveG = G.gear.filter(id => (G.gz[id] || 'reserva') === 'reserva');
  const adq = adequateCount();
  const intel = INTEL.filter(i => i.fase1).map(i => {
    const r = G.p1intel[i.id], done = r && typeof r === 'object', c = intelCost(i.id), can = G.credits >= c;
    return `<div class="icard ${done && r.ok ? 'done' : ''}"><b>${icon(i.ic, 'ico" style="width:18px;height:18px;vertical-align:-4px;margin-right:6px')}${i.nome}</b><p>${i.desc}</p>
      ${done ? dossierHTML(r) : `<button class="btn sm" data-act="p1intel" data-id="${i.id}" ${can ? '' : 'disabled'}>Investigar · ${c} créditos</button>`}</div>`;
  }).join('');
  const zrows = ZONES.map(z => {
    const cov = zoneCoverage(z.id), sel = UI.sel;
    return `<div class="zrow ${UI.pickZone === z.id ? 'sel' : ''}"><div><span class="nm">${z.nome}</span> <span class="pill ${covCls(cov) === 'g' ? 'green' : covCls(cov) === 'a' ? 'amber' : 'red'}">${covSym(cov)} ${covTxt(cov)}</span></div><span class="cv" style="color:var(--${covCls(cov) === 'g' ? 'green' : covCls(cov) === 'a' ? 'amber' : 'red'})">${cov}%</span>
      <div class="chips">${agentsIn(z.id).map(id => chipHTML('a', id)).join('')}${gearIn(z.id).map(id => chipHTML('g', id)).join('')}${sel ? `<button class="btn sm" data-act="place" data-z="${z.id}">Posicionar aqui</button>` : ''}</div></div>`;
  }).join('');
  return `<div class="screen">
    <div class="hud"><div class="hudrow"><span class="brand">PERÍMETRO</span><span class="pill">Fase 1 · Posicionamento</span><span class="spacer"></span>
      <div class="stat"><small>Zonas adequadas</small><b style="color:var(--${adq >= 4 ? 'green' : adq >= 3 ? 'amber' : 'red'})">${adq} / 7</b></div>
      <div class="stat"><small>Créditos</small><b style="color:var(--amber)">${fmt(G.credits)}</b></div></div></div>
    <div class="perim">
      <div class="grid">
        <div><div class="eyebrow">Mapa esquemático</div><h2 style="font-size:22px;margin:4px 0 10px">Onde você vai apostar?</h2>
          <p class="muted" style="margin-bottom:10px;max-width:760px">Quatro das sete zonas são rotas de fuga possíveis, mas você não sabe quais. Selecione um agente ou equipamento e clique na zona de destino. A cobertura combina a eficiência tática dos agentes com o fator dos equipamentos (×1,0 sem · ×1,3 com um · ×1,6 com dois).</p>
          <div class="mapwrap">${mapSVG({ interactive: true, sel: UI.pickZone })}${legendHTML()}</div></div>
        <div><div class="eyebrow">Inteligência prévia (resultado imediato, 15% menos confiável)</div><div class="intelgrid" style="margin-top:8px">${intel}</div></div>
      </div>
      <aside class="side">
        <div class="card"><h3>Reserva <span class="pill">${reserveA.length} agentes</span></h3>
          <div class="row" style="gap:6px">${reserveA.map(id => chipHTML('a', id)).join('') || '<span class="faint" style="font-size:12.5px">Todos posicionados.</span>'}${reserveG.map(id => chipHTML('g', id)).join('')}</div>
          ${UI.sel ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="place" data-z="reserva">Devolver à reserva</button><span class="faint" style="font-size:12px">${UI.sel.t === 'a' ? agentById(UI.sel.id).nome : EQ[UI.sel.id].nome} selecionado</span></div>` : '<p class="faint" style="font-size:12px;margin-top:8px">Clique em um item e depois em uma zona. Agentes na reserva descansam, mas não cobrem zona nenhuma.</p>'}</div>
        <div class="card"><h3>Zonas</h3><div class="zlist">${zrows}</div></div>
        <button class="btn" data-act="autoplace">Distribuição automática</button><button class="btn primary lg" data-act="tosiege">Confirmar e iniciar o cerco</button>
        <p class="faint" style="font-size:11.5px">Cobertura calculada com a pressão inicial (${G.pressure}): eficiência × ${pressureFactor(G.pressure * .95).toFixed(2)}. Ela muda ao longo do cerco.</p>
      </aside>
    </div></div>`;
}

/* ---------- Dossiê de inteligência: resposta + o que muda (o "aha") ---------- */
function dossierHTML(r) {
  return `<div class="dossier ${r.ok ? 'ok' : 'no'}"><span class="stamp">${r.ok ? 'Confirmado' : 'Inconclusivo'}</span>
    <b>${r.nome}</b><p>${r.text}</p>${r.impact ? `<div class="impact"><small>O que muda</small>${r.impact}</div>` : ''}</div>`;
}

/* ---------- Cortes de cena entre fases (não salvos: são só transição) ---------- */
function cutHTML() {
  const c = UI.cut; if (!c) return '';
  return `<div class="cut" role="dialog" aria-modal="true" aria-label="${c.title}"><div class="cutin">
    <div class="time">${c.time}</div><h2>${c.title}</h2>
    ${c.lines.map((l, i) => `<p class="${l.radio ? 'radio-q' : ''}" style="animation-delay:${.5 + i * .9}s">${l.t}</p>`).join('')}
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn primary lg" data-act="cutgo" style="animation-delay:${.6 + c.lines.length * .9}s">${c.btn}</button></div></div></div>`;
}
