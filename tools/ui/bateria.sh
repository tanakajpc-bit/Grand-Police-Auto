#!/bin/bash
# Roda toda a bancada de navegador em sequência, uma de cada vez: em paralelo o navegador perde cliques por falta de CPU.
# uso: NODE_PATH=$(npm root -g) tools/ui/bateria.sh [pasta-de-saída]     (PERI_HTML=/outro-standalone.html testa uma cópia)
cd "$(dirname "$0")/../.."
OUT="${1:-/tmp/peri-bateria}"; mkdir -p "$OUT"
roda() { local nome="$1"; shift; echo "### $nome"; if "$@" > "$OUT/$nome.txt" 2>&1; then echo "ok"; else echo "FALHOU (veja $OUT/$nome.txt)"; fi; tail -3 "$OUT/$nome.txt"; }
for g in grafo reinicio cliques timers menu armazenamento corrompido retomada; do roda "estados-$g" node tools/ui/estados.js "$g"; done
roda uifuzz node tools/ui/uifuzz.js 200
roda ui-limites node tools/ui/limites.js
for p in negociadora agressiva equilibrada semEquipe lento gastaTudo; do roda "e2e-$p-complexo" node tools/ui/e2e.js "$p" complexo noshots; done
roda e2e-gastaTudo-caotico node tools/ui/e2e.js gastaTudo caotico noshots
roda e2e-negociadora-protocolar node tools/ui/e2e.js negociadora protocolar noshots
echo "fim"
