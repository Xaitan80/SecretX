const symbols = [
  { value: "7", weight: 4 },
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

const state = {
  credits: 1000,
  bet: 25,
  lastWin: 0,
  jackpot: 5000,
  spinning: false,
};

const reels = [...document.querySelectorAll(".reel")];
const creditsEl = document.querySelector("#credits");
const betEl = document.querySelector("#bet");
const lastWinEl = document.querySelector("#last-win");
const jackpotEl = document.querySelector("#jackpot");
const messageEl = document.querySelector("#message");
const spinButton = document.querySelector("#spin");
const decreaseBetButton = document.querySelector("#decrease-bet");
const increaseBetButton = document.querySelector("#increase-bet");
const maxBetButton = document.querySelector("#max-bet");
const resetButton = document.querySelector("#reset");

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

function setMessage(text, type = "") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`.trim();
}

function updateUi() {
  creditsEl.textContent = state.credits;
  betEl.textContent = state.bet;
  lastWinEl.textContent = state.lastWin;
  jackpotEl.textContent = state.jackpot;

  const canSpin = state.credits >= state.bet && !state.spinning;
  spinButton.disabled = !canSpin;
  decreaseBetButton.disabled = state.spinning || state.bet <= 5;
  increaseBetButton.disabled = state.spinning || state.bet >= 100 || state.bet + 5 > state.credits;
  maxBetButton.disabled = state.spinning || state.credits < 5;
  resetButton.disabled = state.spinning;
}

function evaluate(result) {
  const line = result.join("");

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

async function spin() {
  if (state.spinning || state.credits < state.bet) {
    return;
  }

  state.spinning = true;
  state.credits -= state.bet;
  state.lastWin = 0;
  setMessage("Reels are spinning...");
  updateUi();

  reels.forEach((reel) => reel.classList.add("spinning"));

  const result = [weightedSymbol(), weightedSymbol(), weightedSymbol()];

  for (let index = 0; index < reels.length; index += 1) {
    await delay(620 + index * 360);
    const reel = reels[index];
    reel.classList.remove("spinning");
    reel.querySelector(".symbol").textContent = result[index];
  }

  const outcome = evaluate(result);
  const regularWin = state.bet * outcome.multiplier;
  const win = outcome.jackpot ? regularWin + state.jackpot : regularWin;

  state.lastWin = win;
  state.credits += win;
  if (outcome.jackpot) {
    state.jackpot = 5000;
  } else {
    state.jackpot += Math.ceil(state.bet * 0.2);
  }

  state.spinning = false;
  setMessage(
    win > 0 ? `${outcome.text} You won ${win} credits.` : `${outcome.text} Try again.`,
    win > 0 ? "win" : "loss",
  );

  if (state.credits < 5) {
    setMessage("Out of credits. Reset to play again.", "loss");
  }

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
  state.jackpot = 5000;
  state.spinning = false;
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
    spin();
  }
});

updateUi();
