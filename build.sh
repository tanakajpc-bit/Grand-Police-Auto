#!/bin/bash
# Gera, a partir de src/, os dois arquivos do jogo:
#   perimetro.html             o conteúdo da página, sem doctype nem <head>: é o que se publica como artefato (a publicação o embrulha)
#   perimetro-standalone.html  o mesmo conteúdo dentro do mesmo esqueleto que a publicação usa (doctype, charset, viewport): abre direto do
#                              disco e é o arquivo que os testes de navegador carregam, para verem a página como o jogador a vê
cd "$(dirname "$0")"
OUT="${OUT:-perimetro.html}"   # OUT=/outra/pasta/x.html gera uma cópia (e x-standalone.html) sem mexer nos arquivos do repositório
{
  cat src/head.html
  echo "<style>"; cat src/style.css; echo "</style>"
  echo '<div id="edge" class="edge" aria-hidden="true"></div><div id="toasts" role="status" aria-live="polite"></div><div id="app"></div>'
  echo "<script>"; cat src/data.js src/story.js src/engine.js src/dash.js src/ui1.js src/ui2.js src/ui3.js; echo "</script>"
} > "$OUT"
STANDALONE="${OUT%.html}-standalone.html"
{
  printf '%s\n' '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>'
  cat "$OUT"
  echo '</body></html>'
} > "$STANDALONE"
wc -c "$OUT" "$STANDALONE"
