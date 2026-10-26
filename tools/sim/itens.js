// Valor de cada equipamento. O robô joga a mesma equipe e a mesma política, mas com UM item (ou nenhum) no lugar do que compraria.
//   pago   : o item sai da verba. Inclui o custo de oportunidade, porque o robô gasta a sobra em inteligência.
//   gratis : o item entra sem custo. É o efeito puro.
// A nota mostrada é a diferença para "nenhum" nas mesmas sementes (±: intervalo de 95%).
// Os robôs só usam o efeito automático dos itens; o que depende de olhar a informação (drone, térmica) vale mais para uma pessoa.
// uso: node tools/sim/itens.js [N] [equilibrada|negociadora|agressiva] [gratis]
const B = require('./bots');
const A = B.load(1);
const N = +process.argv[2] || 1000;
const polName = process.argv[3] || 'equilibrada';
const gratis = process.argv.includes('gratis');
const mkPol = { equilibrada: B.policyEquilibrado, negociadora: () => B.policyNegociador(), agressiva: () => B.policyAgressivo(3, .5) }[polName];
if (!mkPol) { console.error('política desconhecida: ' + polName); process.exit(1); }
const ITENS = ['nenhum', ...A.EQUIP.map(e => e.id)];
function trocaItem(pol, item) {
  const setup = pol.setup;
  pol.setup = function (A2) {
    setup.call(this, A2);
    const G = A2.G;
    G.gear.slice().forEach(id => { const e = A2.EQUIP.find(x => x.id === id); G.credits += e.custo; G.spent.equip -= e.custo; });
    G.gear = []; G.gz = {};
    if (item !== 'nenhum') { if (gratis) { G.gear.push(item); G.gz[item] = 'reserva'; } else B.buy(A2, item); }
    B.placeSmart(A2, G.K.route ? { route: G.K.route } : {});
  };
  return pol;
}
console.log(`${polName}, equipamento ${gratis ? 'grátis (efeito puro)' : 'pago (com custo de oportunidade)'}, N=${N}`);
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  console.log('\n== ' + diff);
  let base = null;
  for (const it of ITENS) {
    const rows = [];
    for (let i = 0; i < N; i++) rows.push(B.playGame(A, diff, trocaItem(mkPol(), it), 5000 + i));
    const m = k => rows.reduce((s, r) => s + r[k], 0) / N;
    const sd = Math.sqrt(rows.reduce((s, r) => s + (r.score - m('score')) ** 2, 0) / N);
    if (base == null) base = m('score');
    const d = m('score') - base;
    console.log(it.padEnd(9), 'nota', m('score').toFixed(1), `(${d >= 0 ? '+' : ''}${d.toFixed(1)} ±${(1.96 * sd / Math.sqrt(N)).toFixed(1)})`, '| morto>=1', Math.round(100 * rows.filter(r => r.dead > 0).length / N) + '%', '| feridos', m('hurt').toFixed(2), '| rendição', Math.round(100 * rows.filter(r => r.type === 'rendicao').length / N) + '%', '| sobra', m('credits').toFixed(0));
  }
}
