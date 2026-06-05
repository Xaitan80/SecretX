const BONUS_SYMBOL = "🏴‍☠️";

const symbols = [
  { value: "7", weight: 4 },
  { value: BONUS_SYMBOL, weight: 2 },
  { value: "X", weight: 7 },
  { value: "$", weight: 10 },
  { value: "#", weight: 13 },
  { value: "*", weight: 18 },
  { value: "O", weight: 22 },
];

const payouts = {
  "777": 200,
  XXX: 75,
  "$$$": 40,
};

const MUST_HIT_BY = 8000;
const JACKPOT_RESET_MIN = 100;
const JACKPOT_RESET_MAX = 7000;

const state = {
  credits: 1000,
  bet: 25,
  lastWin: 0,
  jackpot: createJackpotReset(),
  mustHitBy: MUST_HIT_BY,
  mustHitBonusTriggered: false,
  spinning: false,
  fastStopRequested: false,
  jackpotCheatRequested: false,
};

const reels = [...document.querySelectorAll(".reel")];
const creditsEl = document.querySelector("#credits");
const betEl = document.querySelector("#bet");
const lastWinEl = document.querySelector("#last-win");
const jackpotEl = document.querySelector("#jackpot");
const mustHitByEl = document.querySelector("#must-hit-by");
const messageEl = document.querySelector("#message");
const spinButton = document.querySelector("#spin");
const decreaseBetButton = document.querySelector("#decrease-bet");
const increaseBetButton = document.querySelector("#increase-bet");
const maxBetButton = document.querySelector("#max-bet");
const resetButton = document.querySelector("#reset");
let stopCurrentReel = null;
let currentSpinResult = null;

function weightedSymbol() {
  const totalWeight = symbols.reduce((total, symbol) => total + symbol.weight, 0);
  let roll = secureRandom() * totalWeight;

  for (const symbol of symbols) {
    roll -= symbol.weight;
    if (roll <= 0) {
      return symbol.value;
    }
  }

  return symbols.at(-1).value;
}

function secureRandom() {
  if (!window.crypto?.getRandomValues) {
    return Math.random();
  }

  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return values[0] / 2 ** 32;
}

function randomInt(min, max) {
  return Math.floor(secureRandom() * (max - min + 1)) + min;
}

function createJackpotReset() {
  return randomInt(JACKPOT_RESET_MIN, JACKPOT_RESET_MAX);
}

function formatCredits(value) {
  return Number.isInteger(value) ? value : value.toFixed(2);
}

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`.trim();
}

function updateUi() {
  creditsEl.textContent = formatCredits(state.credits);
  betEl.textContent = state.bet;
  lastWinEl.textContent = formatCredits(state.lastWin);
  jackpotEl.textContent = formatCredits(state.jackpot);
  mustHitByEl.textContent = state.mustHitBy;

  const canSpin = state.credits >= state.bet && !state.spinning;
  spinButton.disabled = !canSpin;
  decreaseBetButton.disabled = state.spinning || state.bet <= 5;
  increaseBetButton.disabled = state.spinning || state.bet >= 100 || state.bet + 5 > state.credits;
  maxBetButton.disabled = state.spinning || state.credits < 5;
  resetButton.disabled = state.spinning;
}

function evaluate(result) {
  const line = result.join("");

  if (result.every((symbol) => symbol === BONUS_SYMBOL)) {
    return {
      multiplier: 0,
      text: "Bonus game triggered.",
      bonus: true,
    };
  }

  if (payouts[line]) {
    return {
      multiplier: payouts[line],
      text: line === "777" ? "Vault jackpot!" : "Three of a kind.",
      jackpot: line === "777",
    };
  }

  if (result.every((symbol) => symbol === result[0])) {
    return { multiplier: 12, text: "Three matching symbols." };
  }

  const hasPair = new Set(result).size === 2;
  if (hasPair) {
    return { multiplier: 2, text: "Two matching symbols." };
  }

  return { multiplier: 0, text: "No match this spin." };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForReel(ms) {
  if (state.fastStopRequested) {
    return delay(80);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      stopCurrentReel = null;
      resolve();
    }, ms);

    stopCurrentReel = () => {
      clearTimeout(timeout);
      stopCurrentReel = null;
      resolve();
    };
  });
}

function requestFastStop() {
  if (!state.spinning || state.fastStopRequested) {
    return;
  }

  state.fastStopRequested = true;
  setMessage("Fast stop engaged.");
  stopCurrentReel?.();
}

function requestJackpotCheat() {
  if (!state.spinning || !currentSpinResult) {
    return;
  }

  state.jackpotCheatRequested = true;
  currentSpinResult.fill("7");
  setMessage("Test jackpot forced.");
  requestFastStop();
}
function requestBonusCheat() {
  if (!state.spinning || !currentSpinResult) {
    return;
  }

  state.jackpotCheatRequested = true;
  currentSpinResult.fill(BONUS_SYMBOL);
  setMessage("Test bonus forced.");
  requestFastStop();
}

async function spin() {
  if (state.spinning || state.credits < state.bet) {
    return;
  }

  state.spinning = true;
  state.fastStopRequested = false;
  state.jackpotCheatRequested = false;
  state.credits -= state.bet;
  state.lastWin = 0;
  setMessage("Reels are spinning...");
  updateUi();

  reels.forEach((reel) => reel.classList.add("spinning"));

  const jackpotContribution = state.bet * 0.05;
  const mustHitTriggered =
    !state.mustHitBonusTriggered && state.jackpot + jackpotContribution >= state.mustHitBy;
  const result = mustHitTriggered
    ? [BONUS_SYMBOL, BONUS_SYMBOL, BONUS_SYMBOL]
    : [weightedSymbol(), weightedSymbol(), weightedSymbol()];
  currentSpinResult = result;

  for (let index = 0; index < reels.length; index += 1) {
    await waitForReel(620 + index * 360);
    const reel = reels[index];
    reel.classList.remove("spinning");
    reel.querySelector(".symbol").textContent = result[index];
  }

  const outcome = evaluate(result);
  const regularWin = state.bet * outcome.multiplier;
  const jackpotAward = state.jackpot;
  const win = outcome.jackpot ? regularWin + jackpotAward : regularWin;

  state.lastWin = win;
  state.credits += win;
  if (outcome.jackpot) {
    state.jackpot = createJackpotReset();
    state.mustHitBy = MUST_HIT_BY;
    state.mustHitBonusTriggered = false;
  } else {
    state.jackpot += jackpotContribution;
    if (mustHitTriggered) {
      state.mustHitBonusTriggered = true;
    }
  }

  state.spinning = false;
  state.fastStopRequested = false;
  currentSpinResult = null;
  setMessage(
    state.jackpotCheatRequested
      ? `Test jackpot forced. You won ${formatCredits(win)} credits.`
      : mustHitTriggered
      ? "Must hit by triggered the bonus game."
      : outcome.bonus
        ? "Three Jolly Rogers triggered the bonus game."
      : win > 0
        ? `${outcome.text} You won ${formatCredits(win)} credits.`
        : `${outcome.text} Try again.`,
    win > 0 || outcome.bonus ? "win" : "loss",
  );

  if (state.credits < 5) {
    setMessage("Out of credits. Reset to play again.", "loss");
  }

  state.jackpotCheatRequested = false;
  updateUi();
}

function changeBet(amount) {
  const nextBet = Math.min(100, Math.max(5, state.bet + amount));
  state.bet = Math.min(nextBet, Math.max(5, state.credits));
  updateUi();
}

function resetGame() {
  state.credits = 1000;
  state.bet = 25;
  state.lastWin = 0;
  state.jackpot = createJackpotReset();
  state.mustHitBy = MUST_HIT_BY;
  state.mustHitBonusTriggered = false;
  state.spinning = false;
  state.fastStopRequested = false;
  state.jackpotCheatRequested = false;
  currentSpinResult = null;
  stopCurrentReel?.();
  reels.forEach((reel, index) => {
    reel.classList.remove("spinning");
    reel.querySelector(".symbol").textContent = ["7", "X", "$"][index];
  });
  setMessage("Choose a bet and spin the vault.");
  updateUi();
}

spinButton.addEventListener("click", spin);
decreaseBetButton.addEventListener("click", () => changeBet(-5));
increaseBetButton.addEventListener("click", () => changeBet(5));
maxBetButton.addEventListener("click", () => {
  state.bet = Math.min(100, Math.max(5, state.credits));
  updateUi();
});
resetButton.addEventListener("click", resetGame);

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (state.spinning) {
      requestFastStop();
      return;
    }

    spin();
  }

  if (event.code === "KeyJ") {
    event.preventDefault();
    requestJackpotCheat();
  }
  if (event.code == "KeyB") {
    event.preventDefault();
    requestBonusCheat();
  }
});

updateUi();
