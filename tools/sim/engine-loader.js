// Carrega data/story/engine/dash num contexto vm isolado, com PRNG com semente.
const vm = require('vm'), fs = require('fs'), path = require('path');
const SRC = process.env.PERI_SRC || path.join(__dirname, '..', '..', 'src');
const FILES = ['data.js', 'story.js', 'engine.js', 'dash.js'];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* Nomes expostos para os testes. Cada um é lido dentro do contexto da simulação; o que não existe numa versão antiga do código
   (usada pelo comparar.js) simplesmente fica de fora, em vez de derrubar o carregamento. */
const NAMES = `newGame startRound resolveDecisions chooseEvent finishRound addDecision removeDecision computeScore zoneCoverage intervProb intervPower negoParts negoSkill autoPlace confirmPerimeter phase1Intel
  stat agentEff ff fp deployed avail agentsIn plantaoCost apoioCost horasCost intelCost infoFrac knownCount etaVault vaultEtaN tocConstraint confidence calcPressure gradeOf
  saveGame loadSave validSave migrateSave clearSave SAVE_KEY adequateCount avgRouteCov getNegotiator hasGear isAway budgetForecast capacityPreview planPreview siegeAlerts milestones blindParts
  council stakeCall roundIntro headlines radioLines genReports sacadaView drawEvent doIntervention doSurrender doEscape doUltimatum ultimatumProb
  DIFF PROFILES AGENTS GENERICS EQUIP INTEL COMMS POSTURES STEPS STK STK_KEYS ZONES ZONE EVENT_DEFS EVENT_FX EVDEF BADGES HOSTAGE_LIST HOST TOCS
  ADEQ HOSTAGES MAX_ROUNDS APOIO_PRECOS agentById clamp fmtTime syncHL
  pressureFactor agentPressure equipFactor negoCalm resolveNego applyComm commMult stakePassives stakeWeights eficienciaCusto addAgit addMedia addHurt addDead stake
  moveAgent placeGear tocScores intelProb resolveIntel ivBand revealHint hostagesLeft evidenceMin agentsHurtIn PLANTAO_BASE PLANTAO_AGENTE CREDITOS_INICIAIS ROUND_MIN START_TIME
  ordemPolitica vidasScore leakChance perceivedAgit perceivedVault badgeEarned hostagesFramed scoreParts ultimatumView reposPreview spendBreakdown vaultEtaN runway burnToEnd snap trackKnown`.split(/\s+/).filter(Boolean);
const EXPOSE = `globalThis.__api = { get G() { return G; }, set G(v) { G = v; } };
${JSON.stringify(NAMES)}.forEach(n => { try { globalThis.__api[n] = eval(n); } catch (e) {} });`;
function load(seed, srcDir, extra) {
  const store = {};
  const sandbox = { console, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, _s: store }, performance: { now: () => 0 } };
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  const dir = srcDir || SRC;
  const code = FILES.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n') + '\n' + EXPOSE + (extra ? '\n' + extra : '');
  vm.runInContext(code, ctx, { filename: 'bundle.js' });
  const setRng = s => { sandbox.__rngfn = mulberry32(s >>> 0); vm.runInContext('Math.random = __rngfn;', ctx); };
  setRng(seed);
  const api = ctx.__api;
  api.reseed = setRng; api.store = store; api.sandbox = sandbox;   // sandbox: os testes de armazenamento trocam o localStorage por um que falha
  api.setRandom = f => { sandbox.__rngfn = f; vm.runInContext('Math.random = __rngfn;', ctx); };
  return api;
}
module.exports = { load, mulberry32 };
