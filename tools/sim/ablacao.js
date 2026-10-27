// Ablação (L2.3): o especialista de paz joga a mesma partida (mesmas sementes) com uma peça a menos. A diferença pareada mostra o que cada
// peça vale e o que acontece com quem ignora a negociação, os stakeholders, a inteligência ou a tática.
//   comportamentos: tira da jogada do especialista todas as ordens de um tipo (a vaga fica vazia)
//   itens e agentes: a equipe é montada sem eles (a verba não gasta fica de reserva)
// uso: node tools/sim/ablacao.js [N]
const { B, summary, pct, f1, batch, paired, signed } = require('./lib');
const E = require('./experts');
const N = +process.argv[2] || 500;
const A = B.load(1);
const BASE = E.TEAMS.paz;
const sem = (pol, drop) => Object.assign({}, pol, { decide(Ax, rn) { const out = pol.decide(Ax, rn); Ax.G.queue.filter(drop).forEach(q => Ax.removeDecision(q.id)); return out; } });
const COMM_STK = { imprensa: ['coletiva', 'geral'], prefeito: ['prefeito', 'geral'], banco: ['gerente', 'geral'], familias: ['acolhe', 'geral'] };
const cenarios = [
  ['base (especialista de paz)', () => E.expert('paz')],
  ['— sem negociar', () => sem(E.expert('paz'), q => q.kind === 'nego')],
  ['— sem falar com ninguém (stakeholders)', () => sem(E.expert('paz'), q => q.kind === 'com')],
  ['— sem negociar e sem comunicar', () => sem(E.expert('paz'), q => q.kind === 'nego' || q.kind === 'com')],
  ['— sem investigar', () => sem(E.expert('paz'), q => q.kind === 'intel')],
  ['— sem horas extras nem apoio', () => sem(E.expert('paz'), q => q.kind === 'horas' || q.kind === 'apoio')],
  ...['imprensa', 'prefeito', 'banco', 'familias'].map(k => [`— ignora só ${k}`, () => sem(E.expert('paz'), q => q.kind === 'com' && COMM_STK[k].includes(q.p.cid))]),
  ['— sem negofone', () => E.expert('paz', { team: { rec: BASE.rec, gear: ['kit'] }, tag: '_a' })],
  ['— sem kit médico', () => E.expert('paz', { team: { rec: BASE.rec, gear: ['negofone'] }, tag: '_b' })],
  ['— sem nenhum equipamento', () => E.expert('paz', { team: { rec: BASE.rec, gear: [] }, tag: '_c' })],
  ...BASE.rec.map(id => [`— sem ${id}`, () => E.expert('paz', { team: { rec: BASE.rec.filter(x => x !== id), gear: BASE.gear }, tag: '_' + id })])
];
console.log(`ablação do especialista de paz, N=${N} por célula (diferença de nota pareada, ±IC95)\n`);
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  console.log('== ' + diff);
  const base = batch(A, diff, cenarios[0][1], N); const sb = summary(base);
  console.log('cenário'.padEnd(42), 'nota   Δ pareada     B+   rend  fuga  mortos  prefeito perdido  ordem política');
  for (const [nome, mk] of cenarios) {
    const rows = nome.startsWith('base') ? base : batch(A, diff, mk, N), s = summary(rows), d = paired(rows, base);
    const ordem = rows.filter(r => r.key.includes('intervencao') && r.round >= 6 && r.stk && r.stk.prefeito <= 15).length;
    const pl = rows.filter(r => r.stk && r.stk.prefeito <= 15).length;
    console.log(nome.padEnd(42), f1(s.score).padStart(5), nome.startsWith('base') ? '      —       ' : (signed(d.d) + ' ±' + d.ci.toFixed(1)).padStart(13), pct(s.Bp, 1, 5), pct(s.rend, 1, 5), pct(s.fuga, 1, 5), s.dead.toFixed(2).padStart(6), pct(pl, rows.length, 8), pct(ordem, rows.length, 12));
  }
  console.log('');
}
