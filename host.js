import { database } from "./firebase.js";
import { ref, get, set, update, push, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const bingoRef = ref(database, "bingo");
const playersRef = ref(database, "bingo/players");
const currentRef = ref(database, "bingo/currentCall");
const callsRef = ref(database, "bingo/calledNumbers");
const winnerRef = ref(database, "bingo/winner");

const els = {
  status: document.getElementById("gameStatus"),
  current: document.getElementById("currentNumber"),
  count: document.getElementById("playerCount"),
  list: document.getElementById("playerList"),
  last: document.getElementById("lastCalls"),
  all: document.getElementById("calledNumbers"),
  open: document.getElementById("openJoiningButton"),
  start: document.getElementById("startGameButton"),
  call: document.getElementById("callNumberButton"),
  reset: document.getElementById("resetGameButton"),
  mode: document.getElementById("gameModeSelect"),
  modeDesc: document.getElementById("gameModeDescription"),
  popup: document.getElementById("winnerPopup"),
  winnerName: document.getElementById("winnerName"),
  closeWinner: document.getElementById("closeWinnerButton"),
  winnerContinue: document.getElementById("winnerContinueButton"),
  winnerRestart: document.getElementById("winnerRestartButton")
};

let state = {
  status: "joining",
  joiningOpen: true,
  locked: false,
  gameMode: "progressive",
  progressiveStage: "one-line"
};
let calledNumbers = [];
let currentWinner = null;

function randomNumbers(min, max, count) {
  const out = [];
  while (out.length < count) {
    const number = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!out.includes(number)) out.push(number);
  }
  return out;
}

function createCard() {
  const columns = [
    randomNumbers(1, 15, 5), randomNumbers(16, 30, 5), randomNumbers(31, 45, 5),
    randomNumbers(46, 60, 5), randomNumbers(61, 75, 5)
  ];
  const card = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      card.push(row === 2 && column === 2 ? "FREE" : columns[column][row]);
    }
  }
  return card;
}

function letter(number) {
  return number <= 15 ? "B" : number <= 30 ? "I" : number <= 45 ? "N" : number <= 60 ? "G" : "O";
}

function numberFrom(call) {
  if (typeof call === "number") return call;
  if (call && typeof call === "object" && Number.isFinite(Number(call.number))) return Number(call.number);
  const text = typeof call === "string" ? call : call?.call;
  const match = typeof text === "string" ? text.match(/\d+/) : null;
  return match ? Number(match[0]) : null;
}

function callText(call) {
  return typeof call === "string" ? call : call?.call || "--";
}

function stageName(stage) {
  return ({ "one-line": "One Line", "two-lines": "Two Lines", "full-house": "Full House" })[stage] || "One Line";
}

function modeName(mode) {
  return ({
    progressive: "Progressive Game",
    "one-line": "One Line",
    "two-lines": "Two Lines",
    "four-corners": "Four Corners",
    "full-house": "Full House"
  })[mode] || "Progressive Game";
}

function activeTarget() {
  return state.gameMode === "progressive" ? state.progressiveStage : state.gameMode;
}

function modeDescription(mode) {
  return ({
    progressive: "One continuous round: first One Line, then Two Lines, then Full House. Cards, dabs and called numbers carry forward.",
    "one-line": "Complete any horizontal line.",
    "two-lines": "Complete any two horizontal lines.",
    "four-corners": "Dab all four corner numbers.",
    "full-house": "Dab every number on the card."
  })[mode] || "One continuous progressive round.";
}

function updateControls() {
  els.open.disabled = state.status === "joining" && state.joiningOpen;
  els.start.disabled = state.status === "playing" || state.status === "stage-winner" || state.status === "winner";
  els.call.disabled = state.status !== "playing" || state.locked || calledNumbers.length >= 75;
  els.mode.disabled = state.status === "playing" || state.status === "stage-winner" || state.status === "winner";
  els.mode.value = state.gameMode;
  els.modeDesc.textContent = modeDescription(state.gameMode);
}

async function initialise() {
  const snap = await get(bingoRef);
  if (!snap.exists()) {
    await set(bingoRef, {
      gameId: `game-${Date.now()}`,
      status: "joining",
      joiningOpen: true,
      locked: false,
      gameMode: "progressive",
      progressiveStage: "one-line",
      createdAt: Date.now()
    });
    return;
  }
  const game = snap.val();
  const patch = {};
  if (!game.gameId) patch.gameId = `game-${Date.now()}`;
  if (!game.status) patch.status = "joining";
  if (game.joiningOpen === undefined) patch.joiningOpen = true;
  if (game.locked === undefined) patch.locked = false;
  if (!game.gameMode) patch.gameMode = "progressive";
  if (!game.progressiveStage) patch.progressiveStage = "one-line";
  if (Object.keys(patch).length) await update(bingoRef, patch);
}

onValue(bingoRef, (snap) => {
  const game = snap.val() || {};
  state = {
    status: game.status || "joining",
    joiningOpen: game.joiningOpen !== false,
    locked: Boolean(game.locked),
    gameMode: game.gameMode || "progressive",
    progressiveStage: game.progressiveStage || "one-line"
  };

  const target = stageName(activeTarget());
  if (state.status === "playing") {
    els.status.textContent = `${modeName(state.gameMode)} — playing for ${target}`;
  } else if (state.status === "stage-winner") {
    els.status.textContent = `${target} winner announced — continue when ready`;
  } else if (state.status === "winner") {
    els.status.textContent = `Final winner announced — ${target}`;
  } else {
    els.status.textContent = `${state.joiningOpen ? "Joining open" : "Joining closed"} — ${modeName(state.gameMode)}`;
  }
  updateControls();
});

onValue(playersRef, (snap) => {
  const entries = Object.entries(snap.val() || {});
  els.count.textContent = String(entries.length);
  els.list.innerHTML = "";
  if (!entries.length) {
    els.list.textContent = "No players yet.";
    return;
  }

  entries
    .sort((a, b) => String(a[1].name || "").localeCompare(String(b[1].name || "")))
    .forEach(([id, player]) => {
      const row = document.createElement("div");
      row.className = "player-row";
      const name = document.createElement("span");
      name.textContent = `👤 ${player.name || id}`;
      const button = document.createElement("button");
      button.className = "mini danger";
      button.textContent = "Remove";
      button.addEventListener("click", async () => {
        if (!confirm(`Remove ${player.name || id}?`)) return;
        await remove(ref(database, `bingo/players/${id}`));
      });
      row.append(name, button);
      els.list.appendChild(row);
    });
});

onValue(currentRef, (snap) => {
  els.current.textContent = snap.exists() ? callText(snap.val()) : "--";
  if (snap.exists()) {
    els.current.classList.remove("number-pop");
    void els.current.offsetWidth;
    els.current.classList.add("number-pop");
  }
});

onValue(callsRef, (snap) => {
  const calls = Object.values(snap.val() || {});
  calledNumbers = [...new Set(calls.map(numberFrom).filter(Number.isFinite))];
  const newest = [...calls].reverse();
  const draw = (target, list) => {
    target.innerHTML = "";
    list.forEach((call) => {
      const ball = document.createElement("div");
      ball.className = "called";
      ball.textContent = callText(call);
      target.appendChild(ball);
    });
  };
  draw(els.last, newest.slice(0, 10));
  draw(els.all, newest);
  updateControls();
});

onValue(winnerRef, (snap) => {
  if (!snap.exists()) {
    currentWinner = null;
    els.popup.classList.remove("show");
    return;
  }

  currentWinner = snap.val();
  const wonStage = currentWinner.stage || currentWinner.gameMode || activeTarget();
  els.winnerName.textContent = `${currentWinner.name || "A player"} has won ${stageName(wonStage)}!`;

  const progressiveNotFinished =
    state.gameMode === "progressive" && wonStage !== "full-house";

  els.winnerContinue.style.display = progressiveNotFinished ? "inline-flex" : "none";
  els.winnerContinue.textContent = wonStage === "one-line"
    ? "Continue to Two Lines"
    : "Continue to Full House";

  els.popup.classList.add("show");
});

els.mode.addEventListener("change", async () => {
  if (["playing", "stage-winner", "winner"].includes(state.status)) return;
  await update(bingoRef, {
    gameMode: els.mode.value,
    progressiveStage: "one-line"
  });
});

els.open.addEventListener("click", () => update(bingoRef, {
  status: "joining",
  joiningOpen: true,
  locked: false
}));

els.start.addEventListener("click", async () => {
  const players = await get(playersRef);
  if (!players.exists()) {
    alert("No players have joined yet.");
    return;
  }
  await update(bingoRef, {
    status: "playing",
    joiningOpen: false,
    locked: false,
    gameMode: els.mode.value,
    progressiveStage: "one-line",
    startedAt: Date.now()
  });
});

els.call.addEventListener("click", async () => {
  if (state.status !== "playing" || state.locked) return;
  if (calledNumbers.length >= 75) {
    alert("All 75 numbers have been called.");
    return;
  }
  let number;
  do {
    number = Math.floor(Math.random() * 75) + 1;
  } while (calledNumbers.includes(number));

  const data = {
    call: `${letter(number)} ${number}`,
    number,
    calledAt: Date.now()
  };

  els.call.disabled = true;
  try {
    await set(currentRef, data);
    await push(callsRef, data);
  } finally {
    updateControls();
  }
});

async function continueProgressiveGame() {
  if (!currentWinner || state.gameMode !== "progressive") return;

  const wonStage = currentWinner.stage || state.progressiveStage;
  const nextStage = wonStage === "one-line" ? "two-lines" : "full-house";

  await remove(winnerRef);
  await update(bingoRef, {
    status: "playing",
    locked: false,
    progressiveStage: nextStage,
    stageStartedAt: Date.now()
  });
  els.popup.classList.remove("show");
}

async function resetGame() {
  if (!confirm("Restart the game? Every player gets a new card and all dabs/calls are cleared.")) return;
  els.reset.disabled = true;
  try {
    const playersSnap = await get(playersRef);
    const players = playersSnap.val() || {};
    const gameId = `game-${Date.now()}`;
    const freshPlayers = {};
    Object.entries(players).forEach(([id, player]) => {
      freshPlayers[id] = {
        ...player,
        card: createCard(),
        marked: null,
        gameId,
        locked: true,
        cardCreatedAt: Date.now()
      };
    });

    await set(bingoRef, {
      gameId,
      status: "joining",
      joiningOpen: true,
      locked: false,
      gameMode: els.mode.value || state.gameMode,
      progressiveStage: "one-line",
      createdAt: Date.now(),
      restartTime: Date.now(),
      players: freshPlayers
    });
    els.popup.classList.remove("show");
  } finally {
    els.reset.disabled = false;
  }
}

els.winnerContinue.addEventListener("click", continueProgressiveGame);
els.reset.addEventListener("click", resetGame);
els.winnerRestart.addEventListener("click", resetGame);
els.closeWinner.addEventListener("click", () => els.popup.classList.remove("show"));

initialise().catch((error) => {
  console.error(error);
  els.status.textContent = "Firebase connection failed.";
});
