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
| `node tools/sim/audit.js [N]` | Auditoria das fórmulas do motor contra a especificação (L2.1): cobertura, pressão (Yerkes-Dodson), fadiga, probabilidade de avanço da negociação, agitação, mídia, vazamento de comunicado, cofre e pontuação (pesos, faixas de nota, Vidas, penalidade por agente ferido), mais os 5 cenários extremos com o rastro de uma partida de cada. Sai com erro se alguma verificação falhar. |
| `node tools/sim/alertas.js [N]` | Roda `siegeAlerts()`, `milestones()`, as prévias e as previsões de `dash.js` em cada rodada de `N` partidas: acusa exceção, texto quebrado, gravidade ou aba inválida, ordem errada e qualquer função de leitura que altere o estado do jogo. |
| `node tools/sim/fluxo.js [N]` | Fluxo e estados do motor (L2.2): a ordem de prioridade dos desfechos no fim da rodada com aleatório de roteiro (intervenção ordenada > ação desesperada > rendição > cofre > ordem política > ultimato, e os limites exatos de cada um); salvar e restaurar em todo ponto de `N` partidas (18 políticas × 3 dificuldades), seguindo o jogo e exigindo o mesmo resultado; novo jogo que não herda nada e tabelas de dados que ninguém altera; rodadas sempre de 1 a 8. |
| `node tools/sim/comparar.js [ref-git] [N]` | Teste diferencial: mesmas sementes com o motor de uma versão anterior (`git show`) e com o atual; conta as partidas que divergem. Zero divergência prova que uma mudança de interface ou de texto não mexeu no jogo. |

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

## Números de referência (Loop 2, depois da L2.1, N = 300 por célula)

Nota média por nível de jogador (Protocolar / Complexo / Caótico). A L2.1 trouxe a nota de Vidas e a penalidade por agente ferido para o que o documento pede, o vazamento de comunicado e o fator de pressão sem piso; isso baixou todas as médias em 2 a 5 pontos em relação à L1.5 (novato 62,2 / 58,2 / 53,9, especialista de paz 83,7 / 78,4 / 69,1).

| Nível | Protocolar | Complexo | Caótico |
| --- | --- | --- | --- |
| novato | 58,3 | 53,9 | 50,3 |
| mid | 62,7 | 53,1 | 47,0 |
| mid+ | 67,0 | 55,8 | 49,5 |
| especialista, paz | 83,0 | 77,6 | 67,5 |
| especialista, equilibrado | 81,7 | 71,8 | 62,0 |
| especialista, agressivo | 75,6 | 66,1 | 47,9 |

Valor dos equipamentos (L1.5, `itens.js 2000 equilibrada gratis`; a L2.3 mede de novo): nota ganha com o item de graça em Protocolar / Complexo / Caótico.

| Item (custo) | Ganho de nota |
| --- | --- |
| Negofone (60) | +3,2 / +3,7 / +4,6 |
| Kit médico (40) | +1,1 / +2,4 / +3,7 |
| Drone (80) | +0,3 / +0,9 / +1,6 |
| Viatura (55) | +0,1 / +0,6 / +1,0 |
| Sniper (90), escudo (50), térmica (70) | de −0,5 a +0,4 (o escudo e o sniper valem +1,5 a +3,2 para a política agressiva) |
| Jammer (75) | −0,4 / −1,3 / −0,4 |

Outras referências (Protocolar / Complexo / Caótico):

- Nota S (`notas.js 600`): uma equipe de 2 agentes que negocia e comunica faz S em 66 / 39 / 1% das partidas; o especialista de paz, em 0% (o S pede perder no máximo 10 pontos e, no Protocolar, só a Eficiência custa 7,5 a ele).
- Selos (`selos.js 300`): a equipe enxuta que comunica toda rodada ganha o Porta-voz em 96 / 89 / 11% e o Equilíbrio em 88 / 72 / 10%. Um selo em 0% em todas as colunas está impossível; um selo que o novato ganha mais que o especialista provavelmente mede pressa.
- Tamanho da equipe (`equipe.js 800 paz`): de 2 a 5 agentes a nota sobe só 1 a 2,5 pontos e o sexto agente a reduz.

Se uma mudança futura mover as notas médias dos níveis de jogador mais do que o ruído (cerca de ±1,5 ponto), a ordem Protocolar > Complexo > Caótico ou a relação entre os níveis pode ter quebrado. Os ganhos de nota dos equipamentos têm ruído de cerca de ±0,5 com N = 2.000.
