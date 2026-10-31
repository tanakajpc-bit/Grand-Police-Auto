// L2.5: o jogo conta a verdade? Joga milhares de partidas completas e confere, texto por texto, tudo o que o jogador lê no fim contra
// o estado real da partida e contra um REGISTRO INDEPENDENTE do que foi decidido (anotado por fora do motor, em cada rodada):
//   Gazeta (manchete, horas, reféns, nomes dos mortos, cofre, verba, vazamentos, citações, linha do tempo, placar)
//   história do desfecho e "a verdade por trás da névoa" · tela de pontuação · selos (regra reescrita a partir da descrição de cada selo)
//   replay (cada decisão e cada evento de cada rodada, mais a preparação antes do cerco) · debrief (cada contagem que ele cita) · ponte da Tabela 12
// As funções de texto são as REAIS da interface: o carregador recorta de src/ui3.js só a parte que desenha o desfecho (sem DOM).
// uso: node tools/sim/verdade.js [partidas por política e nível] [saida.md]       PERI_SRC=<src de outra versão> mede essa versão
const fs = require('fs'), path = require('path');
const B = require('./bots'), E = require('./experts'), TI = require('./tiers');
const { mulberry32, load } = require('./engine-loader');
const SRC = process.env.PERI_SRC || path.join(__dirname, '..', '..', 'src');
const N = +process.argv[2] || 120, OUT = process.argv[3];

/* ---------- carrega o motor + a parte de texto da interface ---------- */
const ler = f => fs.readFileSync(path.join(SRC, f), 'utf8');
const pega = (src, re, nome) => { const m = src.match(re); if (!m) throw new Error('não achei ' + nome + ' no código da interface'); return m[0]; };
const ui1 = ler('ui1.js'), ui2 = ler('ui2.js'), ui3 = ler('ui3.js');
const marca = ui3.indexOf('/* ===================================================================\n   AÇÕES');
if (marca < 0) throw new Error('não achei o fim da parte de texto do ui3.js');
const extra = [pega(ui1, /^const fmt = .*$/m, 'fmt'), pega(ui1, /^const dec = .*$/m, 'dec'), pega(ui1, /^const br = .*$/m, 'br'), pega(ui1, /^const infoTip = .*$/m, 'infoTip'), pega(ui2, /^const FRONT_IC = .*$/m, 'FRONT_IC'),
  "const UI = { post: 'score', replayR: 1 };", ui3.slice(0, marca),
  'Object.assign(globalThis.__api, { UI, newsHTML, outcomeStory, truthHTML, scoreHTML, badgesHTML, replayHTML, debriefHTML, econHTML, chartSVG, renderOutcome });'].join('\n');
const A = load(1, SRC, extra);
const bad = [];
const V = require('./invariantes')(A, bad);

/* ---------- contabilidade das conferências ---------- */
const T = { total: 0, falhas: 0, jogos: 0, porId: {} };
function C(ok, id, det) {
  T.total++; const c = T.porId[id] || (T.porId[id] = { n: 0, f: 0, ex: [] }); c.n++;
  if (!ok) { T.falhas++; c.f++; if (c.ex.length < 3) c.ex.push(String(det).slice(0, 400)); }
}
const sum = a => a.reduce((s, x) => s + x, 0);
const strip = h => String(h).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').replace(/ ([.,;:!?%)])/g, '$1').replace(/\( /g, '(').trim();
const pl = (n, s, p) => (n === 1 ? s : p);
const inc = (t, s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'u').test(t);   // a expressão inteira, sem sobra de letras: "1 rodadas" não vale como "1 rodada"
const dec1 = x => Number(x).toFixed(1).replace('.', ',');
const hhmm = r => { const m = 14 * 60 + 37 + (r - 1) * 45;   // o relógio do cerco começa às 14h37, quando o perímetro fecha (a verba saiu às 14h12 e a equipe chegou às 14h27)
   return String(Math.floor(m / 60) % 24).padStart(2, '0') + 'h' + String(m % 60).padStart(2, '0'); };
const K6 = [['profile', 'perfil'], ['route', 'rota'], ['count', 'nº de armados'], ['vault', 'cofre'], ['hostages', 'estado dos reféns'], ['accomplice', 'cúmplice']];
const knownFlags = K => [!!K.profile, !!K.route, !!K.count, !!K.vault, !!K.hostages, !!K.accomplice];
const cofreFrase = v => (v < 25 ? 'O cofre permaneceu praticamente intocado.' : v < 60 ? 'Os assaltantes chegaram a trabalhar no cofre, mas não o abriram.' : v < 100 ? 'O cofre estava perto de ceder quando a crise terminou.' : 'O cofre foi aberto antes do desfecho.');
const nomesMortos = () => A.G.hl.filter(h => h.st === 'dead').map(h => A.HOST[h.id]);

/* Tabela 12 do documento original (Perimetro_Simulacao.docx, seção 8.3): a ponte entre a simulação e a gestão corporativa. */
const TABELA12 = [['Reféns', 'Clientes, dados de clientes ou colaboradores afetados por uma crise'], ['Assaltantes', 'Um ataque de ransomware, um concorrente agressivo ou uma crise reputacional'],
  ['Cofre', 'Caixa, ativos estratégicos ou propriedade intelectual'], ['Perímetro e rotas de fuga', 'Controles internos e vulnerabilidades operacionais'],
  ['Negociação com o líder', 'Negociação com contrapartes hostis: sindicatos, credores, atacantes'], ['Imprensa e prefeito', 'Mídia, redes sociais, conselho de administração e reguladores'],
  ['Agências parceiras', 'Fornecedores, parceiros e áreas fora da sua hierarquia'], ['Fadiga da equipe', 'Burnout em equipes de resposta a incidentes']];
/* Tabela 2 do documento: cada conceito tem de aparecer no debrief com a referência (autor e ano). */
const REFS = [['Goldratt', '1984'], ['Simon', '1955'], ['Howard', '1966'], ['Klein', '1998'], ['Endsley', '1995'], ['Weick', '1993'], ['Sutcliffe', '2007'], ['Fisher', '2011'], ['Vecchi', '2005'],
  ['Mitchell', '1997'], ['Coombs', '2007'], ['Heifetz', '2002'], ['Marcus', '2019'], ['Stasser', '1985'], ['Edmondson', '1999'], ['Kahneman', '1979'], ['Staw', '1976'], ['Yerkes', '1908'],
  ['Kaplan', '1992'], ['Kerr', '1975'], ['Kolb', '1984'], ['Csikszentmihalyi', '1990']];

/* ---------- o registro independente: anota por fora do motor o que foi decidido e o que o jogador viu ---------- */
let cur = null;
const oConfirm = A.confirmPerimeter, oResolve = A.resolveDecisions, oChoose = A.chooseEvent;
A.confirmPerimeter = function () {
  const G = A.G, r = oConfirm.apply(this, arguments);
  if (cur) {
    cur.prep = { team: G.team.slice(), gear: G.gear.slice(), az: Object.assign({}, G.az), gz: Object.assign({}, G.gz), credits: G.credits, spent: Object.assign({}, G.spent),
      p1: Object.fromEntries(Object.entries(G.p1intel).map(([k, v]) => [k, v && typeof v === 'object' ? { ok: !!v.ok } : { ok: null }])), noRecruit: !!G.stats.noRecruit,
      covRoute: A.zoneCoverage(G.route), vazias: A.ZONES.filter(z => !G.team.some(id => G.az[id] === z.id)).length, rotaConhecida: !!(G.p1intel.rota && G.p1intel.rota.ok) };
  }
  return r;
};
A.resolveDecisions = function () {
  const G = A.G;
  if (cur) {
    const up = G.update;
    cur.rounds.push({ r: G.round, queue: G.queue.map(d => ({ kind: d.kind, front: d.front, label: d.label, cost: d.cost || 0, p: JSON.parse(JSON.stringify(d.p)) })), step0: G.nego.step, pressure0: G.pressure,
      reports: up.reports.map(x => x.kind), chegou: up.intel.length, ev: null, stepMid: null, step1: null });
  }
  const out = oResolve.apply(this, arguments);
  if (cur) cur.rounds[cur.rounds.length - 1].stepMid = G.nego.step;
  return out;
};
A.chooseEvent = function (idx) {
  const G = A.G, id = G.pendingEvent, ok = oChoose.apply(this, arguments);
  if (ok && cur) cur.rounds[cur.rounds.length - 1].ev = { id, label: A.EVENT_FX[id].choices[idx].label };
  return ok;
};

/* ---------- fatos derivados do registro (não do estado do motor) ---------- */
function fatos(rec, G) {
  const decs = rec.rounds.flatMap(r => r.queue), n = k => decs.filter(d => d.kind === k).length;
  // negociação: refeita só com o que o jogador mandou e com o que o motor mostrou na tela da rodada (linha "Funcionou")
  let tries = 0, press = 0, skips = 0, maxStep = 1, streak = 0, last = 0, maxFail = 0;
  rec.rounds.forEach((r, i) => {
    const d = r.queue.find(q => q.kind === 'nego');
    if (d) {
      tries++;
      if (d.p.tech === 'press') { press++; last = 0; }
      else {
        if (d.p.tech > r.step0) skips++;
        const ok = G.log[i].lines.some(l => l.tone === 'good' && /Funcionou/.test(l.text));
        if (ok) { streak = 0; last = d.p.tech; } else { streak = (d.p.tech === last ? streak : 0) + 1; maxFail = Math.max(maxFail, streak); last = d.p.tech; }
      }
    }
    maxStep = Math.max(maxStep, r.stepMid, r.step1);
  });
  const p1 = Object.keys(rec.prep.p1), sofia = rec.prep.team.includes('sofia');
  const custoIntel = sum(p1.map(k => Math.round(A.INTEL.find(i => i.id === k).custo * (sofia ? .8 : 1)))) + sum(decs.filter(d => d.kind === 'intel').map(d => d.cost));
  const aceitouTroca = rec.rounds.filter(r => r.ev && r.ev.id === 'proposta' && /^Aceitar a troca/.test(r.ev.label)).length;
  const promessa = rec.rounds.some(r => r.ev && r.ev.id === 'prefeito' && /^Garantir que resolverá/.test(r.ev.label));
  return {
    decs, pausas: n('pausa'), apoio: n('apoio'), horas: n('horas'), comms: n('com'), intervs: n('interv'), tries, press, skips, maxStep, maxFail, p1: p1.length, ordens: n('intel'), custoIntel,
    relatos: sum(rec.rounds.map(r => r.reports.length)), ruido: sum(rec.rounds.map(r => r.reports.filter(k => k === 'ruido').length)), sinal: sum(rec.rounds.map(r => r.reports.filter(k => k === 'rota').length)),
    chegaram: sum(rec.rounds.map(r => r.chegou)), pico: Math.max(...rec.rounds.map(r => r.pressure0)), media: Math.round(sum(rec.rounds.map(r => r.pressure0)) / rec.rounds.length),
    aceitouTroca, promessa
  };
}

/* ---------- 1. Gazeta ---------- */
function gazeta(rec, F) {
  const G = A.G, H = G.hostages, Ed = G.end, S = G.score, K = G.K, P = A.PROFILES[G.profile], tag = rec.tag;
  const html = A.newsHTML(), t = strip(html), hora = hhmm(G.round + 1), hrs = Math.max(1, Math.round(G.round * 45 / 60));
  const ck = (ok, id, det) => C(ok, 'gazeta: ' + id, tag + ' | ' + det);
  const hl = strip((html.match(/<h1 class="hl">([\s\S]*?)<\/h1>/) || [0, ''])[1]);
  const interv = Ed.type === 'intervencao' || (Ed.type === 'prazo' && Ed.variant === 'forcado');
  const v = Ed.type === 'prazo' && Ed.variant === 'forcado' ? Ed.sub : Ed.variant;
  const zona = Ed.zone ? A.ZONE[Ed.zone].nome : '';
  // tempo e duração
  ck(t.includes('Edição extra das ' + hora), 'edição extra na hora certa', hora);
  ck(t.includes(`terminou às ${hora}, depois de ${hrs} ${pl(hrs, 'hora', 'horas')} de cerco à Agência Central`), 'horas de cerco = rodadas × 45 min', `${hrs} h`);
  // reféns: ilesos, feridos, mortos
  const m = t.match(/Dos 17 reféns, (\d+) (?:saiu ileso|saíram ilesos)(?:, (\d+) (?:ficou ferido|ficaram feridos))?(?: e (\d+) (?:morreu|morreram))?\./);
  ck(!!m && +m[1] === 17 - H.hurt - H.dead && +(m[2] || 0) === H.hurt && +(m[3] || 0) === H.dead, 'ilesos, feridos e mortos batem com o estado', `${m ? m[0] : 'sem frase'} × ${17 - H.hurt - H.dead}/${H.hurt}/${H.dead}`);
  const mortos = nomesMortos(), mn = t.match(/A polícia confirmou (a morte de|as mortes de) ([^.]*)\./);
  if (H.dead) ck(!!mn && mn[2] === mortos.map(h => `${h.nome}, ${h.idade} anos`).join('; ') && mortos.length === H.dead && (mn[1] === 'a morte de') === (H.dead === 1), 'nomes e idades de quem morreu', mn ? mn[2] : 'sem frase');
  else ck(!mn, 'sem mortos, sem frase de confirmação', mn ? mn[0] : '');
  // manchete
  if (Ed.type === 'rendicao') ck(/RENDIÇÃO ENCERRA CERCO|REFÉNS SÃO LIBERTADOS SEM FERIMENTOS/.test(hl), 'manchete da rendição', hl);
  else if (interv) ck(/FORÇA-TAREFA|INTERVENÇÃO|AÇÃO DA POLÍCIA/.test(hl), 'manchete da intervenção', hl);
  else if (Ed.type === 'fuga') ck((Ed.variant === 'perseguicao' ? /PERSEGUIÇÃO PELA AVENIDA/ : Ed.variant === 'barrada' ? new RegExp('FUGA É BARRADA EM ' + zona.toUpperCase()) : new RegExp('ASSALTANTES ESCAPAM POR ' + zona.toUpperCase())).test(hl), 'manchete da fuga (com a zona certa)', hl + ' × ' + zona);
  else ck(/ULTIMATO TERMINA EM RENDIÇÃO/.test(hl), 'manchete do ultimato aceito', hl);
  if (H.dead + H.hurt) ck(!/SEM FERIMENTOS|RESGATA TODOS/.test(hl), 'manchete não diz "sem ferimentos" quando houve', hl);
  else if (Ed.type === 'rendicao' || (interv && v === 'limpa')) ck(/SEM FERIMENTOS|RESGATA TODOS/.test(hl), 'manchete celebra quando ninguém se feriu', hl);
  if (H.dead && (Ed.type === 'rendicao' || (interv && v !== 'fracasso'))) ck(/MORT/.test(hl), 'manchete cita os mortos', hl);
  // cofre, verba, agentes, vazamentos
  ck(t.includes(cofreFrase(G.vault)), 'frase do cofre pela faixa real', `${G.vault}`);
  const verba = A.DIFF[G.diff].verba, usado = Math.round((verba - G.credits) / verba * 100);
  ck(t.includes(`A operação consumiu ${usado}% da verba disponível`) && t.includes('praticamente sem margem') === (G.credits < 100), 'verba consumida = (verba da dificuldade − créditos) ÷ verba', `${usado}% com ${G.credits} de ${verba}`);
  const ah = (Ed.agentsHurt || []).length, ma = t.match(/(\d+) (agente da força-tarefa ficou ferido|agentes da força-tarefa ficaram feridos) na entrada/);
  ck(ah ? !!ma && +ma[1] === ah && (ah === 1) === /ficou ferido/.test(ma[2]) : !ma, 'agentes feridos na entrada', `${ah} × ${ma ? ma[0] : 'nada'}`);
  const lk = G.stats.leaks || 0;
  ck(lk === 0 ? !/vazaram ou foram desmentidos|vazou ou foi desmentido/.test(t) : lk === 1 ? t.includes('um comunicado do comando vazou ou foi desmentido') : t.includes(`${lk} comunicados do comando vazaram ou foram desmentidos`), 'vazamentos citados só se houve, com o número certo', `${lk}`);
  // negociação, informação, ordem política
  if (Ed.type === 'rendicao') ck(t.includes(`chegou ao degrau ${F.maxStep} de um processo de cinco etapas`) && F.maxStep === 5 && F.tries >= 4, 'degrau da negociação na rendição', `${F.maxStep} (${F.tries} rodadas)`);
  if (Ed.type === 'prazo' && Ed.variant === 'cedeu') ck(F.tries > 0 ? t.includes(`depois de uma negociação que chegou ao degrau ${F.maxStep}`) : t.includes('sem que tivesse havido conversa com o comando'), 'ultimato aceito: negociação só se houve', `${F.tries} rodadas, degrau ${F.maxStep}`);
  if (interv) {
    const forcada = !!Ed.forced && Ed.type === 'intervencao';
    ck(t.includes(`A operação foi autorizada na rodada ${G.round}`) || Ed.type === 'prazo', 'rodada em que a operação foi autorizada', `${G.round}`);
    ck(forcada ? t.includes('sob determinação do gabinete do prefeito') : !t.includes('sob determinação do gabinete do prefeito'), 'ordem do prefeito só quando foi ordem do prefeito', `forçada ${forcada}`);
    if (forcada) ck(G.round >= 6 && G.stk.prefeito.lost, 'ordem política só com o prefeito perdido a partir da rodada 6', `${G.round} ${G.stk.prefeito.lost}`);
    const prep = []; if (F.tries) prep.push('rodadas de negociação'); if (F.p1 + F.chegaram > 0 || A.knownCount() > 0) prep.push('levantamento de informações');
    if (Ed.type === 'intervencao' && !Ed.forced) ck(prep.length ? t.includes('Operação foi autorizada depois de ' + prep.join(' e ')) : (G.round === 1 ? t.includes('logo no início do cerco, sem negociação nem levantamento prévio') : t.includes('sem conversa com o líder nem levantamento prévio')), 'subtítulo só cita preparo que existiu', `negociou ${F.tries}, informação ${F.p1 + F.chegaram}, conhecidas ${A.knownCount()}`);
    const kc = A.knownCount();
    if (Ed.type === 'intervencao' && v === 'limpa') ck(kc >= 3 ? t.includes('a informação reunida antes da entrada foi decisiva') : t.includes('a entrada foi rápida e encontrou pouca resistência'), 'intervenção limpa: "informação decisiva" só com 3 ou mais variáveis conhecidas', `${kc}`);
    if (Ed.type === 'intervencao' && v === 'fracasso') ck(kc >= 4 ? t.includes('o interior reagiu com mais força do que o previsto') : t.includes('faltou informação sobre o interior'), 'fracasso: "faltou informação" só com menos de 4 conhecidas', `${kc}`);
  }
  if (Ed.type === 'fuga') {
    ck(t.includes(Ed.variant === 'barrada' ? `A cobertura da zona, de ${Ed.cov}%, impediu a saída` : Ed.variant === 'perseguicao' ? 'A perseguição foi encerrada na Avenida Principal' : `A cobertura da zona era de ${Ed.cov}% e não impediu a fuga`), 'cobertura da rota de fuga citada', `${Ed.cov}%`);
    ck(t.includes(`por ${zona}`) && t.includes('depois de mudarem o plano inicial') === (G.routeNow !== G.route), 'mudança de plano só quando o líder mudou de rota', `${G.route} → ${G.routeNow}`);
  }
  // citações
  const q = [...html.matchAll(/<blockquote>“([\s\S]*?)”<cite>([\s\S]*?)<\/cite><\/blockquote>/g)].map(x => [strip(x[1]), strip(x[2])]);
  ck(q.length === 4, 'quatro citações', `${q.length}`);
  if (q.length === 4) {
    const wn = q[0][1].split(',')[0];
    ck(!mortos.some(h => h.nome === wn) && !!A.HOSTAGE_LIST.find(h => h.nome === wn), 'a testemunha citada está viva', q[0][1]);
    const wq = Ed.type === 'rendicao' ? 'ninguém acreditou' : Ed.type === 'fuga' ? 'Eles saíram correndo' : Ed.type === 'prazo' && Ed.variant === 'cedeu' ? 'As últimas horas foram as piores' : v === 'limpa' ? 'Foi tudo muito rápido' : 'Eu só pensava na minha família';
    ck(q[0][0].includes(wq), 'fala da testemunha combina com o desfecho', q[0][0]);
    const pk = G.stk.prefeito.sat, fk = G.stk.familias.sat, bk = G.stk.banco.sat;
    ck(q[1][0].includes(pk >= 70 ? 'A cidade esteve bem protegida' : pk >= 40 ? 'Poderia ter sido mais rápido' : 'Vamos exigir uma apuração completa'), 'fala do prefeito pela satisfação real', `${pk.toFixed(1)}`);
    ck(q[2][0].includes(H.dead ? 'Nada devolve quem perdemos' : H.hurt ? 'Nossos parentes estão vivos, mas feridos' : fk >= 60 ? 'Só queríamos abraçá-los' : 'Ficamos horas sem informação'), 'fala das famílias pelo que houve com os reféns', `${H.dead}/${H.hurt}/${fk.toFixed(1)}`);
    ck(q[3][0].includes(S.valores > .8 ? 'O patrimônio está preservado' : S.valores > .4 ? 'Estamos avaliando as perdas' : 'Os prejuízos são significativos') && q[3][1].includes('em tom de reprovação') === (bk < 35), 'fala do banco pelo patrimônio e pela satisfação', `${S.valores.toFixed(2)} / ${bk.toFixed(1)}`);
  }
  // linha do tempo = os eventos que de fato ocorreram, na ordem
  const lt = html.match(/<b>Linha do tempo<\/b><ul[^>]*>([\s\S]*?)<\/ul>/), got = lt ? [...lt[1].matchAll(/<li><b>(.*?)<\/b> · (.*?)<\/li>/g)].map(x => `${x[1]} · ${x[2]}`) : [];
  const want = rec.rounds.filter(r => r.ev).map(r => `${hhmm(r.r)} · ${A.EVDEF[r.ev.id].titulo}`);
  ck(got.join('|') === want.join('|'), 'linha do tempo = eventos que ocorreram, em ordem', `${got.join(', ')} × ${want.join(', ')}`);
  // perfil, placar e editorial
  ck(t.includes(`perfil ${P.nome.toLowerCase()}.`) && t.includes(P.desc), 'perfil do líder', P.nome + ' | ' + t.slice(t.indexOf('Perfil do líder'), t.indexOf('Perfil do líder') + 120));
  ck(t.includes(`Nota ${S.grade} (${dec1(S.total)}/100). Vidas ${Math.round(S.vidas * 100)}% · Prisões ${Math.round(S.captura * 100)}% · Valores ${Math.round(S.valores * 100)}% · Confiança ${Math.round(S.confianca * 100)}%.`), 'placar da operação = pontuação', `${S.grade} ${S.total}`);
  ck(t.includes(S.grade === 'S' || S.grade === 'A' ? 'Quando a pressa perdeu para o método' : S.grade === 'B' || S.grade === 'C' ? 'Um desfecho que deixa lições' : 'Perguntas que a cidade vai exigir responder'), 'editorial pela nota', S.grade);
  ck(!/undefined|NaN|\[object|null/.test(t), 'sem texto quebrado', (t.match(/.{20}(undefined|NaN|\[object|null).{20}/) || [''])[0]);
}

/* ---------- 2. História do desfecho e a verdade por trás da névoa ---------- */
function historia(rec, F) {
  const G = A.G, H = G.hostages, Ed = G.end, K = G.K, P = A.PROFILES[G.profile], tag = rec.tag;
  const ck = (ok, id, det) => C(ok, 'desfecho: ' + id, tag + ' | ' + det);
  const o = A.outcomeStory(), txt = o.p.map(strip), hora = hhmm(G.round + 1), zona = Ed.zone ? A.ZONE[Ed.zone].nome : '';
  const v = Ed.type === 'prazo' ? Ed.sub : Ed.variant;
  ck(txt[0].startsWith(hora + '.'), 'primeiro parágrafo na hora certa', txt[0].slice(0, 12));
  ck(txt[txt.length - 1].includes(cofreFrase(G.vault)), 'frase final: o cofre pela faixa real', `${G.vault}`);
  ck(H.dead ? txt[txt.length - 1].includes(`${H.dead} ${pl(H.dead, 'morto', 'mortos')} entre os reféns`) && mortosOk(txt[txt.length - 1]) : H.hurt ? txt[txt.length - 1].includes(`${H.hurt} ${pl(H.hurt, 'refém ficou ferido', 'reféns ficaram feridos')}`) : txt[txt.length - 1].includes('Todos os 17 reféns saíram ilesos'), 'frase final: reféns', `${H.dead}/${H.hurt}`);
  function mortosOk(s) { const ns = nomesMortos().map(h => h.nome); return ns.every(n => s.includes(n)); }
  const ah = (Ed.agentsHurt || []).length; ck(ah ? txt[txt.length - 1].includes('Na entrada,') : !txt[txt.length - 1].includes('Na entrada,'), 'agentes feridos só se houve', `${ah}`);
  if (Ed.type === 'rendicao') {
    ck(o.tag === 'Rendição negociada' && txt[1].includes(`Foram ${G.round} rodadas de cerco, ${F.tries} delas com o canal aberto.`), 'rendição: rodadas e negociações', txt[1].slice(0, 80));
    ck(F.skips === 0 ? txt[1].includes('Ninguém pulou etapa') : txt[1].includes('Nem todos os degraus foram subidos em ordem'), 'rendição: "ninguém pulou etapa" só sem etapas puladas', `${F.skips}`);
    ck(G.agit < 25 ? txt[2].includes('quase uma formalidade') : txt[2].includes('Houve hesitação'), 'rendição: serena × tensa pela agitação real', `${G.agit}`);
    ck(txt.some(s => s.includes('já havia dado sinais de querer sair')) === !!Ed.defector && !!Ed.defector === !!G.defector, 'dissidente só se ele cooperou', `${G.defector}`);
  } else if (Ed.type === 'intervencao' || (Ed.type === 'prazo' && Ed.variant === 'forcado')) {
    ck(o.tag === (Ed.type === 'prazo' ? 'Prazo esgotado' : 'Intervenção'), 'etiqueta da intervenção', o.tag);
    ck(Ed.type === 'prazo' ? txt[0].includes('fim do prazo') : Ed.forced ? txt[0].includes('A ordem vem de cima') : txt[0].includes('O comando dá o sinal'), 'abertura: sinal do comando × ordem do prefeito × fim do prazo', txt[0].slice(0, 60));
    ck(o.title === (v === 'limpa' ? 'O silêncio se parte em segundos' : v === 'baixas' ? 'Termina rápido, mas não limpo' : v === 'parcial' ? 'Minutos longos demais' : 'A intervenção falhou'), 'título pela variante', `${o.title} × ${v}`);
  } else if (Ed.type === 'fuga') {
    ck(o.tag === 'Fuga e perseguição' && txt[0].includes(`A saída é por ${zona}`) && txt[0].includes('mudou o plano no último minuto') === (G.routeNow !== G.route), 'fuga: saída pela zona certa e mudança de plano só se houve', `${G.route} → ${G.routeNow}`);
    ck(txt[1].includes(`${Ed.cov}%`), 'fuga: cobertura efetiva citada', `${Ed.cov}`);
    ck(Ed.zone === G.routeNow, 'a zona da fuga é a rota em vigor', `${Ed.zone} × ${G.routeNow}`);
  } else {
    ck(o.tag === 'Prazo esgotado' && o.title === 'O ultimato é aceito', 'ultimato aceito: etiqueta e título', o.title);
    const st = G.nego.step; ck(st >= 4 ? txt[0].includes('o que foi construído na linha pesou') : st >= 2 ? txt[0].includes('a conversa ainda no degrau ' + st) : txt[0].includes('sem acordo nenhum'), 'ultimato aceito: o texto reflete o degrau real', `${st}`);
  }
  // a verdade por trás da névoa
  const html = A.truthHTML(), rows = [...html.matchAll(/<div class="tr (k|u)"><span>(.*?)<\/span><b>(.*?)<\/b><small>(.*?)<\/small><\/div>/g)].map(x => ({ k: x[1], nome: x[2], v: x[3], s: strip(x[4]) }));
  ck(rows.length === 6, 'seis variáveis ocultas reveladas', `${rows.length}`);
  if (rows.length === 6) {
    const fl = [!!K.profile, !!K.route, !!K.count, !!K.accomplice, !!K.vault, !!K.hostages], esp = [P.nome, A.ZONE[G.route].nome + (G.routeNow !== G.route ? `, depois ${A.ZONE[G.routeNow].nome}` : ''), String(G.assail), G.accomplice ? 'Sim' : 'Não', Math.round(G.vault) + '%', `${H.hurt} ${pl(H.hurt, 'ferido', 'feridos')} · ${H.dead} ${pl(H.dead, 'morto', 'mortos')}`];
    rows.forEach((r, i) => { ck(r.v === esp[i], `verdade: ${r.nome}`, `${r.v} × ${esp[i]}`); ck((r.k === 'k') === fl[i], `verdade: "você sabia" só do que foi confirmado (${r.nome})`, `${r.k} × ${fl[i]}`); });
    ck(strip(html).includes(`${fl.filter(Boolean).length} de 6 variáveis conhecidas`) || Ed.type === 'fuga', 'verdade: variáveis conhecidas = flags de conhecimento', `${fl.filter(Boolean).length}`);
    if (Ed.type === 'intervencao' || (Ed.type === 'prazo' && Ed.variant === 'forcado')) ck(strip(html).includes(`A chance real de sucesso era de ${Math.round((Ed.P || 0) * 100)}%`), 'verdade: chance real da intervenção', `${Ed.P}`);
    if (Ed.type === 'fuga') {
      const conf = !!K.route && K.route === G.routeNow;
      ck(strip(html).includes(`com ${Ed.cov}% de cobertura efetiva`) && (strip(html).includes('numa rota que você nunca confirmou') === !conf), 'verdade: a rota de saída foi confirmada? (só se for a mesma que o líder usou)', `K.route ${K.route} × saída ${G.routeNow}`);
    }
    ck(inc(strip(html), `${F.sinal} ${pl(F.sinal, 'era sinal verdadeiro', 'eram sinais verdadeiros')} e ${F.ruido} ${pl(F.ruido, 'era ruído', 'eram ruído')}`) || F.sinal + F.ruido === 0, 'verdade: relatos de campo (sinal × ruído)', `${F.sinal}/${F.ruido}`);
  }
  // tela do desfecho
  const ro = strip(A.renderOutcome());
  ck(ro.includes(`Reféns ilesos ${17 - H.hurt - H.dead} Feridos ${H.hurt} Mortos ${H.dead} Cofre ${Math.round(G.vault)}%`) && ro.includes(`rodada ${G.round} de 8`) && ro.includes(`Duração ${Math.max(1, Math.round(G.round * 45 / 60))} h`), 'tela do desfecho: números do quadro', ro.slice(0, 160));
}

/* ---------- 3. Tela de pontuação ---------- */
function pontuacao(rec, F) {
  const G = A.G, S = G.score, H = G.hostages, tag = rec.tag;
  const ck = (ok, id, det) => C(ok, 'pontuação: ' + id, tag + ' | ' + det);
  const html = A.scoreHTML(), t = strip(html);
  ck(t.includes(`Pontuação final: nota ${S.grade}, ${dec1(S.total)} de 100`) && t.includes(`${dec1(S.total)} / 100`), 'nota e total na tela', `${S.grade} ${S.total}`);
  ck(t.includes('Teto aplicado') === !!S.capped && (!S.capped || t.includes(`limitada a ${S.cap}`)), 'teto só quando foi aplicado, com o valor certo', `${S.capped} ${S.cap}`);
  ck(t.includes('Penalidade: −') === (S.penal > 0), 'penalidade só quando houve agente ferido', `${S.penal}`);
  const rows = [...html.matchAll(/<div class="mono" style="text-align:right">(\d+)% → ([\d,]+) pts<\/div>/g)].map(x => [+x[1], +x[2].replace(',', '.')]);
  ck(rows.length === 5, 'cinco dimensões na composição', `${rows.length}`);
  if (rows.length === 5) {
    const val = [S.vidas, S.captura, S.valores, S.eficiencia, S.confianca], w = [.40, .20, .15, .10, .15];
    rows.forEach((r, i) => ck(r[0] === Math.round(val[i] * 100) && Math.abs(r[1] - val[i] * w[i] * 100) <= .051, `dimensão ${i + 1}: % e pontos`, `${r} × ${val[i]}`));
    ck(Math.abs(sum(rows.map(r => r[1])) - S.raw) <= .3, 'a soma dos pontos mostrados = nota bruta', `${sum(rows.map(r => r[1]))} × ${S.raw}`);
  }
  ck(t.includes(`${H.dead} ${pl(H.dead, 'morto', 'mortos')} e ${H.hurt} ${pl(H.hurt, 'ferido', 'feridos')} entre 17 reféns`), 'vidas: mortos e feridos citados', `${H.dead}/${H.hurt}`);
  ck(A.STK_KEYS.every(k => t.includes(`${A.STK[k].nome} ${Math.round(G.stk[k].sat)}`)), 'confiança: satisfação final de cada stakeholder', '');
  // promessa ao prefeito (L2.1): cobrada quando o desfecho não foi limpo ou saiu depois das 20h (rodada 8), e a tela diz isso só nesse caso
  const Ed = G.end, limpo = Ed.type === 'rendicao' || (Ed.type === 'intervencao' && ['limpa', 'baixas'].includes(Ed.variant));
  const cobrada = !!F.promessa && (!limpo || G.round >= 8);
  ck(t.includes('O prefeito cobrou a promessa') === cobrada, 'confiança: a promessa ao prefeito cobrada só quando foi quebrada', `${F.promessa} ${Ed.type}:${Ed.variant} r${G.round}`);
  // aposta (L2.3 refeita): a entrada voluntária com menos de 50% de chance não passa de A (89); com menos de 30%, de B (79)
  const aposta = Ed.type === 'intervencao' && !Ed.forced && Ed.P < .5;
  ck(aposta ? S.cap <= (Ed.P < .3 ? 79 : 89) : S.capWhy !== 'aposta', 'aposta: teto A abaixo de 50% de chance e B abaixo de 30%', `${Ed.type} ${Ed.forced} ${Ed.P} ${S.cap}`);
  ck(inc(t, `a crise durou ${G.round} ${pl(G.round, 'rodada', 'rodadas')}`), 'eficiência: duração da crise, no plural certo', `${G.round}`);
}

/* ---------- 4. Selos: a regra de cada selo reescrita a partir da descrição que o jogador lê ---------- */
function selos(rec, F) {
  const G = A.G, H = G.hostages, S = G.score, Ed = G.end, tag = rec.tag, diff = G.diff;
  const quanto = id => ({
    ninguem: H.hurt + H.dead === 0,
    escuta: Ed.type === 'rendicao' && F.aceitouTroca === 0 && F.press === 0,
    sacada: F.pausas >= 2 && F.pausas <= 3 && S.total >= 50,
    aposta: rec.prep.covRoute >= 60 && !rec.prep.rotaConhecida,
    olhos: knownFlags(G.K).filter(Boolean).length >= 5,
    cofre: G.vault < 40,
    economia: G.credits >= .4 * A.DIFF[G.diff].verba,
    porta: F.comms >= 3 && A.STK_KEYS.every(k => G.stk[k].sat >= (diff === 'caotico' ? 50 : 60)),
    degraus: F.maxStep >= 4 && F.skips === 0,
    rodizio: G.stats.minFF >= .7,
    equilibrio: S.vidas > .6 && S.captura > .6 && S.valores > .6 && S.confianca > .6 && S.eficiencia > .3,
    mao: Ed.type === 'intervencao' && ['limpa', 'baixas'].includes(Ed.variant) && H.hurt + H.dead === 0 && !(Ed.agentsHurt || []).length
  })[id];
  let got = 0;
  A.BADGES.forEach(b => { const real = !!A.badgeEarned(b.id), esp = !!quanto(b.id); C(real === esp, 'selos: ' + b.id + ' concedido exatamente quando a regra manda', `${tag} | engine ${real} × regra ${esp}`); if (real) got++; T.selo[b.id] = (T.selo[b.id] || 0) + (real ? 1 : 0); });
  const t = strip(A.badgesHTML());
  C(t.includes(`${got} de ${A.BADGES.length} selos conquistados`), 'selos: contador da tela', `${tag} | ${got}`);
  const on = [...A.badgesHTML().matchAll(/<div class="badge (on|off)">[\s\S]*?<b>(.*?)<\/b>/g)].map(x => [x[2], x[1] === 'on']);
  C(on.length === A.BADGES.length && A.BADGES.every((b, i) => on[i][0] === b.nome && on[i][1] === !!A.badgeEarned(b.id)), 'selos: cada cartão aceso ou apagado como o selo real', tag);
  // causas impossíveis: um selo de "nenhum ferido" junto de feridos, etc.
  if (A.badgeEarned('ninguem')) C(H.hurt + H.dead === 0, 'selos: "Ninguém fica para trás" nunca com ferido ou morto', tag);
  if (A.badgeEarned('mao')) C(H.hurt + H.dead === 0 && Ed.type === 'intervencao', 'selos: "Mão firme" só em intervenção sem ferido', tag);
  if (A.badgeEarned('escuta')) C(Ed.type === 'rendicao', 'selos: "Mestre da escuta" só em rendição', tag);
}
T.selo = {};

/* ---------- 5. Replay ---------- */
function replay(rec, F) {
  const G = A.G, tag = rec.tag, UI = A.UI;
  const ck = (ok, id, det) => C(ok, 'replay: ' + id, tag + ' | ' + det);
  ck(G.log.length === rec.rounds.length && G.log.length === G.round && G.hist.length === G.log.length, 'um registro por rodada jogada', `${G.log.length}/${rec.rounds.length}/${G.round}`);
  let tudo = true, detTudo = '';
  rec.rounds.forEach((r, i) => {
    const L = G.log[i]; if (!L) { tudo = false; detTudo = 'sem registro na rodada ' + (i + 1); return; }
    const mesmo = L.decs.length === r.queue.length && L.decs.every((d, j) => d.kind === r.queue[j].kind && d.label === r.queue[j].label && d.front === r.queue[j].front && (d.cost || 0) === r.queue[j].cost);
    if (!mesmo) { tudo = false; detTudo = `rodada ${i + 1}: ${JSON.stringify(L.decs.map(d => d.kind))} × ${JSON.stringify(r.queue.map(d => d.kind))}`; }
    ck(L.time === hhmm(i + 1) && L.r === i + 1, 'hora e número da rodada', `${L.time} × ${hhmm(i + 1)}`);
    ck(r.ev ? !!L.ev && L.ev.id === r.ev.id && L.ev.choice === r.ev.label : !L.ev, 'evento e escolha registrados', `${L.ev ? L.ev.id + '/' + L.ev.choice : 'nada'} × ${r.ev ? r.ev.id + '/' + r.ev.label : 'nada'}`);
    UI.replayR = i + 1; const html = A.replayHTML(), t = strip(html);
    ck(t.includes(`Rodada ${i + 1} · ${hhmm(i + 1)}`), 'cabeçalho da rodada', `${i + 1}`);
    ck(r.queue.every(d => t.includes(d.label)) && (r.queue.length ? true : t.includes('Sem decisões.')), 'toda decisão da rodada aparece na tela', r.queue.map(d => d.label).join(','));
    ck(r.ev ? t.includes(`${A.EVDEF[r.ev.id].titulo}: ${r.ev.label}`) : !html.includes('class="insight warn"'), 'evento da rodada aparece (e só se houve)', r.ev ? r.ev.id : 'sem evento');
    const cel = [...html.matchAll(/<span>(.*?)<\/span><b>(-?\d+) → (-?\d+)<\/b>/g)].map(x => [x[1], +x[2], +x[3]]);
    ck(cel.length === 8 && cel[0][0] === 'Agitação' && cel[0][1] === Math.round(L.s0.agit) && cel[0][2] === Math.round(L.s1.agit) && cel[2][0] === 'Cofre' && cel[2][2] === Math.round(L.s1.vault), 'quadro antes → depois da rodada', JSON.stringify(cel.slice(0, 3)));
    ck(!/undefined|NaN/.test(t), 'sem texto quebrado', i + 1);
  });
  ck(tudo, 'TODAS as decisões da cerco registradas, na ordem, com custo', detTudo);
  ck(sum(G.log.map(l => l.decs.length)) === F.decs.length, 'total de decisões no replay = total decidido', `${sum(G.log.map(l => l.decs.length))} × ${F.decs.length}`);
  const nos = [...A.replayHTML().matchAll(/class="tnode"/g)].length;
  ck(nos === G.log.length + (nodeR0() ? 1 : 0), 'linha do tempo: um nó por rodada jogada', `${nos}`);
  const svg = A.chartSVG(); ck(!/NaN|undefined/.test(svg) && [...svg.matchAll(/<polyline/g)].length === 4, 'curvas do replay sem NaN, quatro linhas', '');
  // a preparação antes do cerco (recrutamento, compras, investigação prévia, cobertura inicial)
  UI.replayR = 0; const t0 = strip(A.replayHTML()); UI.replayR = 1;
  const nomes = rec.prep.team.filter(id => !A.agentById(id).generic).map(id => A.agentById(id).nome.split(' ').slice(0, 2).join(' '));
  ck(/Preparação/.test(t0) && nomes.every(n => t0.includes(n)) && rec.prep.gear.every(e => t0.includes(A.EQUIP.find(x => x.id === e).nome)), 'preparação (R0) mostra equipe e equipamentos escolhidos', t0.slice(0, 120));
  ck(Object.keys(rec.prep.p1).every(k => t0.includes(A.INTEL.find(i => i.id === k).nome)), 'preparação (R0) mostra a investigação prévia', Object.keys(rec.prep.p1).join(','));
  ck(A.ZONES.every(z => t0.includes(`${z.curto} ${G.stats.initCov[z.id]}%`)), 'preparação (R0) mostra a cobertura inicial de cada zona', '');
  const reserva = A.DIFF[G.diff].verba - rec.prep.spent.rec - rec.prep.spent.equip - sum(Object.keys(rec.prep.p1).map(k => Math.round(A.INTEL.find(i => i.id === k).custo * (rec.prep.team.includes('sofia') ? .8 : 1))));
  ck(inc(t0, `Reserva ao iniciar o cerco: ${reserva.toLocaleString('pt-BR')} créditos`), 'preparação (R0) mostra a reserva com que o cerco começa (verba da dificuldade − equipe − equipamentos − investigação prévia)', `${reserva}`);
  function nodeR0() { return /data-r="0"/.test(A.replayHTML()); }
}

/* ---------- 6. Debrief ---------- */
function debrief(rec, F) {
  const G = A.G, S = G.score, st = G.stats, tag = rec.tag, K = G.K;
  const ck = (ok, id, det) => C(ok, 'debrief: ' + id, tag + ' | ' + det);
  const html = A.debriefHTML(), t = strip(html);
  const cards = {}; [...html.matchAll(/<div class="concept"><h4>(.*?)<\/h4><span class="ref">(.*?)<\/span><div class="you">([\s\S]*?)<\/div>(?:<details class="more"><summary>[^<]*<\/summary>)?<p class="les">([\s\S]*?)<\/p>(?:<\/details>)?<\/div>/g)].forEach(x => { cards[strip(x[1])] = { ref: strip(x[2]), you: strip(x[3]), les: strip(x[4]) }; });
  const card = re => { const e = Object.entries(cards).find(([k]) => re.test(k)); return e ? e[1] : undefined; };
  ck(!/undefined|NaN/.test(t), 'sem texto quebrado', '');
  // ponte da Tabela 12
  const br = [...html.matchAll(/<tr><td><b>(.*?)<\/b><\/td><td>(.*?)<\/td><\/tr>/g)].map(x => [strip(x[1]), strip(x[2])]);
  ck(JSON.stringify(br) === JSON.stringify(TABELA12), 'ponte da Tabela 12: as oito linhas idênticas ao documento', JSON.stringify(br).slice(0, 120));
  // referências da Tabela 2
  REFS.forEach(([nome, ano]) => ck(t.includes(nome) && t.includes(`(${ano})`), `Tabela 2: ${nome} (${ano}) citado`, ''));
  // ciclo de Kolb
  ['1. Experiência concreta', '2. Observação reflexiva', '3. Conceituação abstrata', '4. Experimentação ativa'].forEach(k => ck(t.includes(k), 'Kolb: ' + k, ''));
  ck(t.includes(`Você comandou ${G.round} ${pl(G.round, 'rodada', 'rodadas')} e terminou com ${S.grade} (${dec1(S.total)})`), 'Kolb 1: rodadas (no plural certo), nota e total', `${G.round} ${S.grade}`);
  const perg = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(x => strip(x[1]));
  ck(perg.length === 8, 'oito perguntas de reflexão (seção 8.2 do documento)', `${perg.length}`);
  ['restrição', 'investiu em informação', 'negociação avançou', 'só foi compartilhada|conselho', 'insistiu', 'stakeholder', 'perdas|enquadr', 'pesos'].forEach((re, i) => ck(perg.some(p => new RegExp(re).test(p)), 'pergunta da seção 8.2 coberta: ' + re, perg.join(' | ').slice(0, 80)));
  // cartões
  let c;
  c = card(/Restrições/); ck(!!c, 'cartão: Teoria das Restrições', ''); if (c) {
    const spend = rec.rounds.filter(r => !r.queue.some(d => d.kind === 'interv')).flatMap(r => r.queue).filter(d => ['intel', 'pausa', 'repos', 'apoio', 'horas'].includes(d.kind) || (d.kind === 'com' && ['gerente', 'acolhe'].includes(d.p.cid))).length;
    const mm = c.you.match(/(\d+) de (\d+) ordens de recurso miraram o gargalo/);
    ck(spend === 0 ? !mm : !!mm && +mm[2] === spend && +mm[1] <= spend, 'ordens de recurso contadas = ordens de fato dadas', `${mm ? mm[0] : 'sem'} × ${spend}`);
    ck(c.you.includes(`a rota real (${A.ZONE[G.route].nome}) tinha ${G.stats.initCov[G.route] || 0}% de cobertura no início`) && (G.stats.initCov[G.route] || 0) === rec.prep.covRoute, 'cobertura inicial da rota real', `${rec.prep.covRoute}`);
    ck(new RegExp('zonas adequadas').test(c.you) && c.you.includes(`${A.adequateCount()} de 7 zonas adequadas`), 'zonas adequadas no fim', `${A.adequateCount()}`);
  }
  c = card(/Racionalidade/); ck(!!c, 'cartão: Racionalidade limitada', ''); if (c) {
    const mm = c.you.match(/gastou (\d+) créditos em inteligência \((\d+) (investigação|investigações)\) e terminou sabendo (\d+) de 6/);
    ck(!!mm && +mm[1] === F.custoIntel && +mm[1] === G.spent.intel, 'créditos de inteligência = soma das ordens + investigações prévias', `${mm ? mm[1] : '?'} × ${F.custoIntel} (spent ${G.spent.intel})`);
    ck(!!mm && +mm[2] === F.p1 + F.ordens, 'nº de investigações = investigações pagas (prévias + ordens)', `${mm ? mm[2] : '?'} × ${F.p1 + F.ordens} (resolvidas ${st.intel})`);
    ck(!!mm && mm[3] === pl(+mm[2], 'investigação', 'investigações'), 'investigação(ões) no plural certo', `${mm ? mm[2] + ' ' + mm[3] : '?'}`);
    ck(!!mm && +mm[4] === knownFlags(K).filter(Boolean).length, 'variáveis ocultas conhecidas', `${mm ? mm[4] : '?'}`);
    const oc = K6.filter((x, i) => !knownFlags(K)[i]).map(x => x[1]); ck(oc.length ? c.you.includes('Ficaram ocultas: ' + oc.join(', ') + '.') : !c.you.includes('Ficaram ocultas'), 'lista do que ficou oculto', oc.join(','));
  }
  c = card(/situacional/); ck(!!c, 'cartão: Consciência situacional', ''); if (c) ck(c.you.includes(`Você teve ${F.relatos} relatos de campo, dos quais ${F.ruido} eram ruído de baixa confiança. Usou a Pausa de Comando ${F.pausas} ${pl(F.pausas, 'vez', 'vezes')}.`), 'relatos de campo, ruído e pausas', `${F.relatos}/${F.ruido}/${F.pausas} × ${c.you}`);
  c = card(/Sensemaking|alta confiabilidade/); ck(!!c, 'cartão: Sensemaking e alta confiabilidade (Weick)', ''); if (c) {
    const evs = rec.rounds.filter(r => r.ev).map(r => A.EVDEF[r.ev.id].titulo);
    ck(evs.length ? evs.every(e => c.you.includes(e)) && inc(c.you, `${evs.length} ${pl(evs.length, 'carta de choque', 'cartas de choque')}`) : /nenhuma carta de choque/i.test(c.you), 'choques citados = eventos que ocorreram', `${evs.join(',')} × ${c.you.slice(0, 100)}`);
  }
  c = card(/Negociação/); ck(!!c, 'cartão: Negociação', ''); if (c) {
    const mm = c.you.match(/Degrau máximo: (\d)\/5 em (\d+) (rodada|rodadas) de negociação\. Etapas puladas: (\d+)\. Pressões: (\d+)\. Cobertura da rota que o líder planejou \(o BATNA dele\): (\d+)%/);
    ck(!!mm && +mm[1] === F.maxStep && +mm[2] === F.tries && +mm[4] === F.skips && +mm[5] === F.press, 'degrau máximo, rodadas, etapas puladas e pressões', `${mm ? [mm[1], mm[2], mm[4], mm[5]] : '?'} × ${[F.maxStep, F.tries, F.skips, F.press]}`);
    ck(!!mm && mm[3] === pl(+mm[2], 'rodada', 'rodadas'), 'rodada(s) de negociação no plural certo', `${mm ? mm[2] + ' ' + mm[3] : '?'}`);
    ck(!!mm && +mm[6] === Math.round(A.zoneCoverage(G.routeNow)), 'cobertura da rota planejada (BATNA)', `${mm ? mm[6] : '?'} × ${Math.round(A.zoneCoverage(G.routeNow))}`);
  }
  c = card(/Stakeholders/); ck(!!c, 'cartão: Stakeholders', ''); if (c) {
    ck(A.STK_KEYS.every(k => c.you.includes(`${A.STK[k].nome} ${Math.round(G.stk[k].sat)}`)), 'satisfação final dos quatro', '');
    const lost = A.STK_KEYS.filter(k => G.stk[k].lost).map(k => A.STK[k].nome); ck(lost.length ? c.you.includes('Você perdeu: ' + lost.join(', ')) : c.you.includes('Nenhum stakeholder foi perdido'), 'quem foi perdido', lost.join(','));
  }
  c = card(/Liderança/); ck(!!c, 'cartão: Liderança em crise', ''); if (c) ck(c.you.includes(`Pausas de Comando: ${F.pausas}. Apoios externos: ${F.apoio}. Horas extras: ${F.horas}.`), 'pausas, apoios e horas extras', `${F.pausas}/${F.apoio}/${F.horas}`);
  c = card(/Informação distribuída/); ck(!!c, 'cartão: Informação distribuída', ''); if (c) ck(c.you.includes(`${rec.prep.vazias} das 7 zonas não tinham ninguém no início`), 'zonas sem ninguém no início (pelas posições escolhidas)', `${rec.prep.vazias} × ${c.you.slice(0, 60)}`);
  c = card(/Vieses/); ck(!!c, 'cartão: Vieses', ''); if (c) {
    ck(c.you.includes(G.frame === 'ganho' ? 'em termos de ganhos' : 'em termos de perdas') && inc(c.you, `Maior insistência na mesma postura sem sucesso: ${F.maxFail} ${pl(F.maxFail, 'vez', 'vezes')}`), 'enquadramento e maior insistência sem sucesso', `${G.frame} ${F.maxFail}`);
    ck(c.you.includes('Você prometeu um desfecho ao prefeito') === F.promessa, 'promessa ao prefeito só se foi feita', `${F.promessa}`);
  }
  c = card(/Desempenho sob pressão/); ck(!!c, 'cartão: Pressão', ''); if (c) {
    ck(c.you.includes(`Pressão operacional média ${F.media}, pico ${F.pico}.`), 'pressão média e pico', `${F.media}/${F.pico} × ${c.you.slice(0, 60)}`);
    ck(c.you.includes(`Fadiga mínima da equipe: ${Math.round(st.minFF * 100)}% de eficiência`), 'fadiga mínima', `${st.minFF}`);
  }
  c = card(/Métricas/); ck(!!c, 'cartão: Métricas concorrentes', ''); if (c) {
    const dims = [['vidas', S.vidas], ['prisões', S.captura], ['valores', S.valores], ['eficiência', S.eficiencia], ['confiança', S.confianca]], pior = dims.reduce((a, b) => (b[1] < a[1] ? b : a));
    ck(c.you.includes(`Dimensão mais fraca: ${pior[0]}.`) && c.you.includes(`vidas ${Math.round(S.vidas * 100)}%, prisões ${Math.round(S.captura * 100)}%, valores ${Math.round(S.valores * 100)}%, eficiência ${Math.round(S.eficiencia * 100)}%, confiança ${Math.round(S.confianca * 100)}%`), 'dimensão mais fraca, com o mesmo nome da tela de pontuação', `${pior[0]} × ${c.you.slice(0, 80)}`);
    const dica = { vidas: 'abrir a negociação já na rodada 1', 'prisões': 'cobrir mais as rotas candidatas', valores: 'reduzir o ritmo do cofre', 'eficiência': 'enxugar o que se contrata', 'confiança': 'falar com os stakeholders mais cedo' }[pior[0]];
    ck(t.includes('Na próxima partida, tente ' + dica), 'sugestão da próxima partida pela dimensão mais fraca', pior[0]);
  }
  // dinheiro: a verba fecha na da dificuldade e o debrief mostra as mesmas parcelas
  const cats = A.spendBreakdown(); ck(Math.abs(sum(cats.map(x => x.v)) - A.DIFF[G.diff].verba) < 1e-6 && G.verba === A.DIFF[G.diff].verba, 'a verba fecha: equipe + equipamento + inteligência + plantão + extras + corte + reserva = verba da dificuldade', `${sum(cats.map(x => x.v))} ${JSON.stringify(cats.map(x => [x.k, x.v]))}`);
  ck(G.spent.rec === sum(rec.prep.team.map(id => A.agentById(id).custo)) && G.spent.equip === sum(rec.prep.gear.map(e => A.EQUIP.find(x => x.id === e).custo)), 'gasto com equipe e equipamentos = preços dos escolhidos', `${G.spent.rec}/${G.spent.equip}`);
}

/* ---------- 7. Selos nas bordas (estados montados à mão, um passo antes e um depois da regra) ---------- */
function selosNasBordas() {
  const base = () => {
    const rec = { rounds: [] }; A.reseed(77); A.newGame('complexo'); const pol = B.policyNegociador('complexo'); pol.setup(A); A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound();
    let g = 0; while (!A.G.end && g++ < 12) { A.G.stage = 'panel'; pol.decide(A, A.G.round); const r = A.resolveDecisions(); if (r && r.event) { const n = A.EVENT_FX[r.event].choices.length; let ok = A.chooseEvent(0); for (let i = 0; i < n && !ok; i++) ok = A.chooseEvent(i); } if (!A.G.end) A.startRound(); }
    return JSON.parse(JSON.stringify(A.G));
  };
  const g0 = base();
  const tenta = (id, mut, esperado, rotulo) => { A.G = JSON.parse(JSON.stringify(g0)); mut(A.G); C(!!A.badgeEarned(id) === esperado, 'bordas dos selos: ' + id + ' — ' + rotulo, `esperado ${esperado}`); };
  const fim = (G, tipo, variante, extra = {}) => { G.end = Object.assign({ type: tipo, variant: variante }, extra); };
  // Ninguém fica para trás: zero feridos e mortos
  tenta('ninguem', G => { G.hostages.hurt = 0; G.hostages.dead = 0; }, true, '0 feridos e 0 mortos');
  tenta('ninguem', G => { G.hostages.hurt = 1; G.hostages.dead = 0; }, false, '1 ferido');
  tenta('ninguem', G => { G.hostages.hurt = 0; G.hostages.dead = 1; }, false, '1 morto');
  // Mestre da escuta: rendição, sem concessão material e sem pressionar
  tenta('escuta', G => { fim(G, 'rendicao', 'serena'); G.nego.concessions = 0; G.stats.press = 0; }, true, 'rendição limpa de concessões');
  tenta('escuta', G => { fim(G, 'rendicao', 'serena'); G.nego.concessions = 1; G.stats.press = 0; }, false, 'aceitou a troca');
  tenta('escuta', G => { fim(G, 'rendicao', 'serena'); G.nego.concessions = 0; G.stats.press = 1; }, false, 'pressionou o líder');
  tenta('escuta', G => { fim(G, 'prazo', 'cedeu'); G.nego.concessions = 0; G.stats.press = 0; }, false, 'ultimato aceito não é rendição negociada');
  // Sacada: 2 ou 3 pausas e nota C ou melhor (50+)
  [[1, 60, false], [2, 60, true], [3, 60, true], [4, 60, false], [2, 49.9, false], [2, 50, true]].forEach(([p, nota, esp]) => tenta('sacada', G => { G.stats.pausas = p; G.score.total = nota; }, esp, `${p} pausas, nota ${nota}`));
  // Aposta certa: rota coberta (60+) antes de ser revelada
  [[59, false, false], [60, false, true], [60, true, false]].forEach(([c, known, esp]) => tenta('aposta', G => { G.stats.initCov[G.route] = c; G.stats.routeKnownAtStart = known; }, esp, `cobertura ${c}, rota ${known ? 'já conhecida' : 'oculta'}`));
  // Olhos abertos: 5 de 6
  [[4, false], [5, true], [6, true]].forEach(([n, esp]) => tenta('olhos', G => { G.K.profile = G.K.count = G.K.vault = G.K.hostages = G.K.accomplice = false; G.K.route = null; ['profile', 'route', 'count', 'vault', 'hostages', 'accomplice'].slice(0, n).forEach(k => { G.K[k] = k === 'route' ? G.routeNow : true; }); }, esp, `${n} variáveis`));
  // Cofre intacto: abaixo de 40
  [[39.9, true], [40, false]].forEach(([v, esp]) => tenta('cofre', G => { G.vault = v; }, esp, `cofre ${v}`));
  // Economia: 40% da verba da dificuldade ou mais (720 / 600 / 500)
  [['protocolar', 719, false], ['protocolar', 720, true], ['complexo', 599, false], ['complexo', 600, true], ['caotico', 499, false], ['caotico', 500, true]].forEach(([d, c, esp]) => tenta('economia', G => { G.diff = d; G.verba = A.DIFF[d].verba; G.credits = c; }, esp, `${c} créditos no ${d}`));
  // Porta-voz: 3 falas e os quatro em 60 (50 no Caótico)
  [['complexo', 2, 70, false], ['complexo', 3, 59.9, false], ['complexo', 3, 60, true], ['caotico', 3, 50, true], ['caotico', 3, 49.9, false], ['protocolar', 3, 60, true]].forEach(([d, n, s, esp]) => tenta('porta', G => { G.diff = d; G.stats.comms = n; A.STK_KEYS.forEach(k => { G.stk[k].sat = s; }); }, esp, `${d}, ${n} falas, todos em ${s}`));
  // Um degrau por vez: degrau 4+ sem pular
  [[3, 0, false], [4, 0, true], [5, 1, false], [4, 1, false]].forEach(([m, sk, esp]) => tenta('degraus', G => { G.nego.maxStep = m; G.nego.skips = sk; }, esp, `degrau ${m}, ${sk} puladas`));
  // Equipe descansada: fadiga nunca abaixo de 0,7
  [[.69, false], [.7, true]].forEach(([f, esp]) => tenta('rodizio', G => { G.stats.minFF = f; }, esp, `fator mínimo ${f}`));
  // Equilíbrio: quatro dimensões acima de 60% e eficiência acima de 30%
  [[.61, .31, true], [.6, .31, false], [.61, .3, false]].forEach(([d, e, esp]) => tenta('equilibrio', G => { Object.assign(G.score, { vidas: d, captura: d, valores: d, confianca: d, eficiencia: e }); }, esp, `dimensões ${d}, eficiência ${e}`));
  // Mão firme: intervenção limpa sem ninguém ferido
  tenta('mao', G => { fim(G, 'intervencao', 'limpa', { agentsHurt: [] }); G.hostages.hurt = 0; G.hostages.dead = 0; }, true, 'intervenção limpa sem feridos');
  tenta('mao', G => { fim(G, 'intervencao', 'limpa', { agentsHurt: ['renata'] }); G.hostages.hurt = 0; G.hostages.dead = 0; }, false, 'agente ferido');
  tenta('mao', G => { fim(G, 'intervencao', 'limpa', { agentsHurt: [] }); G.hostages.hurt = 1; G.hostages.dead = 0; }, false, 'refém ferido');
  tenta('mao', G => { fim(G, 'intervencao', 'fracasso', { agentsHurt: [] }); G.hostages.hurt = 0; G.hostages.dead = 0; }, false, 'intervenção fracassada');
  tenta('mao', G => { fim(G, 'prazo', 'forcado', { sub: 'limpa', agentsHurt: [] }); G.hostages.hurt = 0; G.hostages.dead = 0; }, false, 'entrada forçada pelo ultimato não é intervenção autorizada');
}

/* ---------- o corredor ---------- */
const DIFFS = ['protocolar', 'complexo', 'caotico'];
const POLS = [
  ['negociador', (d) => B.policyNegociador(d)], ['agressivo3', () => B.policyAgressivo(3, .5)], ['agressivo2', () => B.policyAgressivo(2, .3)], ['equilibrado', () => B.policyEquilibrado()],
  ['comunicador', () => B.policyComunicador(['paulo', 'fernanda'], ['negofone'])], ['paz', () => E.expert('paz')], ['eq', () => E.expert('eq')], ['agr', () => E.expert('agr')],
  ['novato', (d, s) => TI.novato(s)], ['mid', (d, s) => TI.competente(s, { sloppy: .25 })],
  ...['nenhum', 'gastaTudo', 'ignoraNego', 'ignoraStk', 'soTatica', 'soIntel', 'soCom', 'passivo', 'intervSempre', 'pausaSempre', 'umaZona', 'soReserva'].map(k => ['edge_' + k, () => B.policyEdge(k)]),
  ['fuzz', (d, s) => B.policyFuzz(mulberry32(1000 + s))], ['fuzz2', (d, s) => B.policyFuzz(mulberry32(5000 + s))], ['fuzz3', (d, s) => B.policyFuzz(mulberry32(9000 + s))]
];
const desfechos = {};
const t0 = Date.now();
selosNasBordas();
for (const diff of DIFFS) for (const [nome, mkp] of POLS) for (let i = 0; i < N; i++) {
  const seed = 40000 + i, pol = mkp(diff, seed);
  cur = { rounds: [], prep: null, tag: `${nome} ${diff} s${seed}` };
  const rec = cur;
  let o = null; try { o = V.play(diff, pol, seed, { depois: G => { const rr = rec.rounds[rec.rounds.length - 1]; rr.step1 = G.nego.step; } }); } catch (e) { bad.push('EXC ' + rec.tag + ': ' + e.message); }
  if (!o) { cur = null; continue; }
  T.jogos++; desfechos[o.key] = (desfechos[o.key] || 0) + 1;
  const G = A.G, F = fatos(rec, G);
  for (const [nm, fn] of [['gazeta', gazeta], ['desfecho', historia], ['pontuação', pontuacao], ['selos', selos], ['replay', replay], ['debrief', debrief]]) {
    try { fn(rec, F); } catch (e) { C(false, nm + ': EXCEÇÃO', rec.tag + ' | ' + e.stack.split('\n').slice(0, 3).join(' / ')); }
  }
  cur = null;
}
const seg = ((Date.now() - t0) / 1000).toFixed(0);

/* ---------- relatório ---------- */
const ids = Object.keys(T.porId).sort();
const falhos = ids.filter(i => T.porId[i].f);
const L = [];
L.push(`# A verdade do jogo (L2.5): ${T.jogos} partidas, ${T.total} conferências`); L.push('');
L.push(`Gerado por \`node tools/sim/verdade.js ${N}\`. Cada partida é jogada por uma política (${POLS.length} políticas × 3 níveis × ${N} sementes) e, no fim, as telas de texto REAIS do jogo (Gazeta, história do desfecho, revelação, pontuação, selos, replay, debrief) são conferidas contra o estado e contra um registro das decisões anotado por fora do motor.`); L.push('');
L.push(`**${T.total - T.falhas} de ${T.total} conferências batem${T.falhas ? `; ${T.falhas} DIVERGEM em ${falhos.length} verificações` : ''}** (${seg} s). Desfechos vistos: ${Object.entries(desfechos).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}.`); L.push('');
L.push('| Verificação | Conferências | Divergências |'); L.push('| --- | --: | --: |');
ids.forEach(i => L.push(`| ${i.replace(/\|/g, '\\|')} | ${T.porId[i].n} | ${T.porId[i].f || '0'} |`));   // o nome de uma verificação pode trazer "|" (alternativas de regex): escapa para não quebrar a tabela
if (falhos.length) { L.push(''); L.push('## Divergências (até 3 exemplos por verificação)'); L.push(''); falhos.forEach(i => { L.push(`- **${i}** (${T.porId[i].f} de ${T.porId[i].n})`); T.porId[i].ex.forEach(e => L.push(`  - ${e}`)); }); }
L.push(''); L.push('## Frequência de cada selo nesta amostra (partidas de todas as políticas)'); L.push('');
L.push(A.BADGES.map(b => `${b.nome}: ${(100 * (T.selo[b.id] || 0) / T.jogos).toFixed(1)}%`).join(' · '));
if (bad.length) { L.push(''); L.push(`## Violações de invariantes (${bad.length})`); L.push(''); [...new Set(bad)].slice(0, 20).forEach(b => L.push('- ' + b)); }
const text = L.join('\n') + '\n';
if (OUT) fs.writeFileSync(OUT, text);
console.log(falhos.length ? falhos.map(i => `✗ ${i}: ${T.porId[i].f}/${T.porId[i].n}\n    ${T.porId[i].ex.join('\n    ')}`).join('\n') : 'nenhuma divergência');
console.log(`\nverdade: ${T.jogos} partidas, ${T.total - T.falhas}/${T.total} conferências batem (${ids.length} verificações) em ${seg} s${bad.length ? `; ${bad.length} violações de invariantes` : ''}`);
process.exit(T.falhas || bad.length ? 1 : 0);
