/* =====================================================================
   INTERFACE — helpers, menu, briefing, recrutamento, perímetro
   ===================================================================== */
const $app = document.getElementById('app');
/* Estado de tela que não pertence a nenhuma partida. resetUI() devolve tudo isto ao zero quando a partida muda (nova, retomada, encerrada);
   as preferências (dificuldade escolhida, cronômetro sem limite, código da turma, manchetes pausadas) ficam. */
const UI0 = { tab: 'tatica', sel: null, repoAgent: '', repoZone: '', apoioZone: '', post: 'score', replayR: 1, tutor: false, ivConfirm: false, emptyConfirm: false,
  newConfirm: false, menuConfirm: false, msg: '', pickZone: null, lvl: 1, tabAnim: false, cut: null, paused: false };
const UI = Object.assign({ diffSel: 'complexo', noLimit: false, code: '', tkPause: false, timerId: null, deadline: 0, timerRound: -1 }, UI0);
function resetUI() { stopTimer(); Object.assign(UI, UI0, { timerRound: -1, deadline: 0 }); }

const fmt = n => Math.round(n).toLocaleString('pt-BR');
const covCls = c => c >= ADEQ ? 'g' : c >= 30 ? 'a' : 'r';
const covSym = c => c >= ADEQ ? '✓' : c >= 30 ? '!' : '✕';
const covTxt = c => c >= ADEQ ? 'adequada' : c >= 30 ? 'parcial' : 'descoberta';
const initials = n => n.replace(/^(Cap\.|Sgt\.|Det\.|Neg\.|Ag\.)\s*/, '').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
const mmss = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
const dec = (n, d = 1) => Number(n).toFixed(d).replace('.', ',');   // decimal com vírgula (pt-BR)
const br = t => String(t).replace(/(\d)\.(\d)(?!\d)/g, '$1,$2');   // textos do motor: 9.0 → 9,0 (milhar 1.000 fica intacto)

/* Barras de atributo são neutras: vermelho, âmbar e verde ficam reservados para estado (perigo, alerta, positivo). */
function bar(label, v, cls = 'n', max = 10) { return `<div class="attr"><span>${label}</span><div class="meter ${cls}"><i style="width:${clamp(v / max * 100, 0, 100)}%"></i></div><b>${v}</b></div>`; }
function meter(v, cls = 'b', extra = '') { return `<div class="meter ${cls}" ${extra}><i style="width:${clamp(v, 0, 100)}%"></i></div>`; }

function sil(id, big) {
  const i = ALL_AGENTS.findIndex(a => a.id === id), hue = [205, 160, 28, 265, 340, 190, 90, 310, 50, 130, 235, 10][i % 12];
  const c = `hsl(${hue} 38% 46%)`, d = `hsl(${hue} 30% 30%)`;
  const extra = [`<rect x="17" y="10" width="20" height="6" rx="3" fill="${d}"/>`, `<circle cx="27" cy="9" r="5" fill="${d}"/>`, `<path d="M17 22a10 10 0 0120 0" fill="none" stroke="${d}" stroke-width="3"/><rect x="35" y="22" width="3" height="8" rx="1.5" fill="${d}"/>`, `<path d="M16 20c2-9 20-9 22 0-6-3-16-3-22 0z" fill="${d}"/>`][i % 4];
  return `<svg viewBox="0 0 54 62" width="${big || 54}" height="${big ? big * 62 / 54 : 62}" aria-hidden="true"><path d="M5 62c0-15 9-23 22-23s22 8 22 23z" fill="${c}"/><circle cx="27" cy="23" r="10" fill="${c}"/>${extra}</svg>`;
}

/* ---------- Avisos (toasts) ----------
   Ficam no canto inferior esquerdo, acima da barra de ação, longe da coluna de decisões.
   Passar o mouse pausa a saída; o ✕ fecha na hora. O rádio da rodada não vira toast: ele já está na tela de atualização. */
function toast(title, text, tone = '') {
  const box = document.getElementById('toasts'); if (!box) return;
  if ([...box.children].some(c => c.dataset.t === text)) return;
  const el = document.createElement('div'); el.className = 'toast ' + tone; el.dataset.t = text;
  el.innerHTML = `<b>${title}</b>${text}<button class="tx" type="button" aria-label="Fechar aviso">✕</button>`; box.appendChild(el);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  const kill = () => { if (el.parentNode) el.parentNode.removeChild(el); };
  el.addEventListener('animationend', e => { if (e.animationName === 'toastout') kill(); });
  el.querySelector('.tx').addEventListener('click', kill);
  setTimeout(kill, 20000);
}
/* Os avisos flutuam sobre o conteúdo: a página ganha no fim a altura que eles ocupam, para o último botão sempre poder rolar para fora de baixo deles. */
(() => { const box = document.getElementById('toasts'); if (box && window.ResizeObserver) new ResizeObserver(() => document.body.style.setProperty('--toasth', box.offsetHeight ? box.offsetHeight + 16 + 'px' : '0px')).observe(box); })();

/* ---------- Dica flutuante ----------
   Passar o mouse (ou o foco do teclado) sobre o nome de um agente mostra os cinco atributos dele, em qualquer tela (data-ag).
   Os detalhes que saíram da tela aparecem do mesmo jeito: data-tip (texto) ou o filho .tipc (escondido, mas presente na página). */
const $tip = document.createElement('div'); $tip.id = 'tip'; $tip.setAttribute('role', 'tooltip'); $tip.hidden = true; document.body.appendChild($tip);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/* Regras longas viram um "ⓘ" com o texto na dica: continuam a um gesto de distância, sem ocupar a tela. */
const infoTip = (label, html) => `<span class="helptip hastip" tabindex="0">ⓘ${label ? ' ' + label : ''}<span class="tipc">${html}</span></span>`;
function agentTip(id) {
  const a = agentById(id); if (!a) return '';
  return `<b class="tn">${a.nome}</b><span class="tt"><b>${a.trait}.</b> ${a.tdesc}</span><div class="attrs">${Object.keys(ATTR).map(k => bar(ATTR[k], G ? stat(id, k) : a.s[k])).join('')}</div>`;
}
let tipFor = null;
function showTip(el) {
  const c = el.dataset.ag ? null : [...el.children].find(x => x.classList.contains('tipc'));
  const html = el.dataset.ag ? agentTip(el.dataset.ag) : c ? c.innerHTML : el.dataset.tip ? esc(el.dataset.tip) : '';
  if (!html) { hideTip(); return; }
  tipFor = el; $tip.innerHTML = html; $tip.className = el.dataset.ag ? 'ag' : ''; $tip.hidden = false;
  const r = el.getBoundingClientRect(), w = $tip.offsetWidth, h = $tip.offsetHeight;
  const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  const y = r.bottom + 8 + h <= innerHeight - 8 ? r.bottom + 8 : Math.max(8, r.top - h - 8);
  $tip.style.left = Math.round(x) + 'px'; $tip.style.top = Math.round(y) + 'px';
}
function hideTip() { tipFor = null; $tip.hidden = true; }
const tipTarget = t => t && t.closest ? t.closest('[data-ag],[data-tip],.hastip') : null;
document.addEventListener('mouseover', e => { const el = tipTarget(e.target); if (el !== tipFor) { if (el) showTip(el); else hideTip(); } });
document.addEventListener('focusin', e => { const el = tipTarget(e.target); if (el) showTip(el); else hideTip(); });
document.addEventListener('focusout', hideTip);
addEventListener('scroll', hideTip, { passive: true });

/* ---------- Timer ---------- */
/* Pacing: as duas primeiras rodadas são de orientação e dão mais tempo para ler o painel. */
const roundTimer = () => Math.round(D_().timer * (G.round === 1 ? 1.6 : G.round === 2 ? 1.25 : 1));
const timeLeft = () => Math.max(0, Math.ceil((UI.deadline - Date.now()) / 1000));
function stopTimer() { if (UI.timerId) { clearInterval(UI.timerId); UI.timerId = null; } UI.paused = false; }
function startTimer() {
  stopTimer(); UI.timerRound = G.round;
  if (G.noLimit) { UI.deadline = 0; return; }
  /* G.tleft guarda o que sobrava no relógio: recarregar a página ou voltar à aba continua de onde parou, em vez de dar a rodada inteira de novo. */
  const left = G.tleft != null ? Math.max(10, G.tleft) : roundTimer();
  UI.deadline = Date.now() + left * 1000;
  UI.timerId = setInterval(tick, 250); tick();
}
function tick() {
  if (!UI.timerId) return;
  const left = timeLeft(), el = document.getElementById('clock'); G.tleft = left;
  if (el) { el.textContent = mmss(left); el.classList.toggle('low', left <= 30); }
  if (left <= 0) { stopTimer(); toast('COMANDO', 'Tempo esgotado: o plano atual é executado.', 'hot'); run(() => ACT.execute({})); }
}
/* Aba oculta ou janela de confirmação aberta: o relógio espera. O jogo é de um jogador só, e sair da aba não deve executar o plano às cegas. */
function pauseTimer() { if (!UI.timerId) return; G.tleft = timeLeft(); stopTimer(); UI.paused = true; saveGame(); }
function resumeTimer() { if (UI.paused && !UI.menuConfirm && G && G.phase === 'siege' && G.stage === 'panel') startTimer(); }

/* ---------- Mapa ---------- */
function mapSVG(o = {}) {
  const sel = o.sel || null; const K = G.K;
  let s = `<svg class="map${o.targeting ? ' targeting' : ''}" viewBox="0 0 760 480" role="group" aria-label="Mapa esquemático do perímetro da Agência Central">
  <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="transparent"/><path d="M0 0v8" stroke="rgba(255,255,255,.07)" stroke-width="3"/></pattern></defs>
  <rect width="760" height="480" fill="#0a111d"/>
  <g stroke="#14213a" stroke-width="1">${Array.from({ length: 19 }, (_, i) => `<path d="M${i * 40} 0V480"/>`).join('')}${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${i * 40}H760"/>`).join('')}</g>`;
  // agência
  const dots = [];
  const H = G.hostages;
  for (let i = 0; i < H.inside; i++) dots.push(`<circle cx="${316 + (i % 6) * 25}" cy="${222 + Math.floor(i / 6) * 22}" r="5" fill="${'#8fb6e8'}" opacity=".85"/>`);
  const hot = G.phase === 'siege' && perceivedAgit().v > 65;
  s += `<g aria-label="Agência Central"><rect x="300" y="165" width="160" height="155" rx="6" fill="#16233b" stroke="${hot ? '#ff5468' : '#5a7bb0'}" stroke-width="2.5" ${hot ? 'class="agpulse"' : ''}/>
   <text x="380" y="186" text-anchor="middle" fill="#9fb4d4" font-size="12" font-weight="700" letter-spacing="1.5">AGÊNCIA CENTRAL</text>${dots.join('')}
   <text x="380" y="304" text-anchor="middle" fill="#8b9fbd" font-size="11.5">${H.inside} reféns no interior</text></g>`;
  // stakeholders decor
  const warn = k => G.phase === 'siege' && G.stk[k].sem >= 2;
  s += `<g><rect x="585" y="208" width="155" height="62" rx="6" fill="#111b2d" stroke="${warn('imprensa') ? '#ff5468' : '#2b3d5a'}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="662" y="231" text-anchor="middle" fill="#a9bad2" font-size="12" font-weight="600">Imprensa</text><text x="662" y="248" text-anchor="middle" fill="#8396b3" font-size="11">Rua Marechal Deodoro</text>${G.phase === 'siege' ? `<text x="662" y="263" text-anchor="middle" fill="#a9bad2" font-size="11" font-family="IBM Plex Mono,monospace">mídia ${Math.round(G.media)}</text>` : ''}</g>
  <g><rect x="585" y="282" width="155" height="62" rx="6" fill="#111b2d" stroke="${warn('familias') ? '#ff5468' : '#2b3d5a'}" stroke-width="1.5" stroke-dasharray="4 3"/><text x="662" y="307" text-anchor="middle" fill="#a9bad2" font-size="12" font-weight="600">Famílias</text><text x="662" y="324" text-anchor="middle" fill="#8396b3" font-size="11">ponto de acolhimento</text></g>
  <g><rect x="585" y="356" width="155" height="46" rx="6" fill="#111b2d" stroke="#2b3d5a" stroke-width="1.5"/><text x="662" y="376" text-anchor="middle" fill="#a9bad2" font-size="12" font-weight="600">Posto de comando</text><text x="662" y="392" text-anchor="middle" fill="#8396b3" font-size="11">você está aqui</text></g>`;
  ZONES.forEach(z => {
    const cov = zoneCoverage(z.id), cl = covCls(cov);
    const fill = cl === 'g' ? '#12392b' : cl === 'a' ? '#3a3016' : '#3a1b25', stroke = cl === 'g' ? '#41d08f' : cl === 'a' ? '#f6a623' : '#ff5468';
    const ags = agentsIn(z.id), away = G.team.filter(id => G.az[id] === z.id && isAway(id));
    const isSel = sel === z.id;
    // Zona estreita (o Beco): nome, porcentagem, estado e marca empilhados, para nada se sobrepor.
    // Zona baixa e curta (a Entrada) usa o nome curto para caber ao lado de "100%".
    const short = z.h < 80, narrow = z.w < 120, nm = narrow || (short && z.w < 300 && z.nome.length > 12) ? z.curto : z.nome;
    let mark = '';
    if (K.route === z.id) mark = narrow ? '★ rota' : '★ rota provável'; else if (K.zrev[z.id] === true) mark = '◆ candidata'; else if (K.zrev[z.id] === false || K.cleared.includes(z.id)) mark = '○ improvável';
    const act = o.interactive ? `data-act="${o.act || 'place'}" data-z="${z.id}" tabindex="0" role="button" aria-label="${z.nome}: cobertura ${cov}%, ${covTxt(cov)}${mark ? ', ' + mark.slice(2) : ''}"` : `role="img" aria-label="${z.nome}: cobertura ${cov}%, ${covTxt(cov)}"`;
    const pct = (x, y, anchor) => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${stroke}" font-size="14" font-weight="700" font-family="IBM Plex Mono,monospace">${cov}%</text>`;
    const wide = short && z.w > 300, yS = narrow ? 54 : short && !wide ? 35 : 36, xM = wide ? 130 : 9, yM = narrow ? 71 : wide ? yS : yS + 17;
    // Quantos marcadores cabem sem cobrir o texto da zona; o excedente vira um "+N".
    // Nas zonas baixas a fila de marcadores começa à esquerda dos equipamentos; no Beco, 3 por linha se houver equipamento.
    const nG = gearIn(z.id).length, perRow = narrow && nG ? 3 : 4;
    const cap = short ? (wide ? 20 : Math.max(1, 3 - nG)) : narrow ? 16 : z.h >= 120 ? 12 : 4;
    const shown = ags.length > cap ? ags.slice(0, cap - 1) : ags, extra = ags.slice(shown.length);
    const agPos = i => short ? [z.x + z.w - 17 - nG * 20 - i * 23, z.y + 31] : [z.x + 17 + (i % perRow) * 23, z.y + z.h - 15 - Math.floor(i / perRow) * 21];
    s += `<g class="zone${isSel ? ' sel' : ''}" ${act} data-tip="${esc(z.nome + ': ' + z.tip)}">
      <rect class="z" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="7" fill="${fill}" stroke="${stroke}" ${z.dash ? 'stroke-dasharray="7 4"' : ''}/>
      <rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="7" fill="url(#hatch)" opacity="${cl === 'r' ? 1 : cl === 'a' ? .45 : 0}" pointer-events="none"/>
      <text x="${z.x + 9}" y="${z.y + 18}" fill="#e8edf5" font-size="13" font-weight="700">${nm}</text>
      ${narrow ? pct(z.x + 9, z.y + 37, 'start') : short ? pct(z.x + z.w - 9, z.y + 19, 'end') : pct(z.x + z.w - 9, z.y + 37, 'end')}
      <text x="${z.x + 9}" y="${z.y + yS}" fill="${stroke}" font-size="12.5" font-weight="600">${covSym(cov)} ${covTxt(cov)}</text>
      ${mark ? `<text x="${z.x + xM}" y="${z.y + yM}" fill="#cfe0ff" font-size="12.5" font-weight="600">${mark}</text>` : ''}
      ${shown.map((id, i) => { const [cx, cy] = agPos(i); return `<g data-ag="${id}"><circle cx="${cx}" cy="${cy}" r="9.5" fill="${+G.transit[id] ? '#3b4f6e' : '#27456d'}" stroke="${+G.transit[id] ? '#f6a623' : '#7fb4ee'}" stroke-width="1.5" ${+G.transit[id] ? 'stroke-dasharray="3 2"' : ''}/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">${initials(agentById(id).nome)}</text></g>`; }).join('')}
      ${extra.length ? (() => { const [cx, cy] = agPos(shown.length); return `<g data-tip="${esc(extra.map(id => agentById(id).nome).join(', '))}"><circle cx="${cx}" cy="${cy}" r="9.5" fill="#1b2a44" stroke="#7fb4ee" stroke-width="1.5"/><text x="${cx}" y="${cy + 3.5}" text-anchor="middle" fill="#cfe0ff" font-size="10" font-weight="700">+${extra.length}</text></g>`; })() : ''}
      ${away.map((id, i) => `<text x="${z.x + z.w - 10}" y="${z.y + z.h - 8 - (nG && !short ? 20 : 0) - i * 13}" text-anchor="end" fill="#ff9aa7" font-size="11.5">✕ ${initials(agentById(id).nome)} ausente</text>`).join('')}
      ${gearIn(z.id).map((e, i) => `<g data-tip="${esc(EQ[e].nome + ': ' + EQ[e].dshort)}"><rect x="${z.x + z.w - 24 - i * 20}" y="${z.y + z.h - 24}" width="16" height="16" rx="3" fill="#0d1523" stroke="#4da6ff"/><text x="${z.x + z.w - 16 - i * 20}" y="${z.y + z.h - 12}" text-anchor="middle" fill="#4da6ff" font-size="10.5" font-weight="700">${EQ[e].nome[0]}</text></g>`).join('')}
    </g>`;
  });
  return s + '</svg>';
}
const legendHTML = () => `<div class="legend"><span><i style="background:#41d08f"></i>adequada (≥${ADEQ}%)</span><span><i style="background:#f6a623"></i>parcial (30–59%)</span><span><i style="background:#ff5468"></i>descoberta</span><span><i class="sq"></i>equipamento</span></div>`;

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
const saveLabel = s => s.phase === 'siege' ? 'rodada ' + s.round : s.phase === 'post' || s.phase === 'outcome' ? 'finalizada' : s.phase === 'recruit' ? 'recrutamento' : s.phase === 'perimeter' ? 'perímetro' : 'briefing';
function renderMenu() {
  const save = loadSave(), lost = SAVE_LOST; SAVE_LOST = false;
  const dcards = Object.entries(DIFF).map(([k, d]) => `
    <button class="diffcard" role="radio" data-act="diff" data-v="${k}" aria-checked="${UI.diffSel === k}" tabindex="${UI.diffSel === k ? 0 : -1}" data-tip="${d.slots} decisões e ${d.timer} segundos por rodada · eventos em ${Math.round(d.evChance * 100)}% das rodadas · ${d.ops === 1 ? 'plantão padrão' : 'plantão ' + (d.ops < 1 ? '−' : '+') + Math.round(Math.abs(1 - d.ops) * 100) + '%'}">
      <span class="dot" aria-hidden="true"></span>
      <span><b class="dname">${d.nome}</b><span class="dblurb">${d.blurb}</span></span>
      <span class="dparams">${d.slots} decisões<br>${d.timer} s</span>
    </button>`).join('');
  return `<div class="screen menu">
    <div class="sky">${skyline()}<i class="siren r"></i><i class="siren b"></i><i class="siren r2"></i><i class="siren b2"></i>
      <div class="titleblock"><div class="clock">SEXTA-FEIRA · 14H07 · PORTO ALTO</div><h1>PERÍMETRO</h1><p class="sub">Uma simulação de gestão de crise sob restrições</p></div>
    </div>
    <div class="menubody">
      <div class="grid">
        <div><div class="eyebrow" id="difflbl">Dificuldade</div><div class="diffs" role="radiogroup" aria-labelledby="difflbl" style="margin-top:8px">${dcards}</div></div>
        <div class="row"><button class="btn primary lg" data-act="start">Iniciar simulação</button>
          ${save ? `<button class="btn lg" data-act="continue">Continuar partida <span class="faint" style="font-weight:400">(${DIFF[save.diff].nome}, ${saveLabel(save)}${save.code ? ', turma ' + save.code : ''})</span></button>` : ''}
        </div>
        ${lost ? `<div class="insight warn" role="status">${icon('alert', '', 1.8)}<span>A partida salva neste navegador estava corrompida ou era de outra versão e foi descartada. Uma nova simulação começa do zero.</span></div>` : ''}
        <label class="check"><input type="checkbox" id="nolimit" data-chg="nolimit" ${UI.noLimit ? 'checked' : ''}><span>Sem limite de tempo (acessibilidade)</span></label>
        <div class="turma"><label for="turma">Código da turma</label><input type="text" id="turma" data-chg="turma" maxlength="16" value="${esc(UI.code)}" placeholder="opcional" autocomplete="off" autocapitalize="characters" spellcheck="false">${infoTip('', 'Para turmas: com o mesmo código, todas as equipes jogam o mesmo cenário e recebem as mesmas cartas de evento nas mesmas rodadas, o que torna as notas comparáveis. Com o mesmo código e as mesmas decisões, a partida se repete. Só letras e números contam. Em branco, cada partida é sorteada.')}</div>
      </div>
      <div class="card">
        <h2 class="h3">Sua missão</h2>
        <p class="serif" style="font-size:16.5px;line-height:1.6;color:#dfe6f1">Você comanda a resposta a um assalto com 17 reféns. Em 8 rodadas, equilibre <b>vidas</b>, <b>prisões</b>, <b>valores</b>, <b>custo</b> e <b>confiança pública</b>.</p>
        <div class="row" style="margin-top:12px"><button class="btn sm" data-act="howto">Como funciona</button><span class="faint" style="font-size:12.5px">25 a 40 min · salva sozinho</span></div>
        <p class="faint" style="font-size:12px;margin-top:14px">Uma crise com reféns vista por quem protege, sem imagens explícitas. Nomes, lugares e instituições são fictícios.</p>
      </div>
    </div>
    ${UI.tutor ? tutorModal() : ''}${UI.newConfirm && save ? newConfirmModal(save) : ''}
  </div>`;
}
function newConfirmModal(save) {
  return `<div class="modalback"><div class="tutor" role="dialog" aria-modal="true" aria-labelledby="nct">
    <h2 class="h3" id="nct">Iniciar uma nova partida?</h2>
    <p class="muted">Há uma partida salva neste navegador (${DIFF[save.diff].nome}, ${saveLabel(save)}). Começar uma nova apaga essa partida e não dá para desfazer.</p>
    <div class="row"><button class="btn primary" data-act="newyes">Apagar e iniciar</button><button class="btn" data-act="newno">Manter a partida salva</button><span class="faint" style="font-size:12px">Esc também cancela</span></div></div></div>`;
}
/* Voltar ao menu no meio da partida: a partida fica salva e o relógio da rodada fica parado (a janela não mostra confirm do navegador). */
function menuConfirmModal() {
  return `<div class="modalback"><div class="tutor" role="dialog" aria-modal="true" aria-labelledby="mct">
    <h2 class="h3" id="mct">Voltar ao menu?</h2>
    <p class="muted">A partida fica salva neste navegador e pode ser retomada em “Continuar partida”.${G && G.phase === 'siege' && G.stage === 'panel' && !G.noLimit ? ' O relógio desta rodada fica parado até você voltar.' : ''}</p>
    <div class="row"><button class="btn primary" data-act="menuyes">Voltar ao menu</button><button class="btn" data-act="menuno">Continuar jogando</button><span class="faint" style="font-size:12px">Esc também cancela</span></div></div></div>`;
}
const menuBtn = () => '<button class="btn sm ghost hudmenu" type="button" data-act="menu" title="Voltar ao menu (a partida fica salva)">Menu</button>' + somBtn();
const somBtn = () => `<button class="btn sm ghost hudsom" type="button" data-act="som" aria-pressed="${SOM.on}" aria-label="Trilha sonora" title="${SOM.on ? 'Desligar' : 'Ligar'} a trilha sonora">${icon(SOM.on ? 'som' : 'mudo')}</button>`;
/* Trilha ambiente (L2.5 refeita: o documento pede uma trilha que se intensifica conforme a agitação do líder). Só Web Audio, sem arquivos:
   um zumbido grave que abre o filtro com a tensão, um pulso que acelera e um chiado de rua que cresce. Começa desligada (o navegador só
   deixa tocar depois de um clique, e numa sala de aula o som é escolha de quem joga) e segue a agitação que o jogador enxerga, nunca a
   real. Cala no desfecho e na nota. A escolha fica guardada neste navegador: depois de recarregar, a trilha volta no primeiro clique.
   Sem Web Audio, o botão simplesmente não liga. */
const SOM = (() => {
  const PREF = 'perimetro_som';
  let ctx = null, n = null, on = false, alvo = -1, dorme = null;
  try { on = localStorage.getItem(PREF) === '1'; } catch (e) {}
  const guarda = () => { try { localStorage.setItem(PREF, on ? '1' : '0'); } catch (e) {} };
  function montar() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try {
      ctx = new AC(); const g = () => ctx.createGain(), f = (type, hz, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = hz; b.Q.value = q; return b; };
      const out = g(); out.gain.value = 0; out.connect(ctx.destination);
      const lp = f('lowpass', 180, 4), dz = g(); dz.gain.value = .3; dz.connect(lp); lp.connect(out);
      [55, 55.6, 82.4].forEach(hz => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.connect(dz); o.start(); });
      const pg = g(); pg.gain.value = 0; pg.connect(out);
      const po = ctx.createOscillator(); po.type = 'triangle'; po.frequency.value = 52; po.connect(pg); po.start();
      const lfo = ctx.createOscillator(), lg = g(); lfo.frequency.value = .7; lg.gain.value = 0; lfo.connect(lg); lg.connect(pg.gain); lfo.start();
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0, x = 7; i < len; i++) { x = Math.imul(x, 1103515245) + 12345 | 0; d[i] = (x >>> 9) / 4194304 - 1; }   // ruído fixo: o sorteio do jogo não é tocado
      const ns = ctx.createBufferSource(), bp = f('bandpass', 700, .8), ng = g(); ns.buffer = buf; ns.loop = true; ng.gain.value = 0; ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start();
      n = { out, lp, dz, pg, lfo, lg, bp, ng };
      return true;
    } catch (e) { ctx = null; n = null; return false; }
  }
  // intensidade de 0 a 1: no cerco, a agitação que o painel mostra; antes dele, um fundo baixo; no desfecho e na nota, silêncio
  const nivel = () => !G || G.phase === 'outcome' || G.phase === 'post' ? null : G.phase === 'siege' ? clamp(perceivedAgit().v / 100, 0, 1) : .15;
  function update() {
    if (!ctx || !n) return;
    const x = on ? nivel() : null, k = x == null ? -1 : Math.round(x * 50) / 50;
    if (k === alvo) return; alvo = k;
    const t = ctx.currentTime, set = (p, v, tc = 1.2) => p.setTargetAtTime(v, t, tc);
    if (k < 0) { set(n.out.gain, 0, .25); return; }
    set(n.out.gain, .2);
    set(n.dz.gain, .22 + .18 * k); set(n.lp.frequency, 150 + 850 * k * k);
    set(n.pg.gain, .45 * k); set(n.lg.gain, .45 * k); set(n.lfo.frequency, .7 + 1.3 * k);
    set(n.ng.gain, .015 + .1 * k); set(n.bp.frequency, 600 + 1200 * k);
  }
  // liga o áudio de fato (só dentro de um gesto do jogador): no botão, ou no primeiro clique depois de recarregar com a trilha escolhida
  function acorda() {
    if (on && !ctx && !montar()) on = false;
    if (on && ctx.state === 'suspended') ctx.resume().catch(() => {});
    alvo = -2; update();
  }
  function toggle() {
    on = !on; clearTimeout(dorme); acorda(); guarda();
    if (!on && ctx) dorme = setTimeout(() => { if (!on && ctx) ctx.suspend().catch(() => {}); }, 900);   // depois do fade, o áudio para de gastar CPU
    return on;
  }
  const gesto = e => { if (e.target && e.target.closest && e.target.closest('[data-act=som]')) return; if (on && (!ctx || ctx.state === 'suspended') && !document.hidden) acorda(); };
  document.addEventListener('pointerdown', gesto, true); document.addEventListener('keydown', gesto, true);
  const pausa = () => { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); };
  const retoma = () => { if (ctx && on && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  return { get on() { return on; }, get alvo() { return alvo; }, get estado() { return ctx ? ctx.state : 'sem-audio'; }, toggle, update, pausa, retoma };
})();
function tutorModal() {
  return `<div class="modalback"><div class="tutor" role="dialog" aria-modal="true" aria-labelledby="tutt">
    <h2 class="h3" id="tutt">Como funciona</h2>
    <p class="muted"><b>1. Recrute</b> a equipe com 1.000 créditos. O que sobrar paga o <b>plantão</b> de cada rodada e as ações do cerco.</p>
    <p class="muted"><b>2. Posicione</b> agentes e equipamentos nas 7 zonas. Quatro podem ser rotas de fuga, e você não sabe quais.</p>
    <p class="muted"><b>3. Comande</b> 8 rodadas: leia o painel e escolha 2 ou 3 ações em <b>Tática, Negociação, Inteligência e Comunicação</b>.</p>
    <p class="muted"><b>4. A crise termina</b> em rendição, intervenção, fuga ou ultimato. A nota pesa vidas (40%), prisões (20%), valores (15%), custo (10%) e confiança (15%). Mortes, intervenção fracassada ou entrada com menos de 50% de chance limitam a nota.</p>
    <p class="muted">Dicas: negocie um degrau de cada vez e passe o mouse sobre o nome de um agente para ver os atributos dele.</p>
    <p class="faint" style="font-size:12px">Para facilitadores: com um código da turma combinado no menu, todas as equipes jogam o mesmo cenário e recebem as mesmas cartas de evento, e as notas podem ser comparadas. Quem preferir não participar pode sair pelo Menu a qualquer momento; ofereça uma atividade alternativa.</p>
    <div class="row"><button class="btn primary" data-act="closehowto">Entendi</button><span class="faint" style="font-size:12px">Esc também fecha</span></div></div></div>`;
}

/* ===================================================================
   BRIEFING
   =================================================================== */
/* Manchetes em movimento contínuo: pausam com o mouse ou o foco, e o botão ❚❚ congela de vez (WCAG 2.2.2). */
function tickerHTML(items, label = 'AO VIVO') {
  const t = items.map(x => `<span>${x}</span>`).join('<i>◆</i>'), t2 = items.map(x => `<span class="d">${x}</span>`).join('<i class="d">◆</i>');   // a segunda cópia só existe para o letreiro dar a volta sem emenda
  return `<div class="ticker${UI.tkPause ? ' paused' : ''}" role="marquee" aria-label="Manchetes ao vivo: ${items.join('. ')}"><b>${label}</b><div class="tk"><div class="tkin" aria-hidden="true">${t}<i>◆</i>${t2}<i class="d">◆</i></div></div><button class="tkp" type="button" data-act="tkpause" aria-pressed="${UI.tkPause}" aria-label="${UI.tkPause ? 'Retomar' : 'Pausar'} as manchetes" title="${UI.tkPause ? 'Retomar' : 'Pausar'} as manchetes">${UI.tkPause ? '▶' : '❚❚'}</button></div>`;
}
function hostageStrip(cls = '') {
  return `<div class="hstrip ${cls}" aria-label="Os 17 reféns: ${HOSTAGE_LIST.map(h => h.nome).join(', ')}">${HOSTAGE_LIST.map((h, i) => `<span class="hp" style="--i:${i}" title="${h.nome}, ${h.idade} anos, ${h.papel}${h.nota ? ' (' + h.nota + ')' : ''}">${sil1()}<small>${h.nome.split(' ')[0]}</small></span>`).join('')}</div>`;
}
const sil1 = () => '<svg viewBox="0 0 20 26" aria-hidden="true"><circle cx="10" cy="7" r="5"/><path d="M1 26c0-7 4-11 9-11s9 4 9 11z"/></svg>';
function renderBriefing() {
  const w = [40, 20, 15, 10, 15], names = ['Vidas dos reféns', 'Prisão dos responsáveis', 'Valores recuperados', 'Custos operacionais', 'Confiança pública'];
  return `<div class="screen brief" data-act="skipbrief">
    ${tickerHTML(['URGENTE · Alarme dispara na Agência Central do Banco Meridiano, no centro de Porto Alto', 'Testemunhas falam em homens armados e clientes presos no interior', 'Polícia isola a Rua Marechal Deodoro; trânsito desviado', 'TV Porto Alto acompanha ao vivo'], 'URGENTE')}
    <h1 class="sr">Briefing: assalto com reféns na Agência Central</h1>
    <div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="day">Sexta-feira</div><div class="time">14h07</div></div><div class="row">${menuBtn()}<button class="btn sm ghost skipb" type="button" data-act="skipbrief">Pular animação</button></div></div>
    <div class="narr">
      <p>O alarme silencioso da Agência Central do Banco Meridiano acaba de disparar. Há homens armados lá dentro.</p>
      <p>Dezessete pessoas não podem sair: uma aposentada que veio pagar contas, um caixa de 24 anos, uma cliente grávida de sete meses.</p>
      <p>A TV já está na esquina e o delegado titular está de férias. <b>A partir de agora, todas as decisões são suas.</b></p>
    </div>
    <div class="after">
      <div class="eyebrow" style="margin-top:4px">Quem está lá dentro</div>
      ${hostageStrip()}
      <div class="eyebrow" style="margin-top:20px">Cinco objetivos em tensão</div>
      <div class="objgrid">${w.map((p, i) => `<div class="obj" style="--w:${p * 2.2}%"><b>${p}%</b><span>${names[i]}</span></div>`).join('')}</div>
      <div class="row" style="margin-top:26px"><button class="btn primary lg" data-act="tobrief">Assumir o comando</button></div>
    </div></div>`;
}

/* ===================================================================
   FASE 0 — RECRUTAMENTO
   =================================================================== */
/* Atributos em uma linha (abreviados); o nome por extenso fica na dica do agente. */
const ATTR3 = { tat: 'Tát', neg: 'Neg', int: 'Int', res: 'Res', com: 'Com' };
const miniAttrs = id => `<div class="mattrs" aria-label="${Object.keys(ATTR).map(k => ATTR[k] + ' ' + stat(id, k)).join(', ')}">${Object.keys(ATTR).map(k => `<span><small>${ATTR3[k]}</small><b>${stat(id, k)}</b><i style="--v:${stat(id, k) * 10}%"></i></span>`).join('')}</div>`;
function renderRecruit() {
  const agents = AGENTS.map(a => {
    const on = G.team.includes(a.id), can = on || G.credits >= a.custo;
    return `<button class="acard" data-act="hire" data-id="${a.id}" aria-pressed="${on}" ${can ? '' : `aria-disabled="true" data-why="Faltam ${fmt(a.custo - G.credits)} créditos para chamar ${a.nome}. Dispense alguém ou um equipamento para liberar verba."`}>
      <div class="top" data-ag="${a.id}"><div class="sil">${sil(a.id, 40)}</div><div><b class="an">${a.nome}</b><span class="faint" style="font-size:12px">${a.trait}</span></div><span class="cost">${a.custo}</span></div>
      ${miniAttrs(a.id)}
      <p class="teff">${a.tshort}</p>
      ${on ? '<span class="cfoot on">✓ Na equipe</span>' : can ? '' : `<span class="cfoot no">Faltam ${fmt(a.custo - G.credits)} créditos</span>`}</button>`;
  }).join('');
  const warns = [], F = budgetForecast(), cap = capacityPreview();
  if (G.team.length && !G.team.some(id => stat(id, 'neg') >= 7)) warns.push('Nenhum negociador forte (7+): a negociação será lenta.');
  if (G.team.length && F.free < 0) warns.push(`A reserva não paga o plantão até o fim (faltam ~${Math.round(-F.free)}).`);
  else if (G.team.length && F.free < 60) warns.push('Quase nada sobra para o cerco depois do plantão.');
  if (G.team.length && cap.adq <= 1) warns.push(`Espalhada, esta equipe cobre bem só ${cap.adq} de 7 zonas.`);
  const cam = G.team.includes('camila') ? `<div class="card flat"><h3 data-ag="camila">Camila Araújo · Versátil</h3><div class="row" style="gap:8px">
    <label class="field">+1 em<select data-chg="camplus" id="camplus">${Object.keys(ATTR).map(k => `<option value="${k}" ${G.camAdj.plus === k ? 'selected' : ''}>${ATTR[k]}</option>`).join('')}</select></label>
    <label class="field">−1 em<select data-chg="camminus" id="camminus">${Object.keys(ATTR).map(k => `<option value="${k}" ${G.camAdj.minus === k ? 'selected' : ''}>${ATTR[k]}</option>`).join('')}</select></label></div></div>` : '';
  const resCol = G.credits < 150 ? 'var(--red)' : G.credits < 350 ? 'var(--amber)' : 'var(--green)';
  setBar(recruitBar());
  return `<div class="screen">
    <div class="hud"><div class="hudrow"><span class="brand">PERÍMETRO</span>${menuBtn()}<span class="pill">Recrutamento</span><span class="spacer"></span><div class="stat"><small>Créditos</small><b style="color:var(--amber)" data-k="cred" data-n="${Math.round(G.credits)}">${fmt(G.credits)}</b></div></div></div>
    <div class="recr">
      <div class="grid" style="gap:18px">
        <div><h1 class="ptitle">Monte sua força-tarefa</h1><p class="muted" style="margin-bottom:12px"><span class="mono">14h12</span>. Mil créditos para a equipe e os equipamentos; quem você chamar chega em 15 minutos. O que sobrar paga o cerco.</p><div class="agents">${agents}</div></div>
        <div id="equip" class="anchor"><h2 class="eyebrow">Equipamentos</h2><div class="gear" style="margin-top:8px;grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${EQUIPMENT_HTML()}</div></div>
      </div>
      <aside class="side">
        <div class="card"><h3>Orçamento</h3><div class="credits num" data-k="cred2" data-n="${Math.round(G.credits)}">${fmt(G.credits)}</div>
          <div class="stack" style="margin-top:10px" role="img" aria-label="Equipe ${G.spent.rec}, equipamento ${G.spent.equip}, reserva ${G.credits}"><i style="width:${G.spent.rec / 10}%;background:var(--blue)"></i><i style="width:${G.spent.equip / 10}%;background:var(--violet)"></i><i style="width:${G.credits / 10}%;background:${resCol}"></i></div>
          <div class="stackleg"><span><i style="background:var(--blue)"></i>Equipe <b class="mono">${G.spent.rec}</b></span><span><i style="background:var(--violet)"></i>Equipamento <b class="mono">${G.spent.equip}</b></span><span><i style="background:${resCol}"></i>Reserva <b class="mono">${fmt(G.credits)}</b></span></div>
          ${G.team.length ? `<div style="margin-top:10px"><div class="fc"><span>Plantão</span><b class="mono">~${F.per}/rodada</b></div>
          <div class="fc ${F.free < 0 ? 'bad' : F.free < 60 ? 'warn' : 'ok'}"><span>Sobra para o cerco</span><b class="mono">${F.free < 0 ? '−' + Math.round(-F.free) : Math.round(F.free)}</b></div>
          <div class="fc ${cap.adq >= 3 ? 'ok' : cap.adq === 2 ? 'warn' : 'bad'}"><span>Cobertura possível</span><b class="mono">${cap.adq} / 7 zonas</b></div></div>` : ''}</div>
        <div class="card"><h3>Equipe (${G.team.length})</h3>
          ${G.team.length || G.gear.length ? `<div>${G.team.map(id => `<div class="mini"><span data-ag="${id}">${shortName(agentById(id).nome)}</span><span class="mono">${agentById(id).custo}</span></div>`).join('')}${G.gear.map(id => `<div class="mini"><span>${EQ[id].nome}</span><span class="mono">${EQ[id].custo}</span></div>`).join('')}</div>` : '<p class="faint" style="font-size:12.5px">Ninguém ainda. Clique num agente para chamá-lo.</p>'}
          ${warns.map(w => `<div class="insight warn" style="margin-top:8px">${icon('alert', '', 1.8)}<span>${w}</span></div>`).join('')}</div>
        ${cam}
      </aside>
    </div></div>`;
}
function EQUIPMENT_HTML() {
  return EQUIP.map(e => {
    const on = G.gear.includes(e.id), can = on || G.credits >= e.custo;
    return `<button class="gcard hastip" data-act="buygear" data-id="${e.id}" aria-pressed="${on}" ${can ? '' : `aria-disabled="true" data-why="Faltam ${fmt(e.custo - G.credits)} créditos para ${e.nome}."`}>${icon(e.ic)}<span><b>${e.nome}</b><span>${e.dshort}</span>${on ? '<span class="cfoot on">✓ Comprado</span>' : can ? '' : `<span class="cfoot no">Faltam ${fmt(e.custo - G.credits)} créditos</span>`}</span><span class="cost mono">${e.custo}</span><span class="tipc"><b>${e.nome}</b><br>${e.desc}</span></button>`;
  }).join('');
}
/* Barra de ação do recrutamento: o resumo e o próximo passo sempre à vista. */
function recruitBar() {
  const empty = !G.team.length;
  return `<div class="absum"><span class="abk">Sua força-tarefa</span><span><b class="mono">${G.team.length}</b> ${plural(G.team.length, 'agente', 'agentes')} · <b class="mono">${G.gear.length}</b> ${plural(G.gear.length, 'equipamento', 'equipamentos')} · reserva <b class="mono" style="color:var(--amber)">${fmt(G.credits)}</b></span></div>
    ${UI.emptyConfirm && empty ? `<p class="abmsg bad">${icon('alert', 'ico', 1.8)}Sem agentes, a guarnição local improvisa dois patrulheiros fracos. Seguir assim?</p>` : '<span class="spacer"></span>'}
    <button class="btn primary lg" data-act="torecruit">${UI.emptyConfirm && empty ? 'Sim, seguir sem equipe' : 'Posicionar a equipe →'}</button>`;
}

/* ===================================================================
   FASE 1 — PERÍMETRO
   =================================================================== */
function chipHTML(kind, id) {
  const sel = UI.sel && UI.sel.t === kind && UI.sel.id === id;
  if (kind === 'a') { const a = agentById(id); return `<button class="chip" data-act="selchip" data-t="a" data-id="${id}" data-ag="${id}" aria-pressed="${!!sel}"><span class="in">${initials(a.nome)}</span>${shortName(a.nome).replace(/^(Cap\.|Sgt\.|Det\.|Neg\.|Ag\.)\s*/, '')} · T${stat(id, 'tat')}</button>`; }
  return `<button class="chip" data-act="selchip" data-t="g" data-id="${id}" aria-pressed="${!!sel}" data-tip="${esc(EQ[id].nome + ': ' + EQ[id].dshort)}">${icon(EQ[id].ic, 'ico" style="width:16px;height:16px')}${EQ[id].nome}</button>`;
}
function renderPerimeter() {
  const reserveA = G.team.filter(id => (G.az[id] || 'reserva') === 'reserva'), reserveG = G.gear.filter(id => (G.gz[id] || 'reserva') === 'reserva');
  const adq = adequateCount(), adqCol = adq >= 4 ? 'green' : adq >= 3 ? 'amber' : 'red';
  const intel = INTEL.filter(i => i.fase1).map(i => {
    const r = G.p1intel[i.id], done = r && typeof r === 'object', c = intelCost(i.id), can = G.credits >= c;
    return `<div class="icard ${done && r.ok ? 'done' : ''}"><b>${icon(i.ic, 'ico" style="width:18px;height:18px;vertical-align:-4px;margin-right:6px')}${i.nome}</b><p>${i.desc}</p>
      ${done ? dossierHTML(r) : `<button class="btn sm" data-act="p1intel" data-id="${i.id}" ${can ? '' : `aria-disabled="true" data-why="Faltam ${fmt(c - G.credits)} créditos para esta investigação."`}>Investigar · ${c} créditos</button>${can ? '' : `<small class="unav">Faltam ${fmt(c - G.credits)} créditos</small>`}`}</div>`;
  }).join('');
  /* Lista compacta: só as zonas ocupadas (o mapa já mostra a cobertura de todas). É por ela que se pega quem já está posicionado. */
  const zrows = ZONES.filter(z => agentsIn(z.id).length || gearIn(z.id).length || UI.sel).map(z => {
    const cov = zoneCoverage(z.id), cc = covCls(cov) === 'g' ? 'green' : covCls(cov) === 'a' ? 'amber' : 'red';
    return `<div class="zrow ${UI.pickZone === z.id ? 'sel' : ''}"><span class="nm">${z.nome}</span><span class="cv" style="color:var(--${cc})">${cov}%</span>
      <div class="chips">${agentsIn(z.id).map(id => chipHTML('a', id)).join('')}${gearIn(z.id).map(id => chipHTML('g', id)).join('')}${UI.sel ? `<button class="btn sm" data-act="place" data-z="${z.id}">Posicionar aqui</button>` : ''}</div></div>`;
  }).join('');
  const selName = UI.sel ? (UI.sel.t === 'a' ? agentById(UI.sel.id).nome : EQ[UI.sel.id].nome) : '';
  setBar(`<div class="absum"><span class="abk">Perímetro</span><span><b class="mono" style="color:var(--${adqCol})">${adq} de 7</b> zonas adequadas</span></div>
    <span class="spacer"></span><button class="btn" data-act="autoplace">Distribuição automática</button><button class="btn primary lg" data-act="tosiege">Iniciar o cerco →</button>`);
  return `<div class="screen">
    <div class="hud"><div class="hudrow"><span class="brand">PERÍMETRO</span>${menuBtn()}<span class="pill">Posicionamento</span><span class="spacer"></span>
      <div class="stat"><small>Zonas adequadas</small><b style="color:var(--${adqCol})">${adq} / 7</b></div>
      <div class="stat"><small>Plantão</small><b>−${plantaoCost()}/rod.</b></div>
      <div class="stat"><small>Créditos</small><b style="color:var(--amber)" data-k="cred" data-n="${Math.round(G.credits)}">${fmt(G.credits)}</b></div></div></div>
    <div class="perim">
      <div class="grid">
        <div><h1 class="ptitle">Posicione a equipe</h1>
          <p class="muted" style="margin-bottom:10px">Selecione um agente ou equipamento e clique numa zona. Quatro zonas podem ser rotas de fuga.</p>
          ${UI.sel ? `<div class="target" role="status">${icon('map', 'ico', 1.8)}<span>Posicionando <b>${selName}</b>: clique na zona de destino. <kbd>Esc</kbd> cancela.</span></div>` : ''}
          <div class="mapwrap">${mapSVG({ interactive: true, sel: UI.pickZone, targeting: !!UI.sel })}${legendHTML()}</div></div>
        <div><h2 class="eyebrow">Investigar antes do cerco</h2><div class="intelgrid" style="margin-top:8px">${intel}</div></div>
      </div>
      <aside class="side">
        <div class="card"><h2 class="h3">Reserva <span class="pill">${reserveA.length} ${plural(reserveA.length, 'agente', 'agentes')}</span></h2>
          <div class="row" style="gap:6px">${reserveA.map(id => chipHTML('a', id)).join('') || '<span class="faint" style="font-size:12.5px">Todos posicionados.</span>'}${reserveG.map(id => chipHTML('g', id)).join('')}</div>
          ${UI.sel ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-act="place" data-z="reserva">Devolver à reserva</button></div>` : '<p class="faint" style="font-size:12.5px;margin-top:8px">Na reserva, o agente descansa e não custa plantão, mas não cobre zona.</p>'}</div>
        ${zrows ? `<div class="card"><h2 class="h3">Em campo</h2><div class="zlist">${zrows}</div></div>` : ''}
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
  return `<div class="cut" role="dialog" aria-modal="true" aria-labelledby="cutt"><div class="cutin">
    <div class="time">${c.time}</div><h2 id="cutt">${c.title}</h2>
    ${c.lines.map((l, i) => `<p class="${l.radio ? 'radio-q' : ''}" style="animation-delay:${.5 + i * .9}s">${l.t}</p>`).join('')}
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn primary lg" data-act="cutgo" style="animation-delay:${.6 + c.lines.length * .9}s">${c.btn}</button></div></div></div>`;
}
