/* =====================================================================
   PERÍMETRO — simulação educacional de gestão de crise (single-player)
   ---------------------------------------------------------------------
   ARQUITETURA (resumo)
   1) ESTADOS (máquina): menu → briefing → recruit(F0) → perimeter(F1) → siege(F2, 8 rodadas)
      → outcome(F3) → post[score → news → badges → replay → debrief]
      Dentro de siege, G.stage: 'update' → 'panel' → 'event' → 'result' → (próxima rodada | outcome)
   2) MODELO DE DADOS: G (estado único serializável em JSON → localStorage). Dados estáticos
      (AGENTS, EQUIP, PROFILES, EVENTS, DIFF, ZONES, INTEL, POSTURES) ficam fora de G.
   3) MOTOR: funções puras sobre G (coverage, agentEff, negotiation, agitation, media, vault,
      stakeholders, intervention, escape, score). Interface só chama o motor e renderiza.
   4) FLUXO DE RODADA: startRound() [atualização: resultados de inteligência + relatórios
      distribuídos] → painel (Endsley N1/N2/N3) → decisões (fila, limite de "slots")
      → resolveDecisions() → sorteio de evento → applyEvent() → finishRound() [fadiga, desfecho]
      → feedback com deltas animados.
   5) DECISÕES: 4 frentes — Tática, Negociação, Inteligência, Comunicação; cada uma ocupa 1 slot
      (Intervenção ocupa todos). Créditos são debitados na hora; sem crédito a ação fica bloqueada.
   6) PONTUAÇÃO: (vidas×.40 + captura×.20 + valores×.15 + eficiência×.10 + confiança×.15)×100,
      com tetos de nota quando há reféns mortos (princípio: perspectiva de quem protege).
   ===================================================================== */

const MAX_ROUNDS = 8;
const HOSTAGES = 17;
const START_TIME = 14 * 60 + 7;   // 14h07
const ROUND_MIN = 45;             // minutos simulados por rodada
const ADEQ = 60;                  // cobertura "adequada"
/* ---------- ECONOMIA (L1.3): a verba é um fluxo, não só um estoque ----------
   Custo de plantão: cada rodada o posto de comando paga a operação (base + agentes em campo), escalado pela dificuldade.
   Quem descansa na reserva ou foi reconvocado não custa plantão: rodízio economiza verba, mas abre zonas.
   Apoio externo encarece a cada uso (urgência tem preço crescente); horas extras custam proporcional ao efetivo em campo. */
const PLANTAO_BASE = 4, PLANTAO_AGENTE = 2;
const APOIO_PRECOS = [90, 110, 135];
const HORAS_BASE = 20, HORAS_AGENTE = 8;

/* ---------- ÍCONES (SVG inline minimalistas, stroke) ---------- */
const IC = {
  drone:'<circle cx="12" cy="12" r="2.5"/><path d="M3 6h6M15 6h6M9 6l3 6 3-6M3 18h6M15 18h6M9 18l3-6 3 6"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  thermal:'<path d="M10 14V5a2 2 0 014 0v9a4 4 0 11-4 0z"/><path d="M12 9v7"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  scope:'<circle cx="12" cy="12" r="8"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
  med:'<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M12 10v7M8.5 13.5h7"/>',
  jammer:'<path d="M5 12a10 10 0 0114 0M8 15a6 6 0 018 0"/><circle cx="12" cy="18" r="1.3"/><path d="M4 4l16 16"/>',
  car:'<path d="M4 15l2-6h12l2 6v4h-3v-2H7v2H4z"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/>',
  shot:'<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  heart:'<path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.5A4.5 4.5 0 0120 10c0 6-8 11-8 11z"/><path d="M6 12h3l1.5-3 2 6 1.5-3h3"/>',
  heli:'<path d="M3 5h18M12 5v3"/><ellipse cx="11" cy="13" rx="6" ry="4"/><path d="M17 13h5M8 17l-1 3M14 17l1 3"/>',
  alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',
  call:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/><path d="M15 3a6 6 0 016 6M15 7a2 2 0 012 2"/>',
  live:'<circle cx="12" cy="12" r="3"/><path d="M6 6a8.5 8.5 0 000 12M18 6a8.5 8.5 0 010 12M3 3a13 13 0 000 18M21 3a13 13 0 010 18"/>',
  swap:'<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  tired:'<rect x="3" y="8" width="16" height="9" rx="2"/><path d="M21 11v3M6 12h3"/>',
  bolt:'<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>',
  mask:'<path d="M4 7c4-2 12-2 16 0v4c0 5-3 8-8 9-5-1-8-4-8-9z"/><path d="M8 11h2M14 11h2M9 16c2 1 4 1 6 0"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  news:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
  bank:'<path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>',
  family:'<circle cx="8" cy="8" r="3"/><circle cx="17" cy="10" r="2.3"/><path d="M2 20c0-3.5 2.7-6 6-6s6 2.5 6 6M14 20c0-2.5 1.5-4.5 3.5-4.5S21 17 21 20"/>',
  mayor:'<path d="M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5"/>',
  split:'<path d="M12 21V11M12 11L5 4M12 11l7-7M5 4h4M5 4v4M19 4h-4M19 4v4"/>',
  light:'<path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.7 1 1.5 1 2.5h6c0-1 .2-1.8 1-2.5A6 6 0 0012 3z"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check:'<path d="M5 12l5 5 9-10"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  up:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  support:'<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="8"/>',
  coin:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.7c0 2.3-5 1.1-5 3.6 0 1 1 1.7 2.5 1.7s2.5-.6 2.5-1.5"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  shieldcheck:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  ear:'<path d="M7 9a5 5 0 0110 0c0 3-3 4-3 7a2.5 2.5 0 01-5 0"/><path d="M10.5 9a1.5 1.5 0 013 0"/>',
  map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6-6"/>',
  stairs:'<path d="M3 20h5v-4h5v-4h5V8h3"/>',
  road:'<path d="M8 3L4 21M16 3l4 18M12 4v3M12 11v3M12 18v3"/>',
  wait:'<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>'
};
const icon = (n, cls = 'ico', sw = 1.7) =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || IC.alert}</svg>`;

/* ---------- ZONAS (mapa esquemático em viewBox 760×480) ----------
   W = peso da zona na prontidão de intervenção (quem está perto do banco pesa mais). */
const ZONES = [
  { id:'entrada',  nome:'Entrada Principal',    curto:'Entrada',  x:300, y:330, w:160, h:72,  W:1.0,  tip:'Porta da agência. Agentes aqui pressionam o cofre (reduzem o avanço dos assaltantes), mas também elevam a agitação do líder.' },
  { id:'beco',     nome:'Beco de Serviço',      curto:'Beco',     x:470, y:165, w:100, h:237, W:.8,   tip:'Saída lateral usada para carga. Rota clássica de quem planeja com método.' },
  { id:'telhado',  nome:'Telhado',              curto:'Telhado',  x:300, y:100, w:160, h:58,  W:.8,   tip:'Ponto elevado, ótimo para observação e acesso superior.' },
  { id:'garagem',  nome:'Garagem Subterrânea',  curto:'Garagem',  x:120, y:175, w:170, h:125, W:.7,   dash:true, tip:'Nível inferior com rampa para a rua. Difícil de monitorar de fora.' },
  { id:'vizinho',  nome:'Prédio Vizinho',       curto:'Vizinho',  x:590, y:45,  w:150, h:150, W:.45,  tip:'Janelas de observação em ângulo. Cobertura à distância.' },
  { id:'metro',    nome:'Acesso ao Metrô',      curto:'Metrô',    x:20,  y:312, w:270, h:90,  W:.3,   tip:'Escadas e plataformas: rota de dispersão rápida em meio a pedestres.' },
  { id:'avenida',  nome:'Avenida Principal',    curto:'Avenida',  x:20,  y:414, w:720, h:54,  W:.3,   tip:'Eixo viário da cidade. Fuga em veículo e perseguição passam por aqui.' }
];
const ZONE = Object.fromEntries(ZONES.map(z => [z.id, z]));
const ZNAME = id => id === 'reserva' ? 'Reserva' : ZONE[id].nome;

/* ---------- AGENTES (12, exatamente como no projeto) ---------- */
const AGENTS = [
  { id:'renata',   nome:'Cap. Renata Alves',   s:{tat:9,neg:5,int:6,res:8,com:6},  trait:'Veterana',      tdesc:'Reconhece padrões: +15% de confiabilidade nas investigações e uma intuição na rodada 3.', custo:150 },
  { id:'marcos',   nome:'Sgt. Marcos Ribeiro', s:{tat:8,neg:3,int:5,res:9,com:4},  trait:'Disciplinado',  tdesc:'Fadiga reduzida: cansa na metade da velocidade.', custo:120 },
  { id:'carla',    nome:'Det. Carla Mendes',   s:{tat:4,neg:8,int:9,res:5,com:7},  trait:'Analítica',     tdesc:'Bônus de investigação (+10% de confiabilidade) e correlaciona relatos no painel.', custo:140 },
  { id:'paulo',    nome:'Neg. Paulo Duarte',   s:{tat:3,neg:10,int:6,res:4,com:9}, trait:'Empático',      tdesc:'Como negociador: +10% de avanço e efeito calmante ampliado nos degraus 1 a 3.', custo:135 },
  { id:'lucas',    nome:'Ag. Lucas Ferreira',  s:{tat:7,neg:4,int:7,res:7,com:5},  trait:'Adaptável',     tdesc:'Sem penalidade ao ser reposicionado.', custo:110 },
  { id:'fernanda', nome:'Ag. Fernanda Costa',  s:{tat:6,neg:6,int:8,res:5,com:8},  trait:'Comunicativa',  tdesc:'Bônus de +30% nas ações com stakeholders.', custo:125 },
  { id:'andre',    nome:'Sgt. André Gomes',    s:{tat:8,neg:2,int:4,res:10,com:3}, trait:'Implacável',    tdesc:'Bônus na intervenção (+8 de prontidão), mas penalidade como negociador (−12%).', custo:115 },
  { id:'sofia',    nome:'Det. Sofia Takahashi',s:{tat:5,neg:7,int:10,res:4,com:6}, trait:'Metódica',      tdesc:'Investigações custam 20% menos.', custo:145 },
  { id:'roberto',  nome:'Ag. Roberto Nunes',   s:{tat:7,neg:5,int:5,res:8,com:5},  trait:'Impulsivo',     tdesc:'Sob pressão alta (>65) pode agir sozinho e elevar a agitação.', custo:80 },
  { id:'camila',   nome:'Ag. Camila Araújo',   s:{tat:6,neg:6,int:6,res:6,com:7},  trait:'Versátil',      tdesc:'Atributos ajustáveis: +1 em um e −1 em outro, à sua escolha.', custo:100 },
  { id:'diego',    nome:'Cap. Diego Monteiro', s:{tat:9,neg:4,int:7,res:7,com:5},  trait:'Estrategista',  tdesc:'Pausa de Comando revela mais (duas pistas em vez de uma).', custo:155 },
  { id:'marina',   nome:'Ag. Marina Silva',    s:{tat:5,neg:9,int:5,res:5,com:8},  trait:'Pacificadora',  tdesc:'Reduz passivamente a agitação do líder em 2 por rodada.', custo:130 }
];
/* Guarnição improvisada: só entra se o jogador não recrutar ninguém (evita dead end). */
const GENERICS = [
  { id:'g1', nome:'Patrulheiro da guarnição A', s:{tat:3,neg:2,int:2,res:4,com:3}, trait:'Improvisado', tdesc:'Guarnição local convocada às pressas.', custo:0, generic:true },
  { id:'g2', nome:'Patrulheiro da guarnição B', s:{tat:3,neg:2,int:2,res:4,com:3}, trait:'Improvisado', tdesc:'Guarnição local convocada às pressas.', custo:0, generic:true }
];
const ALL_AGENTS = AGENTS.concat(GENERICS);
const agentById = id => ALL_AGENTS.find(a => a.id === id);
const ATTR = { tat:'Tática', neg:'Negociação', int:'Inteligência', res:'Resistência', com:'Comunicação' };

/* ---------- EQUIPAMENTOS (8) ---------- */
const EQUIP = [
  { id:'drone',   nome:'Drone de vigilância',   custo:80, ic:'drone',  desc:'+15 de cobertura aérea na zona em que for posicionado. Revela se essa zona é rota de fuga.' },
  { id:'escudo',  nome:'Escudo tático',         custo:50, ic:'shield', desc:'+10 de eficiência na intervenção (em qualquer posição).' },
  { id:'termica', nome:'Câmera térmica',        custo:70, ic:'thermal',desc:'Revela o número de pessoas em 1 zona. Em zona vizinha ao banco, revela quantos assaltantes há.' },
  { id:'negofone',nome:'Negofone seguro',       custo:60, ic:'phone',  desc:'+10% de chance de avanço na negociação.' },
  { id:'sniper',  nome:'Sniper de precisão',    custo:90, ic:'scope',  desc:'+20 de eficiência na zona posicionada (precisa de ao menos 1 agente lá). Reforça a prontidão de intervenção.' },
  { id:'kit',     nome:'Kit médico avançado',   custo:40, ic:'med',    desc:'Estabiliza refém ferido: reduz o risco de agravamento e metade das lesões em eventos.' },
  { id:'jammer',  nome:'Jammer de comunicação', custo:75, ic:'jammer', desc:'Bloqueia celulares dos assaltantes: sem cúmplice coordenado e sem lives. Isolamento eleva a agitação em +1/rodada.' },
  { id:'viatura', nome:'Viatura descaracterizada', custo:55, ic:'car', desc:'Mobilidade rápida: reposicionar agentes não gera perda de eficiência na rodada.' }
];
const EQ = Object.fromEntries(EQUIP.map(e => [e.id, e]));

/* ---------- PERFIS DO LÍDER ---------- */
const PROFILES = {
  calculista:  { nome:'Calculista',  start:25, base:2,  vault:1.3, press:5,  mult:{emp:.7,  rat:1.3}, routeW:{garagem:3,beco:3,metro:2.5,avenida:1.5,entrada:.5,telhado:1,vizinho:1},
    desc:'Frio e metódico. Responde a lógica. A agitação sobe devagar (+2/rodada) e também desce devagar.',
    tip:'Critérios objetivos e propostas concretas (Influência, Mudança de comportamento) funcionam melhor que empatia pura. Tende a mudar de rota se perceber cerco forte.',
    sign:'A voz do líder é calma. Ele pede as coisas em lista, uma de cada vez, e repete os prazos que ele mesmo fixou.', adapt:.35 },
  volatil:     { nome:'Volátil',     start:40, base:0,  vault:.8,  press:9,  mult:{emp:1.4, rat:.9},  routeW:{entrada:2.5,avenida:2.5,beco:2,vizinho:1.5,garagem:1,metro:1,telhado:.5},
    desc:'Emocional e imprevisível. A agitação oscila entre −5 e +8 por rodada e responde fortemente à empatia.',
    tip:'Escuta ativa, empatia tática e rapport. Pressão súbita é perigosa.',
    sign:'O tom muda a cada frase: grita, pede desculpas, volta a gritar. Ninguém sabe qual versão dele vai atender o telefone.', adapt:.1 },
  ideologico:  { nome:'Ideológico',  start:35, base:3,  vault:.6,  press:5,  mult:{emp:1.0, rat:.6},  routeW:{avenida:3,entrada:2.5,telhado:1.5,vizinho:1.5,metro:1.5,beco:1,garagem:1},
    desc:'Motivado por uma causa, não por dinheiro. Agitação alta e estável (+3/rodada). Propostas materiais rendem pouco.',
    tip:'Escuta, empatia e rapport; evite oferecer “trocas” puramente materiais. Visibilidade controlada ajuda.',
    sign:'O líder recusa qualquer menção a dinheiro e repete uma mensagem, como se falasse para câmeras que não estão ali.', adapt:.1 },
  desesperado: { nome:'Desesperado', start:60, base:5,  vault:1.0, press:8,  mult:{emp:.8, rat:.8},  routeW:{beco:3,garagem:2.5,metro:2.5,entrada:1.5,avenida:1.5,vizinho:1,telhado:1},
    desc:'Encurralado e reativo. Começa com agitação alta (+5/rodada) e é o perfil mais perigoso.',
    tip:'Calma, paciência e saídas dignas. Ultimatos e movimentos táticos visíveis pioram tudo.',
    sign:'Ele diz que não tem mais para onde ir. A voz falha no meio das frases e ele pergunta se “alguém ainda está do lado de cá”.', adapt:.1 }
};

/* ---------- DIFICULDADE ---------- */
const DIFF = {
  protocolar: { nome:'Protocolar', slots:3, ops:.7, timer:150, resist:1.45, ivp:-.10, agit:-1, evChance:.35, media:.85, vault:.85, stk:65, desp:.8, pbase:25, intel:.00, fat:.9,  lethal:.7, ret:55, hostile:0, assail:[2,3],
    blurb:'Para aprender a mecânica. Mais tempo, líder mais receptivo, eventos raros.' },
  complexo:   { nome:'Complexo',   slots:3, ops:1,  timer:100, resist:1.55, ivp:-.13, agit:0,  evChance:.55, media:1.0,  vault:1.0,  stk:58, desp:1.0, pbase:30, intel:.00, fat:1.0, lethal:1.0, ret:45, hostile:0, assail:[2,4],
    blurb:'O equilíbrio do documento. Tempo apertado, eventos frequentes.' },
  caotico:    { nome:'Caótico',    slots:2, ops:1.3,timer:65,  resist:1.60, ivp:-.19, agit:2,  evChance:.80, media:1.2,  vault:1.2,  stk:58, desp:1.25,pbase:38, intel:-.10,fat:1.25,lethal:1.3, ret:46, hostile:1, assail:[3,4],
    ncalm:1.3, negoFloor:.7, adaptAt:50, adaptMin:.4, violent:.75,
    blurb:'Só duas decisões por rodada, pouco tempo, informação mais cara e eventos quase toda rodada.' }
};

/* ---------- INTELIGÊNCIA ---------- */
const INTEL = [
  { id:'perfil',   nome:'Perfil psicológico do líder', custo:60, ic:'user',   fase1:true,  desc:'Identifica o perfil comportamental e como negociar com ele.' },
  { id:'rota',     nome:'Rastreamento de rota de fuga', custo:70, ic:'road',  fase1:true,  desc:'Revela qual das rotas candidatas o líder planeja usar.' },
  { id:'efetivo',  nome:'Contagem de armados',          custo:50, ic:'eye',   fase1:true,  desc:'Revela quantos assaltantes há e como estão armados.' },
  { id:'cofre',    nome:'Planta e andamento do cofre',  custo:50, ic:'bank',  fase1:false, desc:'Mostra o progresso exato dos assaltantes sobre o cofre e a previsão de abertura.' },
  { id:'refens',   nome:'Estado e identificação dos reféns', custo:40, ic:'heart', fase1:false, desc:'Revela quantos reféns estão feridos e se há risco clínico.' },
  { id:'cumplice', nome:'Varredura de contato externo', custo:60, ic:'call',  fase1:false, desc:'Descobre se há cúmplice do lado de fora.' }
];

/* ---------- NEGOCIAÇÃO (FBI Behavioral Change Stairway Model) ---------- */
const STEPS = [
  { n:1, nome:'Escuta ativa',            sub:'Deixá-lo falar; refletir e resumir.' },
  { n:2, nome:'Empatia',                 sub:'Rotular emoções; “parece que...”.' },
  { n:3, nome:'Rapport',                 sub:'Confiança e sintonia pessoal.' },
  { n:4, nome:'Influência',              sub:'Propor critérios e trocas objetivas.' },
  { n:5, nome:'Mudança de comportamento',sub:'Combinar a saída e a rendição.' }
];
const POSTURES = [
  { t:1, nome:'Escuta ativa',          d:'“Estou aqui. Conte-me o que está acontecendo.” Espelhar, resumir, não interromper.', kind:'emp' },
  { t:2, nome:'Empatia tática',        d:'Rotular o que ele sente: “Parece que ninguém te ouviu até agora.”',                  kind:'emp' },
  { t:3, nome:'Construir rapport',     d:'Oferecer pequenas gentilezas verificáveis (água, medicamento, tempo).',             kind:'emp' },
  { t:4, nome:'Influência',            d:'Propor critérios objetivos e uma troca clara, com o que cada lado ganha.',          kind:'rat' },
  { t:5, nome:'Propor a saída',        d:'Detalhar como a rendição acontece, com garantias e uma saída digna.',               kind:'rat' }
];

/* ---------- STAKEHOLDERS ---------- */
const STK = {
  imprensa: { nome:'Imprensa',   sub:'quer transparência', ic:'mic',    w:.20 },
  prefeito: { nome:'Prefeito',   sub:'quer resolução rápida', ic:'mayor', w:.25 },
  banco:    { nome:'Banco',      sub:'quer o patrimônio', ic:'bank',   w:.25 },
  familias: { nome:'Famílias',   sub:'querem os reféns seguros', ic:'family', w:.30 }
};
const STK_KEYS = Object.keys(STK);

const COMMS = [
  { id:'coletiva',  s:'imprensa', nome:'Coletiva transparente',      custo:0,  d:'Informa o que se sabe. Reduz a pressão da mídia (−5) e agrada a imprensa.' },
  { id:'prefeito',  s:'prefeito', nome:'Relatório de situação ao prefeito', custo:0, d:'Briefing direto no gabinete. Reduz a ansiedade política.' },
  { id:'gerente',   s:'banco',    nome:'Reunião com a diretoria do banco', custo:0, d:'Alinha expectativas. A diretoria entrega a planta do cofre (revela o andamento exato).' },
  { id:'acolhe',    s:'familias', nome:'Sala de acolhimento das famílias', custo:20, d:'Psicólogos e informação. As famílias descrevem os reféns (revela o estado deles).' },
  { id:'geral',     s:'todos',    nome:'Comunicado geral',           custo:0,  d:'Nota única para os quatro públicos: efeito menor em cada um, mas atende todos.' }
];

/* ---------- EVENTOS ---------- */
/* ícones/descrições; efeitos implementados no motor (EVENT_FX) */
const EVENT_DEFS = [
  { id:'tiroteio',  titulo:'Tiroteio acidental', ic:'shot', radio:'[RÁDIO] Disparo! Repito, disparo dentro da agência. Equipe Entrada, confirmem posição! Câmbio.',
    desc:'Um estampido seco corta a tarde. Ninguém sabe quem atirou, nem em quê. A rua inteira recua um passo.' },
  { id:'passamal',  titulo:'Refém passa mal', ic:'heart', radio:'[RÁDIO] O líder pediu insulina pelo telefone. Diz que uma senhora está desmaiando. Câmbio.',
    desc:'Lúcia Andrade, 67 anos, aposentada, é diabética. Veio ao banco pagar contas antes do almoço e não comeu desde então. O tempo para a insulina está acabando. É uma oportunidade de troca humanitária, e também um risco.' },
  { id:'heli',      titulo:'Helicóptero de TV', ic:'heli', radio:'[RÁDIO] Central, temos um helicóptero da Rede Litoral sobrevoando a área. Posições das equipes estão expostas do alto. Repito: estamos visíveis. Câmbio.',
    desc:'As imagens ao vivo mostram cada posição do perímetro. Se alguém lá dentro tem uma televisão, o plano acaba de ser entregue.' },
  { id:'segundo',   titulo:'Segundo incidente', ic:'alert', radio:'[RÁDIO] Central, acidente com múltiplas vítimas no Viaduto Norte. Estão pedindo todas as unidades disponíveis. Câmbio.',
    desc:'A cidade não para por causa do seu cerco. Parte da sua equipe é reconvocada, e a restrição de pessoal fica ainda pior.' },
  { id:'cumplice',  titulo:'Cúmplice externo', ic:'call', radio:'[RÁDIO] Equipe Garagem, vimos um veículo estacionado com o motor ligado há mais de uma hora. Câmbio.',
    desc:'Há um quarto elemento do lado de fora, coordenando o plano. A rota de fuga acaba de ganhar reforço.' },
  { id:'prefeito',  titulo:'Telefonema do prefeito', ic:'mayor', radio:'[RÁDIO] Comandante, o gabinete do prefeito na linha de segurança. Ele quer falar com você agora. Câmbio.',
    desc:'“Não quero ver isso no noticiário das 8.” A voz do outro lado não pede, informa.' },
  { id:'live',      titulo:'Live nas redes', ic:'live', radio:'[RÁDIO] Central, há uma transmissão ao vivo vindo de dentro do banco. Thiago Lima, 19 anos, está filmando com o celular escondido. Já passa de cem mil pessoas assistindo. Câmbio.',
    desc:'A pressão explode, mas a câmera também mostra o que ninguém de fora conseguia ver.' },
  { id:'proposta',  titulo:'Proposta dos assaltantes', ic:'swap', radio:'[RÁDIO] O líder fez uma oferta: três reféns em troca de um veículo na porta. Repito: três por um carro. Câmbio.',
    desc:'A troca clássica. Vidas imediatas contra mobilidade para quem tenta fugir.' },
  { id:'fadiga',    titulo:'Fadiga crítica', ic:'tired', radio:'[RÁDIO] Central, as equipes de campo estão reportando exaustão. Vários agentes sem pausa desde o início. Câmbio.',
    desc:'Olhos pesados, reflexos lentos. Sem rodízio, a equipe perde 15% de eficiência.' },
  { id:'energia',   titulo:'Corte de energia', ic:'bolt', radio:'[RÁDIO] Perdemos a luz no quarteirão inteiro. A agência está no escuro. Repito: apagão total. Câmbio.',
    desc:'A escuridão favorece quem se move, mas lá dentro há dezessete pessoas que não enxergam nada.' },
  { id:'infiltrado',titulo:'Infiltrado', ic:'mask', radio:'[RÁDIO] Comandante, o agente da equipe especial se ofereceu para entrar disfarçado como técnico do ar-condicionado. Autoriza? Câmbio.',
    desc:'Informação rica por dentro, com risco real se for descoberto.' },
  { id:'deadline',  titulo:'Deadline do noticiário', ic:'clock', radio:'[RÁDIO] Central, o jornal das 20h confirmou abertura ao vivo na frente da agência. Faltam cerca de duas rodadas. Câmbio.',
    desc:'O relógio da cidade agora tem hora marcada. O prefeito exige uma resolução antes do horário nobre.' },
  /* extras do documento original (Tabela 8) */
  { id:'familia',   titulo:'Família na linha', ic:'family', radio:'[RÁDIO] A mãe de Yara Tavares, a estagiária da agência, conseguiu ligar para o celular da filha. Elas estão na linha agora. Câmbio.',
    desc:'Um familiar abriu contato direto com uma refém. É um canal humano e também um canal fora do seu controle.' },
  { id:'diretor',   titulo:'Diretor do banco interfere', ic:'bank', radio:'[RÁDIO] Comandante, o diretor regional do Meridiano está no isolamento e exige falar com você. Câmbio.',
    desc:'Ele pede prioridade para proteger o cofre. A pressão institucional chegou ao posto de comando.' },
  { id:'divisao',   titulo:'Sinal de divisão interna', ic:'split', radio:'[RÁDIO] Negociador, um dos homens lá dentro sussurrou no telefone: “eu não quero mais isso”. Câmbio.',
    desc:'Há uma rachadura no grupo. Explorar a divisão pode ajudar, ou desestabilizar tudo.' }
];
const EVDEF = Object.fromEntries(EVENT_DEFS.map(e => [e.id, e]));

/* ---------- TEORIA DAS RESTRIÇÕES: os três elos que migram (Goldratt & Cox, 1984) ----------
   Os cinco passos de foco: identificar a restrição, explorá-la, subordinar o resto a ela, elevá-la, repetir. */
const TOCS = {
  info:    { nome:'Informação',    ic:'eye',   tab:'intel',  cor:'violet', fase:'início do cerco',
             por:'Há variáveis ocultas demais: cada decisão tática é uma aposta no escuro.',
             elevar:'Investigue, abra o canal com o líder, use a Pausa de Comando ou chame a diretoria e as famílias (que revelam o cofre e os reféns).',
             parar:'Não adianta ainda gastar em força tática: sem saber onde atacar, mais gente só cobre mais escuro.' },
  pessoal: { nome:'Pessoal tático', ic:'user',  tab:'tatica', cor:'blue',   fase:'meio do cerco',
             por:'Há rotas candidatas sem cobertura. Mais informação não vira cobertura sem gente.',
             elevar:'Reposicione quem está em zona improvável, peça apoio externo para a rota provável ou recupere agentes reconvocados.',
             parar:'Mais investigações agora trazem pouco: o que falta já não é saber, é ter quem cubra.' },
  tempo:   { nome:'Tempo e fadiga', ic:'clock', tab:'tatica', cor:'amber',  fase:'fim do cerco',
             por:'O relógio e o cansaço viraram o elo mais fraco: rodízio e prazo decidem agora.',
             elevar:'Pague horas extras, faça rodízio pela reserva e use cada rodada para avançar a negociação ou fechar o desfecho.',
             parar:'Reforçar zonas e investigar mais já rendem pouco: o que se esgota é o tempo da equipe e da cidade.' }
};

/* ---------- CONQUISTAS ---------- */
const BADGES = [
  { id:'ninguem',  nome:'Ninguém fica para trás', ic:'shieldcheck', d:'Nenhum refém ferido ou morto.' },
  { id:'escuta',   nome:'Mestre da escuta',       ic:'ear',   d:'Rendição negociada sem aceitar concessões materiais.' },
  { id:'sacada',   nome:'Sacada',                 ic:'light', d:'Usou a Pausa de Comando de forma estratégica (2 a 3 vezes) e terminou com nota C ou melhor.' },
  { id:'aposta',   nome:'Aposta certa',           ic:'scope', d:'A rota de fuga real estava com cobertura adequada desde o perímetro, antes de ser revelada.' },
  { id:'olhos',    nome:'Olhos abertos',          ic:'eye',   d:'Terminou com 5 das 6 variáveis ocultas reveladas.' },
  { id:'cofre',    nome:'Cofre intacto',          ic:'bank',  d:'Encerrou com o cofre abaixo de 40% de progresso.' },
  { id:'economia', nome:'Cofre da corporação',    ic:'coin',  d:'Terminou com 400 créditos ou mais de reserva.' },
  { id:'porta',    nome:'Porta-voz',              ic:'mic',   d:'Todos os quatro stakeholders terminaram com 60 ou mais.' },
  { id:'degraus',  nome:'Um degrau por vez',      ic:'stairs',d:'Chegou ao degrau 4 ou mais sem nunca pular etapa.' },
  { id:'rodizio',  nome:'Equipe descansada',      ic:'tired', d:'Nenhum agente chegou a fator de fadiga abaixo de 0,7.' },
  { id:'equilibrio',nome:'Equilíbrio perfeito',   ic:'radar', d:'As cinco dimensões da pontuação acima de 60%.' },
  { id:'mao',      nome:'Mão firme',              ic:'shield',d:'Intervenção bem-sucedida sem nenhum refém ferido.' }
];
