// Promessas do texto × motor (L2.5): cada descrição que o jogador lê (traço do agente, equipamento, comunicação, investigação, perfil,
// zona, evento) vira uma verificação com o motor real. Quando dá, a prova é por gêmeo: um agente genérico recebe os atributos do
// agente testado, sem o traço, e as duas equipes são comparadas no mesmo estado. A diferença tem de ser exatamente a prometida.
//   node tools/sim/promessas.js          → tudo (sai com código 1 se alguma promessa não for cumprida)
const B = require('./bots'); const { mulberry32 } = require('./engine-loader');
const { mk } = B;
const A = B.load(1);
let fails = 0, checks = 0, tests = 0;
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const ok = (cond, msg, extra) => { checks++; if (!cond) { fails++; console.log('  ✗ FALHA: ' + msg + (extra !== undefined ? ' | ' + JSON.stringify(extra) : '')); } return !!cond; };
const sec = t => console.log('\n## ' + t);
const T = (nome, fn) => { tests++; const f0 = fails; try { fn(); } catch (e) { fails++; console.log(`  ✗ ERRO em "${nome}": ${e.stack.split('\n').slice(0, 3).join(' | ')}`); } console.log(`  ${fails === f0 ? '✓' : '✗'} ${nome}`); };
const ZIDS = A.ZONES.map(z => z.id);

/* ---------- montagem ---------- */
const T1 = A.GENERICS[0], T2 = A.GENERICS[1], S1 = JSON.stringify(T1.s), S2 = JSON.stringify(T2.s);
/* gêmeo: g1 (ou g2) com os atributos do agente testado e nenhum traço */
const twin = (real, which = 0) => { const g = which ? T2 : T1; g.s = Object.assign({}, A.agentById(real).s); return g.id; };
const untwin = () => { T1.s = JSON.parse(S1); T2.s = JSON.parse(S2); };
function fresh(diff = 'complexo', seed = 1, team = [], gear = [], prof) {
  A.reseed(seed); A.newGame(diff); const G = A.G;
  team.forEach(id => { G.team.push(id); G.az[id] = 'reserva'; G.fat[id] = 0; G.transit[id] = 0; G.away[id] = 0; });
  gear.forEach(id => { G.gear.push(id); G.gz[id] = 'reserva'; });
  if (prof) G.profile = prof;
  G.pressure = A.calcPressure();
  return G;
}
function siege(G, zones = {}) {   // posiciona e abre a rodada 1
  Object.entries(zones).forEach(([id, z]) => { G.az[id] = z; });
  A.confirmPerimeter(); G.phase = 'siege'; A.startRound(); G.quietRound = G.round; return G;
}
/* resolve a rodada inteira com a primeira escolha de cada evento */
function play(G) { const r = A.resolveDecisions(); if (r && r.event) A.chooseEvent(0); return G.R; }
const add = d => { const r = A.addDecision(d); if (!r.ok) throw new Error('addDecision recusou: ' + r.msg); return d; };
const lines = R => R.lines.map(l => l.text);
const constRng = c => A.setRandom(() => c);

/* =====================================================================
   AGENTES: o que o traço promete
   ===================================================================== */
sec('Agentes (traço de cada um)');

T('Renata: +15% de confiabilidade nas investigações', () => {
  const a = fresh('complexo', 1, ['renata', 'lucas']), pR = A.intelProb(false);
  const b = fresh('complexo', 1, [twin('renata'), 'lucas']), pT = A.intelProb(false); untwin();
  ok(pR < .95 && near(pR - pT, .15), `Renata deve somar +0,15 à chance de investigação (diferença ${(pR - pT).toFixed(4)})`, { pR, pT });
});
T('Renata: uma intuição na rodada 3 (e só nela)', () => {
  const got = {};
  for (const r of [1, 2, 3, 4]) {
    const G = fresh('complexo', 3, ['renata']); G.az.renata = 'beco'; A.confirmPerimeter(); G.phase = 'siege'; G.round = r - 1; A.startRound();
    got[r] = !!(G.update.hint && /^\[Cap\. Alves reconhece um padrão\]/.test(G.update.hint));
  }
  ok(!got[1] && !got[2] && got[3] && !got[4], 'a intuição da Veterana deve aparecer só na rodada 3', got);
  const G = fresh('complexo', 3, [twin('renata')]); G.az.g1 = 'beco'; A.confirmPerimeter(); G.phase = 'siege'; G.round = 2; A.startRound(); untwin();
  ok(!G.update.hint, 'sem a Renata não há intuição na rodada 3');
  const H = fresh('complexo', 3, ['renata']); H.az.renata = 'beco'; A.confirmPerimeter(); H.phase = 'siege'; H.round = 2; H.away.renata = 2; A.startRound();
  ok(!H.update.hint, 'reconvocada, a Renata não dá a intuição');
});
T('Marcos: cansa na metade da velocidade e não sofre a Fadiga crítica', () => {
  for (const diff of ['protocolar', 'complexo', 'caotico']) for (const fat of [1, 2, 3, 4]) {
    const G = fresh(diff, 1, ['marcos']); G.az.marcos = 'beco'; G.fat.marcos = fat; G.pressure = 50;
    const fm = A.ff('marcos'); untwin();
    const H = fresh(diff, 1, [twin('marcos')]); H.az.g1 = 'beco'; H.fat.g1 = fat; H.pressure = 50; const ft = A.ff('g1'); untwin();
    ok(ft > .31 && near(1 - fm, (1 - ft) / 2), `Marcos deve perder metade da eficiência por fadiga (${diff}, ${fat} rodadas): ${(1 - fm).toFixed(3)} × ${(1 - ft).toFixed(3)}`);
  }
  const G = fresh('complexo', 1, ['marcos']); G.az.marcos = 'beco'; G.fat.marcos = 3; G.pressure = 50; const e0 = A.agentEff('marcos'); G.fatCrit = true; const e1 = A.agentEff('marcos');
  const H = fresh('complexo', 1, [twin('marcos')]); H.az.g1 = 'beco'; H.fat.g1 = 3; H.pressure = 50; const t0 = A.agentEff('g1'); H.fatCrit = true; const t1 = A.agentEff('g1'); untwin();
  ok(near(e0, e1) && near(t1, t0 * .85), 'a Fadiga crítica (−15%) não atinge o Marcos e atinge o gêmeo', { e0, e1, t0, t1 });
});
T('Carla: +10% nas investigações e convergência com 1 indício (não 1,5)', () => {
  const a = fresh('complexo', 1, ['carla', 'lucas']), pC = A.intelProb(true);   // fase 1 (−0,15): longe do teto de 0,95
  const b = fresh('complexo', 1, [twin('carla'), 'lucas']), pT = A.intelProb(true);
  ok(pC < .95 && pT > .25 && near(pC - pT, .10), `Carla deve somar +0,10 (diferença ${(pC - pT).toFixed(4)})`);
  ok(A.evidenceMin() === 1.5, 'sem a Carla a convergência exige 1,5 indício');
  untwin();
  const c = fresh('complexo', 1, ['carla']); ok(A.evidenceMin() === 1, 'com a Carla basta 1 indício');
  c.away.carla = 2; ok(A.evidenceMin() === 1.5, 'reconvocada, a Carla não correlaciona');
  // a mesa de comando só diz "os relatos apontam para" quando o indício chega ao mínimo
  const say = withCarla => {
    const G = fresh('complexo', 4, withCarla ? ['renata', 'carla'] : ['renata', twin('carla')]); G.az.renata = 'garagem';
    A.confirmPerimeter(); G.phase = 'siege'; G.round = 2; G.agit = 90; G.ev = { beco: 1.0 };
    ZIDS.forEach(z => { if (z !== 'garagem') G.az.renata = 'garagem'; });
    const txt = A.council().map(c => c.t).join(' | '); untwin(); return /Os relatos apontam para/.test(txt);
  };
  ok(say(true) && !say(false), 'com 1,0 indício a mesa de comando reforça a zona só com a Carla na equipe');
  const G = fresh('complexo', 4, ['carla']); G.ev = { beco: 1.0 }; G.round = 2; ok(/convergem para Beco/.test(A.sacadaView().join(' ')), 'a visão da Pausa de Comando também usa o limiar da Carla');
  const H = fresh('complexo', 4, [twin('carla')]); H.ev = { beco: 1.0 }; H.round = 2; ok(!/convergem para Beco/.test(A.sacadaView().join(' ')), 'sem a Carla, 1,0 indício não converge na Pausa'); untwin();
});
T('Paulo: +10% de avanço e calma ampliada nos degraus 1 a 3 (negociador)', () => {
  for (const diff of ['protocolar', 'complexo', 'caotico']) for (let step = 1; step <= 5; step++) for (let tech = 1; tech <= 5; tech++) {
    const G = fresh(diff, 1, ['paulo'], [], 'volatil'); G.nego.negotiator = 'paulo'; G.nego.step = step; G.az.paulo = 'beco'; G.pressure = 50; G.agit = 30;
    const pa = A.negoParts(tech), ca = A.negoCalm(tech, step); untwin();
    const H = fresh(diff, 1, [twin('paulo')], [], 'volatil'); H.nego.negotiator = 'g1'; H.nego.step = step; H.az.g1 = 'beco'; H.pressure = 50; H.agit = 30;
    const pb = A.negoParts(tech), cb = A.negoCalm(tech, step); untwin();
    const exp = tech <= 3 ? .10 : 0, expCalm = tech <= 3 ? 1.2 : 1;
    ok(near(pa.parts.traco - pb.parts.traco, exp), `Paulo, postura ${tech}: bônus de traço ${exp}`, { diff, step, tech });
    if (pa.p > .02 && pa.p < .95 && pb.p > .02 && pb.p < .95 && tech <= step) ok(near(pa.p - pb.p, exp), `Paulo, postura ${tech} (sem pular etapa): a chance sobe ${exp}`, { diff, step, tech, d: pa.p - pb.p });
    ok(near(ca, cb * expCalm), `Paulo, postura ${tech}: calma ×${expCalm}`, { diff, step, tech, ca, cb });
  }
});
T('Lucas: sem penalidade ao ser reposicionado', () => {
  const G = fresh('complexo', 5, ['lucas', 'renata', 'camila']); siege(G, { lucas: 'beco', renata: 'telhado', camila: 'entrada' });
  add(mk.repos('lucas', 'garagem')); add(mk.repos('renata', 'metro')); G.credits += 0;
  const R = play(G), tx = lines(R).join(' | ');
  ok(G.transit.lucas === 0 && G.transit.renata === 1 && G.fat.lucas === 1 && G.fat.renata === 1.5, 'Lucas não entra em trânsito nem cansa por deslocar; Renata sim', { tl: G.transit.lucas, tr: G.transit.renata, fl: G.fat.lucas, fr: G.fat.renata });
  ok(/Ag\. Lucas Ferreira reposicionado: Beco de Serviço → Garagem Subterrânea sem perda de eficiência/.test(tx) && /Cap\. Renata Alves sai de Telhado para Acesso ao Metrô\. Em trânsito/.test(tx), 'o relato da rodada diz o mesmo', tx.slice(0, 300));
});
T('Fernanda: +30% nas ações com stakeholders e comunicados que vazam menos', () => {
  const a = fresh('complexo', 1, ['fernanda', 'lucas']), ma = A.commMult(), la = A.leakChance('coletiva');
  const b = fresh('complexo', 1, [twin('fernanda'), 'lucas']), mb = A.commMult(), lb = A.leakChance('coletiva'); untwin();
  ok(near(ma, mb * 1.3), `multiplicador de comunicação ×1,3 (${ma.toFixed(3)} × ${mb.toFixed(3)})`);
  ok(la > .03 && near(lb - la, .05), `risco de vazar cai 5 pontos (${lb.toFixed(3)} → ${la.toFixed(3)})`);
  // e o efeito aparece na confiança: a coletiva rende 12·m na imprensa
  const run = ids => { const G = fresh('complexo', 2, ids); siege(G, {}); constRng(.99); const s0 = G.stk.imprensa.sat; G.stk.imprensa.sat = 40; add(mk.com(A, 'coletiva')); play(G); return G.stk.imprensa.sat - 40; };
  const ga = run(['fernanda', 'lucas']), gb = run([twin('fernanda'), 'lucas']); untwin();
  ok(ga > gb, 'a coletiva da Fernanda rende mais confiança da imprensa', { ga, gb });
});
T('André: +8 de prontidão na intervenção e −12% como negociador', () => {
  const a = fresh('complexo', 1, ['andre']); a.az.andre = 'entrada'; a.pressure = 50; const ia = A.intervPower();
  const b = fresh('complexo', 1, [twin('andre')]); b.az.g1 = 'entrada'; b.pressure = 50; const ib = A.intervPower(); untwin();
  ok(ia < 90 && near(ia - ib, 8), `prontidão +8 (${ia.toFixed(2)} × ${ib.toFixed(2)})`);
  for (let tech = 1; tech <= 5; tech++) {
    const G = fresh('complexo', 1, ['andre']); G.nego.negotiator = 'andre'; G.nego.step = 5; G.az.andre = 'beco'; G.pressure = 50; const pa = A.negoParts(tech);
    const H = fresh('complexo', 1, [twin('andre')]); H.nego.negotiator = 'g1'; H.nego.step = 5; H.az.g1 = 'beco'; H.pressure = 50; const pb = A.negoParts(tech); untwin();
    ok(near(pa.parts.traco - pb.parts.traco, -.12), `André negociador, postura ${tech}: −0,12`);
    if (pa.p > .02 && pb.p < .95 && pa.p < .95) ok(near(pb.p - pa.p, .12), `André negociador, postura ${tech}: a chance cai 12 pontos`, { pa: pa.p, pb: pb.p });
  }
});
T('Sofia: investigações custam 20% menos', () => {
  for (const i of A.INTEL) {
    const a = fresh('complexo', 1, ['sofia']), ca = A.intelCost(i.id);
    const b = fresh('complexo', 1, [twin('sofia')]), cb = A.intelCost(i.id); untwin();
    ok(ca === Math.round(i.custo * .8) && cb === i.custo, `${i.id}: ${i.custo} → ${ca} com a Sofia`, { ca, cb });
  }
  const G = fresh('complexo', 1, ['sofia']); const c0 = G.credits; A.phase1Intel('perfil'); ok(c0 - G.credits === 48, 'a investigação da fase 1 também sai por 48 (60 × 0,8)', c0 - G.credits);
  const H = fresh('complexo', 1, ['sofia']); siege(H); const h0 = H.credits; add(mk.intel(A, 'rota')); ok(h0 - H.credits === 56, 'e na fila da rodada sai por 56 (70 × 0,8)', h0 - H.credits);
});
T('Roberto: acima de 65 de pressão pode agir sozinho (agitação +7, mídia +6); até 65 nunca', () => {
  const N = 2400, hit = { 70: 0, 65: 0, 40: 0 };
  for (const p of [70, 65, 40]) for (let i = 0; i < N; i++) {
    const G = fresh('complexo', 100 + i, ['roberto']); G.az.roberto = 'beco'; siege(G); G.pressure = p; const R = play(G);
    if (lines(R).some(t => /Ag\. Roberto Nunes age sozinho/.test(t))) hit[p]++;
  }
  const f = hit[70] / N; ok(f > .21 && f < .29, `acima de 65 ele age em cerca de 25% das rodadas (${(100 * f).toFixed(1)}%)`);
  ok(hit[65] === 0 && hit[40] === 0, 'com pressão 65 ou menos ele nunca age sozinho', hit);
  const d = ids => { const G = fresh('complexo', 8, ids, ['kit']); siege(G); G.pressure = 70; G.agit = 40; G.media = 20; constRng(.2); const a0 = G.agit, m0 = G.media; play(G); return { da: G.agit - a0, dm: G.media - m0 }; };
  const r = d(['roberto']), t = d([twin('roberto')]); untwin();
  ok(near(r.da - t.da, 7) && near(r.dm - t.dm, 6), 'o ato impulsivo soma +7 de agitação e +6 de mídia', { r, t });
});
T('Camila: +1 num atributo e −1 noutro, à escolha', () => {
  const G = fresh('complexo', 1, ['camila']); const base = A.agentById('camila').s;
  for (const plus of Object.keys(base)) for (const minus of Object.keys(base)) {
    G.camAdj = { plus, minus };
    Object.keys(base).forEach(k => { const exp = Math.max(1, Math.min(10, base[k] + (k === plus ? 1 : 0) - (k === minus ? 1 : 0))); ok(A.stat('camila', k) === exp, `Camila ${k} com +${plus}/−${minus}`, { k, v: A.stat('camila', k), exp }); });
  }
});
T('Diego: a Pausa de Comando traz duas pistas em vez de uma', () => {
  const pistas = ids => { const G = fresh('complexo', 3, ids); siege(G); add(mk.pausa()); return lines(play(G)).filter(t => /^Pista: /.test(t)).length; };
  const d = pistas(['diego']), t = pistas([twin('diego')]); untwin();
  ok(d === 2 && t === 1, 'Diego dá duas pistas, o gêmeo dá uma', { d, t });
});
T('Marina: reduz a agitação do líder em 2 por rodada, sem consumir decisão', () => {
  const run = ids => { const G = fresh('complexo', 3, ids); siege(G); const a0 = G.agit; const R = play(G); return { v: R.agitParts[3].v, slots: G.queue.length }; };
  const m = run(['marina']), t = run([twin('marina')]); untwin();
  ok(m.v === -2 && t.v === 0, 'a parcela "equipe e equipamentos" vale −2 com a Marina', { m, t });
  const G = fresh('complexo', 3, ['marina'], ['jammer']); siege(G); const R = play(G); ok(R.agitParts[3].v === -1, 'com o jammer, a parcela vira −1 (−2 e +1)', R.agitParts[3]);
});

/* =====================================================================
   EQUIPAMENTOS
   ===================================================================== */
sec('Equipamentos');

T('Drone: +15 de cobertura na zona e revela se é candidata', () => {
  for (const z of ZIDS) {
    const G = fresh('complexo', 7, [], ['drone']); G.gz.drone = z; const c = A.zoneCoverage(z); ok(c === 15, `drone sozinho em ${z}: cobertura 15`, c);
  }
  const a = fresh('complexo', 7, ['renata'], ['drone']); a.az.renata = 'beco'; a.pressure = 50; const c0 = A.zoneCoverage('beco'); a.gz.drone = 'beco'; const c1 = A.zoneCoverage('beco');
  const eff = A.agentEff('renata'); ok(c1 === Math.min(100, Math.round(eff * 1.3 * 10 + 15)) && c1 > c0, 'com agente na zona o drone soma +15 e o fator 1,3 da equipe', { c0, c1, eff });
  for (let s = 0; s < 40; s++) for (const z of ZIDS) {
    const G = fresh('complexo', 200 + s, ['renata'], ['drone']); G.gz.drone = z; A.confirmPerimeter();
    ok(G.K.zrev[z] === G.routes.includes(z) && G.perimLog.some(t => t.includes(G.routes.includes(z) ? 'CANDIDATA' : 'livre')), `drone revela a zona ${z} certa`, { routes: G.routes, z });
  }
});
T('Escudo: +10 de prontidão em qualquer posição e metade do risco de agente ferido', () => {
  for (const zone of ['reserva', 'beco', 'entrada']) {
    const a = fresh('complexo', 1, ['renata', 'diego'], ['escudo']); a.az.renata = zone; a.az.diego = zone; a.pressure = 50; const i1 = A.intervPower();
    const b = fresh('complexo', 1, ['renata', 'diego']); b.az.renata = zone; b.az.diego = zone; b.pressure = 50; const i0 = A.intervPower();
    ok(i1 < 100 && near(i1 - i0, 10), `escudo +10 com a equipe em ${zone}`, { i1, i0 });
  }
  const freq = gear => { const G = fresh('complexo', 1, ['renata', 'diego', 'lucas'], gear); A.setRandom(mulberry32(5)); let n = 0, N = 6000; for (let i = 0; i < N; i++) if (A.agentsHurtIn('fracasso').length) n++; return n / N; };
  const f1 = freq(['escudo']), f0 = freq([]); ok(f0 > .40 && f1 > .19 && f1 < .26 && near(f1 / f0, .5, .08), `risco de agente ferido na entrada: ${(100 * f0).toFixed(1)}% sem escudo, ${(100 * f1).toFixed(1)}% com`);
});
T('Câmera térmica: conta os armados quando a zona é vizinha ao banco', () => {
  for (const z of ZIDS) {
    const G = fresh('complexo', 1, ['renata'], ['termica']); G.gz.termica = z; A.confirmPerimeter();
    const viz = ['entrada', 'telhado', 'beco', 'garagem'].includes(z);
    ok(G.K.count === viz && G.perimLog.some(t => viz ? t.includes(`${G.assail} assinaturas`) : t.includes('nenhuma presença')), `térmica em ${z}: ${viz ? 'revela' : 'não revela'} o efetivo`, { k: G.K.count, log: G.perimLog });
  }
});
T('Negofone: +10% de avanço', () => {
  for (let tech = 1; tech <= 5; tech++) {
    const a = fresh('complexo', 1, ['paulo'], ['negofone']); a.nego.negotiator = 'paulo'; a.nego.step = 5; const pa = A.negoParts(tech);
    const b = fresh('complexo', 1, ['paulo']); b.nego.negotiator = 'paulo'; b.nego.step = 5; const pb = A.negoParts(tech);
    ok(near(pa.parts.negofone, .10) && pb.parts.negofone === 0 && (pa.p >= .95 || near(pa.p - pb.p, .10)), `negofone +0,10 na postura ${tech}`, { pa: pa.p, pb: pb.p });
  }
});
T('Sniper: +20 de cobertura com agente na zona, +10 de prontidão, e na reserva nada', () => {
  const G = fresh('complexo', 1, ['renata', 'diego'], ['sniper']); G.az.renata = 'beco'; G.az.diego = 'reserva'; G.pressure = 50;
  G.gz.sniper = 'reserva'; const cov0 = A.zoneCoverage('beco'), ip0 = A.intervPower();
  G.gz.sniper = 'beco'; const cov1 = A.zoneCoverage('beco'), ip1 = A.intervPower();
  const eff = A.agentEff('renata'); ok(cov1 === Math.min(100, Math.round(eff * 1.3 * 10 + 20)) && cov1 > cov0, 'sniper com agente: +20 na zona (e o fator 1,3 da equipe)', { cov0, cov1 });
  ok(near(ip1 - ip0, 10), 'sniper com agente na zona: +10 de prontidão', { ip0, ip1 });
  G.gz.sniper = 'garagem'; const cov2 = A.zoneCoverage('garagem'), ip2 = A.intervPower(); ok(cov2 === 0 && near(ip2, ip0), 'sniper numa zona sem agente: sem efeito algum', { cov2, ip2, ip0 });
  G.gz.sniper = 'reserva'; ok(near(A.intervPower(), ip0), 'sniper na reserva com alguém descansando: sem efeito (promessa da tela)');
});
T('Kit médico: reféns feridos não pioram, o cativeiro longo e os eventos ferem metade, a intervenção mata menos', () => {
  const mortes = kit => { let m = 0; for (let i = 0; i < 1200; i++) { const G = fresh('complexo', 300 + i, ['renata'], kit ? ['kit'] : []); siege(G); G.hostages.hurt = 4; const d0 = G.hostages.dead; play(G); m += G.hostages.dead - d0; } return m; };
  const m1 = mortes(true), m0 = mortes(false); ok(m1 === 0 && m0 > 200, `feridos sem atendimento morrem (${m0} mortes em 1200 rodadas), com o kit nenhum`, { m1, m0 });
  const novos = kit => { let n = 0; for (let i = 0; i < 4000; i++) { const G = fresh('complexo', 500 + i, ['renata'], kit ? ['kit'] : []); siege(G); G.round = 6; G.agit = 20; const h0 = G.hostages.hurt; play(G); n += G.hostages.hurt - h0; } return n; };
  const n1 = novos(true), n0 = novos(false); ok(n1 < n0 * .62 && n1 > n0 * .38, `mal-estar do cativeiro longo: ${n0} feridos novos sem kit, ${n1} com kit (metade)`, { n1, n0 });
  const tiro = kit => { let n = 0; for (let i = 0; i < 6000; i++) { const G = fresh('complexo', 900 + i, ['renata'], kit ? ['kit'] : []); siege(G); const h0 = G.hostages.hurt; A.EVENT_FX.tiroteio.choices[0].run(G.R || (G.R = { lines: [], stkWhy: {}, hchg: [] })); n += G.hostages.hurt - h0; } return n; };
  const t1 = tiro(true), t0 = tiro(false); ok(t1 < t0 * .6 && t1 > t0 * .4, `ferimento no tiroteio acidental: ${t0} sem kit, ${t1} com kit (metade)`, { t1, t0 });
  const interv = kit => { let d = 0, h = 0, N = 6000; for (let i = 0; i < N; i++) { const G = fresh('complexo', 1300 + i, ['renata'], kit ? ['kit'] : []); siege(G); G.agit = 40; G.G = G; A.doIntervention(false); d += G.hostages.dead; h += G.hostages.hurt; } return { d: d / N, h: h / N }; };
  const i1 = interv(true), i0 = interv(false); ok(i1.d < i0.d * .85 && i1.h > i0.h, `intervenção: ${i0.d.toFixed(3)} mortes por entrada sem kit, ${i1.d.toFixed(3)} com kit (e mais feridos, em vez de mortos)`, { i1, i0 });
});
T('Jammer: sem cúmplice nem live, canal único +6, agitação +1 e mídia −2 por rodada', () => {
  const G = fresh('complexo', 1, ['paulo'], ['jammer']); G.hl.forEach(h => { h.in = true; h.st = 'ok'; }); G.round = 4;
  ok(!A.EVENT_FX.cumplice.elig(G) && !A.EVENT_FX.live.elig(G), 'com o jammer as cartas "cúmplice externo" e "live" nunca saem');
  const H = fresh('complexo', 1, ['paulo']); H.round = 4; ok(A.EVENT_FX.cumplice.elig(H) && A.EVENT_FX.live.elig(H), 'sem o jammer elas podem sair');
  for (let tech = 1; tech <= 5; tech++) {
    const a = fresh('complexo', 1, ['paulo'], ['jammer']); a.nego.negotiator = 'paulo'; a.nego.step = 5; const pa = A.negoParts(tech);
    const b = fresh('complexo', 1, ['paulo']); b.nego.negotiator = 'paulo'; b.nego.step = 5; const pb = A.negoParts(tech);
    ok(near(pa.parts.canal, .06) && pb.parts.canal === 0 && near(pa.p - pb.p, .06), `canal único: +0,06 na postura ${tech}`);
  }
  const run = gear => { const X = fresh('complexo', 4, ['paulo'], gear); siege(X); return play(X); };
  const r1 = run(['jammer']), r0 = run([]); ok(r1.agitParts[3].v - r0.agitParts[3].v === 1 && r1.mediaParts[2].v === -2 && r0.mediaParts[2].v === 0, 'agitação +1 e mídia −2 por rodada', { a: r1.agitParts[3], m: r1.mediaParts[2] });
  const E = (gear, acc) => { const X = fresh('complexo', 4, ['renata'], gear); X.az.renata = 'beco'; X.accomplice = acc; X.K.accomplice = false; X.routeNow = 'beco'; X.pressure = 50; constRng(.99); return A.doEscape('cofre'); };
  const e1 = E(['jammer'], true), e0 = E([], true), e2 = E([], false); ok(e1.cov > e0.cov && e1.cov === Math.round(e2.cov * .92) && e0.cov === Math.round(e2.cov * .78), 'o cúmplice tira 22% da cobertura na fuga; com o jammer, 8%', { e1: e1.cov, e0: e0.cov, e2: e2.cov });
});
T('Viatura: reposicionar sem perda e +15 pontos para alcançar quem fugir', () => {
  const G = fresh('complexo', 5, ['lucas', 'renata'], ['viatura']); siege(G, { lucas: 'beco', renata: 'telhado' }); add(mk.repos('renata', 'metro')); play(G);
  ok(G.transit.renata === 0 && G.fat.renata === 1, 'com a viatura Renata chega sem perda de eficiência', { t: G.transit.renata, f: G.fat.renata });
  const E = gear => { const X = fresh('complexo', 4, ['renata'], gear); X.az.renata = 'beco'; X.routeNow = 'beco'; X.accomplice = false; X.pressure = 50; constRng(.99); return A.doEscape('cofre'); };
  const e1 = E(['viatura']), e0 = E([]); ok(e1.variant === 'escapou' && e0.variant === 'escapou' && near(e1.pp - e0.pp, .15), 'a chance de perseguição bem-sucedida sobe 15 pontos', { p1: e1.pp, p0: e0.pp });
  const dr = z => { const X = fresh('complexo', 4, ['renata'], ['drone']); X.az.renata = 'beco'; X.gz.drone = z; X.routeNow = 'beco'; X.accomplice = false; X.pressure = 50; constRng(.99); return A.doEscape('cofre'); };
  const da = dr('avenida'), db = dr('metro'); const Xa = fresh('complexo', 4, ['renata'], ['drone']); Xa.gz.drone = 'avenida'; const cdelta = A.zoneCoverage('avenida');
  ok(near(da.pp - db.pp, .35 * cdelta / 100 + .08 - .35 * 0), 'o drone sobre a Avenida soma +8 pontos à perseguição (além dos 15 de cobertura que ele dá lá)', { da: da.pp, db: db.pp, cdelta });
});

/* =====================================================================
   COMUNICAÇÃO E INVESTIGAÇÃO
   ===================================================================== */
sec('Comunicação e investigação');

T('Comunicações: cada ação entrega o que o cartão diz', () => {
  const run = (cid, prep) => { const G = fresh('complexo', 11, ['paulo', 'fernanda']); siege(G); constRng(.99); G.stk.imprensa.sat = G.stk.prefeito.sat = G.stk.banco.sat = G.stk.familias.sat = 40; if (prep) prep(G); const c0 = G.credits, s0 = JSON.parse(JSON.stringify(G.stk)); add(mk.com(A, cid)); const cost = c0 - G.credits; play(G); return { G, cost, s0, mp: G.R.mediaParts }; };
  const c = run('coletiva'); ok(c.cost === 0 && c.mp[1].v === -5 && c.G.stk.imprensa.sat > 40, 'coletiva: custo 0, mídia −5, imprensa sobe', { cost: c.cost, mp: c.mp[1].v, sat: c.G.stk.imprensa.sat });
  const p = run('prefeito'); ok(p.cost === 0 && p.G.stk.prefeito.sat > 40 - 2 - 0.1, 'relatório ao prefeito: custo 0 e o prefeito sobe', p.G.stk.prefeito.sat);
  const g = run('gerente'); ok(g.cost === 0 && g.G.K.vault === true && g.G.stk.banco.sat > 40 - 8, 'diretoria do banco: revela o cofre', { vault: g.G.K.vault });
  const a = run('acolhe'); ok(a.cost === 20 && a.G.K.hostages === true, 'sala de acolhimento: custa 20 e revela os reféns', { cost: a.cost, h: a.G.K.hostages });
  const t = run('geral'); ok(t.cost === 0 && ['imprensa', 'prefeito', 'banco', 'familias'].every(k => t.G.attended[k]), 'comunicado geral atende os quatro públicos', t.G.attended);
  const m = fresh('complexo', 1, ['fernanda', 'lucas']); ok(near(A.leakChance('prefeito'), A.leakChance('coletiva') / 2) && A.leakChance('gerente') === 0 && A.leakChance('acolhe') === 0, 'o gabinete vaza metade da coletiva; diretoria e famílias não vazam');
});
T('Investigações: cada uma revela o que o nome promete', () => {
  const KEY = { perfil: 'profile', rota: 'route', efetivo: 'count', cofre: 'vault', refens: 'hostages', cumplice: 'accomplice' };
  for (const i of A.INTEL) {
    const G = fresh('complexo', 3, ['renata']); G.az.renata = 'beco'; A.confirmPerimeter(); G.phase = 'siege'; G.round = 2; constRng(0);
    const r = A.resolveIntel(i.id, false); const v = G.K[KEY[i.id]];
    ok(r.ok && (i.id === 'rota' ? v === G.routeNow : v === true), `${i.id}: revela`, { v });
    if (i.id === 'efetivo') ok(r.text.includes(`${G.assail} pessoas`), 'efetivo diz o número certo', r.text);
    if (i.id === 'perfil') ok(r.text.includes(A.PROFILES[G.profile].nome), 'perfil diz o perfil certo', r.text);
    if (i.id === 'rota') ok(r.text.includes(A.ZONE[G.routeNow].nome), 'rota diz a zona certa', r.text);
    if (i.id === 'cumplice') ok(r.text.startsWith(G.accomplice ? 'Confirmado' : 'Nenhum contato'), 'cúmplice diz a verdade', r.text);
    const H = fresh('complexo', 3, ['renata']); H.round = 2; constRng(.999999); const f = A.resolveIntel(i.id, false); ok(!f.ok && !H.K[KEY[i.id]], `${i.id}: inconclusiva não revela nada`);
  }
  ok(A.INTEL.filter(i => i.fase1).map(i => i.id).join() === 'perfil,rota,efetivo', 'só as três primeiras podem ser feitas antes do cerco');
});
T('Apoio externo: +25 de cobertura por duas rodadas, com preço crescente', () => {
  const G = fresh('complexo', 5, ['renata']); siege(G, { renata: 'telhado' });
  ok(A.APOIO_PRECOS.join() === '90,110,135', 'preços 90, 110, 135');
  const c0 = A.zoneCoverage('garagem'); G.credits = 1000; add(mk.apoio(A, 'garagem')); const cr = G.credits; play(G);
  ok(G.support.garagem && G.support.garagem.v === 25 && G.support.garagem.left === 1 && A.zoneCoverage('garagem') === c0 + 25, 'a rodada seguinte ainda conta os +25', { s: G.support.garagem, c: A.zoneCoverage('garagem'), c0 });
  ok(A.apoioCost(0) === 110, 'o próximo apoio custa 110', A.apoioCost(0));
});
T('Horas extras: −2 rodadas de fadiga e fim da Fadiga crítica', () => {
  const G = fresh('complexo', 5, ['renata', 'diego']); siege(G, { renata: 'beco', diego: 'telhado' }); G.fat.renata = 4; G.fat.diego = 1; G.fatCrit = true; add(mk.horas(A)); play(G);
  ok(G.fat.renata === 3 && G.fat.diego === 1 && G.fatCrit === false, 'fadiga −2 (e +1 do fim da rodada), Fadiga crítica encerrada', { r: G.fat.renata, d: G.fat.diego, c: G.fatCrit });
});

/* =====================================================================
   PERFIS, ZONAS, DIFICULDADES E EVENTOS
   ===================================================================== */
sec('Perfis, zonas, dificuldades e eventos');

T('Perfis: agitação inicial e por rodada como a descrição diz', () => {
  const exp = { calculista: [25, 2], volatil: [40, 0], ideologico: [35, 3], desesperado: [60, 5] };
  for (const [pf, [start, base]] of Object.entries(exp)) for (const diff of ['protocolar', 'complexo', 'caotico']) {
    const adj = diff === 'caotico' ? 5 : diff === 'protocolar' ? -5 : 0, D = A.DIFF[diff];
    ok(A.PROFILES[pf].start === start && A.PROFILES[pf].base === base, `${pf}: agitação inicial ${start}, base ${base}/rodada`);
    for (let s = 0; s < 30; s++) {
      const G = fresh(diff, 700 + s, ['renata'], [], pf); G.agit = start + adj; siege(G); const R = play(G), v = R.agitParts[0].v;
      if (pf === 'volatil') ok(v >= -5 + D.agit && v <= 8 + D.agit && Number.isInteger(v - D.agit), `${pf}/${diff}: oscila entre −5 e +8 (${v - D.agit})`);
      else ok(v === base + D.agit, `${pf}/${diff}: ${base} por rodada mais o nível (${v})`);
    }
  }
});
T('Entrada Principal: agentes freiam o cofre (−4 cada) e elevam a agitação (+1,5 cada)', () => {
  const run = n => { const ids = ['renata', 'diego', 'marcos'].slice(0, n); const G = fresh('complexo', 9, ['renata', 'diego', 'marcos'], [], 'calculista'); G.az.renata = 'beco'; G.az.diego = 'telhado'; G.az.marcos = 'garagem'; ids.forEach(id => { G.az[id] = 'entrada'; }); siege(G); const R = play(G); return { v: G.lastVaultDelta, ext: R.agitParts[1].v }; };
  const r0 = run(0), r1 = run(1), r2 = run(2);
  ok(near(r0.v - r1.v, 4) && near(r1.v - r2.v, 4) && near(r1.ext - r0.ext, 1.5) && near(r2.ext - r1.ext, 1.5), 'cada agente na Entrada tira 4 do cofre e põe 1,5 na agitação', { r0, r1, r2 });
});
T('Dificuldades: o que o texto de cada uma diz', () => {
  const P = A.DIFF.protocolar, C = A.DIFF.complexo, K = A.DIFF.caotico;
  ok(P.timer > C.timer && C.timer > K.timer, 'tempo: Protocolar > Complexo > Caótico');
  ok(P.dist < C.dist && C.dist < K.dist && K.hostile === 1 && !P.hostile && !C.hostile, 'líder: receptivo < reservado < hostil');
  ok(P.evChance < C.evChance && C.evChance < K.evChance && K.evChance >= .8, 'eventos: raros < frequentes < quase toda rodada');
  ok(P.ops < C.ops && C.ops < K.ops, 'plantão: mais barato no Protocolar, mais caro no Caótico');
  ok(P.slots === 3 && C.slots === 3 && K.slots === 2, 'decisões por rodada: 3, 3 e 2');
  ok(K.intel < 0 && P.intel === 0 && C.intel === 0, 'investigações menos confiáveis só no Caótico');
  ok(P.verba === 1800 && C.verba === 1500 && K.verba === 1250, 'verba: 1.800, 1.500 e 1.250 créditos');
  ['protocolar', 'complexo', 'caotico'].forEach(d => { A.newGame(d); ok(A.G.credits === A.DIFF[d].verba && A.G.verba === A.DIFF[d].verba, `${A.DIFF[d].nome}: a partida começa com a verba que o cartão do menu mostra`, { credits: A.G.credits, verba: A.G.verba }); });
});
T('Eventos: o efeito de cada carta é o descrito', () => {
  const G = fresh('complexo', 1, ['renata', 'diego'], [], 'calculista'); siege(G, { renata: 'beco', diego: 'garagem' }); G.pressure = 50;
  const c0 = A.zoneCoverage('beco'); G.exposed = 2; ok(A.zoneCoverage('beco') === Math.round(c0 * .9) || A.zoneCoverage('beco') === Math.round(A.agentEff('renata') * 10 * .9), 'helicóptero: cobertura −10% em todas as zonas'); G.exposed = 0;
  const f0 = A.agentEff('renata'); G.fat.renata = 3; const f1 = A.agentEff('renata'); G.fatCrit = true; const f2 = A.agentEff('renata'); ok(near(f2, f1 * .85), 'fadiga crítica: −15% de eficiência de quem passou de 2 rodadas sem descanso', { f1, f2 }); G.fatCrit = false;
  const i0 = A.intervPower(), p0 = A.intervProb(); G.powerCut = 2; ok(near(A.intervPower() - i0, 15) && near(A.intervProb() - p0 - .04 - 0.45 * 15 / 100, 0, 1e-9), 'corte de energia: +15 de prontidão e +4% de chance de intervenção (a prontidão a mais também soma)', { dp: A.intervPower() - i0, dpr: A.intervProb() - p0 }); G.powerCut = 0;
  const R = { lines: [], stkWhy: {}, hchg: [] }; G.R = R; const dep = A.deployed().length; A.EVENT_FX.segundo.choices[0].run(R); const away = Object.values(G.away).filter(v => v > 0);
  ok(away.length === Math.min(dep, 2) && away.every(v => v === 3), 'segundo incidente: dois agentes reconvocados por 3 rodadas (Complexo)', G.away);
  const H = fresh('caotico', 1, ['renata', 'diego', 'marcos']); siege(H, { renata: 'beco', diego: 'garagem', marcos: 'telhado' }); H.R = { lines: [], stkWhy: {}, hchg: [] }; A.EVENT_FX.segundo.choices[0].run(H.R);
  ok(Object.values(H.away).filter(v => v === 4).length === 2, 'no Caótico eles ficam 4 rodadas fora', H.away);
});

console.log(`\n${tests} grupos, ${checks} verificações, ${fails} falha${fails === 1 ? '' : 's'}.`);
untwin();
process.exit(fails ? 1 : 0);
