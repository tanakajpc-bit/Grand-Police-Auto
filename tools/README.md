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
| `node tools/sim/comparar.js [ref-git] [N]` | Teste diferencial: mesmas sementes com o motor de uma versão anterior (`git show`) e com o atual; conta as partidas que divergem. Zero divergência prova que uma mudança de interface ou de texto não mexeu no jogo. |

`PERI_SRC=/outra/pasta/src` simula uma variante do código sem mexer no repositório. Os robôs ficam em `bots.js` (políticas e corredor de partidas; `policyComunicador` joga só negociação e comunicação com a equipe que se escolher), `experts.js` e `tiers.js`.

Limite conhecido: `siegeAlerts()` e `milestones()` usam funções da camada de interface (por exemplo `perceivedAgit`), então só rodam no navegador; o fuzz de interface os cobre.

## Navegador (`tools/ui/`, Playwright)

Precisam do Playwright (`NODE_PATH=$(npm root -g)` se ele estiver instalado globalmente) e abrem `perimetro.html`.

| Script | O que faz |
| --- | --- |
| `node tools/ui/e2e.js <plano> <dificuldade> [noshots]` | Fluxo completo (menu, briefing, recrutamento, perímetro, 8 rodadas, desfecho, as abas do pós-jogo, Continuar partida e Jogar novamente). Planos: `negociadora`, `agressiva`, `equilibrada`, `semEquipe`, `lento`, `gastaTudo`. Acusa erro de console, texto quebrado e tela sem saída. Capturas em `$PERI_SHOTS` (padrão: pasta temporária). |
| `node tools/ui/uifuzz.js [N]` | Joga `N` partidas pelo motor real dentro da página e renderiza todas as telas em cada estado, procurando `undefined`, `NaN`, `[object Object]`, exceções e telas vazias. |

## Números de referência (L1.5, N = 300 por célula)

Nota média por nível de jogador (Protocolar / Complexo / Caótico):

| Nível | Protocolar | Complexo | Caótico |
| --- | --- | --- | --- |
| novato | 62,2 | 58,2 | 53,9 |
| mid | 65,0 | 57,3 | 51,7 |
| mid+ | 67,7 | 60,1 | 53,0 |
| especialista, paz | 83,7 | 78,4 | 69,1 |
| especialista, equilibrado | 82,4 | 75,0 | 63,6 |
| especialista, agressivo | 75,1 | 69,3 | 52,4 |

Valor dos equipamentos (`itens.js 2000 equilibrada gratis`): nota ganha com o item de graça em Protocolar / Complexo / Caótico.

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
