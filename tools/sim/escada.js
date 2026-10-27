// Escada de habilidade (L2.3): quanto cada degrau de erro custa. O especialista de paz joga a mesma partida (mesmas sementes) com ruído:
//   decisões : em cada rodada, com probabilidade ε, as ordens saem do sorteio do novato em vez do plano do especialista (e a equipe, com a mesma
//              probabilidade, é a do novato)
//   postura  : só a negociação erra: com probabilidade ε a postura é sorteada entre as cinco (pular etapa e voltar atrás incluídos)
//   equipe   : o jogo é do especialista, mas a equipe e o equipamento viram os do novato com probabilidade ε
// Se a habilidade é premiada de forma contínua, a nota cai a cada degrau de ε. Um degrau que não cai (ou sobe) é um ponto cego do jogo.
// uso: node tools/sim/escada.js [N]
const { B, summary, pct, f1, batch, paired, signed } = require('./lib');
const E = require('./experts'), T = require('./tiers');
const { mulberry32 } = require('./engine-loader');
const N = +process.argv[2] || 300;
const A = B.load(1);
const EPS = [0, .1, .2, .35, .5, .75, 1];
const mk = B.mk;
function ruido(modo, eps, gseed) {
  const ex = E.expert('paz'), nv = T.novato(gseed), rng = mulberry32((gseed ^ 0x2545f491) >>> 0);
  return {
    name: `${modo}${eps}`, style: 'paz', rng,
    setup(Ax) { if (modo !== 'postura' && rng() < eps) nv.setup(Ax); else ex.setup(Ax); },
    decide(Ax, rn) {
      if (modo === 'decisoes' && rng() < eps) return nv.decide(Ax, rn);
      const out = ex.decide(Ax, rn);
      if (modo === 'postura') {
        const q = Ax.G.queue.find(d => d.kind === 'nego');
        if (q && rng() < eps) { Ax.removeDecision(q.id); Ax.addDecision(mk.nego(1 + Math.floor(rng() * 5))); }
      }
      return out;
    }
  };
}
const NOMES = { decisoes: 'decisões (ordens e equipe viram sorteio)', postura: 'só a postura da negociação', equipe: 'só a equipe e o equipamento' };
console.log(`escada de habilidade, N=${N} por célula (nota média; entre parênteses, B ou melhor)\n`);
for (const modo of ['decisoes', 'postura', 'equipe']) {
  console.log('== ' + NOMES[modo]);
  console.log('ε'.padEnd(6), ['protocolar', 'complexo', 'caotico'].map(d => d.padEnd(18)).join(''));
  const cells = {};
  for (const diff of ['protocolar', 'complexo', 'caotico']) cells[diff] = EPS.map(e => summary(batch(A, diff, s => ruido(modo, e, s), N)));
  EPS.forEach((e, i) => console.log(String(e).padEnd(6), ['protocolar', 'complexo', 'caotico'].map(d => `${f1(cells[d][i].score)} (${pct(cells[d][i].Bp, 1, 3)})`.padEnd(18)).join('')));
  console.log('');
}
