/* =====================================================================
   INTERFACE — Desfecho, pós-jogo, ações e inicialização
   ===================================================================== */
const hoursN = () => Math.max(1, Math.round(G.round * ROUND_MIN / 60));
const plural = (n, s, p) => n === 1 ? s : p;
function harmSentence() {
  const H = G.hostages;
  const names = G.hl.filter(h => h.st === 'dead').map(h => HOST[h.id].nome);
  if (H.dead) return `A crise deixou ${H.dead} ${plural(H.dead, 'morto', 'mortos')} entre os reféns${H.hurt ? ` e ${H.hurt} ${plural(H.hurt, 'ferido', 'feridos')}` : ''}${names.length ? `. ${plural(names.length, 'Não voltou para casa', 'Não voltaram para casa')}: ${names.join(', ')}` : ''}.`;
  if (H.hurt) return `${H.hurt} ${plural(H.hurt, 'refém ficou ferido', 'reféns ficaram feridos')}; os demais saíram ilesos.`;
  return `Todos os ${HOSTAGES} reféns saíram ilesos.`;
}
function vaultSentence() {
  const v = G.vault;
  return v < 25 ? 'O cofre permaneceu praticamente intocado.' : v < 60 ? 'Os assaltantes chegaram a trabalhar no cofre, mas não o abriram.' : v < 100 ? 'O cofre estava perto de ceder quando a crise terminou.' : 'O cofre foi aberto antes do desfecho.';
}
function outcomeStory() {
  const E = G.end, H = G.hostages, t = fmtTime(G.round + 1), z = E.zone ? ZONE[E.zone].nome : '';
  const p = []; let title, tag;
  if (E.type === 'rendicao') {
    tag = 'Rendição negociada'; title = 'A porta se abre sem armas';
    p.push(`${t}. A porta lateral da Agência Central se abre devagar. Primeiro uma mão, depois a outra: vazias, espalmadas. O líder do grupo cruza o limiar sem pressa e sem arma.`);
    p.push(G.nego.skips === 0 ? `Foram ${G.round} rodadas de conversa. A escada foi subida degrau por degrau: escuta, empatia, rapport, influência e, por fim, a saída combinada. Ninguém pulou etapa.` : `Foram ${G.round} rodadas de conversa. Nem todos os degraus foram subidos em ordem, mas a escada foi concluída e o líder aceitou a saída.`);
    p.push(E.variant === 'serena' ? 'A agitação havia baixado o bastante para que a rendição fosse quase uma formalidade. Lá fora, ninguém ousou aplaudir ainda.' : 'Houve hesitação até o último segundo. A tensão ainda estava no ar quando o primeiro refém saiu, mas a decisão já estava tomada do outro lado da linha.');
    if (E.defector) p.push('Um dos integrantes do grupo, que já havia dado sinais de querer sair, foi o primeiro a se entregar.');
  } else if (E.type === 'intervencao' || (E.type === 'prazo' && E.variant === 'forcado')) {
    const v = E.type === 'prazo' ? E.sub : E.variant;
    tag = E.type === 'prazo' ? 'Prazo esgotado' : 'Intervenção';
    title = v === 'limpa' ? 'O silêncio se parte em segundos' : v === 'baixas' ? 'Termina rápido, mas não limpo' : v === 'parcial' ? 'Minutos longos demais' : 'A intervenção falhou';
    if (E.type === 'prazo') p.push(`${t}. O relógio do posto de comando marca o fim do prazo. O ultimato final chega pelo telefone e a voz do outro lado não aceita mais proposta. Você autoriza a ação.`);
    else if (E.forced) p.push(`${t}. A ordem vem de cima, e não da sua avaliação técnica. O gabinete do prefeito determina a intervenção. Você transmite o sinal.`);
    else p.push(`${t}. O comando dá o sinal. As equipes avançam em sincronia, cada uma por uma zona, e o silêncio da Agência Central se parte em segundos.`);
    p.push(v === 'limpa' ? 'A informação certa e a prontidão da equipe fizeram o que a improvisação não faria: tudo termina antes que o medo tenha tempo de virar tragédia.' : v === 'baixas' ? 'A equipe controla o interior, mas a agitação lá dentro cobrou seu preço: houve feridos, e a confusão durou mais do que o planejado.' : v === 'parcial' ? 'Parte do grupo resistiu e a situação só foi contida depois de longos minutos. O cerco acabou, mas não do jeito que alguém desejava.' : 'A falta de informação e a agitação do líder transformaram a entrada em desordem. O que deveria ser uma operação precisa virou o pior cenário.');
  } else if (E.type === 'fuga') {
    tag = 'Fuga e perseguição';
    title = E.variant === 'barrada' ? 'A rota estava coberta' : E.variant === 'perseguicao' ? 'Pela avenida, até o fim' : 'A rota que ninguém cobriu';
    p.push(`${t}. ${E.cause === 'cofre' ? 'Com o cofre aberto, o grupo não tem mais motivo para ficar.' : 'Num gesto desesperado, o líder rompe a linha de contenção.'} A saída é por ${z}${E.adapted ? ', não onde era esperado: ao perceber a presença das equipes, o líder mudou o plano no último minuto' : ''}.`);
    p.push(E.variant === 'barrada' ? `A cobertura em ${z} (${E.cov}%) fechou a porta. Quem apostou no perímetro certo vê a aposta se pagar em segundos.` : E.variant === 'perseguicao' ? `Em ${z} a cobertura era de ${E.cov}%, insuficiente para barrar a saída. A perseguição pela Avenida Principal terminou com a captura.` : `Em ${z} a cobertura era de apenas ${E.cov}%. O grupo saiu, a perseguição não alcançou ninguém e a cidade vai amanhecer com a notícia de que a crise terminou, mas os responsáveis escaparam.`);
  } else {
    tag = 'Prazo esgotado'; title = 'O ultimato é aceito';
    const st = G.nego.step;
    p.push(`${t}. O relógio do posto de comando marca o fim do prazo. O ultimato final chega pelo telefone, e dessa vez o líder cede${st >= 4 ? ': o que foi construído na linha pesou, e ele já falava em “depois”, em quem recebe e por onde sai' : st >= 2 ? ': cansado, com o perímetro fechado à frente e a conversa ainda no degrau ' + st : ': sem acordo nenhum, apenas cansado e sem saída'}.`);
    p.push(G.agit < 40 ? 'A tensão lá dentro já tinha baixado, e a entrega foi mais calma do que o prazo fazia supor. Não foi a saída mais limpa, mas terminou sem uma ação armada.' : 'A rendição acontece sob pressão máxima, com a equipe esgotada e o noticiário ao vivo na esquina. Não foi a saída mais limpa, mas terminou sem uma ação armada.');
  }
  p.push(harmSentence() + ' ' + vaultSentence());
  return { p, title, tag, cls: 'o-' + E.type };
}
/* ---------- A verdade por trás da névoa (revelação final) ---------- */
function truthHTML() {
  const K = G.K, at = K.at || {}, P = PR_(), H = G.hostages, st = G.stats, E = G.end;
  const when = k => at[k] != null ? (at[k] === 0 ? 'antes do cerco' : `na rodada ${at[k]}`) : null;
  const rows = [
    ['Perfil do líder', P.nome, 'profile', K.profile ? '' : `Com esse perfil, ${P.mult.emp >= P.mult.rat ? 'escuta, empatia e rapport' : 'critério objetivo e proposta concreta'} rendiam mais.`],
    ['Rota de fuga', ZONE[G.route].nome + (G.routeNow !== G.route ? `, depois ${ZONE[G.routeNow].nome}` : ''), 'route', `Cobertura no início do cerco: ${st.initCov[G.route] || 0}%.`],
    ['Pessoas armadas', String(G.assail), 'count', ''],
    ['Cúmplice externo', G.accomplice ? 'Sim' : 'Não', 'accomplice', ''],
    ['Cofre', Math.round(G.vault) + '%', 'vault', ''],
    ['Reféns feridos', `${H.hurt} ${plural(H.hurt, 'ferido', 'feridos')} · ${H.dead} ${plural(H.dead, 'morto', 'mortos')}`, 'hostages', '']
  ];
  const known = rows.filter(r => when(r[2])).length;
  const cost = E.type === 'intervencao' || (E.type === 'prazo' && E.variant === 'forcado') ? `A intervenção aconteceu com ${known} de 6 variáveis conhecidas. A chance real de sucesso era de ${Math.round((E.P || 0) * 100)}%${E.type === 'prazo' ? `, depois de o líder, com ${Math.round((E.p || 0) * 100)}% de chance de ceder, recusar o ultimato` : ''}.`
    : E.type === 'fuga' ? `A saída foi por ${ZONE[E.zone].nome}, com ${E.cov}% de cobertura efetiva${when('route') ? '' : ', numa rota que você nunca confirmou'}.`
    : E.type === 'rendicao' ? `A rendição veio ${when('profile') ? 'com o perfil do líder já identificado' : 'sem que você soubesse com quem falava'}: ${known} de 6 variáveis conhecidas.`
    : `O prazo esgotou com ${known} de 6 variáveis conhecidas. Ao fim da rodada ${MAX_ROUNDS}, a chance real de o líder ceder era de ${Math.round((E.p || 0) * 100)}%, e ele cedeu.`;
  const sig = st.sig || 0, noise = st.noise || 0;
  return `<div class="card truth"><h3>A verdade por trás da névoa</h3>
    <div class="trows">${rows.map(([k, v, key, note]) => { const w = when(key); return `<div class="tr ${w ? 'k' : 'u'}"><span>${k}</span><b>${v}</b><small>${w ? '✓ você sabia (' + w + ')' : '✕ você nunca confirmou'}${note ? ' · ' + note : ''}</small></div>`; }).join('')}</div>
    <p style="margin-top:10px">${cost} ${sig + noise ? `Dos relatos de campo sobre rotas, ${sig} ${plural(sig, 'era sinal verdadeiro', 'eram sinais verdadeiros')} e ${noise} ${plural(noise, 'era ruído', 'eram ruído')}.` : ''}</p></div>`;
}
function renderOutcome() {
  const o = outcomeStory(), H = G.hostages;
  return `<div class="screen outcome ${o.cls}">
    <div class="row"><span class="otag">${o.tag}</span><span class="mono faint">${fmtTime(G.round + 1)} · rodada ${G.round} de ${MAX_ROUNDS}</span></div>
    <h1>${o.title}</h1>
    <div class="narr">${o.p.map(t => `<p>${t}</p>`).join('')}</div>
    <div class="kv"><div><small>Reféns ilesos</small><b>${HOSTAGES - H.hurt - H.dead}</b></div><div><small>Feridos</small><b>${H.hurt}</b></div><div><small>Mortos</small><b>${H.dead}</b></div><div><small>Cofre</small><b>${Math.round(G.vault)}%</b></div><div><small>Créditos</small><b>${fmt(G.credits)}</b></div><div><small>Duração</small><b>${hoursN()} h</b></div></div>
    ${truthHTML()}
    <div class="row"><button class="btn primary lg" data-act="toscore">Ver a pontuação</button></div></div>`;
}

/* ---------- Pontuação ---------- */
function radarSVG(vals) {
  const cx = 150, cy = 150, R = 105, n = vals.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = f => vals.map((_, i) => pt(i, R * f).map(x => x.toFixed(1)).join(',')).join(' ');
  const poly = vals.map((v, i) => pt(i, R * clamp(v.v, 0, 1)).map(x => x.toFixed(1)).join(',')).join(' ');
  return `<svg viewBox="0 0 300 300" role="img" aria-label="Radar das cinco dimensões: ${vals.map(v => `${v.k} ${Math.round(v.v * 100)}%`).join(', ')}" style="width:100%;max-width:420px;height:auto">
    ${[.25, .5, .75, 1].map(f => `<polygon points="${ring(f)}" fill="none" stroke="var(--line2)" stroke-width="1"/>`).join('')}
    ${vals.map((_, i) => { const [x, y] = pt(i, R); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)"/>`; }).join('')}
    <polygon points="${poly}" fill="rgba(246,166,35,.22)" stroke="var(--amber)" stroke-width="2.5" stroke-linejoin="round"/>
    ${vals.map((v, i) => { const [x, y] = pt(i, R * clamp(v.v, 0, 1)); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="var(--amber)"/>`; }).join('')}
    ${vals.map((v, i) => { const [x, y] = pt(i, R + 22); return `<text x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}" text-anchor="middle" fill="var(--ink)" font-size="11.5" font-weight="600">${v.k}</text><text x="${x.toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="middle" fill="var(--ink2)" font-size="11" font-family="IBM Plex Mono,monospace">${Math.round(v.v * 100)}%</text>`; }).join('')}</svg>`;
}
const OUTN = { intervencao: 'Intervenção tática', rendicao: 'Rendição negociada', fuga: 'Fuga do grupo', prazo: 'Prazo esgotado' };
const OUTV = { limpa: 'limpa', baixas: 'com baixas', parcial: 'parcial', fracasso: 'fracassada', serena: 'serena', tensa: 'tensa', barrada: 'barrada', perseguicao: 'com perseguição', escapou: 'bem-sucedida', cedeu: 'com cessão', forcado: 'forçado' };
function outName(E) { return (OUTN[E.type] || E.type) + (E.variant && OUTV[E.variant] ? ' ' + OUTV[E.variant] : ''); }
function capReason(S, H, E) {
  if (S.capWhy === 'aposta') return `porque a entrada foi autorizada com ${Math.round(E.P * 100)}% de chance de sucesso. Acertar uma aposta é sorte, não método: abaixo de 50% de chance, a nota máxima é A.`;
  if (S.capWhy === 'fracasso') return `porque a intervenção fracassou. Entrar e perder o controle da operação nunca conta como boa condução${H.dead ? ` (${H.dead} ${plural(H.dead, 'refém morto', 'reféns mortos')})` : ''}.`;
  return `porque houve ${H.dead} ${plural(H.dead, 'refém morto', 'reféns mortos')}. Nesta simulação, vidas perdidas limitam a nota máxima.`;
}
/* O que separa o resultado da próxima nota: as duas maiores perdas da composição (só para A e B, sem teto aplicado). */
const GRADE_NEXT = { A: ['S', 90], B: ['A', 80] };
const DIM_LOSS = { Vidas: 'reféns feridos ou mortos', Prisões: 'assaltantes que não foram presos', Valores: 'perda do cofre', Eficiência: 'verba gasta e duração da crise', Confiança: 'stakeholders insatisfeitos' };
function nextGradeHint(S, dims) {
  const nx = GRADE_NEXT[S.grade]; if (!nx || S.capped) return '';
  const loss = dims.map(d => ({ k: d.k, l: (1 - d.v) * d.w * 100 })).sort((a, b) => b.l - a.l).slice(0, 2);
  const eff = loss[0].k === 'Eficiência' && nx[0] === 'S' ? ' O S pede verba sobrando, mas equipe enxuta demais custa proteção em crises difíceis.' : '';
  const gap = nx[1] - S.total;
  return `${gap <= 1 ? 'Faltou' : 'Faltaram'} ${dec(gap)} ${gap <= 1 ? 'ponto' : 'pontos'} para a nota ${nx[0]}. Onde mais se perdeu: ${loss.map(x => `${x.k} (−${dec(x.l)} pts: ${DIM_LOSS[x.k]})`).join('; ')}.${eff}`;
}
function scoreHTML() {
  const S = G.score, H = G.hostages, E = G.end;
  const dims = [
    { k: 'Vidas', v: S.vidas, w: .40, why: `${H.dead} ${plural(H.dead, 'morto', 'mortos')} e ${H.hurt} ${plural(H.hurt, 'ferido', 'feridos')} entre ${HOSTAGES} reféns (cada morte pesa 2, cada ferido 0,5).${G.stats.kitSaves ? ` O kit médico evitou ${G.stats.kitSaves} ${plural(G.stats.kitSaves, 'morte', 'mortes')}.` : ''}` },
    { k: 'Prisões', v: S.captura, w: .20, why: `${outName(E)}: ${Math.round(S.captura * 100)}% dos responsáveis presos.` },
    { k: 'Valores', v: S.valores, w: .15, why: `Cofre em ${Math.round(G.vault)}% no desfecho; fator de perda do desfecho ${String(E.lootF).replace('.', ',')}.` },
    { k: 'Eficiência', v: S.eficiencia, w: .10, why: `${fmt(G.credits)} créditos sobraram e a crise durou ${G.round} rodadas. O plantão custou ${fmt(G.spent.plantao)} no total${G.deficit ? ` e ${G.deficit} ${plural(G.deficit, 'rodada', 'rodadas')} ficaram no vermelho` : ''}.` },
    { k: 'Confiança', v: S.confianca, w: .15, why: `Média ponderada dos stakeholders: ${STK_KEYS.map(k => `${STK[k].nome} ${Math.round(G.stk[k].sat)}`).join(' · ')}.` }
  ];
  const hint = nextGradeHint(S, dims);
  return `<div class="scorehead"><div style="text-align:center">${radarSVG(dims)}</div>
    <div class="grid" style="gap:10px"><div class="eyebrow">Nota final</div><h1 class="sr">Pontuação final: nota ${S.grade}, ${dec(S.total)} de 100</h1><div class="grade ${S.grade}" aria-hidden="true">${S.grade}</div><div class="bigscore" aria-hidden="true">${dec(S.total)} / 100</div>
    ${S.capped ? `<div class="insight warn">${icon('alert', '', 1.8)}<span>Teto aplicado: a pontuação bruta (${dec(S.raw)}) foi limitada a ${S.cap} ${capReason(S, H, E)}</span></div>` : ''}
    <p class="muted" style="max-width:520px">${S.grade === 'S' ? 'Operação exemplar.' : S.grade === 'A' ? 'Excelente condução, com pouco a corrigir.' : S.grade === 'B' ? 'Boa condução, com trade-offs visíveis.' : S.grade === 'C' ? 'Resultado aceitável, mas com perdas evitáveis.' : S.grade === 'D' ? 'Resultado fraco: as decisões se acumularam contra você.' : 'Operação malsucedida. A falha também ensina: veja o debrief.'}</p>
    ${hint ? `<p class="faint" style="max-width:520px;font-size:13px">${hint}</p>` : ''}</div></div>
    <div class="card" style="margin-top:18px"><h2 class="h3">Composição</h2>${dims.map(d => `<div class="dimrow"><div><b>${d.k}</b><small>peso ${Math.round(d.w * 100)}%</small></div><div><div class="meter tall ${d.v >= .7 ? 'g' : d.v >= .4 ? 'a' : 'r'}"><i style="width:0%" data-to="${Math.round(d.v * 100)}"></i></div><small class="faint">${d.why}</small></div><div class="mono" style="text-align:right">${Math.round(d.v * 100)}% → ${dec(d.v * d.w * 100)} pts</div></div>`).join('')}</div>`;
}

/* ---------- Gazeta ---------- */
function newsHTML() {
  const H = G.hostages, E = G.end, S = G.score, hrs = hoursN(), z = E.zone ? ZONE[E.zone].nome : '', t = fmtTime(G.round + 1);
  const horas = `${hrs} ${plural(hrs, 'HORA', 'HORAS')}`;
  const harmHl = H.dead ? `${H.dead} ${plural(H.dead, 'REFÉM MORTO', 'REFÉNS MORTOS')}` : H.hurt ? `${H.hurt} ${plural(H.hurt, 'FERIDO', 'FERIDOS')}` : 'SEM FERIMENTOS';
  let hl, sub;
  const v = E.type === 'prazo' && E.variant === 'forcado' ? E.sub : E.variant;
  if (E.type === 'rendicao') {
    hl = H.dead ? `RENDIÇÃO ENCERRA CERCO DE ${horas}, MAS CRISE DEIXA ${harmHl}` : H.hurt ? `RENDIÇÃO ENCERRA CERCO DE ${horas}; ${harmHl}` : `APÓS ${horas} DE TENSÃO, REFÉNS SÃO LIBERTADOS SEM FERIMENTOS`;
    sub = H.dead ? 'Líder se entrega, mas o cerco cobrou vidas antes do fim da negociação' : 'Negociação conduzida pela força-tarefa leva assaltantes à rendição na Agência Central do Meridiano';
  }
  else if (E.type === 'intervencao' || (E.type === 'prazo' && E.variant === 'forcado')) {
    hl = v === 'limpa' ? (H.dead ? `FORÇA-TAREFA ENCERRA CERCO DE ${horas}; ${harmHl}` : H.hurt ? `FORÇA-TAREFA ENCERRA CERCO DE ${horas} E RETIRA OS REFÉNS; ${harmHl}` : `FORÇA-TAREFA ENCERRA CERCO DE ${horas} E RESGATA TODOS OS REFÉNS`) : v === 'baixas' ? `INTERVENÇÃO ENCERRA CERCO DE ${horas}; ${harmHl}` : v === 'parcial' ? `AÇÃO DA POLÍCIA ENCERRA CERCO, MAS DEIXA ${harmHl}` : `INTERVENÇÃO TERMINA EM TRAGÉDIA NA AGÊNCIA CENTRAL`;
    sub = E.type === 'prazo' ? 'Sem acordo ao fim do ultimato, comando autoriza entrada na agência do Banco Meridiano' : E.forced ? 'Ordem do gabinete do prefeito antecipa operação, segundo fontes do isolamento' : 'Operação foi autorizada depois de rodadas de negociação e levantamento de informações';
  } else if (E.type === 'fuga') {
    hl = E.variant === 'barrada' ? `FUGA É BARRADA EM ${z.toUpperCase()} E GRUPO É PRESO` : E.variant === 'perseguicao' ? 'PERSEGUIÇÃO PELA AVENIDA TERMINA COM PRISÃO DE ASSALTANTES' : `ASSALTANTES ESCAPAM POR ${z.toUpperCase()} E POLÍCIA INICIA BUSCA`;
    sub = E.variant === 'escapou' ? 'Cofre foi aberto e rota de fuga não tinha cobertura suficiente, apontam testemunhas' : 'Cobertura da rota foi decisiva para encerrar o cerco ao Banco Meridiano';
  } else { hl = `ULTIMATO TERMINA EM RENDIÇÃO APÓS ${horas} DE CERCO`; sub = 'Prazo esgotado e comando sob pressão: assaltantes cedem na última hora'; }
  const safe = HOSTAGES - H.hurt - H.dead;
  const quotes = [], deadIds = G.hl.filter(h => h.st === 'dead').map(h => h.id);
  const wit = ['lucia', 'joana', 'benedito', 'rafael', 'cecilia', 'jorge'].map(id => G.hl.find(h => h.id === id)).find(h => h && h.st !== 'dead') || G.hl.find(h => h.st !== 'dead');
  const wq = E.type === 'rendicao' ? 'Quando ele largou o telefone e disse “acabou”, ninguém acreditou. Ficamos sentados um tempo, sem coragem de levantar.'
    : E.type === 'fuga' ? 'Eles saíram correndo e deixaram a gente lá dentro. Ficamos sem saber se podíamos levantar.'
    : E.type === 'prazo' && E.variant === 'cedeu' ? 'As últimas horas foram as piores. Ele não parava de olhar o relógio.'
    : v === 'limpa' ? 'Foi tudo muito rápido. Num minuto ouvi gritos, no outro alguém segurava a minha mão e dizia que tinha acabado.'
    : 'Eu só pensava na minha família. Ainda não consigo falar sobre o resto.';
  if (wit) quotes.push(`<blockquote>“${wq}”<cite>${HOST[wit.id].nome}, ${HOST[wit.id].idade}, ${HOST[wit.id].papel}</cite></blockquote>`);
  const pk = G.stk.prefeito.sat, fk = G.stk.familias.sat, bk = G.stk.banco.sat;
  quotes.push(`<blockquote>${pk >= 70 ? '“A cidade esteve bem protegida. Agradeço ao comando por não ter cedido à pressa.”' : pk >= 40 ? '“Poderia ter sido mais rápido, mas o resultado final é o que importa.”' : '“Vamos exigir uma apuração completa sobre a condução deste incidente.”'}<cite>Prefeito de Porto Alto</cite></blockquote>`);
  quotes.push(`<blockquote>${H.dead ? '“Nada devolve quem perdemos. Queremos respostas, e queremos que isso nunca mais se repita.”' : H.hurt ? '“Nossos parentes estão vivos, mas feridos. Esperamos que cada um receba o cuidado que merece.”' : fk >= 60 ? '“Só queríamos abraçá-los. Obrigada a quem ficou lá fora o tempo todo.”' : '“Ficamos horas sem informação. A gente só queria saber se eles estavam bem.”'}<cite>Representante das famílias</cite></blockquote>`);
  quotes.push(`<blockquote>${S.valores > .8 ? '“O patrimônio está preservado e a diretoria agradece o cuidado com os clientes.”' : S.valores > .4 ? '“Estamos avaliando as perdas e colaboraremos com a perícia.”' : '“Os prejuízos são significativos e serão apurados.”'}<cite>Diretoria do Banco Meridiano${bk < 35 ? ' (em tom de reprovação)' : ''}</cite></blockquote>`);
  const key = G.log.filter(l => l.ev).map(l => `<li><b>${l.time}</b> · ${EVDEF[l.ev.id].titulo}</li>`).join('');
  const nsteps = G.nego.maxStep;
  const edit = S.grade === 'S' || S.grade === 'A' ? ['Quando a pressa perdeu para o método', 'A crise terminou bem porque o comando não confundiu urgência com pressa. Escolheu o que saber, o que cobrir e quando falar. Em gestão de crise, método é a forma mais rápida de agir.'] : S.grade === 'B' || S.grade === 'C' ? ['Um desfecho que deixa lições', 'Não houve vencedor claro e nem fracasso absoluto. Cada escolha deixou um custo visível, e é nesse custo que mora o aprendizado.'] : ['Perguntas que a cidade vai exigir responder', 'O desfecho abre uma série de perguntas incômodas: que informação faltou, onde a equipe estava e por que determinadas decisões foram adiadas. A resposta precisa vir antes da próxima crise.'];
  return `<div class="news"><div class="mast"><h2>Gazeta de Porto Alto</h2></div>
    <div class="meta"><span>Porto Alto · sexta-feira</span><span>Edição extra das ${t}</span><span>Preço: R$ 3,00</span></div>
    <span class="extra">EDIÇÃO EXTRA</span>
    <h1 class="hl">${hl}</h1><p class="sub">${sub}</p>
    <div class="cols">
      <p>PORTO ALTO — A crise que paralisou o centro da cidade na tarde desta sexta-feira terminou às ${t}, depois de ${hrs} ${plural(hrs, 'hora', 'horas')} de cerco à Agência Central do Banco Meridiano. Dos ${HOSTAGES} reféns, ${safe} ${plural(safe, 'saiu ileso', 'saíram ilesos')}${H.hurt ? `, ${H.hurt} ${plural(H.hurt, 'ficou ferido', 'ficaram feridos')}` : ''}${H.dead ? ` e ${H.dead} ${plural(H.dead, 'morreu', 'morreram')}` : ''}.${deadIds.length ? ` A polícia confirmou ${plural(deadIds.length, 'a morte de', 'as mortes de')} ${deadIds.map(id => `${HOST[id].nome}, ${HOST[id].idade} anos`).join('; ')}.` : ''}</p>
      <p>${E.type === 'rendicao' ? `Segundo a polícia, a negociação foi decisiva. A conversa com o líder do grupo chegou ao degrau ${nsteps} de um processo de cinco etapas, da escuta ativa ao acordo sobre a saída, e a rendição foi acertada sem disparos.` : E.type === 'fuga' ? `Os assaltantes tentaram deixar o local por ${z}${E.adapted ? ' depois de mudarem o plano inicial' : ''}. ${E.variant === 'barrada' ? `A cobertura da zona, de ${E.cov}%, impediu a saída.` : E.variant === 'perseguicao' ? 'A perseguição foi encerrada na Avenida Principal.' : `A cobertura da zona era de ${E.cov}% e não impediu a fuga.`}` : E.type === 'prazo' ? `Ao fim do prazo estipulado pelos assaltantes, ${E.variant === 'cedeu' ? 'o líder do grupo aceitou se render, depois de uma negociação que chegou ao degrau ' + nsteps : 'o comando autorizou a entrada na agência'}.` : `A operação foi autorizada na rodada ${G.round}${E.forced ? ', sob determinação do gabinete do prefeito' : ''}. ${v === 'limpa' ? 'Segundo fontes, a informação reunida antes da entrada foi decisiva para o resultado.' : v === 'fracasso' ? 'Fontes do isolamento afirmam que faltou informação sobre o interior.' : 'Houve resistência no interior e a situação levou alguns minutos para ser contida.'}`}</p>
      <p>${vaultSentence()} A operação consumiu ${Math.round((1000 - G.credits) / 10)}% da verba disponível${G.credits < 100 ? ', deixando o comando praticamente sem margem' : ''}.</p>
      ${quotes.join('')}
      <div class="box"><b>Perfil do líder</b>Segundo investigadores, o líder do grupo agia com perfil <i>${PR_().nome.toLowerCase()}</i>. ${PR_().desc} A polícia não divulgou nomes.</div>
      <h3>${edit[0]}</h3><p>${edit[1]}</p>
      ${key ? `<div class="box"><b>Linha do tempo</b><ul style="margin:0;padding-left:18px">${key}</ul></div>` : ''}
      <div class="box"><b>Placar da operação</b>Nota ${S.grade} (${S.total.toFixed(0)}/100). Vidas ${Math.round(S.vidas * 100)}% · Prisões ${Math.round(S.captura * 100)}% · Valores ${Math.round(S.valores * 100)}% · Confiança ${Math.round(S.confianca * 100)}%.</div>
    </div></div>`;
}

/* ---------- Conquistas ---------- */
function badgeEarned(id) {
  const H = G.hostages, S = G.score, E = G.end, st = G.stats;
  switch (id) {
    case 'ninguem': return H.hurt + H.dead === 0;
    case 'escuta': return E.type === 'rendicao' && G.nego.concessions === 0 && !(st.press);
    case 'sacada': return st.pausas >= 2 && st.pausas <= 3 && S.total >= 50;
    case 'aposta': return (st.initCov[G.route] || 0) >= ADEQ && !st.routeKnownAtStart;
    case 'olhos': return knownCount() >= 5;
    case 'cofre': return G.vault < 40;
    case 'economia': return G.credits >= 400;
    case 'porta': return STK_KEYS.every(k => G.stk[k].sat >= DIFF[G.diff].porta);
    case 'degraus': return G.nego.maxStep >= 4 && G.nego.skips === 0;
    case 'rodizio': return st.minFF >= .7;
    case 'equilibrio': return [S.vidas, S.captura, S.valores, S.confianca].every(x => x > .6) && S.eficiencia > .3;
    case 'mao': return E.type === 'intervencao' && ['limpa', 'baixas'].includes(E.variant) && H.hurt + H.dead === 0;
  }
  return false;
}
function badgesHTML() {
  const got = BADGES.filter(b => badgeEarned(b.id)).length;
  return `<h1 class="sr">Conquistas</h1><p class="muted" style="margin-bottom:12px">${got} de ${BADGES.length} selos conquistados.</p><div class="badges">${BADGES.map(b => { const on = badgeEarned(b.id); return `<div class="badge ${on ? 'on' : 'off'}"><div class="seal">${icon(b.ic, 'ico" style="width:26px;height:26px')}</div><b>${b.nome}</b><p>${b.d}</p><span class="pill ${on ? 'amber' : ''}">${on ? '✓ conquistado' : 'não conquistado'}</span></div>`; }).join('')}</div>`;
}

/* ---------- Replay ---------- */
function chartSVG() {
  const h = G.hist; if (!h.length) return '';
  const W = 720, Hh = 220, L = 38, B = 28, n = MAX_ROUNDS;
  const X = r => L + (W - L - 14) * (r - 1) / (n - 1), Y = v => Hh - B - (Hh - B - 12) * clamp(v, 0, 100) / 100;
  const line = (k, c, dash) => `<polyline points="${h.map(p => `${X(p.r).toFixed(1)},${Y(p[k]).toFixed(1)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="2.5" ${dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round"/>${h.map(p => `<circle cx="${X(p.r).toFixed(1)}" cy="${Y(p[k]).toFixed(1)}" r="3.5" fill="${c}"/>`).join('')}`;
  return `<div class="scroll-x"><svg viewBox="0 0 ${W} ${Hh}" style="min-width:560px;width:100%;height:auto" role="img" aria-label="Evolução de agitação, mídia, cofre e pressão da equipe por rodada">
    ${[0, 25, 50, 75, 100].map(v => `<path d="M${L} ${Y(v)}H${W - 14}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" fill="var(--ink3)" font-size="10.5" font-family="IBM Plex Mono,monospace">${v}</text>`).join('')}
    ${Array.from({ length: n }, (_, i) => `<text x="${X(i + 1)}" y="${Hh - 8}" text-anchor="middle" fill="var(--ink3)" font-size="11">R${i + 1}</text>`).join('')}
    ${line('agit', '#ff5468')}${line('media', '#f6a623')}${line('vault', '#4da6ff')}${line('p', '#a78bfa', true)}</svg></div>
    <div class="legend"><span><i style="background:#ff5468"></i>Agitação do líder</span><span><i style="background:#f6a623"></i>Pressão da mídia</span><span><i style="background:#4da6ff"></i>Cofre</span><span><i style="background:#a78bfa"></i>Pressão da equipe</span></div>`;
}
function replayHTML() {
  const r = clamp(UI.replayR, 1, Math.max(1, G.log.length)), rec = G.log[r - 1];
  const nodes = Array.from({ length: MAX_ROUNDS }, (_, i) => { const l = G.log[i]; return l ? `<button class="tnode" role="tab" data-act="rnode" data-r="${i + 1}" aria-selected="${r === i + 1}" tabindex="${r === i + 1 ? 0 : -1}"><b>R${i + 1}</b>${l.time}<br><span class="faint">${l.decs.length} ${plural(l.decs.length, 'decisão', 'decisões')}${l.ev ? ' · evento' : ''}</span></button>` : `<div class="tnode na" aria-label="Rodada ${i + 1}: não jogada"><b>R${i + 1}</b>não jogada</div>`; }).join('');
  const d = rec ? `<div class="card"><h2 class="h3">Rodada ${r} · ${rec.time}</h2>
    <div class="row" style="margin-bottom:10px">${rec.decs.length ? rec.decs.map(x => `<span class="pill blue">${icon(FRONT_IC[x.front], 'ico" style="width:14px;height:14px')}${x.label}</span>`).join('') : '<span class="muted">Sem decisões.</span>'}</div>
    ${rec.ev ? `<div class="insight warn" style="margin-bottom:10px">${icon(EVDEF[rec.ev.id].ic, '', 1.8)}<span><b>${EVDEF[rec.ev.id].titulo}</b>: ${rec.ev.choice}</span></div>` : ''}
    <div class="grid" style="gap:6px">${rec.lines.map(l => `<div class="res-line ${l.tone}" style="animation:none">${icon(l.ic, '', 1.8)}<span>${br(l.text)}</span></div>`).join('')}</div>
    <div class="delta" style="margin-top:12px">${[['Agitação', rec.s0.agit, rec.s1.agit], ['Mídia', rec.s0.media, rec.s1.media], ['Cofre', rec.s0.vault, rec.s1.vault], ['Pressão da equipe', rec.s0.p, rec.s1.p], ...STK_KEYS.map(k => [STK[k].nome, rec.s0.stk[k], rec.s1.stk[k]])].map(([k, a, b]) => `<div class="dcell"><div class="top"><span>${k}</span><b>${Math.round(a)} → ${Math.round(b)}</b></div></div>`).join('')}</div></div>` : '';
  return `<h1 class="sr">Replay da operação</h1><div class="timeline" role="tablist" aria-label="Rodadas">${nodes}</div>${d}<div class="card" style="margin-top:14px"><h2 class="h3">Curvas da operação (dados reais, sem névoa)</h2>${chartSVG()}</div>`;
}

/* ---------- Debrief: dinheiro e gargalos (L1.3) ---------- */
function tocRuns() {
  const runs = [];
  for (let r = 1; r <= G.round; r++) { const k = G.tocLog[r]; if (!k) continue; const l = runs[runs.length - 1]; if (l && l.k === k) l.to = r; else runs.push({ k, from: r, to: r }); }
  return runs;
}
const runTxt = runs => runs.map(x => `${TOCS[x.k].nome} (${x.from === x.to ? 'R' + x.from : 'R' + x.from + '–R' + x.to})`).join(' → ');
function tocAlign() {
  const L = G.spendLog, n = L.length, hit = L.filter(x => x.hit).length, cost = L.reduce((s, x) => s + x.cost, 0), costHit = L.filter(x => x.hit).reduce((s, x) => s + x.cost, 0);
  return { n, hit, cost, costHit, pct: n ? Math.round(hit / n * 100) : 0 };
}
function econHTML() {
  const cats = spendBreakdown(), tot = cats.reduce((a, c) => a + c.v, 0) || 1, sp = G.spent, runs = tocRuns(), al = tocAlign();
  const decis = sp.ops + sp.intel;
  const verdict = !al.n ? 'Você não fez ordens de informação, pessoal ou tempo: a restrição passou sem que você a atacasse.'
    : al.pct >= 60 ? `${al.hit} de ${al.n} ordens de recurso foram direto no elo mais fraco do momento (${al.costHit} de ${al.cost} créditos). Você subordinou o gasto à restrição.`
    : al.pct >= 30 ? `${al.hit} de ${al.n} ordens miraram o gargalo do momento. O restante foi para pontos que já não eram o elo mais fraco.`
    : `Só ${al.hit} de ${al.n} ordens miraram o gargalo do momento. Muito esforço foi para onde a corrente já era forte.`;
  return `<div class="card econ"><h2 class="h3">Dinheiro e gargalos: o que a operação custou</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:20px">
      <div><div class="eyebrow">Para onde foram os 1.000 créditos</div>
        <div class="stack" style="margin-top:8px" role="img" aria-label="Distribuição dos gastos">${cats.filter(c => c.v > 0).map(c => `<i style="width:${c.v / tot * 100}%;background:${c.c}" title="${c.k}: ${Math.round(c.v)}"></i>`).join('')}</div>
        <div class="stackleg">${cats.filter(c => c.v > 0).map(c => `<span><i style="background:${c.c}"></i>${c.k} <b class="mono">${Math.round(c.v)}</b></span>`).join('')}</div>
        <div class="kv" style="margin-top:12px"><div><small>Plantão pago</small><b>${fmt(sp.plantao)}</b></div><div><small>Decisões pagas</small><b>${fmt(decis)}</b></div><div><small>Rodadas no vermelho</small><b>${G.deficit}</b></div><div><small>Reserva final</small><b>${fmt(G.credits)}</b></div></div>
        <p class="muted" style="font-size:13px;margin-top:10px">${G.deficit ? `A verba acabou antes do fim: ${G.deficit} ${plural(G.deficit, 'rodada', 'rodadas')} no vermelho custaram confiança do banco e pressão sobre a equipe.` : G.credits < 60 ? 'Você terminou sem margem. Qualquer evento a mais teria posto a operação no vermelho.' : sp.plantao > decis ? 'O plantão consumiu mais do que todas as suas decisões: o custo fixo de manter gente em campo pesou mais que a inteligência e o apoio.' : 'Você gastou mais em decisões do que em manter a máquina funcionando, e sobrou margem.'}</p></div>
      <div><div class="eyebrow">Gargalo por rodada</div>
        <div class="runs">${runs.map(x => `<span class="run ${TOCS[x.k].cor}"><b>${TOCS[x.k].nome}</b> · ${x.from === x.to ? 'R' + x.from : 'R' + x.from + '–R' + x.to}</span>`).join('') || '<span class="faint">Sem dados.</span>'}</div>
        <p class="muted" style="font-size:13px">${runs.length >= 3 ? 'A restrição migrou como a teoria prevê: informação, pessoal e depois tempo.' : runs.length === 2 ? 'A restrição migrou uma vez. Quem elevou o primeiro elo viu o próximo aparecer.' : 'O mesmo elo ficou no controle o tempo todo: ele nunca foi elevado, ou a operação acabou cedo.'}</p>
        <p class="serif" style="font-size:15.5px;line-height:1.5;margin-top:8px">${verdict}</p></div>
    </div></div>`;
}

/* ---------- Debrief ---------- */
function debriefHTML() {
  const S = G.score, st = G.stats, H = G.hostages, toc = tocConstraint();
  const miss = []; if (!G.K.profile) miss.push('perfil'); if (!G.K.route) miss.push('rota'); if (!G.K.count) miss.push('nº de armados'); if (!G.K.vault) miss.push('cofre'); if (!G.K.hostages) miss.push('estado dos reféns'); if (!G.K.accomplice) miss.push('cúmplice');
  const avgP = st.pressN ? Math.round(st.pressSum / st.pressN) : 0;
  const empty = ZONES.filter(z => (st.initCov[z.id] || 0) === 0).length;
  const dimsArr = [['vidas', S.vidas], ['captura', S.captura], ['valores', S.valores], ['eficiência', S.eficiencia], ['confiança', S.confianca]].sort((a, b) => a[1] - b[1]);
  const weakest = dimsArr[0][0];
  const next = { vidas: 'abrir a negociação já na rodada 1 e manter a escada em ordem; o líder é o seu maior fator de risco', captura: 'cobrir mais as rotas candidatas (ou investir em rota) e conter o cofre com a pressão da Entrada', valores: 'reduzir o ritmo do cofre com agentes na Entrada ou fechar a rota antes que ele abra', 'eficiência': 'enxugar o que se contrata e compra antes do cerco (é de onde sai a maior parte da verba), cortar gastos sem retorno e encerrar a crise mais cedo', confiança: 'falar com os stakeholders mais cedo e com mais regularidade, em especial o prefeito antes da rodada 6' }[weakest];
  const C = [
    { n: 'Teoria das Restrições', ref: 'Goldratt & Cox (1984)', you: `${tocRuns().length ? 'Gargalo por rodada: ' + runTxt(tocRuns()) + '. ' : ''}${tocAlign().n ? `${tocAlign().hit} de ${tocAlign().n} ordens de recurso miraram o gargalo do momento. ` : ''}Você terminou com ${adequateCount()} de 7 zonas adequadas, e a rota real (${ZONE[G.route].nome}) tinha ${st.initCov[G.route] || 0}% de cobertura no início.`, les: 'Melhorias fora da restrição não mudam o resultado do sistema. Os cinco passos de foco: identificar o elo mais fraco, explorá-lo, subordinar o resto a ele, elevá-lo e repetir, porque o gargalo migra. Aqui: informação (início), pessoal (meio), tempo e fadiga (fim). Reforçar uma zona que não era rota foi orçamento parado.' },
    { n: 'Racionalidade limitada e valor da informação', ref: 'Simon (1955); Howard (1966)', you: `Você gastou ${fmt(G.spent.intel)} créditos em inteligência (${st.intel} investigações) e terminou sabendo ${knownCount()} de 6 variáveis ocultas${miss.length ? `. Ficaram ocultas: ${miss.join(', ')}.` : '.'}`, les: 'Uma informação vale a diferença entre o resultado esperado de decidir com ela e sem ela. Ninguém otimiza: todos satisfazem. A pergunta é quanto saber antes de agir.' },
    { n: 'Consciência situacional e decisão naturalística', ref: 'Endsley (1995); Klein (1998)', you: `Você teve ${st.reports || 0} relatos de campo, dos quais ${st.noise || 0} eram ruído de baixa confiança. Usou a Pausa de Comando ${st.pausas} vez${st.pausas === 1 ? '' : 'es'}.`, les: 'Perceber, compreender e projetar são três coisas diferentes. Dado bruto sem interpretação engana; interpretação sem projeção chega tarde. Veteranos reconhecem padrões, mas padrão reconhecido sem checagem também erra.' },
    { n: 'Negociação baseada em interesses e em crise', ref: 'Fisher, Ury & Patton (2011); Vecchi et al. (2005); Voss & Raz (2016)', you: `Degrau máximo: ${G.nego.maxStep}/5 em ${G.nego.tries} rodadas de negociação. Etapas puladas: ${G.nego.skips}. Pressões: ${st.press || 0}. Cobertura média das rotas (seu BATNA): ${Math.round(avgRouteCov())}%.`, les: 'A escada de cinco degraus funciona em ordem. Pular etapa reduz pela metade a chance de avançar. Fechar rotas fortalece o seu BATNA e enfraquece o do líder: o perímetro altera a negociação.' },
    { n: 'Stakeholders e comunicação de crise', ref: 'Freeman (1984); Mitchell, Agle & Wood (1997); Coombs (2007)', you: `Final: ${STK_KEYS.map(k => `${STK[k].nome} ${Math.round(G.stk[k].sat)}`).join(', ')}. ${STK_KEYS.filter(k => G.stk[k].lost).length ? 'Você perdeu: ' + STK_KEYS.filter(k => G.stk[k].lost).map(k => STK[k].nome).join(', ') + '.' : 'Nenhum stakeholder foi perdido.'}`, les: 'Saliência é poder, legitimidade e urgência, e muda ao longo do jogo: o prefeito ganha urgência, as famílias ganham legitimidade quando há feridos, o banco perde quando prioriza o cofre sobre as vidas. O mais barulhento não é necessariamente o mais saliente.' },
    { n: 'Liderança em crise: subir à sacada', ref: 'Heifetz & Linsky (2002); Marcus et al. (2019)', you: `Pausas de Comando: ${st.pausas}. Apoios externos: ${st.apoio}. Horas extras: ${st.horas}.`, les: 'Alternar entre a ação no salão e a observação do sistema é um custo (uma decisão a menos), e um investimento (visão sistêmica e menos pressão). Usar sempre ou nunca são os dois extremos ruins.' },
    { n: 'Informação distribuída', ref: 'Stasser & Titus (1985); Edmondson (1999)', you: `${empty} das 7 zonas não tinham ninguém no início. Zonas sem agentes não geram relatos: você só ouviu onde posicionou gente.`, les: 'Cada agente enxerga apenas a própria zona, e grupos tendem a discutir o que todos já sabem. Integrar fragmentos é trabalho do líder, e quem decide só pelo que ouve em voz alta perde o que o silêncio esconde.' },
    { n: 'Vieses: enquadramento e escalada de comprometimento', ref: 'Kahneman & Tversky (1979); Staw (1976)', you: `Seus relatórios de reféns foram escritos em termos de ${G.frame === 'ganho' ? 'ganhos ("N reféns ilesos")' : 'perdas ("N reféns em risco")'}. Maior insistência na mesma postura sem sucesso: ${st.maxFail} vez${st.maxFail === 1 ? '' : 'es'}.${G.mayorPromise ? ' Você prometeu um desfecho ao prefeito, e promessas ancoram decisões futuras.' : ''}`, les: 'O mesmo fato, enquadrado como ganho ou perda, muda a decisão. Insistir num plano que deixou de funcionar para justificar o que já foi investido é escalada de comprometimento. Pergunte: eu escolheria isso se começasse hoje?' },
    { n: 'Desempenho sob pressão', ref: 'Yerkes & Dodson (1908)', you: `Pressão operacional média ${avgP}, pico ${st.peakPressure}. Fadiga mínima da equipe: ${Math.round(st.minFF * 100)}% de eficiência.`, les: 'A eficiência segue um U invertido: pouca pressão gera complacência, muita gera erro. A zona ótima fica perto de 50. Rodízio e Pausa de Comando são ferramentas para ajustar a pressão, mas custam cobertura e decisões.' },
    { n: 'Métricas concorrentes', ref: 'Kaplan & Norton (1992); Kerr (1975)', you: `Dimensão mais fraca: ${weakest}. Placar: vidas ${Math.round(S.vidas * 100)}%, prisões ${Math.round(S.captura * 100)}%, valores ${Math.round(S.valores * 100)}%, eficiência ${Math.round(S.eficiencia * 100)}%, confiança ${Math.round(S.confianca * 100)}%.`, les: 'Nenhuma métrica isolada resume uma operação, e quem a perseguia sozinha distorceu as outras. Se os pesos fossem outros, você teria agido diferente? Isso revela os incentivos que a sua organização usa.' }
  ];
  const kolb = [
    ['1. Experiência concreta', `Você comandou ${G.round} rodadas e terminou com ${S.grade} (${S.total.toFixed(0)}). O desfecho foi: ${outcomeStory().tag}.`],
    ['2. Observação reflexiva', 'Qual foi o momento decisivo? Onde faltou informação? Que stakeholder dominou a sua atenção sem merecer?'],
    ['3. Conceituação abstrata', 'Os conceitos ao lado explicam o que aconteceu. Qual deles você não tinha nomeado antes?'],
    ['4. Experimentação ativa', `Na próxima partida, tente ${next}.`]
  ];
  const qs = ['Qual era a restrição da sua operação em cada fase? Você percebeu quando ela mudou?', 'Quanto você investiu em informação antes de agir? Esse investimento se pagou?', 'Em que momento a negociação avançou ou regrediu? O que você fez para isso acontecer?', 'Houve algum momento em que você insistiu num plano que já não funcionava? Por quê?', 'Se os pesos do placar fossem outros, você teria agido de outra forma?'];
  const bridge = [['Reféns', 'Clientes, dados de clientes ou colaboradores afetados por uma crise'], ['Assaltantes', 'Um ataque de ransomware, um concorrente agressivo ou uma crise reputacional'], ['Cofre', 'Caixa, ativos estratégicos ou propriedade intelectual'], ['Perímetro e rotas de fuga', 'Controles internos e vulnerabilidades operacionais'], ['Negociação com o líder', 'Negociação com contrapartes hostis: sindicatos, credores, atacantes'], ['Imprensa e prefeito', 'Mídia, redes sociais, conselho de administração e reguladores'], ['Agências parceiras', 'Fornecedores, parceiros e áreas fora da sua hierarquia'], ['Fadiga da equipe', 'Burnout em equipes de resposta a incidentes']];
  return `<h1 class="sr">Debrief</h1><div class="grid" style="gap:16px">${econHTML()}<div><div class="eyebrow">Ciclo de Kolb</div><div class="kolb" style="margin-top:8px">${kolb.map(([a, b]) => `<div class="concept"><h4>${a}</h4><p class="les">${b}</p></div>`).join('')}</div></div>
    <div><div class="eyebrow">Suas decisões e os conceitos</div><div class="grid" style="gap:12px;margin-top:8px;grid-template-columns:repeat(auto-fit,minmax(340px,1fr))">${C.map(c => `<div class="concept"><h4>${c.n}</h4><span class="ref">${c.ref}</span><div class="you">${c.you}</div><p class="les">${c.les}</p></div>`).join('')}</div></div>
    <div class="card"><h2 class="h3">Perguntas para a reflexão</h2><ul style="margin:0;padding-left:18px;display:grid;gap:6px">${qs.map(q => `<li>${q}</li>`).join('')}</ul></div>
    <div class="card"><h2 class="h3">Da simulação para a gestão de crises corporativas</h2><div class="scroll-x"><table class="table"><thead><tr><th>Na simulação</th><th>Na empresa</th></tr></thead><tbody>${bridge.map(([a, b]) => `<tr><td><b>${a}</b></td><td>${b}</td></tr>`).join('')}</tbody></table></div></div></div>`;
}
const POST_TABS = [['score', 'Pontuação'], ['news', 'Gazeta'], ['badges', 'Conquistas'], ['replay', 'Replay'], ['debrief', 'Debrief']];
function renderPost() {
  const i = POST_TABS.findIndex(t => t[0] === UI.post), nx = POST_TABS[i + 1];
  const body = UI.post === 'score' ? scoreHTML() : UI.post === 'news' ? newsHTML() : UI.post === 'badges' ? badgesHTML() : UI.post === 'replay' ? replayHTML() : debriefHTML();
  return `<div class="screen"><div class="postnav"><div class="pntabs" role="tablist" aria-label="Resultado da operação">${POST_TABS.map(([k, l]) => `<button class="pn" role="tab" id="pt-${k}" aria-controls="postp" data-act="ptab" data-t="${k}" aria-selected="${UI.post === k}" tabindex="${UI.post === k ? 0 : -1}">${l}</button>`).join('')}</div><span class="spacer"></span><button class="btn sm ghost" data-act="tomenu">Menu</button></div>
    <div class="post" id="postp" role="tabpanel" aria-labelledby="pt-${UI.post}">${body}<div class="row" style="margin-top:24px">${nx ? `<button class="btn primary" data-act="ptab" data-t="${nx[0]}" data-nav="1">Próximo: ${nx[1]} →</button>` : ''}<button class="btn" data-act="again">Jogar novamente</button></div></div></div>`;
}

/* ===================================================================
   AÇÕES
   =================================================================== */
const ACT = {}, CHG = {};
const warn = m => toast('COMANDO', m, 'warn');
/* Depois de uma ação que some com o botão focado, o foco vai para o próximo lugar útil. */
const focusFirst = (...sels) => { for (const q of sels) { const el = $app.querySelector(q); if (el) { el.focus({ preventScroll: true }); return; } } };
function setPhase(p) { G.phase = p; saveGame(); render(); }

ACT.diff = d => { UI.diffSel = d.v; render(); };
ACT.start = () => { newGame(UI.diffSel, { noLimit: UI.noLimit }); UI.sel = null; UI.tab = 'tatica'; UI.lvl = 1; UI.post = 'score'; UI.emptyConfirm = false; setPhase('briefing'); };
ACT.continue = () => { const s = loadSave(); if (!s) { render(); return; } G = s; UI.timerRound = -1; if (G.stage === 'resolving') G.stage = 'result'; render(); };
ACT.howto = () => { UI.tutor = true; render(); };
ACT.closehowto = () => { UI.tutor = false; render(); const b = $app.querySelector('[data-act=howto]'); if (b) b.focus({ preventScroll: true }); };
ACT.tobrief = () => setPhase('recruit');
ACT.skipbrief = (d, el) => { $app.classList.add('noanim'); if (el && el.tagName === 'BUTTON') { const b = $app.querySelector('[data-act=tobrief]'); if (b) b.focus({ preventScroll: true }); } };
/* Manchetes: pausa sem re-renderizar (o letreiro continua de onde estava). */
ACT.tkpause = () => {
  UI.tkPause = !UI.tkPause;
  document.querySelectorAll('.ticker').forEach(t => t.classList.toggle('paused', UI.tkPause));
  document.querySelectorAll('.tkp').forEach(b => { const l = (UI.tkPause ? 'Retomar' : 'Pausar') + ' as manchetes'; b.setAttribute('aria-pressed', UI.tkPause); b.setAttribute('aria-label', l); b.title = l; b.textContent = UI.tkPause ? '▶' : '❚❚'; });
};
ACT.lvl = d => { UI.lvl = +d.t; UI.tabAnim = true; render(); };
ACT.cutgo = () => { const c = UI.cut; UI.cut = null; render(); if (c && c.after) c.after(); };
ACT.hire = d => {
  const a = agentById(d.id);
  if (G.team.includes(d.id)) { G.team = G.team.filter(x => x !== d.id); G.credits += a.custo; G.spent.rec -= a.custo; delete G.az[d.id]; }
  else if (G.credits >= a.custo) { G.team.push(d.id); G.credits -= a.custo; G.spent.rec += a.custo; G.az[d.id] = 'reserva'; }
  else { warn('Créditos insuficientes para ' + a.nome + '.'); return; }
  UI.emptyConfirm = false; saveGame(); render();
};
ACT.buygear = d => {
  const e = EQ[d.id];
  if (G.gear.includes(d.id)) { G.gear = G.gear.filter(x => x !== d.id); G.credits += e.custo; G.spent.equip -= e.custo; delete G.gz[d.id]; }
  else if (G.credits >= e.custo) { G.gear.push(d.id); G.credits -= e.custo; G.spent.equip += e.custo; G.gz[d.id] = 'reserva'; }
  else { warn('Créditos insuficientes para ' + e.nome + '.'); return; }
  saveGame(); render();
};
ACT.torecruit = () => {
  if (!G.team.length) {
    if (!UI.emptyConfirm) { UI.emptyConfirm = true; render(); return; }
    G.team = ['g1', 'g2']; G.stats.noRecruit = true; G.team.forEach(id => G.az[id] = 'reserva');
  }
  UI.emptyConfirm = false; UI.sel = null; G.pressure = calcPressure(); autoPlace();
  const lead = G.team.slice().sort((a, b) => stat(b, 'tat') - stat(a, 'tat'))[0];
  UI.cut = { time: '14h22', title: 'A equipe chega ao local', btn: 'Montar o perímetro', lines: [
    { t: `${G.team.length} ${G.team.length === 1 ? 'profissional desce' : 'profissionais descem'} das viaturas na Rua Marechal Deodoro. O quarteirão já está isolado com fita, e a fita já tem uma plateia.` },
    { t: `[RÁDIO] ${agentById(lead).nome} para o comando: “Equipe no local. Aguardo a distribuição pelas zonas. O banco tem mais saídas do que parece.” Câmbio.`, radio: true },
    { t: 'Quatro das sete zonas ao redor da agência podem ser rotas de fuga. Você não sabe quais.' }] };
  setPhase('perimeter');
};
CHG.camplus = (v, d, el) => { G.camAdj.plus = v; if (G.camAdj.minus === v) G.camAdj.minus = Object.keys(ATTR).find(k => k !== v); saveGame(); render(); };
CHG.camminus = (v) => { G.camAdj.minus = v; if (G.camAdj.plus === v) G.camAdj.plus = Object.keys(ATTR).find(k => k !== v); saveGame(); render(); };
CHG.nolimit = (v, d, el) => { UI.noLimit = !!el.checked; };
ACT.selchip = d => { UI.sel = (UI.sel && UI.sel.t === d.t && UI.sel.id === d.id) ? null : { t: d.t, id: d.id }; render(); };
ACT.place = d => {
  if (UI.sel) { if (UI.sel.t === 'a') G.az[UI.sel.id] = d.z; else G.gz[UI.sel.id] = d.z; UI.sel = null; saveGame(); }
  else UI.pickZone = UI.pickZone === d.z ? null : d.z;
  render();
};
ACT.autoplace = () => { autoPlace(); UI.sel = null; saveGame(); render(); };
ACT.p1intel = d => { const r = phase1Intel(d.id); if (!r) { warn('Créditos insuficientes.'); return; } saveGame(); render(); };
ACT.tosiege = () => {
  confirmPerimeter(); G.phase = 'siege'; UI.pickZone = null; startRound();
  const adq = adequateCount();
  UI.cut = { time: '14h37', title: 'Perímetro fechado', btn: 'Começar o cerco', lines: [
    { t: `As equipes assumem as posições. ${adq} de 7 zonas têm cobertura adequada; nas outras, você está apostando.` },
    { t: 'Dentro da agência, o telefone começa a tocar. É a linha que você mandou ligar.' },
    { t: '[RÁDIO] Comando, todas as equipes em posição. A partir de agora o relógio é seu. Câmbio.', radio: true }] };
  render();
};

ACT.takepanel = () => { G.stage = 'panel'; UI.tab = 'tatica'; UI.lvl = 1; UI.ivConfirm = false; UI.pickZone = null; saveGame(); render(); };
/* Abas de decisão. Vindo de um alerta ou do gargalo, o foco e a rolagem acompanham a aba aberta. */
ACT.tab = (d, el) => {
  UI.tab = d.t; UI.tabAnim = true; render();
  if (el && !el.classList.contains('tab')) { const t = document.getElementById('tab-' + d.t); if (t) { t.focus({ preventScroll: true }); t.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' }); } }
};
const addD = (d) => { const r = addDecision(d); if (!r.ok) warn(r.msg); else { saveGame(); } render(); };
ACT.addrepos = () => {
  if (!UI.repoAgent || !UI.repoZone) { warn('Escolha o agente e o destino.'); return; }
  if (G.az[UI.repoAgent] === UI.repoZone) { warn('O agente já está nessa zona.'); return; }
  addD({ front: 'tatica', kind: 'repos', p: { agent: UI.repoAgent, zone: UI.repoZone }, label: `${shortName(agentById(UI.repoAgent).nome)} → ${ZNAME(UI.repoZone)}`, slots: 1 });
};
CHG.repoagent = v => { UI.repoAgent = v; render(); }; CHG.repozone = v => { UI.repoZone = v; render(); }; CHG.apoiozone = v => { UI.apoioZone = v; };
CHG.negotiator = v => { G.nego.negotiator = v; saveGame(); render(); };
ACT.addapoio = () => { if (!UI.apoioZone) { warn('Escolha a zona do apoio externo.'); return; } addD({ front: 'tatica', kind: 'apoio', p: { zone: UI.apoioZone }, label: `Apoio externo em ${ZNAME(UI.apoioZone)}`, slots: 1, cost: apoioCost() }); };
ACT.addpausa = () => addD({ front: 'tatica', kind: 'pausa', p: {}, label: 'Pausa de Comando', slots: 1 });
ACT.addhoras = () => addD({ front: 'tatica', kind: 'horas', p: {}, label: 'Horas extras', slots: 1, cost: horasCost() });
ACT.iv = () => { UI.ivConfirm = true; render(); focusFirst('[data-act=ivno]'); };
ACT.ivno = () => { UI.ivConfirm = false; render(); focusFirst('[data-act=iv]'); };
ACT.ivyes = () => { UI.ivConfirm = false; addD({ front: 'tatica', kind: 'interv', p: {}, label: 'INTERVENÇÃO', slots: D_().slots }); focusFirst('[data-act=iv]'); };
ACT.addnego = d => { const t = d.t === 'press' ? 'press' : +d.t; addD({ front: 'nego', kind: 'nego', p: { tech: t }, label: t === 'press' ? 'Pressionar o líder' : `Negociar: ${POSTURES[t - 1].nome}`, slots: 1 }); };
ACT.addintel = d => addD({ front: 'intel', kind: 'intel', p: { id: d.id }, label: INTEL.find(i => i.id === d.id).nome, slots: 1, cost: intelCost(d.id) });
ACT.addcom = d => { const c = COMMS.find(x => x.id === d.id); addD({ front: 'com', kind: 'com', p: { cid: d.id }, label: c.nome, slots: 1, cost: c.custo }); };
ACT.rmq = (d, el) => { removeDecision(+d.id); saveGame(); render(); if (el) focusFirst('.actbar .qx', '.actbar [data-act=execute]'); };
ACT.zonepick = d => { UI.pickZone = d.z; UI.tab = 'tatica'; UI.repoZone = d.z; UI.apoioZone = d.z; render(); };
ACT.execute = () => {
  if (!G || G.phase !== 'siege' || G.stage !== 'panel') return;
  stopTimer(); UI.ivConfirm = false; resolveDecisions(); render();
};
ACT.evchoice = d => { if (G.stage !== 'event') return; if (!chooseEvent(+d.i)) { warn('Créditos insuficientes para essa escolha.'); return; } render(); };
ACT.cont = () => {
  if (G.end) { const tb = document.getElementById('toasts'); if (tb) tb.innerHTML = ''; G.phase = 'outcome'; saveGame(); render(); return; }
  startRound(); render();
};
ACT.toscore = () => { G.phase = 'post'; UI.post = 'score'; saveGame(); render(); };
ACT.ptab = d => { UI.post = d.t; render(); };
ACT.rnode = d => { UI.replayR = +d.r; render(); };
ACT.again = () => { stopTimer(); clearSave(); G = null; UI.timerRound = -1; render(); };
ACT.tomenu = () => { stopTimer(); G = null; UI.timerRound = -1; render(); };

/* ===================================================================
   RENDER / BOOT
   =================================================================== */
let lastKey = '', BAR = '';
const setBar = h => { BAR = h; };
const T0 = Date.now();
const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
/* Assinatura do elemento focado, para devolver o foco depois do re-render (o innerHTML troca todos os nós). */
const FOCUS_KEYS = ['t', 'id', 'v', 'z', 'i', 'r'];
function focusSig(el) {
  if (!el || el === document.body || !$app.contains(el)) return null;
  let sel = null;
  if (el.id) sel = '#' + CSS.escape(el.id);
  else if (el.dataset && el.dataset.act) sel = `[data-act="${el.dataset.act}"]` + FOCUS_KEYS.filter(k => el.dataset[k] != null).map(k => `[data-${k}="${CSS.escape(el.dataset[k])}"]`).join('');
  if (!sel) return null;
  return { sel, i: [...$app.querySelectorAll(sel)].indexOf(el) };
}
function restoreFocus(sig, changed) {
  const modal = $app.querySelector('.cut, .modalback');
  if (modal) {
    if (!modal.contains(document.activeElement)) { const d = modal.querySelector('[role=dialog]') || modal; d.setAttribute('tabindex', '-1'); d.focus({ preventScroll: true }); }
    return;
  }
  let el = null;
  if (!changed && sig) { const all = $app.querySelectorAll(sig.sel); el = all[sig.i] || all[0] || null; }
  if (!el && (changed || sig)) { el = $app.querySelector('h1'); if (el) el.setAttribute('tabindex', '-1'); }
  if (el && el !== document.activeElement) el.focus({ preventScroll: true });
}
/* Medidores e números que mudaram desde o último render deslizam do valor antigo para o novo. */
function tweenChanged(prev) {
  $app.querySelectorAll('[data-k]').forEach(el => {
    const p = prev[el.dataset.k]; if (p == null) return;
    if (el.dataset.val != null) {
      const i = el.querySelector('i'); if (!i || +p === +el.dataset.val) return;
      const to = i.style.width; i.style.transition = 'none'; i.style.width = clamp(+p, 0, 100) + '%'; void i.offsetWidth; i.style.transition = ''; i.style.width = to;
      el.classList.add('chg');
    } else if (el.dataset.n != null) {
      const a = +p, b = +el.dataset.n; if (a === b || !isFinite(a) || !isFinite(b)) return;
      const t0 = performance.now();
      el.classList.add('chg');
      const step = now => { const t = Math.min(1, (now - t0) / 700), e = 1 - Math.pow(1 - t, 3); el.textContent = fmt(a + (b - a) * e); if (t < 1 && el.isConnected) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }
  });
}
function render() {
  const sig = focusSig(document.activeElement);
  const prev = {}; $app.querySelectorAll('[data-k]').forEach(el => { prev[el.dataset.k] = el.dataset.val != null ? el.dataset.val : el.dataset.n; });
  BAR = '';
  let html;
  if (!G) html = renderMenu();
  else if (G.phase === 'briefing') html = renderBriefing();
  else if (G.phase === 'recruit') html = renderRecruit();
  else if (G.phase === 'perimeter') html = renderPerimeter();
  else if (G.phase === 'siege') html = G.stage === 'update' ? renderUpdate() : G.stage === 'panel' ? renderPanel() : G.stage === 'event' ? renderEventStage() : renderResult();
  else if (G.phase === 'outcome') html = renderOutcome();
  else html = renderPost();
  $app.innerHTML = html + (BAR ? `<div class="actbar" role="region" aria-label="Próximo passo"><div class="actin">${BAR}</div></div>` : '') + cutHTML();
  document.body.classList.toggle('withbar', !!BAR);
  UI.tabAnim = false;
  const key = G ? G.phase + ':' + (G.stage || '') + ':' + G.round + ':' + UI.post : 'menu', changed = key !== lastKey;
  if (changed) $app.classList.remove('noanim');
  $app.classList.toggle('still', !changed);
  if (changed) { window.scrollTo(0, 0); lastKey = key; }
  // o letreiro segue de onde estava, em vez de recomeçar a cada clique
  $app.querySelectorAll('.tkin').forEach(t => { t.style.animationDelay = `-${(((Date.now() - T0) / 1000) % 60).toFixed(2)}s`; });
  restoreFocus(sig, changed);
  if (!reduceMotion()) tweenChanged(prev);
  const inSiege = G && G.phase === 'siege';
  const edge = document.getElementById('edge');
  if (edge) edge.classList.toggle('hot', !!(inSiege && perceivedAgit().v > 70));
  if (inSiege && G.stage === 'panel') { if (UI.timerRound !== G.round) startTimer(); else tick(); }
  else stopTimer();
  // animação dos medidores do feedback
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('.meter>i[data-to]').forEach(i => { i.style.width = i.dataset.to + '%'; })));
}
$app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.getAttribute('aria-disabled') === 'true') { if (el.dataset.why) warn(el.dataset.why); return; }
  const fn = ACT[el.dataset.act]; if (fn) fn(el.dataset, el);
});
$app.addEventListener('change', e => {
  const el = e.target.closest('[data-chg]'); if (!el) return;
  const fn = CHG[el.dataset.chg]; if (fn) fn(el.value, el.dataset, el);
});
$app.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g[data-act]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
/* Teclado: foco preso nas janelas modais, Esc para cancelar, 1–3 na carta de evento, setas em abas e na dificuldade. */
document.addEventListener('keydown', e => {
  const modal = $app.querySelector('.cut, .modalback');
  if (e.key === 'Tab' && modal) {
    const f = [...modal.querySelectorAll('button, [href], select, input, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1], inside = modal.contains(document.activeElement);
    if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    return;
  }
  if (e.key === 'Escape') {
    if (UI.tutor) { e.preventDefault(); ACT.closehowto(); }
    else if (G && G.phase === 'siege' && UI.ivConfirm) { e.preventDefault(); ACT.ivno(); }
    else if (G && G.phase === 'perimeter' && UI.sel) { e.preventDefault(); UI.sel = null; render(); }
    return;
  }
  if (G && G.phase === 'siege' && G.stage === 'event' && /^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const b = $app.querySelector(`.evcard [data-act=evchoice][data-i="${+e.key - 1}"]`); if (b) { e.preventDefault(); b.focus(); b.click(); }
    return;
  }
  const t = e.target, grp = t && t.closest && t.closest('[role=tablist],[role=radiogroup]');
  if (grp && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    const items = [...grp.querySelectorAll('[role=tab],[role=radio]')], cur = t.closest('[role=tab],[role=radio]'); let i = items.indexOf(cur); if (i < 0) return;
    const n = items.length; i = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1) + n) % n;
    e.preventDefault(); items[i].focus(); items[i].click();
  }
});
window.PERIMETRO = { get G() { return G; }, newGame, startRound, resolveDecisions, chooseEvent, finishRound, addDecision, computeScore, zoneCoverage, intervProb, negoParts, autoPlace, confirmPerimeter, render, ACT, UI };
render();
