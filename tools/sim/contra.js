// Contra-estratégias por perfil (L2.3): o especialista de paz muda UMA alavanca e a nota é comparada, nas mesmas sementes, com a do
// especialista-base contra o mesmo perfil de líder. Se o sinal ou o tamanho da diferença muda de perfil para perfil, o perfil pede uma
// contra-estratégia própria; se uma alavanca vale o mesmo contra todos, os perfis só mudam a dificuldade, não a decisão.
//   porta     : sem agente na Entrada (a Entrada segura o cofre e irrita o líder: +1,5 de agitação por agente)
//   perfil    : compra o perfil psicológico na fase do perímetro, no lugar do rastreamento de rota
//   sem rota  : não compra nada de inteligência na fase do perímetro
//   enxuta    : equipe de 2 (Paulo e Fernanda) com negofone, nenhum agente em campo além deles
// uso: node tools/sim/contra.js [N]
const { B, summary, f1, signed, ci, mean } = require('./lib');
const E = require('./experts');
const N = +process.argv[2] || 300;
const A = B.load(1);
const PROFS = Object.keys(A.PROFILES);
function seedsPorPerfil(diff, n) {
  const out = Object.fromEntries(PROFS.map(p => [p, []])); let s = 30000;
  while (PROFS.some(p => out[p].length < n) && s < 200000) { A.reseed(s); A.newGame(diff); const p = A.G.profile; if (out[p].length < n) out[p].push(s); s++; }
  return out;
}
const levers = [
  ['sem agente na Entrada', () => E.expert('paz', { door: false, tag: '_d' })],
  ['perfil em vez da rota (cedo)', () => E.expert('paz', { p1: false, p1b: true, tag: '_p' })],
  ['sem inteligência cedo', () => E.expert('paz', { p1: false, tag: '_r' })],
  ['equipe enxuta (2 agentes)', () => B.policyComunicador(['paulo', 'fernanda'], ['negofone'])]
];
console.log(`Δ de nota contra o especialista-base, por perfil do líder (mesmas sementes), N=${N} por célula; ±IC95 entre parênteses\n`);
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  const seeds = seedsPorPerfil(diff, N);
  const base = Object.fromEntries(PROFS.map(p => [p, seeds[p].map(s => B.playGame(A, diff, E.expert('paz'), s))]));
  console.log('== ' + diff + '   (nota base: ' + PROFS.map(p => `${A.PROFILES[p].nome} ${f1(summary(base[p]).score)}`).join(' · ') + ')');
  console.log('alavanca'.padEnd(28), PROFS.map(p => A.PROFILES[p].nome.padStart(16)).join(''));
  for (const [nm, mk] of levers) {
    const cells = PROFS.map(p => {
      const rows = seeds[p].map(s => B.playGame(A, diff, mk(s), s)), d = rows.map((r, i) => r.score - base[p][i].score);
      return `${signed(mean(d))} (±${ci(d).toFixed(1)})`.padStart(16);
    });
    console.log(nm.padEnd(28), cells.join(''));
  }
  console.log('');
}
