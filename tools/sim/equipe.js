// Valor do tamanho da equipe: o especialista joga com 2 a 8 agentes (sempre os mesmos, na mesma ordem de contratação; a verba da v21 paga até 8).
// A nota já desconta a eficiência de custo, então mostra se o agente a mais se paga.
// uso: node tools/sim/equipe.js [N] [paz|agr]
const B = require('./bots'); const E = require('./experts');
const N = +process.argv[2] || 800, estilo = process.argv[3] || 'paz';
const A = B.load(1);
const ORDEM = estilo === 'agr' ? ['diego', 'andre', 'renata', 'marcos', 'lucas', 'roberto', 'camila', 'fernanda'] : ['paulo', 'renata', 'marina', 'marcos', 'lucas', 'carla', 'fernanda', 'camila'];
const EQUIP = estilo === 'agr' ? ['escudo', 'sniper'] : ['negofone', 'kit'];
console.log(`especialista ${estilo}, equipamento ${EQUIP.join(' + ')}, N=${N}`);
for (const diff of ['protocolar', 'complexo', 'caotico']) {
  for (let n = 2; n <= 8; n++) {
    const team = { rec: ORDEM.slice(0, n), gear: EQUIP };
    const rows = []; for (let i = 0; i < N; i++) rows.push(B.playGame(A, diff, E.expert(estilo, { team, tag: '_' + n }), 30000 + i));
    const m = k => rows.reduce((s, r) => s + r[k], 0) / N;
    console.log(diff.slice(0, 5).padEnd(6), n + ' agentes', 'nota', m('score').toFixed(1), '| morto>=1', Math.round(100 * rows.filter(r => r.dead > 0).length / N) + '%', '| rendição', Math.round(100 * rows.filter(r => r.type === 'rendicao').length / N) + '%', '| sobra', m('credits').toFixed(0), '| eficiência', m('efic').toFixed(2));
  }
  console.log('');
}
