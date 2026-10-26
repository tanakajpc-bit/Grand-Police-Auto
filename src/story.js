/* =====================================================================
   NARRATIVA — pessoas, vozes e manchetes (L1.2)
   Tudo aqui é fictício. Os textos só leem o estado; quem muda o estado é o motor.
   ===================================================================== */

/* ---------- Os 17 reféns: cada número é uma pessoa ---------- */
const HOSTAGE_LIST = [
  { id:'lucia',    nome:'Lúcia Andrade',    idade:67, papel:'aposentada, cliente',         nota:'diabética, usa insulina' },
  { id:'rafael',   nome:'Rafael Mota',      idade:24, papel:'caixa da agência' },
  { id:'larissa',  nome:'Larissa Campos',   idade:35, papel:'gerente da agência' },
  { id:'jorge',    nome:'Jorge Kawasaki',   idade:52, papel:'dono de uma papelaria, cliente' },
  { id:'joana',    nome:'Joana Prado',      idade:29, papel:'cliente',                     nota:'grávida de sete meses' },
  { id:'marta',    nome:'Marta Oliveira',   idade:45, papel:'vigilante da agência' },
  { id:'thiago',   nome:'Thiago Lima',      idade:19, papel:'estudante, cliente' },
  { id:'irene',    nome:'Irene Castro',     idade:58, papel:'auxiliar de limpeza' },
  { id:'samuel',   nome:'Samuel Nogueira',  idade:33, papel:'contador, cliente' },
  { id:'benedito', nome:'Benedito Alves',   idade:74, papel:'aposentado, cliente',         nota:'usa aparelho auditivo' },
  { id:'yara',     nome:'Yara Tavares',     idade:22, papel:'estagiária da agência' },
  { id:'mateus',   nome:'Mateus Fonseca',   idade:41, papel:'eletricista, cliente' },
  { id:'otavio',   nome:'Otávio Brandão',   idade:60, papel:'empresário, cliente' },
  { id:'cecilia',  nome:'Cecília Moura',    idade:48, papel:'professora, cliente' },
  { id:'helio',    nome:'Hélio Santana',    idade:55, papel:'taxista, cliente' },
  { id:'paulah',   nome:'Paula Hirata',     idade:39, papel:'atendente da agência' },
  { id:'davi',     nome:'Davi Rezende',     idade:30, papel:'entregador, cliente' }
];
const HOST = Object.fromEntries(HOSTAGE_LIST.map(h => [h.id, h]));
const firstName = id => HOST[id].nome.split(' ')[0];

/* ---------- Biografias curtas dos agentes (cartas de recrutamento) ---------- */
const BIOS = {
  renata: 'Vinte anos de ocorrências com reféns. Fala pouco e lembra de tudo.',
  marcos: 'Ex-instrutor de tiro. Aguenta doze horas de posição sem reclamar.',
  carla: 'Veio da divisão de fraudes bancárias. Lê um relatório como quem lê um rosto.',
  paulo: 'Negociador-chefe da capital. Nunca perdeu um refém em mesa de negociação.',
  lucas: 'Patrulheiro de rua que conhece cada beco do centro de Porto Alto.',
  fernanda: 'Ex-assessora de imprensa da Secretaria. Sabe o que vira manchete.',
  andre: 'Grupo tático. Acredita que cada minuto de conversa é um minuto perdido.',
  sofia: 'Analista de inteligência. Cruza câmeras, cadastros e telefones em minutos.',
  roberto: 'Corajoso e rápido. Às vezes rápido demais.',
  camila: 'Faz de tudo um pouco e se adapta ao que a equipe precisar.',
  diego: 'Comandou a retomada do Terminal Sul. Pensa a operação inteira de uma vez.',
  marina: 'Mediadora de conflitos em presídios. Baixa a voz e a sala inteira acompanha.'
};

/* ---------- A voz do líder (cada perfil fala de um jeito: é assim que a névoa se dissipa) ---------- */
const LEADER = {
  calculista: {
    step: ['', 'Vamos ser objetivos. Vocês têm algo a oferecer ou estão só ganhando tempo?', 'Não preciso que você entenda o que eu sinto. Preciso que entenda o que eu quero.',
      'A água chegou no horário que você disse. Anotei. Continue assim.', 'Me mostre os termos. Se fizer sentido, eu considero.', 'Quero tudo combinado: quem sai primeiro, por onde e quem garante.'],
    fail: 'Isso não responde ao que eu perguntei. Próxima.', press: 'Ultimato? Eu também sei contar o tempo, comandante.', hot: 'O relógio corre para os dois lados. Lembre-se disso.' },
  volatil: {
    step: ['', 'Ninguém aqui queria que isso acontecesse assim! Vocês não entendem!', 'Desculpa. Eu não devia ter gritado. É que está todo mundo olhando para mim.',
      'Você é o único que fala comigo como gente. Fica na linha, tá?', 'Se eu soltar os mais velhos primeiro… vocês garantem que ninguém entra?', 'Tá. Tá bom. Me diz como eu saio daqui sem ninguém se machucar.'],
    fail: 'Para de falar comigo como se eu fosse idiota!', press: 'É assim? Então ninguém sai daqui!', hot: 'Eu juro que eu não sei o que vou fazer se alguém se mexer aí fora!' },
  ideologico: {
    step: ['', 'Isso não é sobre dinheiro. Nunca foi. Vocês vão ouvir o que eu tenho a dizer.', 'Você diz que entende. Os outros também diziam.',
      'Se a sua palavra vale alguma coisa, deixe a imprensa ler a minha carta.', 'Não aceito trocas. Aceito compromissos públicos.', 'Eu saio de cabeça erguida, diante das câmeras, ou não saio.'],
    fail: 'Mais uma oferta de quem não ouviu nada.', press: 'Ameaças só provam o que eu venho dizendo.', hot: 'Se for preciso, que a cidade inteira veja como isso termina.' },
  desesperado: {
    step: ['', 'Eu não tenho mais para onde ir. Você entende isso? Para onde?', 'Minha filha… ela não pode me ver assim no jornal.',
      'Você ainda está aí? Não desliga. Por favor, não desliga.', 'Se eu entregar a arma… o que acontece comigo? A verdade.', 'Tá. Eu vou sair. Mas fala para eles não atirarem. Promete.'],
    fail: 'Não, não, não. Isso é armadilha.', press: 'Então acaba logo com isso! É isso que vocês querem?', hot: 'Eu não volto para a cadeia. Não volto.' }
};
/* Cena do canal em cada degrau (o que o jogador vê antes de escolher a postura) */
const STEP_SCENE = ['',
  'O telefone da agência toca pela quinta vez até alguém atender. Do outro lado, uma respiração pesada antes de qualquer palavra.',
  'A voz do outro lado oscila entre raiva e algo que parece medo. Ele ainda não confia, mas já não desliga na sua cara.',
  'Ele chama o seu negociador pelo nome. Pede café para os reféns e agradece quando chega. É uma relação, frágil, mas é.',
  'O líder começa a perguntar sobre o depois: o que acontece com ele, quem garante, como seria a saída. É a hora de propor.',
  'Os detalhes da saída estão sobre a mesa: ordem, porta, quem recebe. Falta apenas que a tensão lá dentro baixe o bastante.'];
const NO_CONTACT = 'Ninguém atendeu o telefone da agência ainda. Enquanto não houver canal, o líder está sozinho com a própria raiva, e você não sabe nada sobre ele.';

function leaderSays(kind) {
  const P = LEADER[G.profile];
  if (kind === 'press') return P.press;
  if (kind === 'fail') return G.agit > 75 ? P.hot : P.fail;
  return G.agit > 80 ? P.hot : P.step[G.nego.step];
}

/* ---------- Ligações de stakeholders (quem é ignorado liga) ---------- */
const CALLS = {
  imprensa: ['Comandante, a TV Porto Alto vai ao ar em dez minutos com ou sem uma palavra sua. Prefere que a gente especule?', 'Nossas fontes dizem que há feridos. Se não for verdade, este é o momento de negar.'],
  prefeito: ['O gabinete quer saber por que ninguém nos atualiza. Eu não vou descobrir pela televisão o que acontece na minha cidade.', 'Comandante, a paciência acabou. Quero um prazo, e quero agora.'],
  banco: ['A diretoria do Meridiano precisa saber o que está sendo feito para proteger a agência. O conselho está ligando de hora em hora.', 'Se o cofre cair, o seguro vai perguntar onde estava o comando. Eu também.'],
  familias: ['Uma mãe na barreira está pedindo para falar com alguém. Ela só quer saber se a filha está viva.', 'As famílias estão em frente ao isolamento há horas sem nenhuma informação. Estão começando a gritar com os policiais.']
};
const CALLER = { imprensa: 'Editora-chefe da TV Porto Alto', prefeito: 'Chefe de gabinete do prefeito', banco: 'Diretor regional do Meridiano', familias: 'Coordenação do acolhimento' };

/* ---------- Abertura de cada rodada: hora do dia + o que já aconteceu ---------- */
const DAYLIGHT = ['',
  'O sol de começo de tarde bate na fachada espelhada do Meridiano.',
  'O trânsito do centro foi desviado e a Avenida Principal ficou estranhamente silenciosa.',
  'A sombra dos prédios começa a cobrir a calçada da agência.',
  'O sol baixa entre os prédios e as sombras alongam a Avenida Principal.',
  'Fim de tarde. Quem sai do trabalho para no isolamento para olhar.',
  'O céu fica cor de laranja e os holofotes da imprensa se acendem.',
  'A luz acabou lá fora. Os giroflex das viaturas pintam a fachada de vermelho e azul.',
  'Noite. O jornal das 20h já tem a imagem da porta da agência na tela.'];

function roundIntro() {
  const n = G.nego, H = G.hostages, s = [DAYLIGHT[G.round] || ''];
  if (!n.contact) s.push(G.round === 1 ? 'Ninguém sabe ao certo quantos são, o que querem ou por onde pretendem sair.' : 'O telefone da agência continua sem resposta: o líder segue sozinho com a própria raiva, e você segue sem ouvir a voz dele.');
  else s.push(`O canal com o líder está aberto, no degrau ${n.step} de 5 (${STEPS[n.step - 1].nome}).${n.step >= 4 ? ' Pela primeira vez, ele fala em “depois”.' : ''}`);
  const out = HOSTAGES - H.inside, inside = H.inside - H.dead;
  if (H.dead) s.push(`A sala de comando ainda não se recuperou: ${H.dead === 1 ? 'uma vida foi perdida' : H.dead + ' vidas foram perdidas'}. Lá dentro restam ${inside} pessoas.`);
  else if (out > 0) s.push(`${out} ${out === 1 ? 'refém já saiu' : 'reféns já saíram'}. Lá dentro ainda há ${inside} pessoas esperando por você.`);
  else s.push(`Lá dentro, ${inside} pessoas esperam sem saber o que acontece do lado de fora.`);
  if (G.round >= 6) s.push('O prefeito quer um desfecho. A cidade quer um desfecho. Desfecho é diferente de solução, e é você quem escolhe qual dos dois entrega.');
  else if (G.media > 65) s.push('A cobertura ao vivo não para: cada minuto sem resposta vira especulação na tela.');
  if (G.round === MAX_ROUNDS) s.push('Última rodada. Depois dela, os assaltantes impõem o ultimato final.');
  return s.join(' ');
}

/* ---------- Manchetes da TV (o ticker do cerco) ---------- */
function headlines() {
  const H = G.hostages, out = [], n = G.nego, out0 = HOSTAGES - H.inside;
  out.push(`AO VIVO · Assalto com reféns na Agência Central do Meridiano entra na ${Math.max(1, Math.round(G.round * ROUND_MIN / 60))}ª hora de cerco`);
  if (H.dead) out.push(`URGENTE · Polícia confirma ${H.dead === 1 ? 'a morte de um refém' : H.dead + ' reféns mortos'} na Agência Central`);
  else if (out0 > 0) out.push(`${out0} ${out0 === 1 ? 'refém é libertado' : 'reféns são libertados'}; ${H.inside - H.dead} continuam no interior`);
  if (G.media > 75) out.push('Comentaristas questionam o silêncio do comando: “a cidade merece explicações”');
  else if (G.media > 50) out.push('Repórteres furam o isolamento na Rua Marechal Deodoro em busca de imagens');
  else out.push('Comando da força-tarefa mantém isolamento de três quarteirões no centro');
  if (n.contact && n.step >= 3) out.push('Fontes: negociação com o líder do grupo avança');
  if (G.usedEvents.includes('heli')) out.push('Rede Litoral transmite imagens aéreas das equipes em posição');
  if (G.usedEvents.includes('live')) out.push('Transmissão feita por refém já passa de cem mil visualizações');
  if (G.stk.familias.sat < 35) out.push('Famílias protestam na barreira: “ninguém nos diz nada”');
  if (G.stk.prefeito.sat < 35) out.push('Prefeito cobra resultados: “não aceito esta crise no horário nobre”');
  if (G.deadlineLeft > 0) out.push('Jornal das 20h confirma abertura ao vivo em frente à agência');
  return out.slice(0, 5);
}

/* ---------- Ligação da rodada: o stakeholder mais negligenciado telefona ---------- */
function stakeCall() {
  const k = STK_KEYS.slice().sort((a, b) => (G.stk[b].sem * 10 - G.stk[b].sat) - (G.stk[a].sem * 10 - G.stk[a].sat))[0], s = G.stk[k];
  if (G.round < 2 || (s.sem < 2 && s.sat >= 40)) return null;
  return { k, who: CALLER[k], t: CALLS[k][s.sat < 35 || s.sem >= 3 ? 1 : 0] };
}

/* ---------- Mesa de comando: a equipe aconselha, e nem sempre concorda ----------
   Cada conselheiro só enxerga a sua parte do problema (informação distribuída) e puxa para o próprio ofício (viés). */
function council() {
  const av = avail(), out = [], used = new Set(), K = G.K;
  const best = (k, min) => av.filter(id => !used.has(id) && !agentById(id).generic).sort((a, b) => stat(b, k) - stat(a, k)).find(id => stat(id, k) >= min);
  const say = (id, stance, t) => { used.add(id); out.push({ id, nome: agentById(id).nome, trait: agentById(id).trait, stance, t }); };
  // negociação
  const neg = G.nego.negotiator && av.includes(G.nego.negotiator) && stat(G.nego.negotiator, 'neg') >= 6 ? G.nego.negotiator : best('neg', 6);
  if (neg) {
    if (!G.nego.contact) say(neg, 'esperar', 'Precisamos abrir o canal já. Cada rodada sem contato é uma rodada em que ele fica sozinho com a raiva dele, e nós sem saber quem ele é.');
    else if (G.agit > 70) say(neg, 'esperar', 'Ele está no limite. Nada de pressão agora: escuta, rótulo de emoção e tempo. Qualquer movimento brusco aí fora vai parecer ameaça.');
    else if (G.nego.step >= 4) say(neg, 'esperar', `Estamos no degrau ${G.nego.step}. Ele já fala em saída. Uma entrada agora jogaria fora tudo o que construímos.`);
    else say(neg, 'esperar', `Degrau ${G.nego.step}. Não pule etapas: consolidar ${STEPS[G.nego.step - 1].nome.toLowerCase()} agora vale mais do que correr para a proposta.`);
  }
  // tática
  const tat = best('tat', 7);
  if (tat) {
    const ip = intervProb(), topEv = Object.entries(G.ev).sort((a, b) => b[1] - a[1])[0];
    const weak = G.routes.filter(z => !K.cleared.includes(z)).map(z => [z, zoneCoverage(z)]).sort((a, b) => a[1] - b[1])[0];
    if (tat === 'andre' || ip >= .55) say(tat, 'intervir', `A prontidão está em ${Math.round(intervPower())}%. ${ip >= .55 ? 'Se for para entrar, é agora, antes que eles se organizem.' : 'Já esperamos demais. Cada minuto de conversa é um minuto para eles se prepararem.'}`);
    else if (topEv && topEv[1] >= 1.5 && zoneCoverage(topEv[0]) < ADEQ) say(tat, 'reforçar', `Os relatos apontam para ${ZONE[topEv[0]].nome} e lá a cobertura é de ${zoneCoverage(topEv[0])}%. Eu mandaria gente para lá.`);
    else if (weak && weak[1] < 30) say(tat, 'reforçar', `${ZONE[weak[0]].nome} está praticamente descoberta (${weak[1]}%). Se a saída for por lá, ninguém segura.`);
    else say(tat, 'reforçar', 'O perímetro aguenta por ora. Eu não mexeria em ninguém sem um motivo: reposicionar custa eficiência.');
  }
  // inteligência
  const intl = best('int', 7);
  if (intl) {
    if (!K.profile && G.nego.contact) say(intl, 'investigar', 'Estamos negociando sem saber com quem. O perfil do líder decide qual postura funciona.');
    else if (!K.route) say(intl, 'investigar', 'Ainda não sabemos a rota. Ou investigamos, ou aceitamos que o perímetro é uma aposta.');
    else if (!K.hostages) say(intl, 'investigar', 'Não sabemos como estão os reféns. A sala de acolhimento das famílias resolve isso barato, e ninguém deveria decidir uma entrada sem essa informação.');
    else if (!K.count) say(intl, 'investigar', 'Falta confirmar quantos estão armados. É a variável que mais pesa numa intervenção.');
  }
  // comunicação
  const com = best('com', 7);
  if (com && out.length < 3) {
    const k = STK_KEYS.slice().sort((a, b) => G.stk[b].sem - G.stk[a].sem || G.stk[a].sat - G.stk[b].sat)[0];
    if (G.stk[k].sem >= 1 || G.stk[k].sat < 50) say(com, 'comunicar', `${STK[k].nome} está ${G.stk[k].sem ? `há ${G.stk[k].sem} rodada${G.stk[k].sem > 1 ? 's' : ''} sem notícia nossa` : 'insatisfeito'} (${Math.round(G.stk[k].sat)}). Quem não ouve de nós ouve da televisão.`);
  }
  const lim = G.round <= 2 ? 3 : 2;
  // garante que o conflito apareça: se alguém defende entrar, mantém quem defende esperar
  out.sort((a, b) => (b.stance === 'intervir') - (a.stance === 'intervir'));
  const res = out.slice(0, lim);
  if (out.some(o => o.stance === 'intervir') && !res.some(o => o.stance === 'esperar')) { const w = out.find(o => o.stance === 'esperar'); if (w) res[res.length - 1] = w; }
  return res;
}
