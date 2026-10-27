# PERÍMETRO

Simulação de gestão de crise (reféns em uma agência bancária) em um único arquivo HTML, em português do Brasil. O jogador recruta a equipe, fecha o perímetro, conduz até 8 rodadas de cerco (negociação, comunicação com os stakeholders, investigação, tática) e recebe nota, jornal, selos e debrief. A perspectiva é a de quem protege: a violência não rende nota.

Artefato publicado: https://claude.ai/artifact/7yQmLNrrYJrJQpEDKrXH5P (versão 13, fim da L2.3). O que se publica é `perimetro.html`, só o conteúdo da página (a publicação o embrulha com doctype, charset e viewport). Para abrir o jogo direto do disco use `perimetro-standalone.html`: o mesmo conteúdo dentro desse esqueleto, que é também o arquivo que os testes de navegador carregam.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/data.js` | Constantes e tabelas: `DIFF` (as três dificuldades), `AGENTS`, `EQUIP`, `INTEL`, `COMMS`, `BADGES`, eventos |
| `src/story.js` | Textos narrativos (briefing, manchetes, rádio, jornal) |
| `src/engine.js` | Estado único `G`, regras, negociação, intervenção, pontuação (`computeScore`, `gradeOf`) e salvamento (`perimetro_save_v2`) |
| `src/dash.js` | Projeções e alertas do painel |
| `src/ui1.js` | Peças comuns, mapa, menu, briefing, recrutamento e perímetro |
| `src/ui2.js` | Cerco: HUD, painel do comandante (quatro abas), resultado da rodada e eventos |
| `src/ui3.js` | Desfecho, pós-jogo (nota, gazeta, conquistas, replay, debrief) e o `render()` principal |
| `src/style.css`, `src/head.html` | Estilo e cabeçalho |
| `build.sh` | Junta tudo em `perimetro.html` e `perimetro-standalone.html`, que ficam versionados: rode antes de cada commit |
| `tools/` | Simulação sem navegador e testes de navegador; veja `tools/README.md` |

O motor e o `dash.js` não dependem da interface: tudo o que decide, prevê ou alerta roda sem navegador (`tools/sim/`), e a interface só desenha.

## Fluxo de trabalho

1. Edite `src/` e rode `./build.sh`.
2. Se a mudança não deveria alterar o jogo (texto, interface), prove com `node tools/sim/comparar.js <commit-anterior> 200`: o esperado é zero divergência.
3. Se mexeu em regra ou equilíbrio, rode `node tools/sim/matriz.js 300` e compare com as notas de referência de `tools/README.md`.
4. Antes de publicar, rode a bateria de navegador inteira, uma prova de cada vez (em paralelo o navegador perde cliques): `NODE_PATH=$(npm root -g) tools/ui/bateria.sh /tmp/saida` (estados, uifuzz e os planos do e2e; detalhes em `tools/README.md`).

## Histórico e documentos

- Loop 1 (design e experiência): L1.1 a L1.5, um ou mais commits por iteração, com o prefixo `L1.x`. O relatório da L1.5, com os pontos que o Loop 2 deve auditar, está em https://claude.ai/artifact/TptWTsE8oRx2gaVUajghc7; o da L1.4, em https://claude.ai/artifact/6Ne5nXHoCCMCrNpxdEZScN.
- A especificação original é o `Perimetro_Simulacao.docx`, na pasta de uploads do projeto. A pontuação do jogo difere dela em pesos e na conta de Vidas (ponto em aberto no relatório da L1.5).
