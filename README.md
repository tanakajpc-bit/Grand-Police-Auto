# PERÍMETRO

Simulação de gestão de crise (reféns em uma agência bancária) em um único arquivo HTML, em português do Brasil. O jogador recruta a equipe, fecha o perímetro, conduz até 8 rodadas de cerco (negociação, comunicação com os stakeholders, investigação, tática) e recebe nota, jornal, selos e debrief. A perspectiva é a de quem protege: a violência não rende nota.

Artefato publicado: https://claude.ai/artifact/7yQmLNrrYJrJQpEDKrXH5P (versão 19: interface enxuta, atributos dos agentes ao passar o mouse e as auditorias L2.1, L2.3 e L2.5 refeitas, com o código da turma e a trilha sonora que o documento pedia). O que se publica é `perimetro.html`, só o conteúdo da página (a publicação o embrulha com doctype, charset e viewport). Para abrir o jogo direto do disco use `perimetro-standalone.html`: o mesmo conteúdo dentro desse esqueleto, que é também o arquivo que os testes de navegador carregam.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/data.js` | Constantes e tabelas: `DIFF` (as três dificuldades), `AGENTS`, `EQUIP`, `INTEL`, `COMMS`, `BADGES`, eventos |
| `src/story.js` | Textos narrativos (briefing, manchetes, rádio, jornal) |
| `src/engine.js` | Estado único `G`, regras, negociação, intervenção, pontuação (`computeScore`, `gradeOf`) e salvamento (`perimetro_save_v2`) |
| `src/dash.js` | Projeções e alertas do painel |
| `src/ui1.js` | Peças comuns (inclusive as dicas flutuantes), mapa, menu, briefing, recrutamento e perímetro |
| `src/ui2.js` | Cerco: HUD, painel do comandante (quatro abas), resultado da rodada e eventos |
| `src/ui3.js` | Desfecho, pós-jogo (nota, gazeta, conquistas, replay, debrief) e o `render()` principal |
| `src/style.css`, `src/head.html` | Estilo e cabeçalho |
| `build.sh` | Junta tudo em `perimetro.html` e `perimetro-standalone.html`, que ficam versionados: rode antes de cada commit |
| `tools/` | Simulação sem navegador e testes de navegador; veja `tools/README.md` |

O motor e o `dash.js` não dependem da interface: tudo o que decide, prevê ou alerta roda sem navegador (`tools/sim/`), e a interface só desenha.

## Interface enxuta: o que fica à vista e o que fica na dica

A tela mostra o que decide; o porquê de cada número fica numa dica flutuante (passar o mouse ou focar com o teclado). Três marcações, todas tratadas por `showTip` em `ui1.js`:

- `data-ag="<id do agente>"`: o cartão do agente, com traço e os cinco atributos (tática, negociação, inteligência, resistência e comunicação). Vale para todo lugar onde aparece o nome de um agente: recrutamento, mapa, perímetro, equipe do cerco, relatos de campo, mesa de comando e replay.
- `data-tip="texto"`: uma dica de texto simples.
- `class="hastip"` com um filho `<span class="tipc">…</span>`: uma dica com HTML. `infoTip(rótulo, html)` gera o “ⓘ” das regras longas.

O texto da dica continua no HTML da página (o `.tipc` só fica oculto), assim como o que está dentro de `<details>`: as bancadas `verdade.js` e `limites.js`, que leem o HTML, continuam conferindo esses textos.

## Código da turma e trilha sonora (L2.5 refeita)

- Código da turma: campo opcional no menu. Com o mesmo código, todas as equipes jogam o mesmo cenário (perfil do líder, rotas candidatas, rota planejada, cúmplice) e recebem a mesma carta de evento em cada rodada, sempre que a carta cabe no estado da equipe; com o mesmo código e as mesmas decisões, a partida se repete inteira, também depois de recarregar. Só letras e dígitos contam (`hbs turma a` = `HBS-Turma-A`). O gerador (`mulberry`, com o estado em `G.rng`) vai no save; a carta da rodada sai de um sorteio próprio de código + rodada em `drawEvent`. Sem código, o motor usa `Math.random` exatamente como antes (o `comparar.js` contra a versão 18 dá zero divergência). Provas: `tools/sim/semente.js` e `tools/ui/turma.js`.
- Trilha sonora: o módulo `SOM` em `ui1.js`, só Web Audio, sem arquivos. Começa desligada; o botão ao lado de Menu liga e desliga, e a escolha fica guardada no navegador (depois de recarregar, volta no primeiro clique). A intensidade segue a agitação que o painel mostra, nunca a real, e cala no desfecho e na nota.

## Fluxo de trabalho

1. Edite `src/` e rode `./build.sh`.
2. Se a mudança não deveria alterar o jogo (texto, interface), prove com `node tools/sim/comparar.js <commit-anterior> 200`: o esperado é zero divergência. Se mexeu numa descrição que promete um efeito (traço de agente, equipamento, comunicação, investigação, perfil, carta), rode `node tools/sim/promessas.js`; se mexeu nos textos do fim da partida (Gazeta, desfecho, pontuação, selos, replay, debrief), rode `node tools/sim/verdade.js 120`. Os dois saem com erro quando o texto diz o que o motor não faz.
3. Se mexeu em regra ou equilíbrio, rode `node tools/sim/matriz.js 300` e compare com as notas de referência de `tools/README.md`.
4. Antes de publicar, rode a bateria de navegador inteira, uma prova de cada vez (em paralelo o navegador perde cliques): `NODE_PATH=$(npm root -g) tools/ui/bateria.sh /tmp/saida` (estados, uifuzz e os planos do e2e; detalhes em `tools/README.md`).

## Histórico e documentos

- Loop 1 (design e experiência): L1.1 a L1.5, um ou mais commits por iteração, com o prefixo `L1.x`. O relatório da L1.5, com os pontos que o Loop 2 deve auditar, está em https://claude.ai/artifact/TptWTsE8oRx2gaVUajghc7; o da L1.4, em https://claude.ai/artifact/6Ne5nXHoCCMCrNpxdEZScN.
- Loop 2 (auditoria): L2.1 motor de resolução, L2.2 fluxo de estados, L2.3 balanceamento, L2.4 casos extremos e L2.5 auditoria final cruzada (documento × jogo, três partidas anotadas, o jogo conta a verdade, as promessas do texto), um ou mais commits por iteração, com o prefixo `L2.x`. O relatório completo, com o veredito da L2.5 (aprovado) e os problemas conhecidos, está em https://claude.ai/artifact/EypcMvWcUWiNbRDrs9baiq.
- Em 30/10/2026 a L2.1, a L2.3 e a L2.5 foram refeitas, uma por vez (versões 17, 18 e 19), depois da interface enxuta da versão 16. O relatório final, com o que cada uma achou, a tabela documento × jogo atualizada, os testes e o guia do facilitador (roteiro de sala e códigos da turma sugeridos), está em https://claude.ai/artifact/NYYdUCRN7FR6iaH6hyE8TQ e substitui o do Loop 2 onde os dois divergem.
- A especificação original é o `Perimetro_Simulacao.docx`, na pasta de uploads do projeto. A pontuação do jogo usa os pesos do projeto (40/20/15/10/15) em vez dos do documento (35/25/15/10/15); a nota de Vidas e a penalidade de 10 pontos por agente ferido seguem a Tabela 10, proporcionais a 17 reféns. A tabela seção por seção do documento contra o jogo está no relatório do Loop 2.
