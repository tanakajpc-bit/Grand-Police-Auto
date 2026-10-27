// L2.5: três partidas completas, jogadas pelo motor real e anotadas rodada a rodada.
//   1. Protocolar + líder Calculista + estratégia negociadora
//   2. Complexo   + líder Volátil    + estratégia agressiva
//   3. Caótico    + líder Desesperado + estratégia equilibrada
// Em cada rodada o programa anota o estado de entrada, as decisões, a negociação (as onze parcelas da chance de avanço), a agitação, a mídia,
// o cofre, o plantão, os stakeholders, o evento e o desfecho. Cada número que o motor produz é refeito do zero (só a partir do estado e das
// fórmulas do projeto, sem chamar as funções do motor) e comparado: o que divergir sai marcado com ✗ e a saída do programa é diferente de zero.
// A semente de cada partida é a primeira que dá o perfil pedido E dura o bastante para ter o que anotar (critério dito no cabeçalho do arquivo
// gerado; sem escolha de resultado: nota, desfecho e mortos são o que a semente deu).
// uso: node tools/sim/partidas.js [saida.md]
const fs = require('fs');
const B = require('./bots');
const A = B.load(1);
const OUT = process.argv[2];
const out = [];
const P = (...s) => out.push(s.join(''));
const f = (x, d = 1) => Number(x).toFixed(d).replace('.', ',');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sum = a => a.reduce((s, x) => s + x, 0);
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const T = { falhas: 0, total: 0 };
let rodada = [];
function ck(ok, rotulo, det) { T.total++; if (!ok) T.falhas++; rodada.push({ ok, rotulo, det }); }
const ZN = id => (id === 'reserva' ? 'Reserva' : A.ZONE[id].curto);
const NM = id => A.agentById(id).nome.replace(/^(Cap\.|Sgt\.|Det\.|Neg\.|Ag\.)\s*/, '');

/* ---------- as fórmulas do projeto, refeitas só com o estado ---------- */
function X(G) {
  const D = A.DIFF[G.diff], Pf = A.PROFILES[G.profile];
  const away = id => (G.away[id] || 0) > 0;
  const pressao = () => clamp(Math.round(D.pbase + G.media * .22 + G.agit * .18 + G.round * 2.5 + G.hostages.hurt * 3 + G.hostages.dead * 8 + (G.fatCrit ? 5 : 0) + (G.deadlineLeft > 0 ? 4 : 0) + (G.stk.familias.lost ? 6 : 0) + G.stress - G.calm), 0, 100);
  const agente = id => {
    const res = A.stat(id, 'res'), tat = A.stat(id, 'tat');
    const pa = clamp(G.pressure * (1.3 - .06 * res), 0, 100), fpv = clamp(-Math.pow(pa / 50 - 1, 2) + 1, 0, 1);
    const fat = G.fat[id] || 0, taxa = id === 'marcos' ? .05 : .1, ffv = Math.max(.3, 1 - taxa * fat * (1.5 - .1 * res) * D.fat);
    let e = tat * fpv * ffv; const tr = +G.transit[id] || 0;
    if (tr >= 2) e *= .5; else if (tr === 1) e *= .75;
    if (G.fatCrit && fat >= 2 && id !== 'marcos') e *= .85;
    return { id, tat, res, pa, fpv, fat, ffv, tr, e };
  };
  const emZona = z => G.team.filter(id => G.az[id] === z && !away(id));
  const gearEm = z => G.gear.filter(e => G.gz[e] === z);
  const zona = z => {
    const ags = emZona(z).map(agente), n = gearEm(z).length, fe = n >= 2 ? 1.6 : n === 1 ? 1.3 : 1;
    let cov = sum(ags.map(a => a.e * fe)) * 10; const extra = [];
    if (gearEm(z).includes('drone')) { cov += 15; extra.push('drone +15'); }
    if (gearEm(z).includes('sniper') && ags.length) { cov += 20; extra.push('sniper +20'); }
    const sp = G.support[z]; if (sp && sp.left > 0) { cov += sp.v; extra.push(`apoio +${sp.v}`); }
    if (G.exposed > 0) { cov *= .9; extra.push('exposição ×0,9'); }
    return { z, ags, fe, extra, cov: clamp(Math.round(cov), 0, 100) };
  };
  const covRotas = () => sum(G.routes.map(z => zona(z).cov)) / 4;
  const negociador = () => {
    const n = G.nego.negotiator;
    if (n && G.team.includes(n) && !away(n)) return n;
    return G.team.filter(id => !away(id)).sort((x, y) => A.stat(y, 'neg') - A.stat(x, 'neg'))[0] || null;
  };
  const habilidade = () => { const id = negociador(); if (!id) return 2.7; const a = agente(id); return A.stat(id, 'neg') * Math.max(a.fpv, D.negoFloor || 0) * a.ffv; };
  const partes = tech => {
    const d = G.nego.step, id = negociador(), skill = habilidade(), compat = tech === d, skip = tech > d, kind = A.POSTURES[tech - 1].kind;
    const parts = {
      base: .15 * skill * D.lev, postura: compat ? .20 : skip ? -.25 : 0, rapport: .05 * d, negofone: G.gear.includes('negofone') ? .10 : 0,
      traco: (id === 'paulo' && tech <= 3 ? .10 : 0) + (id === 'andre' ? -.12 : 0), perfil: (Pf.mult[kind] - 1) * .15, info: G.K.profile ? .06 : 0,
      batna: .10 * covRotas() / 100, canal: G.gear.includes('jammer') ? .06 : 0, agitacao: -Math.max(0, G.agit - 50) * .006, lider: -D.dist
    };
    let raw = sum(Object.values(parts)); if (skip) raw *= .5;
    return { parts, raw, p: clamp(raw, .02, .95), skill, compat, skip, id };
  };
  const calma = (tech, stepDepois) => { const kind = A.POSTURES[tech - 1].kind, id = negociador(); let m = Pf.mult[kind]; if (id === 'paulo' && tech <= 3) m *= 1.2; return 3 * stepDepois * m * (D.ncalm || 1); };
  return { D, Pf, away, pressao, agente, emZona, gearEm, zona, covRotas, negociador, partes, calma };
}

/* ---------- pontuação refeita ---------- */
function pontuacao(G) {
  const H = G.hostages, E = G.end, w = { imprensa: .20, prefeito: .25, banco: .25, familias: .30 };
  if (H.hurt + H.dead > 0) { w.familias += .10; w.banco -= .08; }
  if (G.round >= 6) w.prefeito += .08;
  const t = sum(Object.values(w)); Object.keys(w).forEach(k => { w[k] /= t; });
  const vidas = clamp(1 - (2.5 * H.dead + .5 * H.hurt) / 17, 0, 1), captura = clamp(E.captured, 0, 1), valores = clamp(1 - E.lootF * G.vault / 100, 0, 1);
  const efic = clamp(.6 * Math.min(1, Math.max(0, G.credits) / 1000) + .4 * (1 - (G.round - 1) / 8 * .8), 0, 1);
  const conf = clamp(sum(Object.keys(w).map(k => G.stk[k].sat * w[k])) / 100, 0, 1);
  const raw = Math.min(100, (vidas * .40 + captura * .20 + valores * .15 + efic * .10 + conf * .15) * 100);
  const penal = 10 * (E.agentsHurt ? E.agentsHurt.length : 0);
  const falhou = (E.type === 'intervencao' && E.variant === 'fracasso') || (E.type === 'prazo' && E.sub === 'fracasso');
  const aposta = E.type === 'intervencao' && !E.forced && E.P < .5;
  const tetos = []; if (H.dead >= 1) tetos.push([H.dead >= 4 ? 49 : H.dead >= 2 ? 64 : 79, 'mortes']); if (falhou) tetos.push([49, 'fracasso']); if (aposta) tetos.push([89, 'aposta']);
  tetos.sort((a, b) => a[0] - b[0]); const cap = tetos.length ? tetos[0][0] : 100;
  const total = Math.round(Math.max(0, Math.min(raw, cap) - penal) * 10) / 10;
  const nota = total >= 90 ? 'S' : total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : total >= 35 ? 'D' : 'F';
  return { w, vidas, captura, valores, efic, conf, raw, penal, cap, capWhy: tetos.length ? tetos[0][1] : null, total, nota };
}

/* ---------- achar a semente: perfil pedido e partida longa o bastante ---------- */
function achaSemente(diff, perfil, mkPol, minRodadas, tipo) {
  for (let s = 1; s < 20000; s++) {
    A.reseed(s); A.newGame(diff); if (A.G.profile !== perfil) continue;
    const r = B.playGame(A, diff, mkPol(), s);
    if (r.round >= minRodadas && (!tipo || r.type === tipo)) return { seed: s, r };
  }
  throw new Error('sem semente para ' + diff + '/' + perfil);
}

/* ---------- uma partida anotada ---------- */
function joga(titulo, diff, perfil, mkPol, estrategia, minRodadas, tipo) {
  const { seed, r: seco } = achaSemente(diff, perfil, mkPol, minRodadas, tipo), pol = mkPol();
  A.reseed(seed); A.newGame(diff);
  const G = A.G, X0 = X(G), D = X0.D, Pf = X0.Pf;
  P(`## ${titulo}`); P('');
  P(`Semente ${seed} (a primeira que dá líder ${Pf.nome} e dura pelo menos ${minRodadas} rodadas${tipo ? ', terminando em ' + tipo : ''}). Dificuldade ${D.nome}; estratégia ${estrategia}.`); P('');
  P('### O que o jogador não vê (a verdade sorteada)'); P('');
  P(`- Líder: **${Pf.nome}** (agitação inicial ${G.agit}: base ${Pf.start} ${diff === 'caotico' ? '+5 do Caótico' : diff === 'protocolar' ? '−5 do Protocolar' : 'sem ajuste'}; deriva ${Pf.base >= 0 ? '+' : ''}${Pf.base} por rodada; multiplicadores empatia ${f(Pf.mult.emp)} e razão ${f(Pf.mult.rat)}).`);
  P(`- Rotas candidatas: ${G.routes.map(z => (z === G.route ? '**' + ZN(z) + '** (a real)' : ZN(z))).join(', ')}. Armados: ${G.assail}. Cúmplice externo: ${G.accomplice ? 'sim' : 'não'}.`);
  P(`- Cofre começa em ${G.vault}%; mídia ${G.media}; pressão da equipe ${G.pressure}; créditos ${G.credits}; stakeholders em ${D.stk}.`);
  rodada = []; ck(G.agit === Pf.start + (diff === 'caotico' ? 5 : diff === 'protocolar' ? -5 : 0), 'agitação inicial = base do perfil + ajuste da dificuldade'); ck(G.pressure === X0.pressao(), 'pressão inicial = fórmula');
  // recrutamento e perímetro
  pol.setup(A);
  P(''); P('### Recrutamento e perímetro'); P('');
  const custoEq = sum(G.gear.map(e => A.EQUIP.find(x => x.id === e).custo)), custoAg = sum(G.team.map(id => A.agentById(id).custo));
  const p1 = Object.keys(G.p1intel).filter(k => G.p1intel[k]), custoP1 = sum(p1.map(k => Math.round(A.INTEL.find(i => i.id === k).custo * (G.team.includes('sofia') ? .8 : 1))));
  P(`- Equipe: ${G.team.map(id => `${NM(id)} (${A.agentById(id).custo})`).join(', ') || '—'} = ${custoAg} créditos.`);
  P(`- Equipamento: ${G.gear.map(e => `${A.EQUIP.find(x => x.id === e).nome} (${A.EQUIP.find(x => x.id === e).custo})`).join(', ') || '—'} = ${custoEq} créditos.`);
  P(`- Inteligência antes do cerco: ${p1.length ? p1.map(k => `${A.INTEL.find(i => i.id === k).nome} (${typeof G.p1intel[k] === 'object' ? (G.p1intel[k].ok ? 'confirmada' : 'inconclusiva') : '?'})`).join(', ') + ' = ' + custoP1 + ' créditos' : 'nenhuma'}.`);
  P(`- Conta: 1.000 − ${custoAg} − ${custoEq} − ${custoP1} = ${1000 - custoAg - custoEq - custoP1}; o motor tem ${G.credits}.`);
  ck(G.credits === 1000 - custoAg - custoEq - custoP1, 'créditos após o recrutamento = 1.000 − equipe − equipamento − inteligência');
  ck(G.spent.rec === custoAg && G.spent.equip === custoEq, 'gastos registrados por categoria batem');
  A.G.pressure = A.calcPressure();
  A.confirmPerimeter(); G.phase = 'siege';
  const X1 = X(G);
  P(`- Posições: ${G.team.map(id => `${NM(id)} → ${ZN(G.az[id])}`).join('; ')}${G.gear.length ? '. Equipamentos: ' + G.gear.map(e => `${e} → ${ZN(G.gz[e])}`).join('; ') : ''}.`);
  P(`- Cobertura inicial por zona: ${A.ZONES.map(z => `${z.curto} ${A.zoneCoverage(z.id)}%${G.routes.includes(z.id) ? '★' : ''}`).join(' · ')} (★ rota candidata; a real é ${ZN(G.route)}).`);
  A.ZONES.forEach(z => ck(A.zoneCoverage(z.id) === X1.zona(z.id).cov, `cobertura inicial de ${z.curto}`, `${A.zoneCoverage(z.id)} × ${X1.zona(z.id).cov}`));
  (G.perimLog || []).forEach(l => P(`- ${l}`));
  fecha('Conferência do perímetro'); P('');
  A.startRound();
  const rounds = [];
  let guard = 0;
  while (!G.end && guard++ < 12) rounds.push(rodadaAnotada(pol, X));
  P('### Desfecho e pontuação'); P('');
  desfecho(G);
  rodada = []; ck(G.score.total === seco.score && G.end.type === seco.type && G.round === seco.round, 'a partida anotada é a mesma da busca da semente (mesma nota, desfecho e rodada)', `${G.score.total} × ${seco.score}`);
  fecha('Reprodutibilidade');
  const resumo = { titulo, seed, diff, perfil: Pf.nome, tipo: G.end.type + (G.end.variant ? ':' + G.end.variant : ''), round: G.round, total: G.score.total, nota: G.score.grade, mortos: G.hostages.dead, feridos: G.hostages.hurt };
  return resumo;
}

function fecha(titulo) {
  const bad = rodada.filter(c => !c.ok), n = rodada.length;
  P(`**${titulo}:** ${n - bad.length} de ${n} conferências batem${bad.length ? '. DIVERGÊNCIAS: ' + bad.map(b => `✗ ${b.rotulo}${b.det ? ' (' + b.det + ')' : ''}`).join('; ') : ' ✓'}.`);
  rodada = [];
}

function rodadaAnotada(pol, X) {
  const G = A.G, x = X(G), D = x.D, Pf = x.Pf, r = G.round, up = G.update;
  rodada = [];
  P(`### Rodada ${r} · ${A.fmtTime(r)}`); P('');
  // estado de entrada
  const pre = { credits: G.credits, agit: G.agit, media: G.media, vault: G.vault, pressure: G.pressure, step: G.nego.step, stk: Object.fromEntries(A.STK_KEYS.map(k => [k, { sat: G.stk[k].sat, sem: G.stk[k].sem }])), H: Object.assign({}, G.hostages) };
  P(`**Entrada.** Créditos ${Math.round(G.credits)} · agitação ${f(G.agit)} · mídia ${f(G.media)} · cofre ${f(G.vault)}% · pressão da equipe ${G.pressure} · degrau ${G.nego.step} · reféns ${G.hostages.inside - G.hostages.hurt - G.hostages.dead} ilesos / ${G.hostages.hurt} feridos / ${G.hostages.dead} mortos · confiança: ${A.STK_KEYS.map(k => `${A.STK[k].nome} ${Math.round(G.stk[k].sat)}${G.stk[k].sem ? ` (${G.stk[k].sem} sem atenção)` : ''}`).join(', ')}.`);
  ck(G.pressure === x.pressao(), 'pressão da equipe = pbase + 0,22·mídia + 0,18·agitação + 2,5·rodada + 3·feridos + 8·mortos + crítica + prazo + famílias + estresse − calma', `${G.pressure} × ${x.pressao()}`);
  if (up.intel.length) P(`**Inteligência que chegou:** ${up.intel.map(i => `${i.nome} — ${i.ok ? i.text : 'inconclusiva'}`).join(' | ')}`);
  if (up.reports.length) P(`**Relatos de campo:** ${up.reports.map(rp => `${ZN(rp.z)} (${rp.kind === 'rota' ? 'sinal real' : rp.kind === 'ruido' ? 'ruído' : 'interior'}, confiança ${rp.conf})`).join('; ')}.`);
  if (up.hint) P(`**Intuição da veterana:** ${up.hint}`);
  P(`**Gargalo da rodada (Teoria das Restrições):** ${{ info: 'informação', pessoal: 'pessoal tático', tempo: 'tempo e fadiga' }[up.toc]}.`);
  // equipe
  const ags = G.team.map(id => x.agente(id));
  P(''); P('| Agente | Zona | Tát | Res | Pressão do agente | Fator pressão | Rodadas sem descanso | Fator fadiga | Eficiência |'); P('| --- | --- | --: | --: | --: | --: | --: | --: | --: |');
  ags.forEach(a => {
    P(`| ${NM(a.id)}${x.away(a.id) ? ' (reconvocado)' : ''} | ${ZN(G.az[a.id])}${a.tr ? ` (trânsito ${a.tr})` : ''} | ${a.tat} | ${a.res} | ${f(a.pa)} | ${f(a.fpv, 3)} | ${f(a.fat, 1)} | ${f(a.ffv, 3)} | ${f(a.e, 2)} |`);
    ck(near(A.agentEff(a.id), a.e, 1e-9), `eficiência de ${NM(a.id)} = tát × fator de pressão × fator de fadiga`, `${f(A.agentEff(a.id), 4)} × ${f(a.e, 4)}`);
    ck(near(A.fp(a.id), a.fpv, 1e-9) && near(A.ff(a.id), a.ffv, 1e-9), `fatores de ${NM(a.id)}`);
  });
  const zonas = A.ZONES.map(z => x.zona(z.id));
  P(''); P(`**Cobertura** (Σ eficiência × fator de equipamento × 10, mais bônus, limitada a 0–100): ${zonas.map(z => `${A.ZONE[z.z].curto} ${z.cov}%${G.routes.includes(z.z) ? '★' : ''}${z.ags.length ? ` [${z.ags.map(a => f(a.e, 2)).join('+')}]×${f(z.fe, 1)}${z.extra.length ? ' ' + z.extra.join(' ') : ''}` : ''}`).join(' · ')}. Cobertura média das quatro rotas candidatas (o BATNA): ${f(x.covRotas())}%.`);
  zonas.forEach(z => ck(A.zoneCoverage(z.z) === z.cov, `cobertura de ${A.ZONE[z.z].curto}`, `${A.zoneCoverage(z.z)} × ${z.cov}`));
  // decisões
  pol.decide(A, r);
  const q = G.queue.map(d => Object.assign({}, d));
  P(''); P(`**Decisões** (${q.length} de ${D.slots} vagas): ${q.map(d => rotuloDecisao(d)).join('; ') || 'nenhuma'}.`);
  const custoFila = sum(q.map(d => d.cost || 0));
  const creditosPre = G.credits;
  ck(creditosPre === pre.credits - custoFila, 'créditos descontam o custo de cada decisão ao agendar', `${creditosPre} × ${pre.credits - custoFila}`);
  // negociação antes de resolver
  const nd = q.find(d => d.kind === 'nego'); let np = null, xp = null;
  if (nd && nd.p.tech !== 'press') {
    np = A.negoParts(nd.p.tech); xp = x.partes(nd.p.tech);
    const nomes = { base: 'habilidade×lev', postura: 'postura', rapport: 'rapport', negofone: 'negofone', traco: 'traço', perfil: 'perfil', info: 'perfil conhecido', batna: 'BATNA (rotas)', canal: 'canal único', agitacao: 'agitação', lider: 'desconfiança do líder' };
    P(`**Negociação:** ${xp.id ? NM(xp.id) : 'o comandante'} (habilidade ${f(xp.skill, 2)}) tenta **${A.POSTURES[nd.p.tech - 1].nome}** no degrau ${G.nego.step}${xp.compat ? ' (compatível: +0,20)' : xp.skip ? ' (pulando etapa: −0,25 e o total pela metade)' : ' (abaixo do degrau: neutra)'}. Parcelas: ${Object.entries(xp.parts).filter(([, v]) => v).map(([k, v]) => `${nomes[k]} ${v >= 0 ? '+' : '−'}${f(Math.abs(v), 3)}`).join(' · ')}; soma ${f(xp.raw, 3)}${xp.skip ? ' (×0,5 depois da soma)' : ''} → chance de avanço **${f(xp.p * 100)}%**.`);
    ck(near(np.p, xp.p, 1e-9), 'chance de avanço = soma das parcelas, limitada a 2–95%', `${f(np.p, 4)} × ${f(xp.p, 4)}`);
    Object.keys(xp.parts).forEach(k => ck(near(np.parts[k], xp.parts[k], 1e-9), `parcela ${k}`, `${np.parts[k]} × ${xp.parts[k]}`));
  } else if (nd) P(`**Negociação:** pressão (ultimato). Foi lida como ameaça: +${Pf.press} de agitação.`);
  else P('**Negociação:** nenhuma nesta rodada (o canal fica em silêncio e o degrau não se move).');
  const hurt0 = G.hostages.hurt, dead0 = G.hostages.dead, leaks0 = G.stats.leaks || 0, exp0 = G.exposed;
  const stepAntes = G.nego.step;
  // resolução
  const res = A.resolveDecisions();
  const R = G.R;
  let evento = null;
  if (res && res.event) {
    evento = res.event;
    const fx = A.EVENT_FX[evento], idx0 = pol.event ? pol.event(A, evento) : B.eventChoice(A, evento, pol.style);
    P(''); P(`**Carta de evento: ${A.EVDEF[evento].titulo}.** Escolhas: ${fx.choices.map((c, i) => `${i + 1}) ${c.label}${c.cost ? ` (−${c.cost})` : ''}`).join(' · ')}. O comando escolhe **${idx0 + 1}**.`);
    let ok = A.chooseEvent(idx0); for (let i = 0; i < fx.choices.length && !ok; i++) ok = A.chooseEvent(i);
  }
  // a rodada, linha a linha
  P(''); P('**Resolução** (a ordem do motor: tática → apoio e horas extras → pausa → inteligência → comunicação → negociação → cofre → plantão → mídia → agitação → reféns → stakeholders → evento → desfecho):'); P('');
  R.lines.forEach(l => P(`- ${l.tone === 'good' ? '＋' : l.tone === 'bad' ? '−' : l.tone === 'warn' ? '!' : '·'} ${l.text.replace(/\s+/g, ' ')}`));
  if (R.interv) P('A intervenção ocupa a rodada inteira: nenhuma outra decisão é executada, e cofre, plantão, mídia, agitação e stakeholders não passam pelas regras da rodada.');
  else {
    // conferências da resolução
    const x2 = X(G);
    const nEnt = x2.emZona('entrada').length;
    // cofre
    const vdelta = Math.max(0, 10 * Pf.vault * D.vault - 4 * nEnt);
    ck(near(G.lastVaultDelta, vdelta, 1e-9), 'cofre: +máx(0; 10 × ritmo do perfil × dificuldade − 4 × agentes na Entrada)', `${f(G.lastVaultDelta, 3)} × ${f(vdelta, 3)} (${nEnt} na Entrada)`);
    // plantão
    const nCampo = G.team.filter(id => G.az[id] && G.az[id] !== 'reserva' && !x2.away(id)).length, pcost = Math.round(D.ops * (4 + 2 * nCampo));
    ck(R.plantao.cost === pcost && R.plantao.n === nCampo, 'plantão = ops × (4 + 2 × agentes em campo)', `${R.plantao.cost} × ${pcost}`);
    // mídia
    const nl = (G.stats.leaks || 0) - leaks0;
    const vazadas = R.lines.filter(l => l.tone === 'bad' && /sobe \+10 em vez de ceder/.test(l.text)).map(l => A.COMMS.find(c => l.text.startsWith(c.nome + ':')));
    const cm = sum(q.filter(d => d.kind === 'com').map(d => (vazadas.some(c => c && c.id === d.p.cid) ? 10 : d.p.cid === 'coletiva' ? -5 : d.p.cid === 'geral' ? -3 : 0)));
    const esc = (8 + r * 2) * D.media, mg = esc + cm - (G.gear.includes('jammer') ? 2 : 0);
    ck(near(sum(R.mediaParts.map(p => p.v)), mg, 1e-9), 'mídia: +(8 + 2 × rodada) × dificuldade + comunicados − jammer', `${f(sum(R.mediaParts.map(p => p.v)), 3)} × ${f(mg, 3)}`);
    ck(vazadas.length === nl, 'vazamentos de comunicado contados = linhas "vazou" do resultado', `${nl} × ${vazadas.length}`);
    // agitação
    const midiaMeio = clamp(R.s0.media + mg, 0, 100);
    let base = Pf.base; const baseObs = R.agitParts[0].v;
    const baseOk = G.profile === 'volatil' ? (baseObs - D.agit >= -5 && baseObs - D.agit <= 8) : near(baseObs, base + D.agit, 1e-9);
    ck(baseOk, G.profile === 'volatil' ? 'agitação: base do Volátil sorteada entre −5 e +8, mais o ajuste da dificuldade' : 'agitação: base do perfil + ajuste da dificuldade', `${f(baseObs)}`);
    const ext = midiaMeio * .03 + 1.5 * nEnt + (exp0 > 0 ? 2 : 0), extObs = R.agitParts[1].v;
    ck(near(extObs, ext, 1e-9), 'agitação: pressão externa = 0,03 × mídia + 1,5 × agentes na Entrada (+2 se as posições estão expostas)', `${f(extObs, 3)} × ${f(ext, 3)} (mídia ${f(midiaMeio)}, ${nEnt} na Entrada)`);
    const pas = (G.team.includes('marina') && !x2.away('marina') ? -2 : 0) + (G.gear.includes('jammer') ? 1 : 0);
    ck(near(R.agitParts[3].v, pas, 1e-9), 'agitação: Marina −2, jammer +1', `${R.agitParts[3].v} × ${pas}`);
    const dA = sum(R.agitParts.map(p => p.v)), agitMeio = clamp(R.s0.agit + dA, 0, 100);
    if (np || nd) {
      const tech = nd.p.tech;
      if (tech === 'press') ck(near(R.agitParts[2].v, Pf.press, 1e-9), 'agitação: pressão = +perfil.press', `${R.agitParts[2].v} × ${Pf.press}`);
      else {
        const subiu = R.lines.some(l => l.tone === 'good' && /Funcionou/.test(l.text)), skip = tech > stepAntes;
        const calm = skip ? -2 : x2.calma(tech, subiu ? Math.min(5, stepAntes + 1) : stepAntes);
        ck(near(R.agitParts[2].v, -calm, 1e-9), 'agitação: efeito da negociação = −3 × degrau depois × multiplicador × (1,3 no Caótico); pular etapa vale +2', `${f(R.agitParts[2].v, 3)} × ${f(-calm, 3)}`);
      }
    } else ck(near(R.agitParts[2].v, 0, 1e-9), 'agitação: sem negociação, sem efeito calmante');
    P(''); P(`**Agitação:** ${f(R.s0.agit)} ${dA >= 0 ? '+' : '−'} ${f(Math.abs(dA), 2)} = ${f(agitMeio)} antes de impulso, eventos e ações do líder (partes: ${R.agitParts.map(p => `${p.k} ${p.v >= 0 ? '+' : '−'}${f(Math.abs(p.v), 2)}`).join('; ')}). **Mídia:** ${f(R.s0.media)} → ${f(midiaMeio)} (${R.mediaParts.filter(p => p.v).map(p => `${p.k} ${p.v >= 0 ? '+' : '−'}${f(Math.abs(p.v), 2)}`).join('; ')}). **Cofre:** ${f(R.s0.vault)} → ${f(clamp(R.s0.vault + vdelta, 0, 100))}%. **Plantão:** −${R.plantao.paid} (${R.plantao.n} em campo).`);
    // stakeholders
    const efeitoCartas = evento || G.hostages.hurt !== hurt0 || G.hostages.dead !== dead0;
    P(''); P('**Stakeholders** (antes → depois, com o porquê de cada movimento):'); P('');
    A.STK_KEYS.forEach(k => {
      const s0 = R.s0.stk[k], s1 = R.s1.stk[k], por = (R.stkWhy[k] || []), soma = sum(por.map(p => p.v));
      const extra = s1 - clamp(s0 + soma, 0, 100);
      P(`- ${A.STK[k].nome}: ${f(s0)} → ${f(s1)} = ${por.map(p => `${p.v >= 0 ? '+' : '−'}${f(Math.abs(p.v), 1)} ${p.t}`).join(', ') || 'sem mudança nas regras da rodada'}${Math.abs(extra) > 1e-9 ? `; ${extra >= 0 ? '+' : '−'}${f(Math.abs(extra), 1)} de evento, mortes/feridos ou efeito da decisão` : ''}.`);
      if (!efeitoCartas) ck(Math.abs(extra) < 1e-6, `${A.STK[k].nome}: todo movimento tem causa registrada`, `resíduo ${f(extra, 3)}`);
    });
    // créditos
    const cortes = R.lines.some(l => /corta 60 créditos/.test(l.text)) ? Math.min(60, Math.max(0, creditosPre - R.plantao.paid)) : 0;
    const pcredit = creditosPre - R.plantao.paid - cortes;
    if (!evento) ck(near(R.s1.credits, pcredit, 1e-9), 'créditos ao fim = antes − plantão − corte do banco', `${f(R.s1.credits)} × ${f(pcredit)}`);
    else ck(R.s1.credits <= pcredit + 1e-9, 'créditos só caem com o evento (nunca sobem)', `${f(R.s1.credits)} × ${f(pcredit)}`);
  }
  // fim de rodada
  P(''); const e = G.end;
  const det = [];
  const agitFim = R.s1.agit, violenta = R.lines.some(l => /dispara contra a parede/.test(l.text)), agitAntes = violenta ? agitFim + 10 : agitFim;
  if (R.interv) det.push('intervenção ordenada pelo comando');
  if (agitAntes > 80) det.push(`agitação ${f(agitAntes)} > 80: chance de ação desesperada = (${f(agitAntes)} − 80) × 2% × ${D.desp} = ${f((agitAntes - 80) * .02 * D.desp * 100)}%`);
  if (G.nego.step === 5) det.push(`degrau 5 com agitação ${f(agitFim)} ${agitFim <= D.ret ? '≤' : '>'} ${D.ret}: ${agitFim <= D.ret ? 'rendição' : 'ainda sem rendição'}`);
  if (G.vault >= 100) det.push('cofre em 100%');
  if (r >= 6 && G.stk.prefeito.lost) det.push(`prefeito perdido (confiança ${f(G.stk.prefeito.sat)}) na rodada ${r}`);
  if (r >= A.MAX_ROUNDS) det.push('rodada 8: ultimato final');
  P(`**Fim da rodada.** ${det.length ? 'Condições presentes: ' + det.join('; ') + '.' : 'Nenhuma condição de desfecho presente.'} ${e ? 'Desfecho: **' + e.type + (e.variant ? ' (' + e.variant + ')' : '') + (e.sub ? ' > ' + e.sub : '') + '**.' : 'A crise continua.'}`);
  // ordem de prioridade
  const surr = G.nego.step === 5 && agitFim <= D.ret, cofre = G.vault >= 100, politica = r >= 6 && G.stk.prefeito.lost && G.stk.prefeito.sat <= 15;
  if (!e) {
    ck(!surr, 'sem rendição enquanto o degrau 5 com agitação baixa não existe', 'degrau 5 e agitação ≤ limite sem desfecho');
    ck(!cofre, 'cofre em 100% sempre termina a crise');
    ck(!politica, 'ordem política sempre termina a crise');
    ck(r < A.MAX_ROUNDS, 'a rodada 8 sempre termina a crise');
  } else {
    const t = e.type + (e.variant ? ':' + e.variant : '');
    const esperado = R.interv ? 'intervencao' : (agitAntes > 80 && /AÇÃO DESESPERADA/.test(R.lines.map(l => l.text).join(' '))) ? (e.cause === 'desespero' ? 'fuga' : null) : surr ? 'rendicao' : cofre ? 'fuga' : politica ? 'intervencao' : r >= A.MAX_ROUNDS ? 'prazo' : null;
    ck(esperado === null || esperado === e.type, 'o desfecho segue a prioridade: ordenada > desesperada > rendição > cofre > ordem política > ultimato', `${t} × ${esperado}`);
  }
  fecha('Conferência da rodada');
  P('');
  if (!G.end) A.startRound();
  return { r, evento };
}

function rotuloDecisao(d) {
  switch (d.kind) {
    case 'nego': return d.p.tech === 'press' ? 'negociação: pressionar (ultimato)' : `negociação: ${A.POSTURES[d.p.tech - 1].nome}`;
    case 'intel': return `investigar ${A.INTEL.find(i => i.id === d.p.id).nome} (−${d.cost})`;
    case 'com': return `comunicar: ${A.COMMS.find(c => c.id === d.p.cid).nome}${d.cost ? ' (−' + d.cost + ')' : ''}`;
    case 'pausa': return 'Pausa de Comando';
    case 'horas': return `horas extras (−${d.cost})`;
    case 'apoio': return `apoio externo em ${ZN(d.p.zone)} (−${d.cost})`;
    case 'repos': return `reposicionar ${NM(d.p.agent)} → ${ZN(d.p.zone)}`;
    case 'interv': return 'AUTORIZAR INTERVENÇÃO';
  }
  return d.kind;
}

function desfecho(G) {
  const E = G.end, H = G.hostages, S = G.score, y = pontuacao(G); rodada = [];
  P(`- Desfecho: **${E.type}${E.variant ? ' (' + E.variant + ')' : ''}${E.sub ? ' > ' + E.sub : ''}** na rodada ${G.round}${E.P != null ? `, com chance real de ${f(E.P * 100)}%` : ''}${E.forced ? ' (forçado)' : ''}${E.zone ? `, saída por ${ZN(E.zone)} com cobertura efetiva ${E.cov}%` : ''}. Reféns: ${17 - H.hurt - H.dead} ilesos, ${H.hurt} feridos, ${H.dead} mortos${(E.agentsHurt || []).length ? `; agentes feridos na entrada: ${E.agentsHurt.map(NM).join(', ')}` : ''}.`);
  P(`- Cálculo da nota (pesos do projeto):`); P('');
  P('| Dimensão | Conta | Valor | Peso | Pontos |'); P('| --- | --- | --: | --: | --: |');
  P(`| Vidas | 1 − (2,5 × ${H.dead} + 0,5 × ${H.hurt}) ÷ 17 | ${f(y.vidas * 100)}% | 40% | ${f(y.vidas * 40, 2)} |`);
  P(`| Prisões | fator do desfecho | ${f(y.captura * 100)}% | 20% | ${f(y.captura * 20, 2)} |`);
  P(`| Valores | 1 − ${f(E.lootF, 2)} × ${f(G.vault)}% | ${f(y.valores * 100)}% | 15% | ${f(y.valores * 15, 2)} |`);
  P(`| Eficiência | 0,6 × ${Math.round(G.credits)}/1000 + 0,4 × (1 − (${G.round} − 1)/8 × 0,8) | ${f(y.efic * 100)}% | 10% | ${f(y.efic * 10, 2)} |`);
  P(`| Confiança | ${A.STK_KEYS.map(k => `${A.STK[k].nome} ${Math.round(G.stk[k].sat)}×${f(y.w[k] * 100, 0)}%`).join(' + ')} | ${f(y.conf * 100)}% | 15% | ${f(y.conf * 15, 2)} |`);
  P(''); P(`Bruta ${f(y.raw, 2)}${y.capWhy ? `; teto ${y.cap} (${y.capWhy})` : ''}${y.penal ? `; penalidade −${y.penal}` : ''} → **${f(y.total)} (${y.nota})**. O motor entregou ${f(S.total)} (${S.grade}).`);
  ck(near(S.total, y.total, 1e-9) && S.grade === y.nota, 'nota final refeita = nota do motor', `${S.total} ${S.grade} × ${y.total} ${y.nota}`);
  ['vidas', 'captura', 'valores', 'eficiencia', 'confianca'].forEach((k, i) => ck(near(S[k], [y.vidas, y.captura, y.valores, y.efic, y.conf][i], 1e-9), `dimensão ${k}`));
  ck(H.inside + H.freed === 17 && H.dead + H.hurt <= 17, 'os 17 reféns fecham (no interior + libertados = 17; mortos + feridos ≤ 17)');
  ck(H.dead === 0 || S.total <= (H.dead >= 4 ? 49 : H.dead >= 2 ? 64 : 79), 'teto de mortes respeitado');
  const sel = A.BADGES.filter(b => A.badgeEarned(b.id));
  P(`- Selos: ${sel.length ? sel.map(b => b.nome).join(', ') : 'nenhum'}.`);
  fecha('Conferência do desfecho'); P('');
}

/* ---------- as três partidas ---------- */
P('# Auditoria final cruzada (L2.5): três partidas anotadas'); P('');
P('Gerado por `node tools/sim/partidas.js`. Cada número do motor é refeito só com o estado e as fórmulas do projeto e comparado; ✗ marca divergência.'); P('');
const resumo = [];
resumo.push(joga('Partida 1: Protocolar, líder Calculista, estratégia negociadora', 'protocolar', 'calculista', () => B.policyNegociador('protocolar'), 'negociadora (Paulo, Marina, Carla, Renata, Lucas, Fernanda; negofone, kit e câmera térmica; negocia todo turno e investiga perfil, efetivo e rota)', 6));
resumo.push(joga('Partida 2: Complexo, líder Volátil, estratégia agressiva', 'complexo', 'volatil', () => B.policyAgressivo(3, .5), 'agressiva (André, Marcos, Diego, Renata, Roberto, Lucas; escudo, sniper e viatura; investiga e entra a partir da rodada 3 quando a chance chega a 50%)', 3, 'intervencao'));
resumo.push(joga('Partida 3: Caótico, líder Desesperado, estratégia equilibrada', 'caotico', 'desesperado', () => B.policyEquilibrado(), 'equilibrada (Renata, Paulo, Carla, Marcos, Lucas, Fernanda; negofone e drone; investiga em ordem e só entra se a chance for alta nas últimas rodadas)', 5));
P('## Resumo'); P('');
P('| Partida | Semente | Líder | Desfecho | Rodadas | Nota | Mortos | Feridos |'); P('| --- | --: | --- | --- | --: | --: | --: | --: |');
resumo.forEach(s => P(`| ${s.titulo.split(':')[0]} (${s.diff}) | ${s.seed} | ${s.perfil} | ${s.tipo} | ${s.round} | ${f(s.total)} (${s.nota}) | ${s.mortos} | ${s.feridos} |`));
P(''); P(`**Conferências independentes: ${T.total - T.falhas} de ${T.total} batem${T.falhas ? `; ${T.falhas} DIVERGEM` : ''}.**`);
const text = out.join('\n') + '\n';
if (OUT) fs.writeFileSync(OUT, text); else process.stdout.write(text);
console.error(`partidas: ${T.total - T.falhas}/${T.total} conferências batem`);
process.exit(T.falhas ? 1 : 0);
