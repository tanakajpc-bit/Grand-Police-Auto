/* =====================================================================
   MOTOR DE RESOLUÇÃO
   ===================================================================== */
let G = null;
const SAVE_KEY = 'perimetro_save_v2';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rnd = () => Math.random();
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
function wpick(items, wf) {
  const ws = items.map(wf); let t = ws.reduce((a, b) => a + b, 0), r = rnd() * t;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function wsample(items, wf, n) {
  const pool = items.slice(), out = [];
  while (out.length < n && pool.length) { const x = wpick(pool, wf); out.push(x); pool.splice(pool.indexOf(x), 1); }
  return out;
}
const fmtTime = r => { const m = START_TIME + (r - 1) * ROUND_MIN; return String(Math.floor(m / 60) % 24).padStart(2, '0') + 'h' + String(m % 60).padStart(2, '0'); };
const hasGear = id => G.gear.includes(id);
const D_ = () => DIFF[G.diff];
const PR_ = () => PROFILES[G.profile];

/* ---------------- Novo jogo ---------------- */
function newGame(diffKey, opts = {}) {
  const D = DIFF[diffKey];
  const prof = pick(Object.keys(PROFILES));
  const wf = id => PROFILES[prof].routeW[id];
  const routes = wsample(ZONES.map(z => z.id), wf, 4);
  const route = wpick(routes, wf);
  G = {
    ver: 2, diff: diffKey, noLimit: !!opts.noLimit, phase: 'briefing', stage: null, round: 0,
    credits: CREDITOS_INICIAIS, spent: { rec: 0, equip: 0, intel: 0, ops: 0, plantao: 0 }, deficit: 0, tocLog: [], spendLog: [], creditsHist: [],
    team: [], gear: [], az: {}, gz: {}, fat: {}, transit: {}, away: {}, camAdj: { plus: 'tat', minus: 'com' },
    profile: prof, agit: PROFILES[prof].start + (diffKey === 'caotico' ? 5 : diffKey === 'protocolar' ? -5 : 0),
    routes, route, routeNow: route, assail: ri(D.assail[0], D.assail[1]), accomplice: rnd() < .3,
    hostages: { inside: HOSTAGES, freed: 0, hurt: 0, dead: 0 }, pendingDeath: null,
    hl: HOSTAGE_LIST.map(h => ({ id: h.id, in: true, st: 'ok' })), hPref: {}, quietRound: 0,
    vault: 20, lastVaultDelta: 0, media: 15, pressure: D.pbase + 8, calm: 0, stress: 0,
    nego: { step: 1, contact: false, negotiator: null, skips: 0, tries: 0, concessions: 0, lastTech: 0, failStreak: 0, maxStep: 1, signalShown: false, last: null },
    stk: Object.fromEntries(STK_KEYS.map(k => [k, { sat: D.stk, sem: 0, lost: false }])),
    K: { profile: false, profileHint: null, route: null, cleared: [], count: false, countHint: null, vault: false, hostages: false, accomplice: false, zrev: {}, at: {} },
    ev: {}, pendingIntel: [], hints: [], radio: [], log: [], hist: [], p1intel: {},
    exposed: 0, powerCut: 0, fatCrit: false, support: {}, supportUsed: 0, deadlineLeft: 0, deadlineFired: false,
    mayorPromise: false, vehicleGiven: false, defector: false, attended: {}, commMedia: 0, usedEvents: [],
    frame: pick(['ganho', 'perda']),
    stats: { pausas: 0, skips: 0, intel: 0, comms: 0, intervs: 0, repos: 0, horas: 0, apoio: 0, events: 0, minFF: 1, maxFail: 0, initCov: {}, routeKnownAtStart: false, noRecruit: false, material: 0, peakPressure: 0, pressSum: 0, pressN: 0 },
    queue: [], update: null, R: null, pendingEvent: null, end: null, score: null
  };
  G.pressure = calcPressure();
  return G;
}

/* ---------------- Persistência ---------------- */
function saveGame() {
  if (!G || G.phase === 'menu') return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* sem save: segue o jogo */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
    const s = JSON.parse(raw);
    if (!validSave(s)) { localStorage.removeItem(SAVE_KEY); return null; }
    return migrateSave(s);
  } catch (e) { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} return null; }
}
/* Saves da versão anterior (sem a camada narrativa) ganham os campos novos sem perder a partida. */
function migrateSave(s) {
  s.K.at = s.K.at || {}; s.hPref = s.hPref || {}; s.quietRound = s.quietRound || 0;
  /* L1.3: economia e restrições */
  s.spent = Object.assign({ rec: 0, equip: 0, intel: 0, ops: 0, plantao: 0 }, s.spent || {});
  s.deficit = s.deficit || 0; s.tocLog = s.tocLog || []; s.spendLog = s.spendLog || []; s.creditsHist = s.creditsHist || [];
  Object.keys(s.transit || {}).forEach(id => { const t = s.transit[id]; s.transit[id] = t === true ? 2 : t === false || t == null ? 0 : +t || 0; });
  if (!Array.isArray(s.hl) || s.hl.length !== HOSTAGE_LIST.length) { s.hl = HOSTAGE_LIST.map(h => ({ id: h.id, in: true, st: 'ok' })); const g = G; G = s; syncHL(null); G = g; }
  return s;
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
function validSave(s) {
  return s && s.ver === 2 && DIFF[s.diff] && PROFILES[s.profile] && Array.isArray(s.team) && Array.isArray(s.gear) &&
    s.hostages && s.nego && s.stk && s.K && Array.isArray(s.log) && Array.isArray(s.queue) &&
    ['briefing', 'recruit', 'perimeter', 'siege', 'outcome', 'post'].includes(s.phase) &&
    typeof s.credits === 'number' && s.round >= 0 && s.round <= MAX_ROUNDS && Array.isArray(s.routes) && s.routes.length === 4 &&
    s.team.every(id => agentById(id)) && STK_KEYS.every(k => s.stk[k] && typeof s.stk[k].sat === 'number');
}

/* ---------------- Atributos, pressão, fadiga ---------------- */
function stat(id, k) {
  let v = agentById(id).s[k];
  if (id === 'camila') { if (G.camAdj.plus === k) v++; if (G.camAdj.minus === k) v--; }
  return clamp(v, 1, 10);
}
/* Pressão coletiva da operação (0-100): sobe com mídia, agitação, tempo e baixas */
function calcPressure() {
  const D = D_();
  let p = D.pbase + G.media * .22 + G.agit * .18 + G.round * 2.5 + G.hostages.hurt * 3 + G.hostages.dead * 8 +
    (G.fatCrit ? 5 : 0) + (G.deadlineLeft > 0 ? 4 : 0) + (G.stk.familias.lost ? 6 : 0) + G.stress - G.calm;
  return clamp(Math.round(p), 0, 100);
}
/* Yerkes-Dodson: U invertido, pico 1.0 em pressão 50. Piso 0.35 evita eficiência zero nos extremos. */
function pressureFactor(p) { return clamp(-Math.pow(p / 50 - 1, 2) + 1, .35, 1); }
function agentPressure(id) { return clamp(G.pressure * (1.3 - .06 * stat(id, 'res')), 0, 100); }
const fp = id => pressureFactor(agentPressure(id));
function ff(id) {
  const eff = (G.fat[id] || 0) * (1.5 - .1 * stat(id, 'res')) * D_().fat;
  const rate = id === 'marcos' ? .05 : .1;
  return Math.max(.3, 1 - rate * eff);
}
function agentEff(id) {
  let e = stat(id, 'tat') * fp(id) * ff(id);
  const tr = +G.transit[id] || 0; if (tr >= 2) e *= .5; else if (tr === 1) e *= .75;   // em trânsito: 50% na rodada da ordem, 75% na seguinte (reconhecer o terreno)
  if (G.fatCrit && (G.fat[id] || 0) >= 2 && id !== 'marcos') e *= .85;
  return e;
}
const isAway = id => (G.away[id] || 0) > 0;
const avail = () => G.team.filter(id => !isAway(id));
const agentsIn = z => G.team.filter(id => G.az[id] === z && !isAway(id));
const deployed = () => G.team.filter(id => G.az[id] && G.az[id] !== 'reserva' && !isAway(id));

/* ---------------- Economia (L1.3) ---------------- */
/* Custo de plantão da rodada: base do posto de comando + cada agente em campo (reserva e reconvocados não custam). */
const plantaoCost = (n = deployed().length) => Math.round(D_().ops * (PLANTAO_BASE + PLANTAO_AGENTE * n));
const apoioCost = (queued = G.queue.filter(q => q.kind === 'apoio').length) => APOIO_PRECOS[Math.min(G.supportUsed + queued, APOIO_PRECOS.length - 1)];
const horasCost = () => HORAS_BASE + HORAS_AGENTE * Math.max(1, deployed().length);
/* Quantas rodadas a reserva atual sustenta só de plantão (sem investigar, sem apoio, sem nada) */
const runway = () => { const c = plantaoCost(); return c > 0 ? G.credits / c : 99; };
/* Quanto o plantão ainda vai custar até o fim, se nada mudar */
const burnToEnd = () => plantaoCost() * Math.max(0, MAX_ROUNDS - Math.max(G.round, 0));

/* ---------------- Cobertura ---------------- */
const gearIn = z => G.gear.filter(e => G.gz[e] === z);
function equipFactor(z) { const n = gearIn(z).length; return n >= 2 ? 1.6 : n === 1 ? 1.3 : 1.0; }
function zoneCoverage(z) {
  const ags = agentsIn(z), fe = equipFactor(z);
  let cov = ags.reduce((s, id) => s + agentEff(id) * fe, 0) * 10;
  if (gearIn(z).includes('drone')) cov += 15;
  if (gearIn(z).includes('sniper') && ags.length) cov += 20;
  const sp = G.support[z]; if (sp && sp.left > 0) cov += sp.v;
  if (G.exposed > 0) cov *= .9;
  return clamp(Math.round(cov), 0, 100);
}
const adequateCount = () => ZONES.filter(z => zoneCoverage(z.id) >= ADEQ).length;
const avgRouteCov = () => G.routes.reduce((s, z) => s + zoneCoverage(z), 0) / 4;

/* ---------------- Informação ---------------- */
function infoFrac() {
  const K = G.K; let n = 0;
  n += K.profile ? 1 : K.profileHint ? .35 : 0;
  n += K.route ? 1 : 0;
  n += K.count ? 1 : K.countHint ? .3 : 0;
  n += K.vault ? 1 : 0; n += K.hostages ? 1 : 0; n += K.accomplice ? 1 : 0;
  return n / 6;
}
const knownCount = () => { const K = G.K; return [K.profile, !!K.route, K.count, K.vault, K.hostages, K.accomplice].filter(Boolean).length; };

/* ---------------- Negociação ---------------- */
function getNegotiator() {
  const n = G.nego.negotiator;
  if (n && G.team.includes(n) && !isAway(n)) return n;
  const a = avail().sort((x, y) => stat(y, 'neg') - stat(x, 'neg'));
  return a[0] || null;
}
function negoSkill() {
  const id = getNegotiator(); if (!id) return 2.7;
  return stat(id, 'neg') * Math.max(fp(id), D_().negoFloor || 0) * ff(id);
}
function negoParts(tech) {
  const n = G.nego, d = n.step, D = D_(), P = PR_(), id = getNegotiator(), skill = negoSkill();
  const compat = tech === d, skip = tech > d;
  const kind = POSTURES[tech - 1].kind;
  const parts = {
    base: .15 * skill * D.lev,   // habilidade do negociador, atenuada pela resistência do líder (lev)
    postura: compat ? .20 : skip ? -.25 : 0,
    rapport: .05 * d,
    negofone: hasGear('negofone') ? .10 : 0,
    traco: (id === 'paulo' && tech <= 3 ? .10 : 0) + (id === 'andre' ? -.12 : 0),
    perfil: (P.mult[kind] - 1) * .15,
    info: G.K.profile ? .06 : 0,
    batna: BATNA_PESO * avgRouteCov() / 100,
    agitacao: -Math.max(0, G.agit - 50) * .006,
    lider: -D.dist               // desconfiança de base do líder
  };
  let raw = Object.values(parts).reduce((a, b) => a + b, 0);
  if (skip) raw *= .5;
  return { p: clamp(raw, .02, .95), raw, parts, compat, skip, skill };
}
/* efeito calmante da negociação sobre a agitação (valor positivo = reduz) */
function negoCalm(tech, stepAfter) {
  const P = PR_(), id = getNegotiator(), kind = POSTURES[tech - 1].kind;
  let m = P.mult[kind];
  if (id === 'paulo' && tech <= 3) m *= 1.2;
  return 3 * stepAfter * m * (D_().ncalm || 1);
}

/* ---------------- Intervenção, fuga, desfechos ---------------- */
function intervPower() {
  let sum = 0;
  G.team.forEach(id => {
    if (isAway(id)) return;
    const z = G.az[id] || 'reserva';
    sum += agentEff(id) * (z === 'reserva' ? .5 : ZONE[z].W);
  });
  let p = Math.min(100, sum * 3.5);
  if (hasGear('escudo')) p += 10;
  if (hasGear('sniper') && agentsIn(G.gz.sniper).length) p += 10;
  if (G.team.includes('andre') && !isAway('andre')) p += 8;
  if (G.powerCut > 0) p += 15;
  return clamp(p, 0, 100);
}
/* Entrar às cegas: sem saber quantos estão armados e onde estão os reféns, a intervenção perde precisão. */
function blindParts() {
  const K = G.K, out = [];
  if (!K.count) out.push({ k: 'count', v: -.07, txt: 'não sabe quantos estão armados' });
  if (!K.hostages) out.push({ k: 'hostages', v: -.07, txt: 'não sabe onde e como estão os reféns' });
  return out;
}
function intervProb(extra = 0) {
  const blind = blindParts().reduce((s, b) => s + b.v, 0);
  const pr = .24 + .45 * intervPower() / 100 + .33 * infoFrac() + blind - .30 * G.agit / 100 + (G.powerCut > 0 ? .04 : 0) + (D_().ivp || 0) + extra;
  return clamp(pr, .05, .95);
}
const hostagesLeft = () => G.hostages.inside;
function addHurt(n) {
  const H = G.hostages, free = H.inside - H.hurt - H.dead; n = Math.max(0, Math.min(n, free));
  if (!n) return 0;
  H.hurt += n; stake('familias', -7 * n); G.media = clamp(G.media + 3 * n, 0, 100);
  return n;
}
function addDead(n) {
  const H = G.hostages; n = Math.max(0, Math.min(n, H.inside - H.dead)); if (!n) return 0;
  const fromHurt = Math.min(n, H.hurt); H.hurt -= fromHurt; H.dead += n;
  stake('familias', -20 * n); stake('banco', -4 * n); stake('prefeito', -6 * n); G.media = clamp(G.media + 12 * n, 0, 100);
  return n;
}
function stake(k, v) { const s = G.stk[k]; s.sat = clamp(s.sat + v, 0, 100); }

/* ---------------- Reféns com nome ----------------
   O motor conta (inside/hurt/dead); esta camada decide QUEM. Reconciliação estável:
   mortes saem primeiro dos feridos, ferimentos e libertações respeitam G.hPref (eventos com pessoa definida). */
function syncHL(R) {
  const L = G.hl, H = G.hostages, ch = [], pref = G.hPref || {};
  const pickOne = (cands, pid) => cands.find(h => h.id === pid) || cands[Math.floor(rnd() * cands.length)];
  let dead = L.filter(h => h.st === 'dead').length;
  while (dead < H.dead) {
    let c = L.filter(h => h.in && h.st === 'hurt'); if (!c.length) c = L.filter(h => h.st === 'hurt'); if (!c.length) c = L.filter(h => h.st === 'ok');
    if (!c.length) break; const h = pickOne(c, pref.dead); h.st = 'dead'; h.in = true; dead++; ch.push({ id: h.id, what: 'dead' });
  }
  let hurt = L.filter(h => h.st === 'hurt').length;
  while (hurt < H.hurt) {
    let c = L.filter(h => h.in && h.st === 'ok'); if (!c.length) c = L.filter(h => h.st === 'ok');
    if (!c.length) break; const h = pickOne(c, pref.hurt); h.st = 'hurt'; hurt++; ch.push({ id: h.id, what: 'hurt' });
  }
  while (hurt > H.hurt) { const h = L.find(x => x.st === 'hurt'); if (!h) break; h.st = 'ok'; hurt--; }
  let ins = L.filter(h => h.in).length;
  while (ins > H.inside) {
    let c = L.filter(h => h.in && h.st === 'ok'); if (!c.length) c = L.filter(h => h.in && h.st === 'hurt');
    if (!c.length) break; const h = pickOne(c, pref.free); h.in = false; ins--; ch.push({ id: h.id, what: 'free' });
  }
  G.hPref = {};
  if (R) R.hchg = (R.hchg || []).concat(ch);
  return ch;
}
const hlNames = ids => { const n = ids.map(firstName); return n.length <= 1 ? (n[0] || '') : n.slice(0, -1).join(', ') + ' e ' + n[n.length - 1]; };
/* Quando cada variável oculta foi descoberta (para a revelação final) */
function trackKnown() {
  const K = G.K, at = K.at || (K.at = {});
  [['profile', K.profile], ['route', !!K.route], ['count', K.count], ['vault', K.vault], ['hostages', K.hostages], ['accomplice', K.accomplice]]
    .forEach(([k, v]) => { if (v && at[k] == null) at[k] = G.round; });
}
/* Sorteio decorativo derivado do estado: não consome o gerador da partida, então comprar o kit não muda o resto do sorteio. */
function sideRoll(i) {
  let t = Math.imul((Math.round(G.agit * 997)) ^ (Math.round(G.media * 991) << 7) ^ (Math.round(G.vault * 983) << 13) ^ (G.round << 21), 0x85EBCA6B) + i * 0x9E3779B9;
  t = Math.imul(t ^ t >>> 15, 0x2C1B3C6D); t = Math.imul(t ^ t >>> 12, 0x297A2D39); t ^= t >>> 15;
  return (t >>> 0) / 4294967296;
}
const addAgit = v => { G.agit = clamp(G.agit + v, 0, 100); };
const addMedia = v => { G.media = clamp(G.media + v, 0, 100); };

function doIntervention(forced) {
  const D = D_(), P = intervProb(forced ? -.10 : 0), r = rnd(), kit = hasGear('kit');
  let variant, h, d, cap, loot;
  if (r < P * .7)      { variant = 'limpa';    h = rnd() < .35 ? 1 : 0; d = 0; cap = 1;  loot = .30; }
  else if (r < P)      { variant = 'baixas';   h = ri(1, 3); d = rnd() < .20 * D.lethal ? 1 : 0; cap = 1; loot = .35; }
  else if (r < P + .15){ variant = 'parcial';  h = ri(2, 4); d = rnd() < .5 ? 1 : 0; cap = .6; loot = .6; }
  else                 { variant = 'fracasso'; h = ri(3, 5); d = ri(1, 3); cap = .4; loot = .8; }
  if (G.agit > 70 && variant !== 'fracasso' && rnd() < (G.agit - 70) * .01) d += 1;
  if (kit && d > 0 && rnd() < .5) { d -= 1; h += 1; }
  const H = G.hostages;
  const free = HOSTAGES - H.dead - H.hurt;
  const hh = Math.min(h, Math.max(0, free)); H.hurt += hh;
  const dd = Math.min(d, HOSTAGES - H.dead); const fromHurt = Math.min(dd, H.hurt); H.hurt -= fromHurt; H.dead += dd;
  H.inside = H.dead; H.freed = HOSTAGES - H.dead; // todos saem do interior; os mortos permanecem contabilizados e só os vivos contam como libertados
  return { type: 'intervencao', variant, captured: cap, lootF: loot, P, forced: !!forced, newHurt: hh, newDead: dd };
}
function doSurrender() {
  const H = G.hostages; H.freed += H.inside - H.dead; H.inside = H.dead;
  return { type: 'rendicao', variant: G.agit < 25 ? 'serena' : 'tensa', captured: 1, lootF: .25, defector: G.defector };
}
function doEscape(cause) {
  const P = PR_(), H = G.hostages;
  let z = G.routeNow, adapted = false;
  const covR = zoneCoverage(z), D = D_();
  // no Caótico o líder testa o cerco: reage a rotas cobertas já a partir de 50% (nas demais, só a partir de 80%)
  if ((G.exposed > 0 || covR >= (D.adaptAt || 80)) && rnd() < (G.exposed > 0 ? .8 : Math.max(P.adapt, D.adaptMin || 0))) {
    const alts = G.routes.filter(r => r !== z).sort((a, b) => zoneCoverage(a) - zoneCoverage(b));
    if (alts.length) { z = alts[0]; G.routeNow = z; adapted = true; }
  }
  let cov = zoneCoverage(z);
  if (G.accomplice) cov *= hasGear('jammer') ? .92 : (G.K.accomplice ? .9 : .78);
  if (G.vehicleGiven) cov *= .88;
  cov = Math.round(cov);
  const pc = clamp(cov / 100 * .9 + .05, .05, .95);
  H.freed += H.inside - H.dead; H.inside = H.dead;
  let extraHurt = 0;
  if (cause === 'desespero' && rnd() < .25) extraHurt = addHurtFree(1);
  if (rnd() < pc) return { type: 'fuga', variant: 'barrada', zone: z, cov, pc, adapted, cause, captured: .85, lootF: .35, newHurt: extraHurt };
  const pp = clamp(.15 + zoneCoverage('avenida') / 100 * .35 + (hasGear('viatura') ? .15 : 0) + (gearIn('avenida').includes('drone') ? .08 : 0), .1, .7);
  if (rnd() < pp) return { type: 'fuga', variant: 'perseguicao', zone: z, cov, pc, pp, adapted, cause, captured: .7, lootF: .5, newHurt: extraHurt };
  return { type: 'fuga', variant: 'escapou', zone: z, cov, pc, pp, adapted, cause, captured: .2, lootF: 1.0, newHurt: extraHurt };
}
function addHurtFree(n) { const H = G.hostages; const free = HOSTAGES - H.dead - H.hurt; n = Math.max(0, Math.min(n, free)); H.hurt += n; return n; }
/* Ultimato final: o líder decide aceitar a última proposta ou forçar a mão. Quanto mais a escada avançou, mais baixa a agitação
   e mais fechado o perímetro (o BATNA), maior a chance de ele ceder; do contrário, a entrada é forçada com a prontidão que existir. */
function ultimatumProb() {
  const d = G.nego.step;
  return clamp(.04 + .15 * (d - 1) - G.agit / 300 + (G.K.profile ? .05 : 0) + .10 * avgRouteCov() / 100 + (G.nego.contact ? 0 : -.04), .05, .9);
}
function doUltimatum() {
  const p = ultimatumProb();
  if (rnd() < p) {
    const H = G.hostages; H.freed += H.inside - H.dead; H.inside = H.dead;
    const h = rnd() < .3 ? addHurtFree(1) : 0;
    return { type: 'prazo', variant: 'cedeu', captured: .9, lootF: .45, p, newHurt: h };
  }
  const o = doIntervention(true);
  return Object.assign(o, { type: 'prazo', variant: 'forcado', sub: o.variant, p });
}

/* ---------------- Pontuação ---------------- */
function stakeWeights() {
  const H = G.hostages, harm = H.hurt + H.dead > 0;
  const w = Object.fromEntries(STK_KEYS.map(k => [k, STK[k].w]));
  if (harm) { w.familias += .10; w.banco -= .08; }       // famílias ganham legitimidade; banco a perde
  if (G.round >= 6) w.prefeito += .08;                    // prefeito ganha urgência
  const t = Object.values(w).reduce((a, b) => a + b, 0);
  STK_KEYS.forEach(k => w[k] /= t);
  return w;
}
function confidence() { const w = stakeWeights(); return clamp(STK_KEYS.reduce((s, k) => s + G.stk[k].sat * w[k], 0) / 100, 0, 1); }
/* Eficiência de custo (0–1): verba que sobrou ÷ verba inicial (60%) e rapidez do desfecho (40%). O HUD projeta o mesmo valor "se acabasse agora". */
function eficienciaCusto() { return clamp(.6 * Math.min(1, Math.max(0, G.credits) / CREDITOS_INICIAIS) + .4 * (1 - (G.round - 1) / MAX_ROUNDS * .8), 0, 1); }
function gradeOf(s) { return s >= 90 ? 'S' : s >= 80 ? 'A' : s >= 65 ? 'B' : s >= 50 ? 'C' : s >= 35 ? 'D' : 'F'; }
function computeScore() {
  const E = G.end, H = G.hostages;
  if (G.mayorPromise && !(E.type === 'rendicao' || (E.type === 'intervencao' && (E.variant === 'limpa' || E.variant === 'baixas')))) stake('prefeito', -20);
  const vidas = clamp(1 - (H.dead * 2 + H.hurt * .5) / HOSTAGES, 0, 1);
  const captura = clamp(E.captured, 0, 1);
  const valores = clamp(1 - E.lootF * (G.vault / 100), 0, 1);
  const eficiencia = eficienciaCusto();
  const confianca = confidence();
  const raw = (vidas * .40 + captura * .20 + valores * .15 + eficiencia * .10 + confianca * .15) * 100;
  // Tetos (perspectiva de quem protege): vidas perdidas e intervenção fracassada nunca contam como boa condução,
  // e acertar uma aposta (entrada voluntária com menos de 50% de chance) é sorte, não método: no máximo nota A.
  const failed = (E.type === 'intervencao' && E.variant === 'fracasso') || (E.type === 'prazo' && E.sub === 'fracasso');
  const aposta = E.type === 'intervencao' && !E.forced && E.P < APOSTA_P;
  const tetos = [];
  if (H.dead >= 1) tetos.push({ v: H.dead >= 4 ? 49 : H.dead >= 2 ? 64 : 79, why: 'mortes' });
  if (failed) tetos.push({ v: 49, why: 'fracasso' });
  if (aposta) tetos.push({ v: 89, why: 'aposta' });
  const teto = tetos.sort((a, b) => a.v - b.v)[0] || { v: 100, why: null };
  const cap = teto.v;
  const total = Math.min(raw, cap);
  G.score = { vidas, captura, valores, eficiencia, confianca, raw, total, cap, capWhy: teto.why, capped: raw > cap, grade: gradeOf(total) };
  return G.score;
}

/* ---------------- Relatos distribuídos (informação por posição) ---------------- */
const ROUTE_TXT = {
  entrada: ['um carro parou em fila dupla diante da porta e o motorista não desce', 'um homem de boné observa a porta há quarenta minutos sem tirar os olhos do relógio'],
  beco: ['a porta de carga do beco foi destravada por dentro; ouviu-se o ferrolho', 'uma van de entregas sem identificação está estacionada com o porta-malas aberto'],
  telhado: ['marcas recentes na escada de incêndio; alguém testou a saída de serviço', 'a claraboia do telhado estava aberta há pouco, agora fechada'],
  garagem: ['motor ligado na rampa da garagem; ninguém aparece ao volante', 'o portão da garagem se mexeu duas vezes, como se testasse o mecanismo'],
  vizinho: ['luzes acenderam e apagaram no 4º andar do prédio vizinho, em padrão repetido', 'um zelador diz que alguém pediu a chave do acesso ao terraço'],
  metro: ['catraca do metrô foi liberada por dentro, sem passageiro algum', 'um bilhete múltiplo foi deixado numa escada do acesso, ainda quente'],
  avenida: ['um motociclista faz a mesma volta no quarteirão pela quarta vez', 'um carro de aplicativo espera com a corrida marcada, destino a duas quadras']
};
function genReports() {
  const out = [];
  ZONES.forEach(z => {
    const ags = agentsIn(z.id); if (!ags.length) return;
    const id = ags.slice().sort((a, b) => stat(b, 'int') - stat(a, 'int'))[0], ag = agentById(id);
    const cov = zoneCoverage(z.id), intl = stat(id, 'int');
    const isRoute = z.id === G.routeNow, isCand = G.routes.includes(z.id);
    const pHit = clamp(.16 + .04 * intl + cov / 400, .1, .72);
    const nm = ag.nome.split(' ').slice(0, 2).join(' ');
    if (isRoute && rnd() < pHit) {
      G.ev[z.id] = (G.ev[z.id] || 0) + 1;
      out.push({ z: z.id, ag: nm, txt: pick(ROUTE_TXT[z.id]), conf: cov >= ADEQ && rnd() < .6 ? 'Alta' : 'Média', kind: 'rota' });
    } else if (!isRoute && rnd() < .20 + (isCand ? .05 : 0)) {
      G.ev[z.id] = (G.ev[z.id] || 0) + .5;
      out.push({ z: z.id, ag: nm, txt: pick(ROUTE_TXT[z.id]), conf: rnd() < .3 ? 'Média' : 'Baixa', kind: 'ruido' });
    } else if (['entrada', 'telhado', 'beco', 'garagem'].includes(z.id) && rnd() < .30) {
      const t = G.lastVaultDelta >= 6 ? 'ruído metálico contínuo vindo do subsolo, parece uma broca' : G.agit > 60 ? 'vozes alteradas, alguém bate numa porta' : 'silêncio pesado, só se ouve um telefone tocando sem resposta';
      out.push({ z: z.id, ag: nm, txt: t, conf: 'Média', kind: 'int' });
    }
  });
  return out;
}
/* Pista parcial (Pausa de Comando, Veterana, etc.) */
function revealHint() {
  const K = G.K, c = [];
  if (!K.profile && !K.profileHint) c.push('profile');
  if (!K.route) c.push('route');
  if (!K.count && !K.countHint) c.push('count');
  if (!K.hostages) c.push('hostages');
  if (!c.length) return 'Visão sistêmica: não há incertezas críticas restantes além das que só a investigação resolve.';
  const k = pick(c); let t;
  if (k === 'profile') {
    const other = pick(Object.keys(PROFILES).filter(p => p !== G.profile));
    K.profileHint = [G.profile, other].sort();
    t = `O comportamento do líder é compatível com os perfis ${PROFILES[K.profileHint[0]].nome} ou ${PROFILES[K.profileHint[1]].nome}.`;
  } else if (k === 'route') {
    const non = ZONES.map(z => z.id).filter(z => !G.routes.includes(z) && !K.cleared.includes(z));
    if (non.length) { const z = pick(non); K.cleared.push(z); t = `${ZONE[z].nome} parece improvável como rota de fuga. Pode-se economizar atenção ali.`; }
    else t = 'As rotas improváveis já foram descartadas; o desafio agora é escolher entre as candidatas.';
  } else if (k === 'count') {
    K.countHint = [Math.max(2, G.assail - 1), G.assail + 1];
    t = `Pelo volume de sinais, há entre ${K.countHint[0]} e ${K.countHint[1]} pessoas armadas no interior.`;
  } else {
    t = G.hostages.hurt + G.hostages.dead > 0 ? 'Há indícios de pelo menos um refém com lesão, sem confirmação.' : 'Não há sinais de reféns gravemente feridos até agora (sem confirmação).';
  }
  G.hints.push({ r: G.round, t });
  return t;
}
/* Restrição dominante (Teoria das Restrições).
   Só usa o que o comandante pode saber: zonas ainda candidatas (não descartadas), cobertura, equipe, fadiga e tempo. */
function tocScores() {
  const r = Math.max(1, G.round), d = deployed(), K = G.K;
  const info = (1 - infoFrac()) * (r <= 3 ? 1.25 : r <= 5 ? .9 : .5);
  const cands = K.route ? [K.route] : ZONES.map(z => z.id).filter(z => !K.cleared.includes(z) && K.zrev[z] !== false);
  const uncovered = cands.length ? cands.filter(z => zoneCoverage(z) < ADEQ).length / cands.length : 0;
  const pers = (uncovered * .9 + (G.team.length - avail().length) * .15) * (r >= 3 && r <= 6 ? 1.2 : .85);
  const fatLoss = d.length ? d.reduce((s, id) => s + (1 - ff(id)), 0) / d.length : 0;
  const tempo = (fatLoss * 2 + (r - 1) / 7) * (r >= 6 ? 1.3 : .7);
  return { info, pessoal: pers, tempo };
}
function tocConstraint() {
  const sc = tocScores(), ks = ['info', 'pessoal', 'tempo'], k = ks.reduce((a, b) => sc[b] > sc[a] ? b : a, 'info');
  const pct = Object.fromEntries(ks.map(x => [x, clamp(Math.round(sc[x] / 1.25 * 100), 0, 100)]));
  return { k, label: TOCS[k].nome, why: TOCS[k].por, scores: sc, pct };
}

/* ---------------- Inteligência ---------------- */
const intelCost = id => Math.round(INTEL.find(i => i.id === id).custo * (G.team.includes('sofia') ? .8 : 1));
function intelProb(phase1) {
  let best = 0;
  avail().forEach(id => { best = Math.max(best, stat(id, 'int') * fp(id) * ff(id)); });
  if (!avail().length) best = 2.5;
  let p = .30 + .065 * best + (G.team.includes('renata') ? .15 : 0) + (G.team.includes('carla') ? .10 : 0) + D_().intel + (phase1 ? -.15 : 0);
  return clamp(p, .25, .95);
}
function resolveIntel(id, phase1) {
  const def = INTEL.find(i => i.id === id), K = G.K, ok = rnd() < intelProb(phase1);
  G.stats.intel++;
  const res = { id, nome: def.nome, ok, text: '' };
  if (!ok) { res.text = 'Resultado inconclusivo: o sinal veio ruidoso e nada foi confirmado. O custo foi pago e a incerteza continua.'; res.impact = 'Nada muda no painel. É o risco de comprar informação: você paga pela tentativa, não pela resposta.'; return res; }
  const before = { ip: intervProb(), band: ivBand() };
  if (id === 'perfil') { K.profile = true; K.profileHint = null; res.text = `Perfil confirmado: ${PR_().nome}. ${PR_().desc} ${PR_().tip}`; }
  if (id === 'rota') { K.route = G.routeNow; res.text = `O líder planeja sair por: ${ZONE[K.route].nome}. Atenção: planos mudam quando o líder percebe cerco forte.`; }
  if (id === 'efetivo') { K.count = true; K.countHint = null; res.text = `Há ${G.assail} pessoas armadas no interior da agência.`; }
  if (id === 'cofre') { K.vault = true; res.text = `Cofre em ${Math.round(G.vault)}% de progresso. Na velocidade atual, abre em ${etaVault()}.`; }
  if (id === 'refens') { K.hostages = true; const H = G.hostages; res.text = `Reféns: ${H.inside - H.hurt - H.dead} ilesos, ${H.hurt} feridos, ${H.dead} mortos. ${H.hurt ? 'Os feridos precisam de atendimento.' : 'Sem ferimentos graves.'}`; }
  if (id === 'cumplice') { K.accomplice = true; res.text = G.accomplice ? 'Confirmado: há um cúmplice externo coordenando a fuga. A rota está reforçada.' : 'Nenhum contato externo detectado. O grupo age sozinho.'; }
  res.impact = intelImpact(id, before);
  return res;
}
/* "Aha": o que a informação muda na próxima decisão (valor da informação, Howard 1966) */
const ivBand = () => .16 * (1 - infoFrac());
const pctRange = (p, b) => `${Math.round(clamp(p - b, 0, 1) * 100)}–${Math.round(clamp(p + b, 0, 1) * 100)}%`;
function intelImpact(id, before) {
  const P = PR_(), K = G.K;
  if (id === 'perfil') return `Com esse perfil, rende mais ${P.mult.emp >= P.mult.rat ? 'escuta, empatia e rapport' : 'critério objetivo e proposta concreta'}. ${G.nego.contact ? 'A agitação do líder passa a aparecer com o valor exato no painel.' : 'Abra o canal de negociação para medir a agitação com precisão.'}`;
  if (id === 'rota') { const c = zoneCoverage(K.route); return `Cobertura atual em ${ZONE[K.route].nome}: ${c}% (${c >= ADEQ ? 'adequada' : c >= 30 ? 'parcial' : 'descoberta'}). ${c >= ADEQ ? 'A sua aposta no perímetro estava certa.' : 'Reforçar essa zona agora é a aposta mais barata que você tem.'}`; }
  if (id === 'efetivo' || id === 'refens') return `Chance estimada de uma intervenção: ${pctRange(before.ip, before.band)} antes, ${pctRange(intervProb(), ivBand())} agora. Saber estreita a faixa e tira a intervenção do escuro.`;
  if (id === 'cofre') return `O tempo do cofre deixa de ser palpite: ${etaVault() === 'agora' ? 'ele está prestes a ceder' : 'previsão de abertura em ' + etaVault()}. Agentes na Entrada desaceleram o trabalho, mas irritam o líder.`;
  if (id === 'cumplice') return G.accomplice ? 'Na fuga, cada ponto de cobertura na rota vale cerca de 20% menos. Um jammer de comunicação neutraliza boa parte disso.' : 'Uma ameaça a menos: a rota de fuga não tem reforço externo.';
  return '';
}
function etaVault() {
  const vm = PR_().vault * D_().vault, n = agentsIn('entrada').length, delta = Math.max(0, 10 * vm - 4 * n);
  if (delta <= 0) return 'nunca (pressão da Entrada trava o cofre)';
  const r = Math.ceil((100 - G.vault) / delta);
  return r <= 0 ? 'agora' : `${r} rodada${r > 1 ? 's' : ''}`;
}

/* ---------------- Perímetro (fase 1) ---------------- */
function moveAgent(id, z) { G.az[id] = z; }
function placeGear(id, z) { G.gz[id] = z; }
function autoPlace() {
  G.team.forEach(id => G.az[id] = 'reserva');
  const order = ['entrada', 'avenida', 'beco', 'garagem', 'metro', 'telhado', 'vizinho'];
  const ags = G.team.slice().sort((a, b) => stat(b, 'tat') - stat(a, 'tat'));
  ags.forEach((id, i) => { if (stat(id, 'tat') >= 5) G.az[id] = order[i % order.length]; });
}
function phase1Intel(id) {
  const c = intelCost(id); if (G.credits < c || G.p1intel[id]) return null;
  G.credits -= c; G.spent.intel += c; G.p1intel[id] = true;
  const r = resolveIntel(id, true); G.p1intel[id] = r; return r;
}
function confirmPerimeter() {
  G.team.forEach(id => { if (!G.az[id]) G.az[id] = 'reserva'; G.fat[id] = 0; G.transit[id] = 0; G.away[id] = 0; });
  G.gear.forEach(e => { if (!G.gz[e]) G.gz[e] = 'reserva'; });
  const log = [];
  if (G.gz.drone && G.gz.drone !== 'reserva') { const z = G.gz.drone; G.K.zrev[z] = G.routes.includes(z); log.push(`Drone sobre ${ZONE[z].nome}: ${G.K.zrev[z] ? 'zona CANDIDATA a rota de fuga' : 'zona livre de movimentação suspeita'}.`); }
  if (G.gz.termica && G.gz.termica !== 'reserva') {
    const z = G.gz.termica;
    if (['entrada', 'telhado', 'beco', 'garagem'].includes(z)) { G.K.count = true; G.K.countHint = null; log.push(`Câmera térmica em ${ZONE[z].nome}: ${G.assail} assinaturas de calor armadas no interior.`); }
    else log.push(`Câmera térmica em ${ZONE[z].nome}: nenhuma presença suspeita na zona.`);
  }
  G.stats.initCov = Object.fromEntries(ZONES.map(z => [z.id, zoneCoverage(z.id)]));
  trackKnown();
  G.stats.routeKnownAtStart = !!G.K.route;
  G.perimLog = log;
}

/* ---------------- Rodada ---------------- */
function radioLines() {
  const L = [], r = G.round;
  if (r === 1) L.push({ t: '[RÁDIO] Todas as equipes em posição. Silêncio total dentro da agência. O isolamento do quarteirão está fechado.', c: '' });
  if (G.media > 55) L.push({ t: '[RÁDIO] Central, repórteres furando o isolamento na Marechal Deodoro. Pedem declaração do comando.', c: 'warn' });
  if (G.agit > 65) L.push({ t: '[RÁDIO] Equipe Entrada: vozes alteradas lá dentro. Alguém gritou “ninguém mexe nisso”. Câmbio.', c: 'hot' });
  else if (r > 1 && G.agit < 35) L.push({ t: '[RÁDIO] Equipe Telhado: interior sem movimentação brusca. Parece calmaria, e calmaria também pode enganar.', c: '' });
  const tired = deployed().filter(id => ff(id) < .75);
  if (tired.length) L.push({ t: `[RÁDIO] ${agentById(tired[0]).nome.split(' ').slice(0, 2).join(' ')} na escuta: “posso segurar a posição, mas estou no limite”.`, c: 'warn' });
  if (r === 6) L.push({ t: '[RÁDIO] Gabinete do prefeito avisa: a partir de agora ele quer relatório a cada rodada. A paciência política acabou.', c: 'hot' });
  if (G.nego.contact && G.nego.tries >= 2 && !G.nego.signalShown) { G.nego.signalShown = true; L.push({ t: `[RÁDIO] Negociador: “${PR_().sign}”`, c: '' }); }
  if (r === 8) L.push({ t: '[RÁDIO] Comandante, última rodada. Os assaltantes anunciaram que falam em uma hora, e que depois disso não falam mais.', c: 'hot' });
  if (!L.length) L.push({ t: '[RÁDIO] Perímetro estável. Aguardando ordens do comando.', c: '' });
  return L.slice(0, 4);
}
function startRound() {
  G.round++;
  G.pressure = calcPressure();
  G.stats.peakPressure = Math.max(G.stats.peakPressure, G.pressure);
  G.stats.pressSum += G.pressure; G.stats.pressN++;
  const toc = tocConstraint(); G.tocLog[G.round] = toc.k; G.creditsHist[G.round] = G.credits;
  const up = { r: G.round, time: fmtTime(G.round), radio: [], intel: [], reports: [], hint: null, toc: toc.k, tocPrev: G.tocLog[G.round - 1] || null };
  G.pendingIntel.filter(o => o.due <= G.round).forEach(o => up.intel.push(resolveIntel(o.id, false)));
  G.pendingIntel = G.pendingIntel.filter(o => o.due > G.round);
  up.reports = genReports();
  G.stats.reports = (G.stats.reports || 0) + up.reports.length; G.stats.noise = (G.stats.noise || 0) + up.reports.filter(r => r.kind === 'ruido').length; G.stats.sig = (G.stats.sig || 0) + up.reports.filter(r => r.kind === 'rota').length;
  if (G.team.includes('renata') && G.round === 3 && !isAway('renata')) up.hint = '[Cap. Alves reconhece um padrão] ' + revealHint();
  up.radio = radioLines();
  up.intro = roundIntro(); up.council = council(); up.call = stakeCall(); up.quiet = G.quietRound === G.round;
  G.radio = up.radio.concat(G.radio).slice(0, 12);
  G.update = up; G.stage = 'update'; G.queue = [];
  G.attended = {}; G.commMedia = 0;
  saveGame();
}

/* ---------------- Decisões / fila ---------------- */
const slotsLeft = () => D_().slots - G.queue.reduce((s, d) => s + d.slots, 0);
function queueCost(d) { return d.cost || 0; }
function addDecision(d) {
  d.id = Date.now() + Math.random();
  if (d.kind === 'interv') { G.queue.forEach(q => G.credits += queueCost(q)); G.queue = []; d.slots = D_().slots; G.queue.push(d); return { ok: true }; }
  if (G.queue.some(q => q.kind === 'interv')) return { ok: false, msg: 'A intervenção ocupa a rodada inteira. Remova-a para tomar outras decisões.' };
  if (d.kind === 'nego') { const old = G.queue.find(q => q.kind === 'nego'); if (old) removeDecision(old.id); }
  if (d.kind === 'pausa' && G.queue.some(q => q.kind === 'pausa')) return { ok: false, msg: 'A Pausa de Comando já está no plano.' };
  if (d.kind === 'intel' && (G.queue.some(q => q.kind === 'intel' && q.p.id === d.p.id) || G.pendingIntel.some(o => o.id === d.p.id))) return { ok: false, msg: 'Essa investigação já está em andamento.' };
  if (d.kind === 'com' && G.queue.some(q => q.kind === 'com' && q.p.cid === d.p.cid)) return { ok: false, msg: 'Essa ação de comunicação já está no plano.' };
  if (d.kind === 'repos' && G.queue.some(q => q.kind === 'repos' && q.p.agent === d.p.agent)) return { ok: false, msg: 'Esse agente já tem uma ordem de reposicionamento.' };
  if (d.kind === 'apoio' && G.supportUsed + G.queue.filter(q => q.kind === 'apoio').length >= APOIO_PRECOS.length) return { ok: false, msg: 'O limite de apoios externos já foi usado (3 por operação).' };
  if (slotsLeft() < d.slots) return { ok: false, msg: 'Sem decisões disponíveis nesta rodada. Remova uma ação do plano.' };
  if (G.credits < queueCost(d)) return { ok: false, msg: 'Créditos insuficientes para essa ação.' };
  G.credits -= queueCost(d); G.queue.push(d);
  return { ok: true };
}
function removeDecision(id) {
  const i = G.queue.findIndex(q => q.id === id); if (i < 0) return;
  G.credits += queueCost(G.queue[i]); G.queue.splice(i, 1);
  let k = G.supportUsed;   // os apoios que sobram sobem ou descem na tabela de preços
  G.queue.filter(q => q.kind === 'apoio').forEach(q => { const c = APOIO_PRECOS[Math.min(k++, APOIO_PRECOS.length - 1)]; G.credits += q.cost - c; q.cost = c; });
}

const SPEND_TOC = { intel: 'info', pausa: 'info', repos: 'pessoal', apoio: 'pessoal', horas: 'tempo' };
const L = (R, tone, ic, text) => R.lines.push({ tone, ic, text, sec: R.sec || 'dec' });
function snap() {
  trackKnown();
  return { agit: G.agit, media: G.media, vault: G.vault, credits: G.credits, hurt: G.hostages.hurt, dead: G.hostages.dead, step: G.nego.step, p: G.pressure,
    stk: Object.fromEntries(STK_KEYS.map(k => [k, G.stk[k].sat])), cov: Math.round(avgRouteCov()) };
}
function commMult() {
  let best = 0; avail().forEach(id => best = Math.max(best, stat(id, 'com')));
  if (!avail().length) best = 3;
  let m = .7 + .06 * best; if (G.team.includes('fernanda') && !isAway('fernanda')) m *= 1.3;
  return m;
}
const why = (R, k, v, t) => { if (R && R.stkWhy && Math.abs(v) >= .5) (R.stkWhy[k] = R.stkWhy[k] || []).push({ v, t }); };
function applyComm(cid, R) {
  const m = commMult(), c = COMMS.find(x => x.id === cid); G.stats.comms++;
  if (cid === 'geral') STK_KEYS.forEach(k => why(R, k, 4 * m, 'comunicado geral'));
  else why(R, c.s, 10 * m * (cid === 'coletiva' ? 1.2 : 1), c.nome.toLowerCase());
  if (cid === 'geral') { STK_KEYS.forEach(k => { stake(k, 4 * m); G.attended[k] = true; }); G.commMedia += -3; L(R, 'good', 'news', 'Comunicado geral publicado: os quatro públicos recebem a mesma nota. Efeito menor em cada um, mas ninguém ficou no escuro.'); return; }
  G.attended[c.s] = true;
  if (cid === 'coletiva') { stake('imprensa', 12 * m); G.commMedia += -5; L(R, 'good', 'mic', 'Coletiva transparente: a imprensa recebe fatos, não rumores. A pressão da mídia cede (−5) e a confiança da imprensa sobe.'); }
  if (cid === 'prefeito') { stake('prefeito', 10 * m); L(R, 'good', 'mayor', 'Relatório ao gabinete: o prefeito recebe a situação sem edição e baixa o tom por algumas horas.'); }
  if (cid === 'gerente') { stake('banco', 10 * m); G.K.vault = true; L(R, 'good', 'bank', `A diretoria do banco entrega a planta do cofre: progresso exato em ${Math.round(G.vault)}%. Na velocidade atual abre em ${etaVault()}.`); }
  if (cid === 'acolhe') { stake('familias', 10 * m); G.K.hostages = true; const H = G.hostages; L(R, 'good', 'family', `Sala de acolhimento: as famílias descrevem os reféns. Situação confirmada: ${H.inside - H.hurt - H.dead} ilesos, ${H.hurt} feridos, ${H.dead} mortos.`); }
}

function resolveNego(dec, R) {
  const n = G.nego, D = D_(), P = PR_(), id = getNegotiator();
  const nm = id ? agentById(id).nome : 'o comandante (sem negociador na equipe)';
  n.contact = true; n.tries++;
  let calm = 0;
  if (dec.p.tech === 'press') {
    calm = -P.press; n.lastTech = 0;
    L(R, 'bad', 'alert', `${nm} pressiona o líder com um ultimato. Foi lido como ameaça: a agitação sobe (+${P.press}).`);
    n.last = { r: G.round, t: leaderSays('press'), tone: 'bad' }; L(R, 'voice', 'phone', `Líder, na linha: “${n.last.t}”`);
    if (n.step >= 3 && rnd() < .25) { n.step--; L(R, 'bad', 'stairs', `A negociação regride ao degrau ${n.step} (${STEPS[n.step - 1].nome}).`); }
    G.stats.press = (G.stats.press || 0) + 1;
    return calm;
  }
  const tech = dec.p.tech, np = negoParts(tech), d = n.step;
  if (np.skip) { n.skips++; G.stats.skips++; }
  const ok = rnd() < np.p;
  const posture = POSTURES[tech - 1].nome;
  // canal aberto: as famílias sabem que alguém está falando com o líder, então a espera deixa de contar como "sem atenção"
  G.attended.familias = true;
  if (ok) {
    stake('familias', 3); why(R, 'familias', 3, 'avanço na negociação');
    if (n.step < 5) n.step++;
    n.failStreak = 0; n.maxStep = Math.max(n.maxStep, n.step);
    L(R, 'good', 'stairs', `${nm}: ${posture}${np.skip ? ' (pulando etapa)' : ''}. Funcionou. Degrau ${n.step}: ${STEPS[n.step - 1].nome}.`);
  } else {
    n.failStreak = (tech === n.lastTech ? n.failStreak : 0) + 1; G.stats.maxFail = Math.max(G.stats.maxFail, n.failStreak);
    let msg = `${nm}: ${posture}${np.skip ? ' (pulando etapa)' : ''}. O líder não acompanhou. O degrau continua em ${n.step}.`;
    if (np.skip && rnd() < .20 && n.step > 1) { n.step--; msg += ` Pior: a negociação regride ao degrau ${n.step}.`; L(R, 'bad', 'stairs', msg); }
    else L(R, 'warn', 'stairs', msg);
  }
  n.lastTech = tech;
  n.last = { r: G.round, t: leaderSays(ok ? 'step' : 'fail'), tone: ok ? 'good' : 'warn' }; L(R, 'voice', 'phone', `Líder, na linha: “${n.last.t}”`);
  if (np.skip) calm = -2; else calm = negoCalm(tech, n.step);
  return calm;
}

function resolveDecisions() {
  const R = { lines: [], s0: snap(), decs: [], eventId: null, ev: null, skipEvent: false, sec: 'dec', stkWhy: {}, hchg: [] };
  G.R = R; const D = D_(), P = PR_();
  const q = G.queue.slice();
  R.decs = q.map(d => ({ front: d.front, kind: d.kind, label: d.label, cost: d.cost || 0 }));
  q.forEach(d => { if (d.cost) { if (d.front === 'intel') G.spent.intel += d.cost; else G.spent.ops += d.cost; } });
  G.attended = {};
  G.commMedia = 0;
  q.forEach(d => {   // gasto alinhado ao gargalo (Teoria das Restrições): para onde foi cada decisão?
    const t = SPEND_TOC[d.kind] || (d.kind === 'com' && ['gerente', 'acolhe'].includes(d.p.cid) ? 'info' : null);
    if (t) G.spendLog.push({ r: G.round, kind: d.kind, cost: d.cost || 0, toc: G.tocLog[G.round] || null, hit: t === G.tocLog[G.round], target: t });
  });
  if (q.some(d => d.kind === 'interv')) {
    R.interv = true; R.skipEvent = true; G.stats.intervs++;
    L(R, 'warn', 'shield', 'Intervenção autorizada. Todas as equipes recebem o sinal. Nenhuma outra decisão será executada nesta rodada.');
    G.queue = []; G.stage = 'resolving'; return finishRound();
  }
  // Tática
  q.filter(d => d.kind === 'repos').forEach(d => {
    const id = d.p.agent, z = d.p.zone; if (!G.team.includes(id) || G.az[id] === z) return;
    const from = G.az[id]; G.az[id] = z; G.stats.repos++;
    if (z !== 'reserva' && !hasGear('viatura') && id !== 'lucas') {
      G.transit[id] = 2; G.fat[id] = (G.fat[id] || 0) + .5;
      L(R, 'warn', 'swap', `${agentById(id).nome} sai de ${ZNAME(from)} para ${ZNAME(z)}. Em trânsito: 50% de eficiência agora, 75% na próxima rodada, e o deslocamento cansa. ${ZNAME(from)} fica sem esse agente imediatamente.`);
    }
    else L(R, 'info', 'swap', `${agentById(id).nome} reposicionado: ${ZNAME(from)} → ${ZNAME(z)}${z === 'reserva' ? ' (descansa e reinicia a fadiga)' : ' sem perda de eficiência'}.`);
  });
  q.filter(d => d.kind === 'apoio').forEach(d => {
    G.support[d.p.zone] = { v: 25, left: 2 }; G.supportUsed++; G.stats.apoio++;
    L(R, 'info', 'support', `Apoio externo mobilizado em ${ZNAME(d.p.zone)}: +25 de cobertura por 2 rodadas (custo ${d.cost} créditos${G.supportUsed < APOIO_PRECOS.length ? `; o próximo custa ${apoioCost(0)}` : ''}).`);
  });
  q.filter(d => d.kind === 'horas').forEach(() => {
    G.fatCrit = false; G.stats.horas++; deployed().forEach(id => G.fat[id] = Math.max(0, (G.fat[id] || 0) - 2));
    L(R, 'info', 'tired', 'Horas extras pagas: a equipe recupera o fôlego (fadiga −2 rodadas) e a Fadiga crítica é encerrada.');
  });
  if (q.some(d => d.kind === 'pausa')) {
    G.stats.pausas++; G.calm = Math.max(G.calm, 10);
    L(R, 'insight', 'light', 'PAUSA DE COMANDO. Você sobe à sacada: a ação no salão fica por conta da equipe enquanto você observa o sistema inteiro.');
    sacadaView().forEach(t => L(R, 'insight', 'eye', t));
    const n = G.team.includes('diego') && !isAway('diego') ? 2 : 1;
    for (let i = 0; i < n; i++) L(R, 'insight', 'light', 'Pista: ' + revealHint());
  }
  // Inteligência
  q.filter(d => d.kind === 'intel').forEach(d => {
    G.pendingIntel.push({ id: d.p.id, due: G.round + 1 });
    L(R, 'info', 'eye', `Investigação ordenada: ${INTEL.find(i => i.id === d.p.id).nome}. O resultado chega no início da próxima rodada (custo ${d.cost} créditos).`);
  });
  // Comunicação
  q.filter(d => d.kind === 'com').forEach(d => applyComm(d.p.cid, R));
  // Negociação
  let calm = 0; const nd = q.find(d => d.kind === 'nego');
  if (nd) calm = resolveNego(nd, R);
  else if (G.nego.contact) L(R, 'info', 'phone', 'Sem negociação nesta rodada: o canal com o líder fica em silêncio e o degrau não se move.');
  // Passivos do motor
  R.sec = 'mundo';
  // cofre
  const vm = P.vault * D.vault, nEnt = agentsIn('entrada').length, vdelta = Math.max(0, 10 * vm - 4 * nEnt);
  G.vault = clamp(G.vault + vdelta, 0, 100); G.lastVaultDelta = vdelta;
  if (G.K.vault) L(R, vdelta > 6 ? 'warn' : 'info', 'bank', `Cofre: +${vdelta.toFixed(1)} pontos${nEnt ? ` (pressão interna de ${nEnt} agente${nEnt > 1 ? 's' : ''} na Entrada)` : ''} → ${Math.round(G.vault)}%.`);
  else L(R, vdelta > 6 ? 'warn' : 'info', 'bank', vdelta > 6 ? 'Há sinais de que o trabalho no cofre avançou depressa, mas você não sabe medir quanto.' : 'Sem indícios claros de avanço no cofre, mas sem leitura direta dele.');
  // plantão: o posto de comando paga a operação toda rodada (estoque vira fluxo)
  const pcost = plantaoCost(), pn = deployed().length, ppaid = Math.min(pcost, Math.max(0, G.credits));
  G.credits -= ppaid; G.spent.plantao += ppaid; R.plantao = { cost: pcost, paid: ppaid, n: pn };
  if (ppaid >= pcost) L(R, G.credits < pcost * 2 ? 'warn' : 'info', 'coin', `Custo de plantão: −${pcost} créditos (${pn} ${pn === 1 ? 'agente' : 'agentes'} em campo). Reserva: ${Math.round(G.credits)}${G.credits < pcost * 2 ? ', menos de duas rodadas de plantão' : ''}.`);
  else {
    G.deficit++; stake('banco', -5); why(R, 'banco', -5, 'plantão no vermelho');
    const sob = G.deficit <= DEFICIT_STRESS_ROUNDS;   // o desgaste da equipe tem teto: o vermelho prolongado pesa na confiança do banco, não numa espiral de pressão
    if (sob) G.stress += 3;
    L(R, 'bad', 'coin', `Verba esgotada: o plantão custava ${pcost} e só havia ${ppaid}. A operação segue no vermelho: o banco, que cobre a diferença, perde confiança (−5)${sob ? ' e a equipe, trabalhando sem folga, sente a pressão (+3)' : '; a equipe já está no limite e a pressão não sobe mais por causa disso'}.`);
  }
  // mídia: 8 + rodada×2 (escalados pela dificuldade) + comunicado
  const mgain = (8 + G.round * 2) * D.media + G.commMedia - (hasGear('jammer') ? 2 : 0) - (G.team.includes('fernanda') ? 0 : 0);
  addMedia(mgain);
  R.mediaParts = [{ k: 'Escalada natural da cobertura', v: (8 + G.round * 2) * D.media }, { k: 'Seus comunicados', v: G.commMedia }, { k: 'Jammer', v: hasGear('jammer') ? -2 : 0 }];
  L(R, G.media > 70 ? 'warn' : 'info', 'mic', `Pressão da mídia ${mgain >= 0 ? '+' : ''}${Math.round(mgain)} → ${Math.round(G.media)}.`);
  // agitação
  let base = P.base; if (G.profile === 'volatil') base = ri(-5, 8);
  base += D.agit;
  const ext = G.media * .03 + 1.5 * nEnt + (G.exposed > 0 ? 2 : 0);
  let pas = 0; if (G.team.includes('marina') && !isAway('marina')) pas -= 2; if (hasGear('jammer')) pas += 1;
  const dA = base + ext - calm + pas;
  const a0 = G.agit; addAgit(dA);
  R.agitParts = [{ k: 'Perfil do líder', v: base }, { k: 'Pressão externa (mídia e agentes na Entrada)', v: ext }, { k: 'Negociação', v: -calm }, { k: 'Equipe e equipamentos', v: pas }];
  if (!(G.K.profile && G.nego.contact)) L(R, dA > 0 ? 'warn' : 'good', 'alert', dA > 4 ? 'O tom do líder no canal parece mais tenso.' : dA < -4 ? 'O tom do líder no canal parece mais baixo.' : 'O tom do líder no canal parece estável.');
  else L(R, dA > 0 ? 'warn' : 'good', 'alert', `Agitação do líder ${dA >= 0 ? '+' : ''}${dA.toFixed(1)} (perfil ${base >= 0 ? '+' : ''}${base.toFixed(0)}, pressão externa +${ext.toFixed(1)}${calm ? `, negociação ${calm > 0 ? '−' : '+'}${Math.abs(calm).toFixed(1)}` : ''}${pas ? `, equipe ${pas > 0 ? '+' : ''}${pas}` : ''}).`);
  // impulsivo
  if (G.team.includes('roberto') && !isAway('roberto') && G.pressure > 65 && rnd() < .25) {
    addAgit(7); addMedia(6); const h = addHurt(rnd() < (hasGear('kit') ? .15 : .30) ? 1 : 0);
    L(R, 'bad', 'alert', `Ag. Roberto Nunes age sozinho sob pressão e rompe o protocolo: agitação +7, mídia +6${h ? ', e um refém se fere no tumulto' : ''}.`);
  }
  // reféns feridos agravam. Com o kit médico ninguém morre por isso; o que ele evitou é sorteado à parte e aparece no resultado
  const H = G.hostages;
  if (H.hurt > 0 && !hasGear('kit')) {
    let died = 0; for (let i = 0; i < H.hurt; i++) if (rnd() < .12 * D.lethal) died++;
    if (died) { addDead(died); L(R, 'bad', 'heart', died === 1 ? 'Sem atendimento adequado, um refém ferido não resiste. Uma morte confirmada.' : `Sem atendimento adequado, ${died} reféns feridos não resistem. ${died} mortes confirmadas.`); }
  } else if (H.hurt > 0) {
    let saved = 0; for (let i = 0; i < H.hurt; i++) if (sideRoll(i) < .12 * D.lethal) saved++;
    if (saved) {
      G.stats.kitSaves = (G.stats.kitSaves || 0) + saved;
      L(R, 'good', 'heart', saved === 1 ? 'O kit médico estabilizou um refém ferido que estava piorando. Sem ele, teria sido uma morte.' : `O kit médico estabilizou ${saved} reféns feridos que estavam piorando. Sem ele, teriam sido ${saved} mortes.`);
    }
  }
  // desgaste do cativeiro: quanto mais longo o cerco, mais reféns passam mal
  if (G.round >= 4 && G.hostages.inside - H.hurt - H.dead > 0 && rnd() < .18 * (G.round - 3) * D.lethal * (hasGear('kit') ? .5 : 1)) {
    addHurt(1); L(R, 'warn', 'heart', 'O cativeiro prolongado cobra seu preço: um refém passa mal e precisa de atendimento.');
  }
  if (G.pendingDeath) {
    const pd = G.pendingDeath; pd.left--;
    if (pd.left <= 0) { G.pendingDeath = null; if (rnd() < pd.p) { G.hPref.dead = pd.who || 'lucia'; addDead(1); L(R, 'bad', 'heart', 'Lúcia Andrade, 67 anos, não resistiu. A sala de comando fica em silêncio.'); } else L(R, 'good', 'heart', 'Dona Lúcia se estabilizou a tempo. Alguém lá dentro conseguiu dar o açúcar que restava na bolsa dela.'); }
  }
  // stakeholders
  stakePassives(R);
  G.pressure = calcPressure();
  syncHL(R);
  // evento
  const evId = drawEvent();
  if (evId) {
    R.eventId = evId; G.pendingEvent = evId; G.stage = 'event'; G.stats.events++;
    return { event: evId };
  }
  G.stage = 'resolving';
  return finishRound();
}

function stakePassives(R) {
  STK_KEYS.forEach(k => {
    const s = G.stk[k];
    if (G.attended[k]) s.sem = 0; else s.sem++;
    stake(k, -3 * Math.min(s.sem, 3)); why(R, k, -3 * Math.min(s.sem, 3), `${s.sem} rodada${s.sem > 1 ? 's' : ''} sem atenção`);
  });
  if (G.media > 70) { stake('imprensa', -3); why(R, 'imprensa', -3, 'cobertura saturada'); }
  stake('prefeito', -2 - (G.round >= 6 ? 3 : 0) - (G.deadlineLeft > 0 ? 2 : 0)); why(R, 'prefeito', -2 - (G.round >= 6 ? 3 : 0) - (G.deadlineLeft > 0 ? 2 : 0), G.round >= 6 ? 'urgência política (rodada 6+)' : 'impaciência com a duração');
  stake('banco', -(G.lastVaultDelta * .4)); why(R, 'banco', -(G.lastVaultDelta * .4), 'avanço do cofre');
  stake('familias', -1); why(R, 'familias', -1, 'angústia da espera');
  const lost = STK_KEYS.filter(k => G.stk[k].sat <= 15 && !G.stk[k].lost);
  lost.forEach(k => {
    G.stk[k].lost = true;
    if (k === 'banco') { const cut = Math.min(60, Math.max(0, G.credits)); G.credits -= cut; G.spent.corte = (G.spent.corte || 0) + cut; L(R, 'bad', 'bank', 'O banco perdeu a confiança: a diretoria aciona o seguro e corta 60 créditos da verba operacional.'); }
    if (k === 'imprensa') L(R, 'bad', 'mic', 'A imprensa rompeu com o comando: a cobertura passa a ser hostil e a pressão da mídia ganha +8 por rodada.');
    if (k === 'prefeito') L(R, 'bad', 'mayor', 'O prefeito perdeu a paciência com o comando. Se ele continuar sem confiança a partir da rodada 6, vai ordenar a intervenção por conta própria, contra a sua recomendação técnica.');
    if (k === 'familias') L(R, 'bad', 'family', 'As famílias rompem o isolamento em protesto. A pressão sobre a equipe sobe.');
  });
  if (G.stk.imprensa.lost) addMedia(8);
}

/* ---------------- Eventos ---------------- */
const EVENT_FX = {
  tiroteio:  { elig: g => true, choices: [{ label: 'Entendido', hint: 'Assimilar o choque', run: R => {
    addAgit(15); addMedia(20); stake('imprensa', -8);
    const h = addHurt(rnd() < (hasGear('kit') ? .15 : .30) ? 1 : 0);
    L(R, 'bad', 'shot', `Disparo acidental: agitação +15 e mídia +20. ${h ? 'Um refém foi atingido.' : 'Por sorte, ninguém foi atingido.'}`); } }] },
  passamal:  { elig: g => g.hl.some(h => h.id === 'lucia' && h.in && h.st === 'ok'), choices: [
    { label: 'Oferecer troca humanitária (insulina)', hint: 'Usa o canal de negociação. Pode libertar a refém.', run: R => {
      const p = clamp(.30 + .06 * negoSkill() + (G.nego.contact ? .10 : 0), .25, .9);
      if (rnd() < p) { const H = G.hostages; H.inside--; H.freed++; G.hPref.free = 'lucia'; addAgit(-6); stake('familias', 10); L(R, 'good', 'heart', 'A troca humanitária funcionou: Dona Lúcia sai amparada pela porta lateral, com a insulina já na mão. A agitação cai (−6) e as famílias respiram.'); }
      else { addAgit(5); G.hPref.hurt = 'lucia'; const h = addHurt(rnd() < (hasGear('kit') ? .25 : .5) ? 1 : 0); L(R, 'bad', 'heart', `O líder desconfia da troca e recusa. Agitação +5.${h ? ' Dona Lúcia piora.' : ''}`); } } },
    { label: 'Aguardar e preparar o kit médico', hint: 'Arriscado sem kit médico.', run: R => {
      G.hPref.hurt = 'lucia'; addHurt(1); G.pendingDeath = { left: 1, p: hasGear('kit') ? .10 : .40, who: 'lucia' };
      L(R, 'warn', 'heart', `Dona Lúcia passa mal e fica em estado crítico. ${hasGear('kit') ? 'O kit médico está de prontidão.' : 'Sem kit médico, há risco real de morte na próxima rodada.'}`); } }] },
  heli:      { elig: g => true, choices: [
    { label: 'Solicitar restrição do espaço aéreo (30 créditos)', hint: 'Reduz a exposição, custa verba.', cost: 30, run: R => {
      G.credits -= 30; G.spent.ops += 30; addMedia(6); G.exposed = 1; stake('prefeito', 3); stake('imprensa', -6);
      L(R, 'warn', 'heli', 'Espaço aéreo restrito. A exposição dura só mais uma rodada; a imprensa reclama (−6) e o prefeito aprova (+3).'); } },
    { label: 'Aceitar a exposição', hint: 'Posições visíveis por 2 rodadas.', run: R => {
      addMedia(15); G.exposed = 2; addAgit(4);
      L(R, 'bad', 'heli', 'As posições do perímetro estão expostas por 2 rodadas: cobertura −10% em todas as zonas, mídia +15 e agitação +4.'); } }] },
  segundo:   { elig: g => g.round >= 3, choices: [{ label: 'Liberar as unidades', hint: 'A cidade também precisa de você', run: R => {
    const D = D_(), n = D.hostile ? 2 : (G.diff === 'protocolar' ? 1 : 2), dep = deployed();
    const pool = dep.slice().sort(() => rnd() - .5).slice(0, n);
    pool.forEach(id => { G.away[id] = D.hostile ? 4 : 3; });
    if (pool.length) L(R, 'bad', 'alert', `Segundo incidente na cidade: ${pool.map(id => agentById(id).nome).join(' e ')} ${pool.length > 1 ? 'são reconvocados' : 'é reconvocado'} por ${D.hostile ? 4 : 3} rodadas. As zonas deles ficam descobertas.`);
    else { G.stress += 4; L(R, 'warn', 'alert', 'Segundo incidente na cidade: sem agentes em campo para retirar, mas a pressão sobre o comando sobe.'); } } }] },
  cumplice:  { elig: g => !hasGear('jammer'), choices: [{ label: 'Entendido', hint: 'Reavaliar as rotas', run: R => {
    G.accomplice = true; G.assail++; addAgit(-3);
    L(R, 'bad', 'call', 'Há um quarto elemento do lado de fora. A rota de fuga está reforçada: capturar quem tentar sair por ela ficou mais difícil. O líder, ao saber disso, ficou mais confiante (agitação −3).'); } }] },
  prefeito:  { elig: g => g.round >= 3 && g.round <= 6, choices: [
    { label: 'Garantir que resolverá antes das 20h', hint: 'Agrada hoje, cobra amanhã (escalada de comprometimento).', run: R => {
      stake('prefeito', 12); G.mayorPromise = true; G.stress += 6;
      L(R, 'warn', 'mayor', 'Você promete o desfecho antes do horário nobre. O prefeito sobe 12 pontos, mas a promessa pesa sobre a equipe (+6 de pressão). Se o final não for limpo, a conta chega.'); } },
    { label: 'Pedir confiança no protocolo', hint: 'Honesto, mas pode irritar.', run: R => {
      if (G.stk.prefeito.sat < 50) { stake('prefeito', -5); L(R, 'bad', 'mayor', 'O prefeito já estava insatisfeito e interpreta o pedido como evasiva (−5).'); }
      else { stake('prefeito', 3); L(R, 'good', 'mayor', 'O prefeito aceita o argumento técnico por ora (+3).'); } } }] },
  live:      { elig: g => g.round >= 3 && !hasGear('jammer') && g.hl.some(h => h.id === 'thiago' && h.in && h.st !== 'dead'), choices: [
    { label: 'Aproveitar a transmissão', hint: 'Revela informação, dispara a mídia.', run: R => {
      addMedia(25); addAgit(6); stake('imprensa', 6); G.K.count = true; G.K.countHint = null; G.K.hostages = true;
      const H = G.hostages; L(R, 'warn', 'live', `Você acompanha a live: ${G.assail} armados no interior e reféns identificados (${H.inside - H.hurt - H.dead} ilesos, ${H.hurt} feridos). Em troca, mídia +25 e agitação +6.`); } },
    { label: 'Pedir que a plataforma derrube a live', hint: 'Menos exposição, menos informação.', run: R => {
      addMedia(10); stake('imprensa', -8); stake('familias', -4); addAgit(3);
      L(R, 'warn', 'live', 'A transmissão cai. A mídia sobe menos (+10), mas a imprensa reclama de censura (−8), as famílias perdem a única janela (−4) e o líder se irrita (+3).'); } }] },
  proposta:  { elig: g => g.hostages.inside - g.hostages.dead >= 6, choices: [
    { label: 'Aceitar a troca (3 reféns por 1 veículo)', hint: 'Vidas já, mobilidade para a fuga.', run: R => {
      const H = G.hostages, n = Math.min(3, H.inside - H.dead - H.hurt); H.inside -= n; H.freed += n; G.vehicleGiven = true; G.nego.concessions++; G.stats.material++;
      addAgit(-8); stake('familias', 12); stake('prefeito', 6);
      L(R, 'warn', 'swap', `Troca aceita: ${n} reféns saem. O líder agora tem um veículo à porta, e a rota de fuga fica mais difícil de fechar. Agitação −8.`); } },
    { label: 'Recusar', hint: 'Mantém o cerco, aumenta a tensão.', run: R => {
      addAgit(8); stake('familias', -12); L(R, 'bad', 'swap', 'Proposta recusada. O líder interpreta como desprezo: agitação +8. As famílias não perdoam (−12).'); } },
    { label: 'Fazer contraproposta (sem veículo)', hint: 'Depende da habilidade do negociador.', run: R => {
      const p = clamp(.15 + .05 * negoSkill() + (G.nego.step >= 3 ? .10 : 0), .1, .8);
      if (rnd() < p) { const H = G.hostages, n = Math.min(3, H.inside - H.dead - H.hurt); H.inside -= n; H.freed += n; addAgit(-4); stake('familias', 10); L(R, 'good', 'swap', `A contraproposta emplaca: ${n} reféns saem sem que o veículo seja entregue.`); }
      else { addAgit(6); stake('familias', -4); L(R, 'bad', 'swap', 'A contraproposta é rejeitada com raiva. Agitação +6.'); } } }] },
  fadiga:    { elig: g => g.round >= 3, choices: [
    { label: 'Pagar horas extras', hint: 'Recupera o fôlego da equipe. O custo cresce com o efetivo em campo.', get cost() { return horasCost(); }, run: R => {
      const hc = horasCost(); G.credits -= hc; G.spent.ops += hc; deployed().forEach(id => G.fat[id] = Math.max(0, (G.fat[id] || 0) - 1));
      L(R, 'info', 'tired', 'Horas extras autorizadas: fadiga −1 rodada para todos em campo e nenhuma perda adicional.'); } },
    { label: 'Seguir sem rodízio', hint: '−15% de eficiência de quem passar de 2 rodadas sem descanso.', run: R => {
      G.fatCrit = true; L(R, 'bad', 'tired', 'Fadiga crítica: quem passar de 2 rodadas sem descanso perde 15% de eficiência até que haja rodízio ou horas extras.'); } }] },
  energia:   { elig: g => true, choices: [
    { label: 'Explorar a escuridão (vantagem tática)', hint: 'Intervenção mais forte por 2 rodadas; risco aos reféns.', run: R => {
      G.powerCut = 2; addAgit(6); const h = addHurt(rnd() < (hasGear('kit') ? .10 : .20) ? 1 : 0);
      L(R, 'warn', 'bolt', `Você explora o apagão: +15 de prontidão e +4% de chance de intervenção por 2 rodadas. A agitação sobe +6.${h ? ' No escuro, um refém se machuca.' : ''}`); } },
    { label: 'Acionar a concessionária', hint: 'Energia volta na próxima rodada.', run: R => {
      addAgit(3); L(R, 'info', 'bolt', 'A concessionária restabelece a energia em minutos. A escuridão assustou os reféns, e o líder também (+3).'); } }] },
  infiltrado:{ elig: g => g.round >= 2, choices: [
    { label: 'Autorizar a infiltração', hint: 'Informação rica; risco se for descoberto.', run: R => {
      const pd = G.profile === 'calculista' ? .45 : .30;
      G.K.count = true; G.K.countHint = null; G.K.hostages = true;
      if (rnd() < pd) { addAgit(20); const h = addHurt(rnd() < (hasGear('kit') ? .2 : .4) ? 1 : 0); L(R, 'bad', 'mask', `O agente colheu informação (${G.assail} armados, reféns identificados), mas foi descoberto. Agitação +20.${h ? ' Um refém se fere no tumulto.' : ''}`); }
      else { const t = revealHint(); L(R, 'good', 'mask', `Infiltração limpa: ${G.assail} armados confirmados, reféns identificados. Pista extra: ${t}`); } } },
    { label: 'Recusar', hint: 'Sem risco, sem ganho.', run: R => { L(R, 'info', 'mask', 'Você recusa. O agente volta para a equipe de apoio.'); } }] },
  deadline:  { elig: g => (g.round === 6 || g.round === 7) && !g.deadlineFired, choices: [{ label: 'Entendido', hint: 'O tempo agora tem hora marcada', run: R => {
    G.deadlineLeft = 2; G.deadlineFired = true; stake('prefeito', -5); addMedia(10);
    L(R, 'bad', 'clock', 'O noticiário das 20h vai ao ar em cerca de duas rodadas. O prefeito exige resolução (−5) e a mídia sobe +10. Até lá o prefeito perde mais 2 pontos por rodada, e, se não houver desfecho no horário, perde outros 15.'); } }] },
  familia:   { elig: g => g.round >= 2 && g.hl.some(h => h.id === 'yara' && h.in && h.st !== 'dead'), choices: [
    { label: 'Usar o canal para tranquilizar a refém', hint: 'Humano, mas fora do seu controle.', run: R => {
      stake('familias', 10); addAgit(4); G.K.hostages = true; const H = G.hostages;
      L(R, 'warn', 'family', `A mãe acalma a filha e você ouve o interior pela linha: ${H.hurt} feridos entre os reféns. As famílias aprovam (+10), o líder se irrita por perder o controle do canal (+4).`); } },
    { label: 'Bloquear o canal', hint: 'Preserva o controle da comunicação.', run: R => {
      stake('familias', -10); L(R, 'warn', 'family', 'Você derruba a ligação. A operação segue sob controle, mas a família jamais vai esquecer (−10).'); } }] },
  diretor:   { elig: g => g.round >= 2, choices: [
    { label: 'Priorizar a proteção do cofre', hint: 'Agrada ao banco, desagrada famílias.', run: R => {
      stake('banco', 14); stake('familias', -8); stake('imprensa', -4);
      L(R, 'warn', 'bank', 'Você promete proteger o cofre. O banco sobe 14, mas famílias (−8) e imprensa (−4) percebem a inversão de prioridades.'); } },
    { label: 'Manter a prioridade nas vidas', hint: 'Fiel ao princípio da missão.', run: R => {
      stake('banco', -10); stake('familias', 6); stake('imprensa', 4);
      L(R, 'info', 'bank', 'Você reafirma que vidas vêm primeiro. O banco cai 10, famílias (+6) e imprensa (+4) aprovam.'); } },
    { label: 'Pedir tempo ao diretor', hint: 'Meio-termo.', run: R => { stake('banco', 3); L(R, 'info', 'bank', 'Você promete avaliar o risco ao cofre. O diretor concede algumas horas (+3).'); } }] },
  divisao:   { elig: g => g.nego.contact && g.nego.step >= 2, choices: [
    { label: 'Explorar a divisão', hint: '50%: ajuda a negociação. 50%: desestabiliza o grupo.', run: R => {
      if (rnd() < .5) { addAgit(-10); G.defector = true; L(R, 'good', 'split', 'O dissidente passa a cooperar pelo canal. A agitação do líder cai (−10): o grupo perdeu coesão.'); }
      else { addAgit(12); if (G.nego.step > 1) G.nego.step--; L(R, 'bad', 'split', `O líder percebe a manobra. Agitação +12 e a negociação regride ao degrau ${G.nego.step}.`); } } },
    { label: 'Ignorar o sinal', hint: 'Sem risco, sem oportunidade.', run: R => { L(R, 'info', 'split', 'Você registra o sinal e não age. O momento passa.'); } }] }
};
const HEAVY = ['tiroteio', 'segundo', 'cumplice', 'live', 'infiltrado', 'passamal', 'proposta'];
function drawEvent() {
  const D = D_(); if (G.round < 2 || G.quietRound === G.round || rnd() > D.evChance) return null;
  const avgFat = deployed().length ? deployed().reduce((s, id) => s + (G.fat[id] || 0), 0) / deployed().length : 0;
  const pool = EVENT_DEFS.filter(e => !G.usedEvents.includes(e.id) && EVENT_FX[e.id].elig(G));
  if (!pool.length) return null;
  const e = wpick(pool, x => {
    let w = 1;
    if ((x.id === 'heli' || x.id === 'live') && G.media > 60) w *= 2;
    if (x.id === 'fadiga') w *= (avgFat >= 2 ? 3 : .5);
    if (x.id === 'deadline') w *= 4;
    if (x.id === 'prefeito' && G.round >= 4) w *= 2;
    return w;
  });
  G.usedEvents.push(e.id);
  if (HEAVY.includes(e.id)) G.quietRound = G.round + 1;   // respiro: a rodada seguinte não tem carta de evento
  return e.id;
}
function chooseEvent(idx) {
  const R = G.R, fx = EVENT_FX[G.pendingEvent], ch = fx.choices[idx];
  if (ch.cost && G.credits < ch.cost) return false;
  R.ev = { id: G.pendingEvent, choice: ch.label }; R.sec = 'ev';
  ch.run(R); G.pendingEvent = null; G.pressure = calcPressure(); G.stage = 'resolving';
  finishRound(); return true;
}

/* ---------------- Fim de rodada / desfecho ---------------- */
function finishRound() {
  const R = G.R, D = D_();
  R.sec = 'fim';
  let out = null;
  if (R.interv) { out = doIntervention(false); }
  // ação desesperada
  if (!out && G.agit > 80 && rnd() < (G.agit - 80) * .02 * D.desp) {
    if (rnd() < (D.violent || .55)) {
      const h = addHurt(1), dead = h && rnd() < .25 * D.lethal ? addDead(1) : 0; addAgit(-10);
      L(R, 'bad', 'shot', `AÇÃO DESESPERADA: o líder dispara contra a parede e agride um refém${dead ? ', que não sobrevive' : h ? ', que fica ferido' : ''}. A tensão se esvazia por um instante (agitação −10).`);
    } else {
      L(R, 'bad', 'road', 'AÇÃO DESESPERADA: o líder tenta romper o perímetro em direção à rota de fuga!');
      out = doEscape('desespero');
    }
  }
  if (!out && G.nego.step === 5 && G.agit <= D.ret) out = doSurrender();
  if (!out && G.vault >= 100) { L(R, 'bad', 'bank', 'O cofre foi aberto. Com o butim, o grupo parte para a fuga!'); out = doEscape('cofre'); }
  if (!out && G.round >= 6 && G.stk.prefeito.lost && G.stk.prefeito.sat <= 15) { L(R, 'bad', 'mayor', 'ORDEM POLÍTICA: o prefeito determina a intervenção imediata, contra a sua recomendação técnica.'); out = doIntervention(true); }
  if (!out && G.round >= MAX_ROUNDS) out = doUltimatum();
  // manutenção de fim de rodada
  syncHL(R);
  R.s1 = snap();
  const rec = { r: G.round, time: fmtTime(G.round), decs: R.decs, lines: R.lines.slice(), ev: R.ev, s0: R.s0, s1: R.s1, interv: !!R.interv };
  G.log.push(rec);
  G.hist.push({ r: G.round, agit: Math.round(G.agit), media: Math.round(G.media), vault: Math.round(G.vault), credits: G.credits, cov: R.s1.cov, p: G.pressure });
  if (out) {
    G.end = out; G.stage = 'result'; G.phase = 'siege'; R.out = out;
    computeScore(); saveGame(); return { outcome: out };
  }
  // upkeep
  G.team.forEach(id => {
    if (isAway(id)) { G.away[id]--; return; }
    const z = G.az[id];
    if (z === 'reserva') { if (getNegotiator() === id && R.decs.some(d => d.kind === 'nego')) G.fat[id] = (G.fat[id] || 0) + .5; else G.fat[id] = 0; }
    else G.fat[id] = (G.fat[id] || 0) + 1;
    G.transit[id] = Math.max(0, (+G.transit[id] || 0) - 1);
    G.stats.minFF = Math.min(G.stats.minFF, ff(id));
  });
  Object.keys(G.support).forEach(z => { if (G.support[z].left > 0) G.support[z].left--; });
  if (G.exposed > 0) G.exposed--;
  if (G.powerCut > 0) G.powerCut--;
  if (G.calm > 0) G.calm = Math.max(0, G.calm - 10);
  if (G.fatCrit && !deployed().some(id => (G.fat[id] || 0) >= 2)) G.fatCrit = false;
  if (G.deadlineLeft > 0) {
    G.deadlineLeft--;
    if (G.deadlineLeft === 0) { stake('prefeito', -15); addMedia(10); L(R, 'bad', 'clock', 'O prazo do noticiário venceu sem desfecho: o prefeito perde 15 pontos e a mídia sobe +10.'); }
  }
  G.pressure = calcPressure();
  G.stage = 'result'; saveGame();
  return { next: true };
}

/* ---------------- Visão da sacada (Pausa de Comando) ---------------- */
function sacadaView() {
  const out = [], toc = tocConstraint();
  out.push(`Restrição atual do sistema: ${toc.label}. ${toc.why}`);
  const w = STK_KEYS.slice().sort((a, b) => G.stk[b].sem - G.stk[a].sem)[0];
  if (G.stk[w].sem >= 1) out.push(`${STK[w].nome} está há ${G.stk[w].sem} rodada${G.stk[w].sem > 1 ? 's' : ''} sem atenção do comando e sua satisfação é ${Math.round(G.stk[w].sat)}. O barulhento nem sempre é o mais saliente: revise quem pode virar problema.`);
  const topEv = Object.entries(G.ev).sort((a, b) => b[1] - a[1])[0];
  if (topEv && topEv[1] >= 1.5) out.push(`Os relatos de campo convergem para ${ZONE[topEv[0]].nome} (${topEv[1].toFixed(1)} indícios ponderados). Cuidado: relatos de baixa confiança também contam e podem ser ruído.`);
  else out.push('Os relatos de campo ainda não convergem para uma rota. Cada agente só vê o que está na sua zona: informação distribuída precisa ser integrada por você.');
  const hot = G.agit > 70 ? 'A agitação do líder está em zona de risco: a negociação é a única alavanca que reduz o risco aos reféns sem custo tático.' : G.pressure > 70 ? 'A pressão sobre a equipe passou da zona ótima: a eficiência cai com pressão alta demais. Um respiro ajuda.' : G.pressure < 30 ? 'A pressão está baixa demais: a equipe pode estar em modo complacente.' : 'A pressão da equipe está na zona produtiva.';
  out.push(hot);
  return out.slice(0, 4);
}
