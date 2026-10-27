// Valor de cada agente (L2.3): a equipe-base (Paulo, Renata, negofone, kit) joga com o especialista de paz; em cada linha entra mais UM agente.
// A diferença pareada (mesmas sementes) já desconta o custo do agente, que sai da reserva (eficiência de custo) e do plantão.
//   dominância estática: um agente é dominado quando outro mais barato (ou igual) tem todos os atributos iguais ou melhores.
// uso: node tools/sim/agentes.js [N] [paz|agr|eq]
const { B, summary, f1, batch, paired, signed } = require('./lib');
const E = require('./experts');
const N = +process.argv[2] || 500, estilo = process.argv[3] || 'paz';
const A = B.load(1);
const baseTeam = estilo === 'agr' ? ['diego', 'andre'] : ['paulo', 'renata'];
const gear = estilo === 'agr' ? ['escudo', 'sniper'] : estilo === 'eq' ? ['negofone', 'drone'] : ['negofone', 'kit'];
const cands = A.AGENTS.map(a => a.id).filter(id => !baseTeam.includes(id));
console.log(`equipe-base ${baseTeam.join(' + ')} (+ ${gear.join(', ')}), política ${estilo}, N=${N}\n`);
console.log('— dominância estática (atributos tat neg int res com, custo) —');
const dom = [];
for (const a of A.AGENTS) for (const b of A.AGENTS) {
  if (a.id === b.id || a.custo > b.custo) continue;
  const ks = Object.keys(a.s);
  if (ks.every(k => a.s[k] >= b.s[k]) && ks.some(k => a.s[k] > b.s[k])) dom.push(`${a.nome} (${a.custo}) domina ${b.nome} (${b.custo})`);
}
console.log(dom.length ? dom.join('\n') : 'nenhum agente é dominado em atributos por outro mais barato');
console.log('\n— custo por ponto de atributo —');
console.log(A.AGENTS.map(a => `${a.id} ${a.custo} → ${(a.custo / Object.values(a.s).reduce((s, x) => s + x, 0)).toFixed(1)}/pt`).join(' · '));
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  console.log('\n== ' + diff);
  const mk = team => () => E.expert(estilo, { team: { rec: team, gear }, tag: '_' + team.join('') });
  const base = batch(A, diff, mk(baseTeam), N); const sb = summary(base);
  console.log('equipe-base'.padEnd(30), f1(sb.score).padStart(5));
  const out = [];
  for (const id of cands) {
    const ag = A.agentById(id), rows = batch(A, diff, mk(baseTeam.concat(id)), N), s = summary(rows), d = paired(rows, base);
    out.push({ id, ag, s, d });
  }
  out.sort((x, y) => y.d.d - x.d.d);
  for (const { id, ag, s, d } of out) console.log(`+ ${ag.nome} (${ag.custo}, ${ag.trait})`.padEnd(46), f1(s.score).padStart(5), (signed(d.d) + ' ±' + d.ci.toFixed(1)).padStart(12), '| rend', Math.round(100 * s.rend) + '%', '| mortos', s.dead.toFixed(2), '| sobra', s.credits.toFixed(0));
}
