// Auditoria do motor de resolução (L2.1): cada fórmula é conferida contra a especificação nos limites e em cenários extremos,
// sempre com o motor real (o mesmo código do jogo), não com uma cópia.
//   node tools/sim/audit.js            → tudo
//   node tools/sim/audit.js formulas   → só as tabelas de limites
//   node tools/sim/audit.js cenarios   → só os cinco cenários extremos
// Sai com código 1 se alguma verificação falhar.
const B = require('./bots'); const E = require('./experts'); const { mulberry32 } = require('./engine-loader');
const { hire, buy, mk } = B;
const A = B.load(1);
const only = process.argv[2];
let fails = 0, checks = 0;
const ok = (cond, msg, extra) => { checks++; if (!cond) { fails++; console.log('  ✗ FALHA: ' + msg + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); } return !!cond; };
const sec = t => console.log('\n## ' + t);
const f1 = x => (Math.round(x * 10) / 10).toFixed(1), f3 = x => x.toFixed(3);
const DIFFS = ['protocolar', 'complexo', 'caotico'], PROFS = Object.keys(A.PROFILES);
const ALL_IDS = A.AGENTS.map(a => a.id), ZIDS = A.ZONES.map(z => z.id);

/* ---------- utilitários de montagem ---------- */
function fresh(diff = 'complexo', seed = 1, team = [], gear = []) {
  A.reseed(seed); A.newGame(diff); const G = A.G;
  team.forEach(id => { G.team.push(id); G.az[id] = 'reserva'; G.fat[id] = 0; G.transit[id] = 0; G.away[id] = 0; });
  gear.forEach(id => { G.gear.push(id); G.gz[id] = 'reserva'; });
  G.pressure = A.calcPressure();
  return G;
}
function startSiege() { A.confirmPerimeter(); A.G.phase = 'siege'; A.startRound(); }
const rngSeed = s => mulberry32(s);

/* ---------- implementação independente da especificação (projeto) ---------- */
const spec = {
  // fator de pressão: U invertido, zero em 0 e 100, pico 1 em 50
  P: p => -Math.pow(p / 50 - 1, 2) + 1,
  // fator de fadiga: max(0,3; 1 − 0,1 × rodadas sem descanso)
  F: r => Math.max(.3, 1 - .1 * r),
  cov: (zone) => {
    const G = A.G, ags = A.agentsIn(zone), n = G.gear.filter(e => G.gz[e] === zone).length;
    const fe = n >= 2 ? 1.6 : n === 1 ? 1.3 : 1.0;
    let c = ags.reduce((s, id) => s + A.agentEff(id) * fe, 0) * 10;
    const inZ = G.gear.filter(e => G.gz[e] === zone);
    if (inZ.includes('drone')) c += 15;
    if (inZ.includes('sniper') && ags.length) c += 20;
    const sp = G.support[zone]; if (sp && sp.left > 0) c += sp.v;
    if (G.exposed > 0) c *= .9;
    return Math.max(0, Math.min(100, Math.round(c)));
  },
  grade: s => s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 65 ? 'B' : s >= 50 ? 'C' : s >= 35 ? 'D' : 'F'
};

/* =====================================================================
   1) COBERTURA DE ZONA
   ===================================================================== */
function auditCobertura() {
  sec('1. Cobertura de zona  (cobertura = min(100, Σ(eficiência × fator_equip) × 10))');
  const rng = rngSeed(11);
  let n = 0, maxSeen = 0, minSeen = 100, mism = 0, emptyBad = 0, monoBad = 0;
  for (let i = 0; i < 6000; i++) {
    const diff = DIFFS[i % 3];
    const team = ALL_IDS.filter(() => rng() < .55);
    const gear = A.EQUIP.map(e => e.id).filter(() => rng() < .5);
    const G = fresh(diff, 100 + i, team, gear);
    team.forEach(id => { G.az[id] = rng() < .15 ? 'reserva' : ZIDS[Math.floor(rng() * 7)]; G.fat[id] = Math.floor(rng() * 8); G.transit[id] = Math.floor(rng() * 3); if (rng() < .1) G.away[id] = 2; });
    gear.forEach(e => { G.gz[e] = rng() < .2 ? 'reserva' : ZIDS[Math.floor(rng() * 7)]; });
    G.media = rng() * 100; G.agit = rng() * 100; G.stress = rng() * 20; G.calm = rng() < .3 ? 10 : 0; G.round = Math.floor(rng() * 9);
    G.exposed = rng() < .2 ? 2 : 0; G.fatCrit = rng() < .2;
    if (rng() < .25) G.support[ZIDS[Math.floor(rng() * 7)]] = { v: 25, left: 2 };
    G.pressure = A.calcPressure();
    for (const z of ZIDS) {
      const c = A.zoneCoverage(z); n++; maxSeen = Math.max(maxSeen, c); minSeen = Math.min(minSeen, c);
      if (!Number.isInteger(c) || c < 0 || c > 100) ok(false, 'cobertura fora de 0–100', { z, c });
      if (c !== spec.cov(z)) mism++;
      const noAg = A.agentsIn(z).length === 0, inZ = G.gear.filter(e => G.gz[e] === z), sp = G.support[z] && G.support[z].left > 0;
      if (noAg && !inZ.includes('drone') && !sp && c !== 0) emptyBad++;
      // monotonia: tirar um agente da zona nunca aumenta a cobertura
      const ags = A.agentsIn(z);
      if (ags.length) { const id = ags[0], z0 = G.az[id]; G.az[id] = 'reserva'; const c2 = A.zoneCoverage(z); G.az[id] = z0; if (c2 > c) monoBad++; }
    }
  }
  ok(mism === 0, `cobertura difere da fórmula independente em ${mism} de ${n} casos`);
  ok(emptyBad === 0, `zona vazia (sem agente, drone ou apoio) com cobertura > 0 em ${emptyBad} casos`);
  ok(monoBad === 0, `tirar um agente aumentou a cobertura em ${monoBad} casos`);
  console.log(`  ${n} zonas sorteadas (equipes de 0 a 12, 0 a 8 equipamentos, fadiga, trânsito, apoio, exposição): mín ${minSeen}, máx ${maxSeen}, 0 fora de [0,100], ${mism} divergências da fórmula, ${emptyBad} zonas vazias com cobertura.`);
  // casos pedidos: nenhum agente; cinco na mesma zona
  const G = fresh('complexo', 5, ['renata', 'diego', 'marcos', 'andre', 'lucas'], []);
  G.pressure = 50; G.media = 0; G.agit = 0; G.round = 0; G.stress = 0; G.calm = 0; G.pressure = A.calcPressure();
  const zEmpty = A.zoneCoverage('beco');
  ['renata', 'diego', 'marcos', 'andre', 'lucas'].forEach(id => G.az[id] = 'beco');
  const raw5 = ['renata', 'diego', 'marcos', 'andre', 'lucas'].reduce((s, id) => s + A.agentEff(id), 0) * 10;
  const c5 = A.zoneCoverage('beco');
  console.log(`  Nenhum agente na zona: cobertura ${zEmpty}.  Cinco agentes (Renata, Diego, Marcos, André, Lucas) na mesma zona: soma bruta ${f1(raw5)} → cobertura ${c5} (limitada a 100).`);
  ok(zEmpty === 0 && c5 === 100 && raw5 > 100, 'zona vazia deve dar 0 e cinco agentes devem saturar em 100');
  // fator de equipamento: 0, 1 e 2+ itens (agente fraco, para não saturar em 100)
  const G2 = fresh('complexo', 6, ['paulo'], ['escudo', 'negofone']); G2.az.paulo = 'beco'; G2.media = 0; G2.agit = 0; G2.round = 0; G2.pressure = A.calcPressure();
  const c0 = A.zoneCoverage('beco'); G2.gz.escudo = 'beco'; const c1 = A.zoneCoverage('beco'); G2.gz.negofone = 'beco'; const c2 = A.zoneCoverage('beco');
  console.log(`  Fator de equipamento (Paulo, tática 3, sozinho no Beco): 0 itens → ${c0}, 1 item → ${c1}, 2 itens → ${c2}  (esperado ×1,0 / ×1,3 / ×1,6).`);
  ok(Math.abs(c1 / c0 - 1.3) < .06 && Math.abs(c2 / c0 - 1.6) < .08, 'fator de equipamento 1,0 / 1,3 / 1,6', [c0, c1, c2]);
}

/* =====================================================================
   2) EFICIÊNCIA DO AGENTE: pressão (Yerkes-Dodson) e fadiga
   ===================================================================== */
function auditEficiencia() {
  sec('2. Eficiência do agente  (E = atributo × fator_pressão × fator_fadiga)');
  A.newGame('complexo');
  const row = [];
  for (let p = 0; p <= 100; p += 10) row.push(`${p}:${f3(A.pressureFactor(p))}`);
  console.log('  fator_pressão do motor por pressão do agente: ' + row.join('  '));
  console.log('  fator_pressão da especificação −(p/50−1)²+1:   ' + [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => `${p}:${f3(spec.P(p))}`).join('  '));
  ok(A.pressureFactor(50) === 1, 'pico do fator de pressão em p=50 deve valer 1,0', A.pressureFactor(50));
  let peakOK = true; for (let p = 0; p <= 100; p++) if (A.pressureFactor(p) > A.pressureFactor(50) + 1e-12) peakOK = false;
  ok(peakOK, 'nenhuma pressão supera o pico de p=50');
  let symOK = true; for (let d = 0; d <= 50; d++) if (Math.abs(A.pressureFactor(50 - d) - A.pressureFactor(50 + d)) > 1e-12) symOK = false;
  ok(symOK, 'a curva deve ser simétrica em torno de 50');
  ok(Math.abs(A.pressureFactor(0) - spec.P(0)) < 1e-12 && Math.abs(A.pressureFactor(100) - spec.P(100)) < 1e-12,
    `fator de pressão em p=0 e p=100 deve ser ${spec.P(0)} (especificação), o motor devolve ${A.pressureFactor(0)} e ${A.pressureFactor(100)}`);
  let diverge = 0; for (let p = 0; p <= 100; p += .5) if (Math.abs(A.pressureFactor(p) - spec.P(p)) > 1e-12) diverge++;
  console.log(`  pontos de 0 a 100 (passo 0,5) em que o motor difere da especificação: ${diverge} de 201.`);
  // fadiga
  let minF = 9, maxF = 0, badF = 0;
  for (const diff of DIFFS) for (let res = 1; res <= 10; res++) for (let r = 0; r <= 14; r++) {
    const G = fresh(diff, 1, ['camila']); G.az.camila = 'beco';
    // atributo de resistência de teste: usamos Camila (res 6) e variamos via ajuste de agente de teste
    const ag = A.agentById('camila'); const old = ag.s.res; ag.s.res = res; G.fat.camila = r;
    const f = A.ff('camila'); ag.s.res = old;
    minF = Math.min(minF, f); maxF = Math.max(maxF, f); if (!(f >= .3 && f <= 1)) badF++;
  }
  ok(badF === 0, `fator de fadiga fora de [0,3; 1] em ${badF} casos`);
  console.log(`  fator_fadiga em 3 níveis × resistência 1–10 × 0–14 rodadas sem descanso: mín ${f3(minF)}, máx ${f3(maxF)} (piso 0,3 respeitado; nunca negativo).`);
  const G = fresh('complexo', 1, ['camila']); const ag = A.agentById('camila'); const old = ag.s.res; ag.s.res = 5;
  let eq = true; for (let r = 0; r <= 10; r++) { G.fat.camila = r; if (Math.abs(A.ff('camila') - spec.F(r)) > 1e-9) eq = false; } ag.s.res = old;
  ok(eq, 'com resistência 5 no Complexo a fadiga deve coincidir com a especificação max(0,3; 1 − 0,1·r)');
  // eficiência: 0 ≤ E ≤ atributo
  let bad = 0; const rng = rngSeed(3);
  for (let i = 0; i < 3000; i++) {
    const id = ALL_IDS[Math.floor(rng() * 12)]; const G = fresh(DIFFS[i % 3], i, [id]); G.az[id] = 'beco';
    G.media = rng() * 100; G.agit = rng() * 100; G.stress = rng() * 30; G.round = Math.floor(rng() * 9); G.hostages.dead = Math.floor(rng() * 6); G.hostages.hurt = Math.floor(rng() * 8);
    G.fat[id] = Math.floor(rng() * 10); G.transit[id] = Math.floor(rng() * 3); G.fatCrit = rng() < .5; G.pressure = A.calcPressure();
    const e = A.agentEff(id); if (!(e >= 0 && e <= A.stat(id, 'tat') + 1e-9)) bad++;
  }
  ok(bad === 0, `eficiência fora de [0, atributo] em ${bad} casos`);
  // com que frequência o piso 0,35 está ativo nas partidas dos robôs?
  console.log('  Frequência com que a pressão de um agente em campo cai onde a especificação daria fator < 0,35 (o piso do motor atual atuaria):');
  const pols = [['novato', s => require('./tiers').novato(s)], ['mid', s => require('./tiers').competente(s)], ['exp_paz', () => E.expert('paz')], ['exp_agr', () => E.expert('agr')]];
  for (const diff of DIFFS) {
    const parts = [];
    for (const [nm, mkp] of pols) {
      let tot = 0, low = 0, high = 0;
      for (let i = 0; i < 120; i++) {
        const seed = 5000 + i, pol = mkp(seed);
        A.reseed(seed); A.newGame(diff); pol.setup(A); startSiege(); let g = 0; const G = A.G;
        while (!G.end && g++ < 12) {
          G.stage = 'panel'; pol.decide(A, G.round);
          G.team.forEach(id => { if (G.az[id] && G.az[id] !== 'reserva') { tot++; const r = spec.P(A.agentPressure(id)); if (r < .35) { low++; if (A.agentPressure(id) > 50) high++; } } });
          const r = A.resolveDecisions(); if (r && r.event) { const n = A.EVENT_FX[r.event].choices.length; let o = false; for (let k = 0; k < n && !o; k++) o = A.chooseEvent(k); }
          if (!G.end) A.startRound();
        }
      }
      parts.push(`${nm} ${(100 * low / Math.max(1, tot)).toFixed(1)}%`);
    }
    console.log(`    ${diff.padEnd(10)} ${parts.join(' · ')}  (fração de agente-rodadas em campo)`);
  }
}

/* =====================================================================
   3) NEGOCIAÇÃO
   ===================================================================== */
function auditNegociacao() {
  sec('3. Negociação  (p = clamp(.15·skill·lev + postura + rapport + …); degrau 1–5)');
  let n = 0, pMin = 9, pMax = -9, rawMin = 9, rawMax = -9, argMin = null, argMax = null, bad = 0;
  const all = ['paulo', 'marina', 'renata', 'carla', 'andre', 'marcos', 'sofia', 'roberto', 'camila', 'diego', 'lucas', 'fernanda'];
  for (const diff of DIFFS) for (const prof of PROFS) for (const neg of all) for (const gearN of [0, 1]) for (const agit of [0, 50, 75, 100]) for (const knowP of [false, true]) for (const cov of [0, 1]) for (const fat of [0, 8]) for (const media of [0, 100]) {
    const G = fresh(diff, 1, cov ? all : [neg], gearN ? ['negofone'] : []);
    G.profile = prof; G.agit = agit; G.media = media; G.K.profile = knowP; G.nego.negotiator = neg; G.team.forEach(id => { G.fat[id] = fat; });
    if (cov) { G.routes.forEach(z => { G.team.forEach((id, i) => { if (i < 4) G.az[id] = z; }); }); G.routes.forEach((z, i) => { G.az[G.team[i]] = z; }); }
    G.pressure = A.calcPressure();
    for (let step = 1; step <= 5; step++) { G.nego.step = step; for (let tech = 1; tech <= 5; tech++) {
      const np = A.negoParts(tech); n++;
      if (!Number.isFinite(np.p) || np.p < .02 - 1e-12 || np.p > .95 + 1e-12) bad++;
      if (np.raw < rawMin) rawMin = np.raw; if (np.raw > rawMax) rawMax = np.raw;
      if (np.p < pMin) { pMin = np.p; argMin = { diff, prof, neg, agit, step, tech, fat }; }
      if (np.p > pMax) { pMax = np.p; argMax = { diff, prof, neg, agit, step, tech, fat }; }
    } }
  }
  ok(bad === 0, `probabilidade de avanço fora de [0,02; 0,95] em ${bad} casos`);
  console.log(`  ${n} combinações (3 níveis × 4 perfis × 12 negociadores × negofone × 4 agitações × perfil conhecido × cobertura × fadiga × mídia × 5 degraus × 5 posturas):`);
  console.log(`    p mínimo ${f3(pMin)}, p máximo ${f3(pMax)}; soma bruta de −${f3(-rawMin)} a ${f3(rawMax)} antes do corte (nunca sai de [0,02; 0,95]).`);
  console.log(`    pior caso: ${JSON.stringify(argMin)}  ·  melhor caso: ${JSON.stringify(argMax)}`);
  // melhor caso absoluto pedido: habilidade 10 e todos os bônus no máximo
  const G = fresh('protocolar', 1, ['paulo'], ['negofone']); G.profile = 'volatil'; G.agit = 0; G.media = 0; G.K.profile = true; G.nego.negotiator = 'paulo'; G.nego.step = 3; G.pressure = 50;
  G.az.paulo = 'beco'; G.round = 0; G.stress = 0; G.pressure = A.calcPressure();
  const best = A.negoParts(3);
  console.log(`  Habilidade 10 (Paulo, neg 10) + negofone + rapport (degrau 3, postura compatível) + perfil Volátil conhecido, agitação 0: soma bruta ${f3(best.raw)} → p = ${f3(best.p)}.`);
  ok(best.p <= .95 + 1e-12, 'melhor caso deve ficar em 0,95 no máximo');
  const G3 = fresh('caotico', 1, ['andre']); G3.profile = 'calculista'; G3.agit = 100; G3.media = 100; G3.nego.negotiator = 'andre'; G3.nego.step = 1; G3.team.forEach(id => G3.fat[id] = 10); G3.pressure = 100;
  const worst = A.negoParts(5);
  console.log(`  Habilidade 2 (André) no Caótico, agitação 100, fadiga máxima, pulando do degrau 1 ao 5 (postura 5, perfil Calculista): soma bruta ${f3(worst.raw)} → p = ${f3(worst.p)} (piso 0,02).`);
  ok(worst.p >= .02 - 1e-12, 'pior caso nunca fica abaixo de 0,02');
  // degrau 1–5 e regressão: 60 000 resoluções com estado aleatório
  const rng = rngSeed(21); let stepBad = 0, regress = 0, below1 = 0, above5 = 0, at1regress = 0; const R = () => ({ lines: [], stkWhy: {}, hchg: [], sec: 'dec' });
  for (let i = 0; i < 60000; i++) {
    const G = fresh(DIFFS[i % 3], 1, ['paulo', 'andre', 'marina']); G.profile = PROFS[i % 4]; G.agit = rng() * 100; G.nego.step = 1 + Math.floor(rng() * 5);
    G.nego.negotiator = ['paulo', 'andre', 'marina'][i % 3]; G.az.paulo = 'beco'; G.pressure = A.calcPressure();
    const s0 = G.nego.step; const tech = rng() < .2 ? 'press' : 1 + Math.floor(rng() * 5);
    A.reseed(i * 7 + 1);
    A.resolveNego({ p: { tech } }, R());
    const s1 = G.nego.step; if (s1 < 1) below1++; if (s1 > 5) above5++; if (s1 < s0) { regress++; if (s0 === 1) at1regress++; } if (!Number.isInteger(s1) || s1 < 1 || s1 > 5 || s1 > s0 + 1) stepBad++;
  }
  ok(stepBad === 0 && below1 === 0 && above5 === 0 && at1regress === 0, `degrau saiu de 1–5 ou saltou mais de um passo (${stepBad} casos)`);
  console.log(`  60 000 resoluções com degrau, perfil, agitação e postura (inclusive "pressionar") sorteados: degrau abaixo de 1: ${below1}; acima de 5: ${above5}; regressões: ${regress} (a partir do degrau 1: ${at1regress}); saltos de mais de um degrau: 0.`);
  // regressão em todos os caminhos: pular com falha, pressionar e a carta "divisão"
  const G4 = fresh('complexo', 1, ['paulo']); G4.nego.step = 1; G4.nego.negotiator = 'paulo';
  A.setRandom(() => 0); // sempre o sorteio mais baixo: falha só quando p for 0; testamos o ramo de falha com sorteio alto
  A.setRandom(() => .999);
  const Rr = () => ({ lines: [], stkWhy: {}, hchg: [], sec: 'dec' });
  A.resolveNego({ p: { tech: 5 } }, Rr()); const afterSkip = G4.nego.step;
  G4.nego.step = 1; A.resolveNego({ p: { tech: 'press' } }, Rr()); const afterPress = G4.nego.step;
  G4.nego.step = 1; A.EVENT_FX.divisao.choices[0].run(Rr()); const afterDiv = G4.nego.step;
  console.log(`  Degrau 1 + pular com falha (sorteio máximo): ${afterSkip}; pressionar: ${afterPress}; carta "divisão" (ramo ruim ou bom): ${afterDiv}. Nenhum caminho leva a 0.`);
  ok(afterSkip >= 1 && afterPress >= 1 && afterDiv >= 1, 'a regressão a partir do degrau 1 não pode sair de 1');
  A.reseed(1);
}

/* =====================================================================
   4) AGITAÇÃO, 5) MÍDIA, 6) COFRE
   ===================================================================== */
function playRounds(G, nRounds, decide) {
  const tr = [];
  for (let i = 0; i < nRounds && !G.end; i++) {
    G.stage = 'panel'; if (decide) decide(G, i);
    const r = A.resolveDecisions();
    if (r && r.event) { const n = A.EVENT_FX[r.event].choices.length; let o = false; for (let k = 0; k < n && !o; k++) o = A.chooseEvent(k); }
    tr.push({ r: G.round, agit: G.agit, media: G.media, vault: G.vault, credits: G.credits, p: G.pressure, step: G.nego.step });
    if (!G.end) A.startRound();
  }
  return tr;
}
function auditAgitacao() {
  sec('4. Agitação do líder  (delta = base_perfil + pressão_externa − efeito_negociação ± evento; clamp 0–100)');
  // Volátil no pior sorteio e no melhor, sem ninguém negociando
  for (const [nm, val] of [['sorteio máximo (+8)', .9999], ['sorteio mínimo (−5)', 0]]) {
    const G = fresh('caotico', 1, ['renata', 'marcos'], []); G.profile = 'volatil'; G.agit = nm.includes('+8') ? 60 : 40; G.az.renata = 'entrada'; G.az.marcos = 'entrada';
    startSiege(); A.setRandom(() => val); // eventos e outros sorteios no extremo também
    const tr = playRounds(G, 8);
    ok(tr.every(t => t.agit >= 0 && t.agit <= 100), `agitação saiu de 0–100 com Volátil no ${nm}`);
    console.log(`  Volátil, ${nm}: agitação por rodada ${tr.map(t => Math.round(t.agit)).join(' → ')}${G.end ? ' (partida encerrada: ' + G.end.type + (G.end.variant ? ':' + G.end.variant : '') + ')' : ''}`);
    A.reseed(1);
  }
  // ação desesperada: risco (agit−80)×2% × desp
  console.log('  Ação desesperada, probabilidade por rodada (agit−80)×2% × fator do nível:');
  for (const diff of DIFFS) console.log(`    ${diff.padEnd(10)} ` + [80, 85, 90, 95, 100].map(a => `agit ${a}: ${(Math.max(0, (a - 80) * .02 * A.DIFF[diff].desp) * 100).toFixed(1)}%`).join('  '));
  ok(A.DIFF.caotico.desp * .02 * 20 <= 1, 'probabilidade de ação desesperada no pior caso deve ser ≤ 100%');
  // empirico: frequência da ação com agitação fixa em 100 ao fim da rodada
  for (const diff of DIFFS) {
    let hit = 0, N = 2000;
    for (let i = 0; i < N; i++) {
      const G = fresh(diff, 9000 + i, ['renata'], []); startSiege(); G.stage = 'panel'; G.nego.step = 1;
      G.agit = 100; G.vault = 0; const before = G.agit;
      // isola finishRound: R mínimo
      G.R = { lines: [], decs: [], s0: {}, stkWhy: {}, hchg: [], sec: 'fim', interv: false };
      A.finishRound(); const lines = G.R.lines.map(l => l.text).join(' ');
      if (/AÇÃO DESESPERADA/.test(lines)) hit++;
    }
    console.log(`    medido em ${N} fins de rodada com agitação 100 (${diff}): ${(100 * hit / N).toFixed(1)}%  (esperado ${(Math.min(1, 20 * .02 * A.DIFF[diff].desp) * 100).toFixed(1)}%)`);
  }
  // decomposição da variação de agitação por perfil em rodada neutra
  console.log('  Variação de agitação por rodada sem negociação, mídia 30, ninguém na Entrada (base do perfil + nível + pressão externa):');
  for (const prof of PROFS) {
    const row = DIFFS.map(d => { const base = prof === 'volatil' ? 1.5 : A.PROFILES[prof].base; return `${d.slice(0, 4)} ${f1(base + A.DIFF[d].agit + 30 * .03)}`; });
    console.log(`    ${prof.padEnd(11)} ${row.join('  ')}${prof === 'volatil' ? '  (média de −5…+8)' : ''}`);
  }
}
function auditMidia() {
  sec('5. Pressão da mídia  (mídia += (8 + rodada×2) × nível + comunicados − jammer; clamp 0–100)');
  // teto: nenhum comunicado, 8 rodadas, Caótico, imprensa perdida (+8)
  let G = fresh('caotico', 1, ['renata'], []); startSiege(); G.media = 95; G.stk.imprensa.sat = 5;
  let tr = playRounds(G, 8); ok(tr.every(t => t.media <= 100 && t.media >= 0), 'mídia saiu de 0–100 (teto)');
  console.log(`  Teto: mídia 95 e imprensa perdida, 8 rodadas sem comunicado: ${tr.map(t => Math.round(t.media)).join(' → ')}`);
  // piso: coletiva e comunicado geral toda rodada com mídia 0
  G = fresh('protocolar', 2, ['fernanda', 'paulo'], ['jammer']); startSiege(); G.media = 0;
  tr = playRounds(G, 8, (g) => { A.addDecision(mk.com(A, 'coletiva')); A.addDecision(mk.com(A, 'geral')); });
  ok(tr.every(t => t.media >= 0 && t.media <= 100), 'mídia ficou negativa ou passou de 100 (piso)');
  console.log(`  Piso: mídia 0, coletiva + comunicado geral + jammer todo turno (Protocolar): ${tr.map(t => Math.round(t.media)).join(' → ')}  (nunca negativa)`);
  // fórmula: ganho = (8 + r×2) × nível + comunicados − jammer, conferido rodada a rodada (sem evento, sem baixas, agitação baixa)
  let bad = 0, n = 0;
  for (const diff of DIFFS) for (let r = 1; r <= 7; r++) for (const comm of [null, 'coletiva', 'geral']) for (const jam of [0, 1]) {
    const G = fresh(diff, 4, ['renata'], jam ? ['jammer'] : []); startSiege(); G.round = r; G.media = 10; G.agit = 20; G.stage = 'panel'; G.usedEvents = A.EVENT_DEFS.map(e => e.id);
    G.vault = 0; const m0 = G.media; if (comm) A.addDecision(mk.com(A, comm));
    const expectComm = comm === 'coletiva' ? -5 : comm === 'geral' ? -3 : 0;
    A.setRandom(() => .999); A.resolveDecisions(); A.reseed(1);   // sorteio alto: sem vazamento e sem mal-estar de cativeiro (que na rodada 8 sempre dispararia)
    const mg = (8 + G.round * 2) * A.DIFF[diff].media + expectComm - (jam ? 2 : 0); n++;
    if (Math.abs((G.media - m0) - Math.max(-m0, mg)) > 1e-9) bad++;
  }
  ok(bad === 0, `ganho de mídia difere da fórmula em ${bad} de ${n} casos`);
  console.log(`  ${n} rodadas conferidas (3 níveis × rodadas 1–7 × sem comunicado/coletiva/geral × com e sem jammer): ${bad} divergências da fórmula.`);
  console.log('  Ganho natural por rodada (8 + rodada×2) × nível: ' + DIFFS.map(d => `${d.slice(0, 4)}: ` + [1, 4, 8].map(r => f1((8 + 2 * r) * A.DIFF[d].media)).join('/')).join('  ') + ' (rodadas 1/4/8)');
}
function auditVazamento() {
  sec('5b. Vazamento de comunicado  (mídia +10 em vez de −5 quando "vazou/falso"; risco cai com Comunicação, informação e calma)');
  const G0 = fresh('complexo', 1, ['renata'], []); startSiege();
  const rows = [];
  for (const [nm, team] of [['sem equipe', []], ['só Renata (com 6)', ['renata']], ['Paulo (com 9)', ['paulo']], ['Fernanda (com 8, +30%)', ['fernanda']], ['Carla (com 7)', ['carla']]]) {
    const G = fresh('complexo', 2, team, []); startSiege(); if (!team.length) { G.team = ['g1', 'g2']; G.az.g1 = G.az.g2 = 'reserva'; }
    rows.push(`${nm}: coletiva ${(100 * A.leakChance('coletiva')).toFixed(0)}%, geral ${(100 * A.leakChance('geral')).toFixed(0)}%, prefeito ${(100 * A.leakChance('prefeito')).toFixed(0)}%, banco ${(100 * A.leakChance('gerente')).toFixed(0)}%`);
  }
  console.log('  Risco no início do cerco (sem informação): ' + rows.join(' · '));
  let bad = 0, n = 0, lo = 1, hi = 0;
  for (const cid of ['coletiva', 'geral', 'prefeito', 'gerente', 'acolhe']) for (let i = 0; i < 400; i++) {
    const rng = rngSeed(i); const G = fresh(DIFFS[i % 3], i, ALL_IDS.filter(() => rng() < .4), []); startSiege();
    G.media = rng() * 100; G.exposed = rng() < .3 ? 1 : 0; G.K.profile = rng() < .5; G.K.route = rng() < .5 ? G.routeNow : null; G.K.count = rng() < .5; G.K.hostages = rng() < .5;
    const p = A.leakChance(cid); n++; lo = Math.min(lo, p); hi = Math.max(hi, p);
    if (!(p >= 0 && p <= .4)) bad++; if (['gerente', 'acolhe'].includes(cid) && p !== 0) bad++;
  }
  ok(bad === 0, `risco de vazamento fora de [0, 40%] ou presente em canal privado em ${bad} casos`);
  console.log(`  ${n} estados sorteados: risco entre ${(100 * lo).toFixed(0)}% e ${(100 * hi).toFixed(0)}%; banco e famílias (canais privados) sempre 0%.`);
  // efeito: com o sorteio forçado a vazar, a mídia sobe +10 em vez de cair 5; sem vazar, cai 5
  const run = (rv) => { const G = fresh('complexo', 4, ['renata'], []); startSiege(); G.media = 30; G.agit = 20; G.usedEvents = A.EVENT_DEFS.map(e => e.id); G.stage = 'panel'; G.vault = 0;
    A.addDecision(mk.com(A, 'coletiva')); const a0 = G.agit, m0 = G.media; A.setRandom(() => rv); A.resolveDecisions(); A.reseed(1); return { dm: G.media - m0, G, base: (8 + G.round * 2) * A.DIFF.complexo.media, imp: G.stk.imprensa.sat }; };
  const vaz = run(0), ok_ = run(.999);
  console.log(`  Coletiva que vaza: mídia ${f1(vaz.dm)} (natural ${f1(vaz.base)} + 10); coletiva que não vaza: ${f1(ok_.dm)} (natural ${f1(ok_.base)} − 5).`);
  ok(Math.abs(vaz.dm - (vaz.base + 10)) < 1e-9 && Math.abs(ok_.dm - (ok_.base - 5)) < 1e-9, 'efeito do vazamento na mídia deve ser +10 e, sem vazar, −5');
  // frequência medida
  let leaks = 0, tot = 0;
  for (const diff of DIFFS) for (let i = 0; i < 300; i++) { const G = fresh(diff, 5000 + i, ['paulo', 'fernanda'], ['negofone']); startSiege(); G.stage = 'panel'; G.usedEvents = A.EVENT_DEFS.map(e => e.id);
    A.addDecision(mk.com(A, 'coletiva')); A.resolveDecisions(); tot++; if (G.stats.leaks) leaks++; }
  console.log(`  Equipe enxuta (Paulo + Fernanda) na rodada 1, coletiva: vazou em ${(100 * leaks / tot).toFixed(1)}% de ${tot} sorteios.`);
}
function auditCofre() {
  sec('6. Progresso do cofre  (cofre += max(0, 10 × perfil × nível − 4 × agentes na Entrada); clamp 0–100)');
  const rows = [];
  for (const prof of PROFS) { const vm = A.PROFILES[prof].vault; rows.push(`${prof}: ` + DIFFS.map(d => f1(10 * vm * A.DIFF[d].vault)).join('/')); }
  console.log('  Ritmo sem ninguém na Entrada (Protocolar/Complexo/Caótico): ' + rows.join(' · '));
  // 6 agentes na Entrada: delta tende a 0 mas nunca negativo
  let G = fresh('protocolar', 1, ['renata', 'diego', 'marcos', 'andre', 'lucas', 'roberto'], []); G.profile = 'ideologico'; ['renata', 'diego', 'marcos', 'andre', 'lucas', 'roberto'].forEach(id => G.az[id] = 'entrada');
  startSiege(); G.vault = 20; let tr = playRounds(G, 4, null);
  ok(tr.every(t => t.vault >= 0 && t.vault <= 100), 'cofre fora de 0–100 com 6 agentes na Entrada');
  console.log(`  6 agentes na Entrada contra o Ideológico no Protocolar (ritmo 5,1 − 24 < 0): cofre ${tr.map(t => f1(t.vault)).join(' → ')} (nunca negativo, trava em 20).`);
  // ninguém cobre: o cofre chega a 100 e o motor trata com fuga por cofre
  G = fresh('caotico', 3, ['renata'], []); G.profile = 'calculista'; G.az.renata = 'beco'; startSiege();
  tr = playRounds(G, 8, null); ok(tr.every(t => t.vault >= 0 && t.vault <= 100), 'cofre passou de 100');
  console.log(`  Calculista no Caótico sem pressão na Entrada: cofre ${tr.map(t => Math.round(t.vault)).join(' → ')}; desfecho ${G.end ? G.end.type + (G.end.variant ? ':' + G.end.variant : '') + ' (causa ' + (G.end.cause || '-') + ')' : 'sem desfecho'} na rodada ${G.round}.`);
  ok(G.vault <= 100, 'cofre > 100');
}

/* =====================================================================
   7) PONTUAÇÃO
   ===================================================================== */
function auditPontuacao() {
  sec('7. Pontuação final  (pesos .40/.20/.15/.10/.15; componentes 0–1; S≥90, A≥80, B≥65, C≥50, D≥35, F<35)');
  const w = [.40, .20, .15, .10, .15]; const sum = w.reduce((a, b) => a + b, 0);
  ok(sum === 1, 'os pesos devem somar exatamente 1,0', sum);
  console.log(`  Soma dos pesos: ${sum} (exatamente 1). Componentes todos em 1,0 → nota ${(1 * .4 + 1 * .2 + 1 * .15 + 1 * .1 + 1 * .15) * 100}.`);
  // faixas contínuas, sem lacuna
  let gap = 0, last = null, changes = [];
  for (let s = 0; s <= 100.0001; s += .01) { const g = A.gradeOf(s); if (!'SABCDF'.includes(g)) gap++; if (g !== last) { changes.push(`${last || ''}→${g}@${s.toFixed(2)}`); last = g; } }
  ok(gap === 0, 'há nota indefinida em alguma faixa');
  console.log(`  Faixas varridas de 0 a 100 (passo 0,01): ${changes.join('  ')}; fronteiras exatas: 34,99→${A.gradeOf(34.99)} 35→${A.gradeOf(35)} 49,99→${A.gradeOf(49.99)} 50→${A.gradeOf(50)} 64,99→${A.gradeOf(64.99)} 65→${A.gradeOf(65)} 79,99→${A.gradeOf(79.99)} 80→${A.gradeOf(80)} 89,99→${A.gradeOf(89.99)} 90→${A.gradeOf(90)}.`);
  ok(['F', 'D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S'].join() === [34.99, 35, 49.99, 50, 64.99, 65, 79.99, 80, 89.99, 90].map(A.gradeOf).join(), 'fronteiras de nota');
  // Vidas: 100 − 25 por morto − 5 por ferido do documento, na proporção dos 17 reféns; limites e monotonia
  let vBad = 0, vMono = 0; const Hh = { dead: 0, hurt: 0 };
  for (let d = 0; d <= A.HOSTAGES; d++) for (let h = 0; h + d <= A.HOSTAGES; h++) {
    const v = A.vidasScore({ dead: d, hurt: h }); if (!(v >= 0 && v <= 1)) vBad++;
    if (Math.abs(v - Math.max(0, 1 - (25 * d + 5 * h) / 100 * 10 / A.HOSTAGES)) > 1e-12) vBad++;
    if (h > 0 && A.vidasScore({ dead: d, hurt: h }) > A.vidasScore({ dead: d, hurt: h - 1 })) vMono++;
    if (d > 0 && A.vidasScore({ dead: d, hurt: h }) > A.vidasScore({ dead: d - 1, hurt: h })) vMono++;
  }
  ok(vBad === 0 && vMono === 0, `vidasScore fora de [0,1], diferente da fórmula do documento (proporcional) ou não monótono: ${vBad}/${vMono}`);
  console.log(`  Vidas = 1 − (2,5·mortos + 0,5·feridos) ÷ 17 (documento: −25 e −5 por 100, na proporção de 10 para 17 reféns): ${A.vidasScore({ dead: 0, hurt: 0 })} sem baixas; 1 morto ${f3(A.vidasScore({ dead: 1, hurt: 0 }))}; 1 ferido ${f3(A.vidasScore({ dead: 0, hurt: 1 }))}; 7 mortos ${f3(A.vidasScore({ dead: 7, hurt: 0 }))}; 17 mortos ${A.vidasScore({ dead: 17, hurt: 0 })}.`);
  // penalidade: −10 por agente ferido em ação, depois do teto, nunca abaixo de 0
  let pBad = 0;
  for (const nAg of [0, 1, 2, 3]) for (const raw of [100, 80, 40]) {
    const G = fresh('complexo', 3, ['renata', 'diego', 'marcos'], []); startSiege();
    G.end = { type: 'intervencao', variant: 'limpa', captured: 1, lootF: .3, P: .8, forced: false, agentsHurt: G.team.slice(0, nAg) };
    G.hostages.dead = 0; G.hostages.hurt = 0; G.vault = 0; G.credits = A.DIFF[G.diff].verba; G.round = 1; A.STK_KEYS.forEach(k => G.stk[k].sat = raw);
    const S = A.computeScore(); const exp = Math.max(0, Math.round((Math.min(S.raw, S.cap) - 10 * nAg) * 10) / 10);
    if (Math.abs(S.total - exp) > 1e-9 || S.penal !== 10 * nAg) pBad++;
  }
  ok(pBad === 0, `penalidade de agentes aplicada errado em ${pBad} casos`);
  console.log('  Penalidade de −10 por agente ferido: aplicada depois do teto, nunca abaixo de 0, sempre inteira em pontos (0, 10, 20, 30).');
  // arredondamento: a nota guardada já tem uma casa decimal, a mesma da tela
  // componentes normalizados e nota dentro de 0–100 em milhares de partidas completas
  const pols = [['negociadora', () => B.policyNegociador()], ['agressiva', () => B.policyAgressivo(3, .5)], ['exp_paz', () => E.expert('paz')], ['fuzz', s => B.policyFuzz(mulberry32(s))], ['nenhum', () => B.policyEdge('nenhum')]];
  let n = 0, badC = 0, badT = 0, roundMis = 0, capBad = 0, maxT = 0, minT = 100; const disp = {};
  for (const [nm, mkp] of pols) for (const diff of DIFFS) for (let i = 0; i < 250; i++) {
    const seed = 70000 + i; A.reseed(seed); A.newGame(diff); const pol = mkp(seed); pol.setup(A); startSiege(); const G = A.G; let g = 0;
    while (!G.end && g++ < 12) { G.stage = 'panel'; pol.decide(A, G.round); const r = A.resolveDecisions(); if (r && r.event) { const k = pol.event ? pol.event(A, r.event) : 0; if (!A.chooseEvent(k)) for (let j = 0; j < A.EVENT_FX[r.event].choices.length; j++) if (A.chooseEvent(j)) break; } if (!G.end) A.startRound(); }
    const S = G.score; n++; if (!S) continue;
    ['vidas', 'captura', 'valores', 'eficiencia', 'confianca'].forEach(k => { if (!(S[k] >= 0 && S[k] <= 1)) badC++; });
    if (!(S.total >= 0 && S.total <= 100)) badT++; maxT = Math.max(maxT, S.total); minT = Math.min(minT, S.total);
    if (A.gradeOf(Math.round(S.total * 10) / 10) !== S.grade || Math.abs(S.total * 10 - Math.round(S.total * 10)) > 1e-6) roundMis++;
    const cap = S.cap; if (S.total > cap + 1e-9) capBad++;
    disp[S.grade] = (disp[S.grade] || 0) + 1;
  }
  ok(badC === 0, `componente da nota fora de [0,1] em ${badC} partidas`);
  ok(badT === 0, `nota total fora de [0,100] em ${badT} partidas`);
  ok(capBad === 0, 'a nota passou do teto');
  console.log(`  ${n} partidas completas (5 políticas × 3 níveis): componentes sempre em [0,1]; nota entre ${f1(minT)} e ${f1(maxT)}; teto respeitado; notas ${JSON.stringify(disp)}.`);
  ok(roundMis === 0, `a nota exibida (uma casa decimal) cai em outra faixa que a nota guardada em ${roundMis} partidas`);
}

/* =====================================================================
   8) CENÁRIOS EXTREMOS
   ===================================================================== */
function describe(G) { const E = G.end; return E ? E.type + (E.variant ? ':' + E.variant : '') + (E.sub ? '>' + E.sub : '') : '—'; }
function stats(rows, key) { const v = rows.map(r => r[key]).sort((a, b) => a - b); return { mean: v.reduce((s, x) => s + x, 0) / v.length, min: v[0], max: v[v.length - 1] }; }
function summarizeRun(rows, label) {
  const g = {}; rows.forEach(r => g[r.grade] = (g[r.grade] || 0) + 1);
  const o = {}; rows.forEach(r => o[r.key] = (o[r.key] || 0) + 1);
  const s = stats(rows, 'score');
  console.log(`  ${label}: nota média ${f1(s.mean)} (mín ${f1(s.min)}, máx ${f1(s.max)}); notas ${['S', 'A', 'B', 'C', 'D', 'F'].map(x => x + ' ' + Math.round(100 * (g[x] || 0) / rows.length) + '%').join(' ')}; mortos ${f1(stats(rows, 'dead').mean)}; rodadas ${f1(stats(rows, 'round').mean)}; desfechos ${Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + Math.round(100 * v / rows.length) + '%').join(', ')}`);
  return s;
}
function runCustom(diff, seed, pol, hooks = {}) {
  A.reseed(seed); A.newGame(diff); pol.setup(A); const G = A.G;
  if (hooks.afterSetup) hooks.afterSetup(G);
  startSiege(); const trace = []; let g = 0;
  while (!G.end && g++ < 12) {
    G.stage = 'panel'; if (hooks.beforeRound) hooks.beforeRound(G, G.round);
    pol.decide(A, G.round);
    const credBefore = G.credits;
    const r = A.resolveDecisions();
    if (r && r.event) { let k = pol.event ? pol.event(A, r.event) : 0; if (!A.chooseEvent(k)) for (let j = 0; j < A.EVENT_FX[r.event].choices.length; j++) if (A.chooseEvent(j)) break; }
    trace.push({ r: G.round, agit: G.agit, media: G.media, vault: G.vault, credits: G.credits, p: G.pressure, step: G.nego.step, deficit: G.deficit, hurt: G.hostages.hurt, dead: G.hostages.dead, ev: G.R && G.R.eventId, key: G.end ? describe(G) : '' });
    if (!G.end) A.startRound();
  }
  const S = G.score; return { G, trace, row: { key: describe(G), score: S ? S.total : NaN, grade: S && S.grade, dead: G.hostages.dead, hurt: G.hostages.hurt, round: G.round, capped: S && S.capped, cap: S && S.cap, raw: S && S.raw, parts: S } };
}
const negoRight = A_ => mk.nego(Math.min(5, A_.G.nego.step));
function printTrace(tr) { console.log('    rodada agit  mídia cofre créd  pressão degrau déficit feridos mortos  evento'); tr.forEach(t => console.log(`    ${String(t.r).padStart(3)}    ${String(Math.round(t.agit)).padStart(4)} ${String(Math.round(t.media)).padStart(5)} ${String(Math.round(t.vault)).padStart(5)} ${String(Math.round(t.credits)).padStart(5)} ${String(Math.round(t.p)).padStart(6)} ${String(t.step).padStart(6)} ${String(t.deficit).padStart(6)} ${String(t.hurt).padStart(7)} ${String(t.dead).padStart(6)}   ${t.ev || ''}${t.key ? '  → ' + t.key : ''}`)); }

function scenario1() {
  sec('8.1 Cenário 1: tudo no máximo (12 agentes, 8 equipamentos, verba ilimitada, decisões ótimas)');
  const pol = {
    name: 'maximo',
    setup(A_) { ALL_IDS.forEach(id => { const G = A_.G; if (!G.team.includes(id)) { G.team.push(id); G.az[id] = 'reserva'; } }); A_.G.credits = 1e6; A_.EQUIP.forEach(e => buy(A_, e.id)); A_.G.credits = 1e6; A_.G.pressure = A_.calcPressure(); A_.autoPlace();
      const G = A_.G; G.team.forEach(id => G.az[id] = 'reserva');
      // alocação: o melhor de tática em cada zona de rota, o resto no perímetro; equipamento de zona sobre as rotas
      const field = G.team.filter(id => A_.stat(id, 'tat') >= 5).sort((a, b) => A_.stat(b, 'tat') - A_.stat(a, 'tat'));
      const zs = ['beco', 'avenida', 'garagem', 'metro', 'entrada', 'vizinho', 'telhado']; field.forEach((id, i) => G.az[id] = zs[i % 7]);
      G.gz.drone = 'beco'; G.gz.sniper = 'beco'; G.gz.termica = 'garagem'; ['escudo', 'negofone', 'kit', 'jammer', 'viatura'].forEach(e => G.gz[e] = 'reserva');
      ['perfil', 'rota', 'efetivo'].forEach(i => A_.phase1Intel(i)); },
    decide(A_, rn) { const G = A_.G, slots = A_.DIFF[G.diff].slots; let out = 0; const add = d => { if (out < slots && A_.addDecision(d).ok) out++; };
      add(negoRight(A_));
      const KEY = { perfil: 'profile', rota: 'route', efetivo: 'count', cofre: 'vault', refens: 'hostages', cumplice: 'accomplice' };
      const need = ['cofre', 'refens', 'cumplice', 'perfil', 'efetivo', 'rota'].find(i => !G.K[KEY[i]] && !G.pendingIntel.some(o => o.id === i)); if (need) add(mk.intel(A_, need));
      const k = A_.STK_KEYS.slice().sort((a, b) => G.stk[a].sat - G.stk[b].sat)[0]; add(mk.com(A_, { imprensa: 'coletiva', prefeito: 'prefeito', banco: 'gerente', familias: 'acolhe' }[k])); }
  };
  const rows = [];
  for (const diff of DIFFS) for (let i = 0; i < 100; i++) rows.push(runCustom(diff, 800 + i, pol).row);
  for (const diff of DIFFS) summarizeRun(rows.filter((_, i) => Math.floor(i / 100) === DIFFS.indexOf(diff)), diff.padEnd(10));
  ok(rows.every(r => r.score <= 100 && r.score >= 0), 'cenário 1: nota fora de 0–100');
  const one = runCustom('complexo', 801, pol); console.log('  Rastro de uma partida (Complexo, semente 801):'); printTrace(one.trace);
  console.log(`  Nota final ${f1(one.row.score)} (${one.row.grade}); componentes: vidas ${f3(one.row.parts.vidas)} captura ${f3(one.row.parts.captura)} valores ${f3(one.row.parts.valores)} eficiência ${f3(one.row.parts.eficiencia)} confiança ${f3(one.row.parts.confianca)}.`);
}
function scenario2() {
  sec('8.2 Cenário 2: tudo no mínimo (ninguém recrutado, sem equipamento, piores decisões)');
  const worst = {
    name: 'minimo',
    setup(A_) { const G = A_.G; G.team = ['g1', 'g2']; G.stats.noRecruit = true; G.team.forEach(id => { G.az[id] = 'reserva'; }); G.pressure = A_.calcPressure(); },
    decide(A_, rn) { const G = A_.G; A_.addDecision(mk.nego('press')); }   // só pressiona o líder, nunca fala com ninguém, nunca investiga
  };
  const rows = [];
  for (const diff of DIFFS) for (let i = 0; i < 100; i++) rows.push(runCustom(diff, 900 + i, worst).row);
  for (const diff of DIFFS) summarizeRun(rows.filter((_, i) => Math.floor(i / 100) === DIFFS.indexOf(diff)), diff.padEnd(10));
  ok(rows.every(r => Number.isFinite(r.score) && r.score >= 0 && r.score <= 100), 'cenário 2: nota fora de 0–100');
  const one = runCustom('caotico', 901, worst); console.log('  Rastro de uma partida (Caótico, semente 901):'); printTrace(one.trace);
  console.log(`  Nota final ${f1(one.row.score)} (${one.row.grade}); teto ${one.row.cap}; bruta ${f1(one.row.raw)}.`);
}
function scenario3() {
  sec('8.3 Cenário 3: misto (tática ótima, negociação péssima)');
  const mixed = {
    name: 'misto',
    setup(A_) { ['renata', 'diego', 'marcos', 'andre', 'lucas'].forEach(id => hire(A_, id)); ['sniper', 'drone', 'escudo', 'viatura'].forEach(id => buy(A_, id)); A_.G.pressure = A_.calcPressure(); A_.autoPlace();
      const G = A_.G; const zs = ['beco', 'avenida', 'garagem', 'metro', 'entrada']; G.team.forEach((id, i) => G.az[id] = zs[i]); G.gz.sniper = 'beco'; G.gz.drone = 'avenida'; G.gz.escudo = 'reserva'; G.gz.viatura = 'reserva'; },
    decide(A_, rn) { const G = A_.G; A_.addDecision(mk.nego(rn % 2 ? 'press' : 5)); const slots = A_.DIFF[G.diff].slots; if (slots > 1 && !G.K.count && !G.pendingIntel.some(o => o.id === 'efetivo')) A_.addDecision(mk.intel(A_, 'efetivo')); }
  };
  const rows = [];
  for (const diff of DIFFS) for (let i = 0; i < 100; i++) rows.push(runCustom(diff, 1000 + i, mixed).row);
  for (const diff of DIFFS) summarizeRun(rows.filter((_, i) => Math.floor(i / 100) === DIFFS.indexOf(diff)), diff.padEnd(10));
  const one = runCustom('complexo', 1001, mixed); console.log('  Rastro de uma partida (Complexo, semente 1001):'); printTrace(one.trace);
  console.log(`  Nota final ${f1(one.row.score)} (${one.row.grade}).`);
  // comparação: mesma tática com boa negociação
  const good = Object.assign({}, mixed, { decide(A_, rn) { const G = A_.G; A_.addDecision(negoRight(A_)); const slots = A_.DIFF[G.diff].slots; if (slots > 1 && !G.K.count && !G.pendingIntel.some(o => o.id === 'efetivo')) A_.addDecision(mk.intel(A_, 'efetivo')); } });
  const rows2 = []; for (const diff of DIFFS) for (let i = 0; i < 100; i++) rows2.push(runCustom(diff, 1000 + i, good).row);
  for (const diff of DIFFS) summarizeRun(rows2.filter((_, i) => Math.floor(i / 100) === DIFFS.indexOf(diff)), ('mesma tática, negocia bem ' + diff).padEnd(32));
}
function scenario4() {
  sec('8.4 Cenário 4: orçamento zerado no início da rodada 3');
  const pol = E.expert('eq');
  const rows = [];
  const hook = { beforeRound(G, r) { if (r === 3) { G.queue.forEach(q => G.credits += q.cost || 0); G.queue = []; G.credits = 0; G.creditsHist[3] = 0; } } };
  for (const diff of DIFFS) for (let i = 0; i < 100; i++) rows.push(runCustom(diff, 1100 + i, E.expert('eq'), hook).row);
  for (const diff of DIFFS) summarizeRun(rows.filter((_, i) => Math.floor(i / 100) === DIFFS.indexOf(diff)), diff.padEnd(10));
  const one = runCustom('complexo', 1101, E.expert('eq'), hook); console.log('  Rastro de uma partida (Complexo, semente 1101): crédito zera ao abrir a rodada 3'); printTrace(one.trace);
  ok(one.trace.every(t => t.credits >= 0), 'cenário 4: crédito negativo');
  const G = one.G; const bank = G.stk.banco;
  console.log(`  Rodadas no vermelho: ${G.deficit}; confiança do banco ao fim: ${Math.round(bank.sat)}${bank.lost ? ' (perdida)' : ''}; pressão por desgaste acumulada: +${G.stress}.`);
  // ações pagas ficam bloqueadas, as gratuitas continuam disponíveis
  const T = fresh('complexo', 3, ['paulo', 'renata'], []); startSiege(); T.credits = 0; T.stage = 'panel';
  const blocked = [A.addDecision(mk.intel(A, 'perfil')), A.addDecision(mk.apoio(A, 'beco')), A.addDecision(mk.com(A, 'acolhe'))].map(r => r.ok);
  const free = [A.addDecision(mk.nego(1)), A.addDecision(mk.com(A, 'coletiva'))].map(r => r.ok);
  ok(blocked.every(b => !b) && free.every(Boolean), 'com créditos zerados as ações pagas devem ficar bloqueadas e as gratuitas liberadas', { blocked, free });
  console.log(`  Com 0 crédito: investigação, apoio externo e sala de acolhimento bloqueados (${blocked.map(b => b ? 'sim' : 'não').join('/')}); negociação e coletiva liberadas (${free.map(b => b ? 'sim' : 'não').join('/')}).`);
}
function scenario5() {
  sec('8.5 Cenário 5: agitação do líder em 100 na rodada 2');
  const mk5 = () => E.expert('eq');
  const hook = { beforeRound(G, r) { if (r === 2) G.agit = 100; } };
  const rows = [], traces = [];
  for (const diff of DIFFS) for (let i = 0; i < 200; i++) { const r = runCustom(diff, 1200 + i, mk5(), hook); rows.push(r.row); }
  for (const diff of DIFFS) summarizeRun(rows.filter((_, i) => Math.floor(i / 200) === DIFFS.indexOf(diff)), diff.padEnd(10));
  const one = runCustom('complexo', 1201, mk5(), hook); console.log('  Rastro de uma partida (Complexo, semente 1201): agitação 100 ao abrir a rodada 2'); printTrace(one.trace);
  // probabilidade de intervenção com agitação 100 e as condições do teste 12
  const T = fresh('complexo', 3, ['renata', 'diego', 'marcos', 'andre', 'lucas'], ['escudo', 'sniper']); T.team.forEach((id, i) => T.az[id] = ['beco', 'garagem', 'entrada', 'avenida', 'metro'][i]); T.gz.sniper = 'beco'; startSiege(); T.agit = 100;
  const p100 = A.intervProb(), pInfo = (() => { T.K.profile = true; T.K.route = T.routeNow; T.K.count = true; T.K.vault = true; T.K.hostages = true; T.K.accomplice = true; return A.intervProb(); })();
  T.agit = 0; const p0 = A.intervProb();
  console.log(`  Chance de intervenção com a equipe forte: agitação 100 sem informação ${(100 * p100).toFixed(0)}%, agitação 100 com tudo revelado ${(100 * pInfo).toFixed(0)}%, agitação 0 com tudo revelado ${(100 * p0).toFixed(0)}%. O piso do motor é 5% e o teto 95%.`);
  ok(p100 >= .05 && pInfo <= .95 && p0 <= .95, 'chance de intervenção fora de 5–95%');
}

if (!only || only === 'formulas') { auditCobertura(); auditEficiencia(); auditNegociacao(); auditAgitacao(); auditMidia(); auditVazamento(); auditCofre(); auditPontuacao(); }
if (!only || only === 'cenarios') { scenario1(); scenario2(); scenario3(); scenario4(); scenario5(); }
console.log(`\n${checks} verificações, ${fails} falha${fails === 1 ? '' : 's'}.`);
process.exit(fails ? 1 : 0);
