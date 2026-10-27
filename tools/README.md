# Ferramentas de teste

Bancada usada para calibrar o equilíbrio e auditar a lógica do PERÍMETRO. Não faz parte do jogo: o artefato continua sendo só `perimetro.html`, gerado por `./build.sh`.

## Simulação headless (`tools/sim/`)

Carrega `data.js`, `story.js`, `engine.js` e `dash.js` num contexto `vm` isolado, com gerador aleatório de semente fixa, e joga partidas completas com robôs que chamam o motor do mesmo jeito que a interface. Só precisa de Node.

| Script | O que faz |
| --- | --- |
| `node tools/sim/matriz.js [N] [filtro]` | Nível de jogador (novato, mid, mid+, especialistas `exp_paz`, `exp_eq`, `exp_agr`) × dificuldade: nota média, distribuição de notas, mortes e desfechos. |
| `node tools/sim/arquetipos.js [N]` | Os três jogos de referência (negociadora, agressiva, equilibrada) nas três dificuldades. |
| `node tools/sim/edge.js [N] [NF]` | Casos extremos (sem equipe, gasta tudo, ignora negociação, só uma frente, passivo, intervém sempre…) mais um fuzz de `NF` partidas que confere invariantes a cada rodada (sem NaN, reféns que fecham 17, notas e tetos coerentes). |
| `node tools/sim/itens.js [N] [equilibrada\|negociadora\|agressiva] [gratis]` | Valor de cada equipamento: a mesma equipe e política com um item só (ou nenhum). Pago inclui o custo de oportunidade; `gratis` mostra o efeito puro. |
| `node tools/sim/notas.js [N]` | Fração das partidas que passa de cada limiar de nota (S e A) por jogador e dificuldade, incluindo equipes enxutas e cheias. |
| `node tools/sim/selos.js [N]` | Frequência de cada selo por jogador e dificuldade, com uma equipe enxuta que comunica toda rodada. Acusa selo impossível ou ganho pelo motivo errado. |
| `node tools/sim/equipe.js [N] [paz\|agr]` | Valor do tamanho da equipe: o especialista joga com 2 a 6 agentes e mostra se o agente a mais se paga (a nota já desconta a eficiência de custo). |
| `node tools/sim/audit.js [formulas\|cenarios]` | Auditoria das fórmulas do motor contra a especificação (L2.1): cobertura, pressão (Yerkes-Dodson), fadiga, probabilidade de avanço da negociação, agitação, mídia, vazamento de comunicado, cofre e pontuação (pesos, faixas de nota, Vidas, penalidade por agente ferido), mais os 5 cenários extremos com o rastro de uma partida de cada. Sai com erro se alguma verificação falhar. |
| `node tools/sim/alertas.js [N]` | Roda `siegeAlerts()`, `milestones()`, as prévias e as previsões de `dash.js` em cada rodada de `N` partidas: acusa exceção, texto quebrado, gravidade ou aba inválida, ordem errada e qualquer função de leitura que altere o estado do jogo. |
| `node tools/sim/fluxo.js [N]` | Fluxo e estados do motor (L2.2): a ordem de prioridade dos desfechos no fim da rodada com aleatório de roteiro (intervenção ordenada > ação desesperada > rendição > cofre > ordem política > ultimato, e os limites exatos de cada um); salvar e restaurar em todo ponto de `N` partidas (18 políticas × 3 dificuldades), seguindo o jogo e exigindo o mesmo resultado; novo jogo que não herda nada e tabelas de dados que ninguém altera; rodadas sempre de 1 a 8. |
| `node tools/sim/comparar.js [ref-git] [N]` | Teste diferencial: mesmas sementes com o motor de uma versão anterior (`git show`) e com o atual; conta as partidas que divergem. Zero divergência prova que uma mudança de interface ou de texto não mexeu no jogo. |
| `node tools/sim/ablacao.js [N]` | Ablação (L2.3): o especialista de paz joga as mesmas partidas com uma peça a menos (negociação, comunicação com cada stakeholder, inteligência, horas extras e apoio, cada equipamento, cada agente). A diferença pareada mostra o que cada peça vale e o que custa ignorar a negociação ou um stakeholder (perda de confiança e ordem política). |
| `node tools/sim/agentes.js [N] [paz\|agr\|eq]` | Valor de cada agente: a equipe-base joga com mais um agente por vez (a diferença já desconta o custo) e a dominância estática entre os doze. |
| `node tools/sim/perfil.js [N]` | As mesmas políticas contra cada perfil do líder nas três dificuldades: mostra se os perfis são distintos, se o Desesperado é o mais difícil e que política rende mais contra cada um. |
| `node tools/sim/contra.js [N]` | Contra-estratégias por perfil: o especialista muda uma alavanca (sem agente na Entrada, perfil em vez da rota, sem inteligência cedo, equipe enxuta) e a nota é comparada com a do especialista-base contra o mesmo perfil. |
| `node tools/sim/rush.js [N] [forte\|enxuta]` | Quando intervir: espera até a rodada r e autoriza a entrada, sem preparo, só investigando ou com o plano completo. Mede o valor de esperar. |
| `node tools/sim/escada.js [N]` | Escada de habilidade: o especialista joga com ruído crescente (decisões, só a postura, só a equipe) e a nota tem de cair a cada degrau, senão a habilidade não é premiada. |
| `node tools/sim/perda.js [N] [rodada]` | O que custa perder um stakeholder: ele cai para 10 na rodada escolhida; mede a nota, as mortes, a ordem política e o corte do banco. |
| `node tools/sim/eventos.js [N] [paz\|neglige]` | Cartas de evento: frequência por partida e por rodada e o peso de cada carta e de cada escolha (a carta é forçada e a partida é comparada com uma sem eventos). |
| `node tools/sim/partidas.js [saida.md]` | Auditoria final (L2.5): três partidas completas anotadas rodada a rodada (Protocolar + Calculista + negociadora, Complexo + Volátil + agressiva, Caótico + Desesperado + equilibrada), com cada número refeito do zero só a partir do estado e das fórmulas do projeto e comparado com o do motor. Sai com erro se algo divergir. |

`PERI_SRC=/outra/pasta/src` simula uma variante do código sem mexer no repositório; `OUT=/outra/pasta/x.html ./build.sh` gera uma cópia do artefato para os testes de navegador (`PERI_HTML`). Os robôs ficam em `bots.js` (políticas e corredor de partidas; `policyComunicador` joga só negociação e comunicação com a equipe que se escolher), `experts.js` e `tiers.js`.

Tudo o que o painel calcula (alertas, marcos, prévias, percepção com névoa, selos) mora em `dash.js` e roda aqui; a interface só desenha.

## Navegador (`tools/ui/`, Playwright)

Precisam do Playwright (`NODE_PATH=$(npm root -g)` se ele estiver instalado globalmente) e abrem `perimetro-standalone.html`, o conteúdo do jogo dentro do mesmo esqueleto (doctype, charset, viewport) que a publicação usa. Abrir direto do disco o `perimetro.html`, que não tem esse esqueleto, faz o navegador adivinhar a codificação e entrar em modo de compatibilidade: sob carga a página falhou ao carregar em cerca de 2% das recargas.

| Script | O que faz |
| --- | --- |
| `node tools/ui/e2e.js <plano> <dificuldade> [noshots]` | Fluxo completo (menu, briefing, recrutamento, perímetro, 8 rodadas, desfecho, as abas do pós-jogo, Continuar partida e Jogar novamente). Planos: `negociadora`, `agressiva`, `equilibrada`, `semEquipe`, `lento`, `gastaTudo`. Acusa erro de console, texto quebrado e tela sem saída. Capturas em `$PERI_SHOTS` (padrão: pasta temporária). |
| `node tools/ui/estados.js [grupo]` | Fluxo de estados no navegador (L2.2). Grupos: `grafo` (todo estado alcançável, nenhum beco sem saída, só transições previstas), `retomada` (recarrega a página a cada passo de três partidas e compara o estado restaurado com o salvo), `corrompido` (42 saves quebrados à mão e 150 mutações aleatórias de um save real: a página não pode travar nem quebrar), `armazenamento` (localStorage bloqueado, cheio ou devolvendo lixo), `reinicio` (Jogar novamente limpa tudo), `timers` (um só cronômetro, expiração, aba oculta, recarga, ouvintes e memória em 6 partidas), `cliques` (duplo clique e ações fora de hora) e `menu` (Menu no meio da partida, confirmação ao iniciar sobre um save, aviso de save descartado). `PERI_HTML=/outro.html` testa uma cópia; `FUZZ_SAVES=N` muda o número de mutações. |
| `tools/ui/bateria.sh [pasta]` | Roda em sequência tudo o que há de navegador: os oito grupos de `estados.js`, `uifuzz.js 200` e sete planos do `e2e.js`. Uma prova por vez, porque em paralelo o navegador perde cliques por falta de CPU. Escreve um arquivo por prova na pasta e imprime o resumo. |
| `node tools/ui/uifuzz.js [N]` | Joga `N` partidas pelo motor real dentro da página e renderiza todas as telas em cada estado, procurando `undefined`, `NaN`, `[object Object]`, exceções e telas vazias. |

## Números de referência (Loop 2, depois da L2.3, N = 300 por célula)

Nota média por nível de jogador (Protocolar / Complexo / Caótico). A L2.1 trouxe a nota de Vidas e a penalidade por agente ferido para o que o documento pede, o vazamento de comunicado e o fator de pressão sem piso (isso baixou todas as médias em 2 a 5 pontos em relação à L1.5: novato 62,2 / 58,2 / 53,9, especialista de paz 83,7 / 78,4 / 69,1). A L2.3 mexeu em cinco pontos (ver o relatório do Loop 2) e deixou as médias praticamente onde estavam: o jammer vira canal único (+6% de avanço), o Complexo ganha `lev` e `dist` intermediários, o Caótico recebe o mesmo limite de rendição do Complexo, o aviso da ordem política mostra a previsão exata e as cartas Diretor do banco e Cúmplice passam a ter consequência operacional.

| Nível | Protocolar | Complexo | Caótico |
| --- | --- | --- | --- |
| novato | 58,5 | 54,0 | 50,3 |
| mid | 63,1 | 53,5 | 47,4 |
| mid+ | 67,9 | 56,0 | 50,2 |
| especialista, paz | 83,0 | 77,6 | 67,6 |
| especialista, equilibrado | 81,7 | 71,2 | 62,1 |
| especialista, agressivo | 75,4 | 67,0 | 49,5 |

Valor dos equipamentos (`itens.js 2000 equilibrada gratis`, depois da L2.3): nota ganha com o item de graça em Protocolar / Complexo / Caótico.

| Item (custo) | Ganho de nota |
| --- | --- |
| Negofone (60) | +3,6 / +4,2 / +5,6 |
| Kit médico (40) | +1,8 / +3,5 / +4,5 |
| Jammer (75) | +2,2 / +1,3 / +3,1 |
| Drone (80) | +0,3 / +1,0 / +1,6 |
| Viatura (55) | +0,1 / +0,6 / +1,1 |
| Sniper (90), escudo (50), térmica (70) | de +0,3 a +0,7 (o escudo e o sniper valem +1,5 a +3,2 para a política agressiva) |

Outras referências (Protocolar / Complexo / Caótico):

- Nota S (`notas.js 300`): uma equipe de 2 agentes que negocia e comunica faz ≥ 90 em 69 / 34 / 1% das partidas; o especialista de paz, em 0% (o S pede perder no máximo 10 pontos e a Eficiência custa 7,5 a ele no Protocolar).
- Perfis (`perfil.js 300`): para quem negocia (especialista de paz, equilibrado, equipe enxuta, mid+) o Desesperado é o pior perfil nas três dificuldades (especialista de paz 80,5 / 66,5 / 53,2 contra 82,7–85,3 / 77,7–82,3 / 68,4–74,6 dos outros três) e o Volátil, o mais favorável à escuta. Quem não negocia (novato, agressivo) mal sente o perfil: as diferenças ficam dentro do ruído.
- Ablação (`ablacao.js 300`, especialista de paz): sem negociar custa −28,5 / −29,3 / −17,6; sem falar com nenhum stakeholder, −7,8 / −11,1 / −11,2 (ordem política em 23 / 42 / 68% das partidas); sem investigar, −1,0 / −2,7 / −8,7; sem equipamento nenhum, −3,3 / −9,1 / −9,3.
- Selos (`selos.js 300`): nenhum em 0% em todas as colunas. A equipe enxuta que comunica toda rodada ganha o Porta-voz em 99 / 88 / 12% e o Equilíbrio em 90 / 66 / 15%; o Sacada exige a Pausa usada 2 a 3 vezes.
- Quando intervir (`rush.js 300 forte`): entrar sem preparo na rodada 1 dá 66,0 / 61,6 / 58,9; entrar na 4 com o plano completo, 76,1 / 71,4 / 63,4; entrar na 8, 67,7 / 58,5 / 50,0.
- Tamanho da equipe (`equipe.js 800 paz`): de 2 a 5 agentes a nota sobe só 1 a 2,5 pontos e o sexto agente a reduz.

Se uma mudança futura mover as notas médias dos níveis de jogador mais do que o ruído (cerca de ±1,5 ponto), a ordem Protocolar > Complexo > Caótico ou a relação entre os níveis pode ter quebrado. Os ganhos de nota dos equipamentos têm ruído de cerca de ±0,5 com N = 2.000.
