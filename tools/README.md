# Ferramentas de teste

Bancada usada para calibrar o equilíbrio e auditar a lógica do PERÍMETRO. Não faz parte do jogo: o artefato continua sendo só `perimetro.html`, gerado por `./build.sh`.

## Simulação headless (`tools/sim/`)

Carrega `data.js`, `story.js`, `engine.js` e `dash.js` num contexto `vm` isolado, com gerador aleatório de semente fixa, e joga partidas completas com robôs que chamam o motor do mesmo jeito que a interface. Só precisa de Node.

| Script | O que faz |
| --- | --- |
| `node tools/sim/matriz.js [N] [filtro]` | Nível de jogador (novato, mid, mid+, especialistas `exp_paz`, `exp_eq`, `exp_agr`) × dificuldade: nota média, distribuição de notas, mortes e desfechos. |
| `node tools/sim/arquetipos.js [N]` | Os três jogos de referência (negociadora, agressiva, equilibrada) nas três dificuldades. |
| `node tools/sim/edge.js [N] [NF]` | Casos extremos (sem equipe, gasta tudo, ignora negociação, só uma frente, passivo, intervém sempre…) mais um fuzz de `NF` partidas que confere invariantes a cada rodada (sem NaN, reféns que fecham 17, notas e tetos coerentes). |

`PERI_SRC=/outra/pasta/src` simula uma variante do código sem mexer no repositório. Os robôs ficam em `bots.js` (políticas e corredor de partidas), `experts.js` e `tiers.js`.

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

Se uma mudança futura mover estes números mais do que o ruído (cerca de ±1,5 ponto), a ordem Protocolar > Complexo > Caótico ou a relação entre os níveis de jogador pode ter quebrado.
