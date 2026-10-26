#!/bin/bash
# Gera perimetro.html (artefato único) a partir de src/
cd "$(dirname "$0")"
{
  cat src/head.html
  echo "<style>"; cat src/style.css; echo "</style>"
  echo '<div id="edge" class="edge" aria-hidden="true"></div><div id="toasts" role="status" aria-live="polite"></div><div id="app"></div>'
  echo "<script>"; cat src/data.js src/story.js src/engine.js src/dash.js src/ui1.js src/ui2.js src/ui3.js; echo "</script>"
} > perimetro.html
wc -c perimetro.html
