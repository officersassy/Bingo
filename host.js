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
  winnerRestart: document.getElementById("winnerRestartButton"),
  statPlayers: document.getElementById("statPlayers"),
  statCalled: document.getElementById("statCalled"),
  statRemaining: document.getElementById("statRemaining"),
  statElapsed: document.getElementById("statElapsed"),
  statAverage: document.getElementById("statAverage"),
  statStage: document.getElementById("statStage"),
  historySummary: document.getElementById("historySummary"),
  sassy: document.getElementById("generalSassyMessage")
};

let state = {
  status: "joining",
  joiningOpen: true,
  locked: false,
  gameMode: "progressive",
  progressiveStage: "one-line"
};
let calledNumbers = [];
let callTimes = [];
let currentWinner = null;
let startedAt = null;
let knownPlayerIds = new Set();
let playerListInitialised = false;

const sassyCallLines = [
  "Eyes down. General Sassy has entered the numbers into active service.",
  "No, shouting ‘nearly’ does not count as a tactical update.",
  "Someone is one number away. Statistically. Emotionally, who knows?",
  "General Sassy reminds you that luck is not a personality trait.",
  "Keep dabbing, recruits. Panic is not a recognised Bingo strategy.",
  "That next number could make a champion—or ruin someone’s evening.",
  "If your card looks terrible, blame probability. General Sassy is flawless.",
  "The room is getting tense. General Sassy finds this deeply entertaining."
];

const sassyRestartLines = [
  "Fresh campaign declared. New cards, cleared dabs, same questionable luck.",
  "General Sassy has wiped the battlefield clean. Pretend the last round never happened.",
  "New cards issued. Complaints have been filed directly into the bin.",
  "Reset complete. Everyone gets another chance to disappoint probability."
];

function pick(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

async function broadcastSassy(message, event = "comment") {
  if (els.sassy) els.sassy.textContent = `“${message}”`;
  try {
    await set(ref(database, "bingo/generalSassy"), {
      message,
      event,
      time: Date.now()
    });
  } catch (error) {
    console.error("General Sassy broadcast failed:", error);
  }
}

// Host section tabs keep the dashboard usable without page scrolling.
const hostTabs = document.querySelectorAll("[data-host-tab]");
const hostViews = document.querySelectorAll("[data-host-view]");

function openHostView(viewName) {
  hostTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.hostTab === viewName);
  });
  hostViews.forEach((view) => {
    view.classList.toggle("active", view.dataset.hostView === viewName);
  });
}

hostTabs.forEach((tab) => {
  tab.addEventListener("click", () => openHostView(tab.dataset.hostTab));
});

onValue(ref(database, "bingo/generalSassy"), (snap) => {
  const data = snap.val();
  if (data?.message && els.sassy) els.sassy.textContent = `“${data.message}”`;
});

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


function formatDuration(milliseconds) {
  if (!milliseconds || milliseconds < 0) return "00:00";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateStatistics() {
  const playerTotal = Number(els.count?.textContent || 0);
  if (els.statPlayers) els.statPlayers.textContent = String(playerTotal);
  if (els.statCalled) els.statCalled.textContent = String(calledNumbers.length);
  if (els.statRemaining) els.statRemaining.textContent = String(Math.max(0, 75 - calledNumbers.length));
  if (els.statStage) els.statStage.textContent = stageName(activeTarget());
  if (els.historySummary) els.historySummary.textContent = `${calledNumbers.length} of 75`;

  if (els.statElapsed) {
    const running = startedAt && ["playing", "stage-winner", "winner"].includes(state.status);
    els.statElapsed.textContent = running ? formatDuration(Date.now() - startedAt) : "00:00";
  }

  if (els.statAverage) {
    if (callTimes.length < 2) {
      els.statAverage.textContent = "—";
    } else {
      const sorted = [...callTimes].sort((a, b) => a - b);
      const averageMs = (sorted[sorted.length - 1] - sorted[0]) / (sorted.length - 1);
      els.statAverage.textContent = `${Math.max(1, Math.round(averageMs / 1000))}s`;
    }
  }
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
  startedAt = Number(game.startedAt || game.createdAt || 0) || null;
  updateControls();
  updateStatistics();
});

onValue(playersRef, (snap) => {
  const entries = Object.entries(snap.val() || {});
  const currentIds = new Set(entries.map(([id]) => id));
  if (playerListInitialised) {
    const newcomers = entries.filter(([id]) => !knownPlayerIds.has(id));
    if (newcomers.length === 1) {
      const newcomer = newcomers[0][1];
      broadcastSassy(`${newcomer.name || "A fresh recruit"} has joined the ranks. Try to look lucky.`, "join");
    } else if (newcomers.length > 1) {
      broadcastSassy(`${newcomers.length} new recruits have arrived. General Sassy is pretending not to be impressed.`, "join");
    }
  }
  knownPlayerIds = currentIds;
  playerListInitialised = true;
  els.count.textContent = String(entries.length);
  updateStatistics();
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
        const playerName = player.name || id;
        const warnings = [
          `Boot ${playerName} from Bingo Night? Their card is about to become ancient history.`,
          `Send ${playerName} to the naughty corner? This removes their card and dabs.`,
          `Evict ${playerName}? Harsh… but the host has spoken.`,
          `Remove ${playerName} from the game? Their Bingo privileges will be dramatically revoked.`
        ];
        if (!confirm(warnings[Math.floor(Math.random() * warnings.length)])) return;
        const kickLines = [
          `General Sassy has discharged ${playerName} from Bingo duty.`,
          `${playerName} has been escorted from the battlefield—with dramatic efficiency.`,
          `General Sassy said “not today,” and ${playerName} is officially out.`,
          `${playerName}'s Bingo privileges have been revoked by command of General Sassy.`
        ];
        const kickMessage = pick(kickLines);
        await set(ref(database, `bingo/kickedPlayers/${id}`), {
          message: kickMessage,
          time: Date.now()
        });
        await remove(ref(database, `bingo/players/${id}`));
        await broadcastSassy(kickMessage, "kick");
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
  callTimes = calls.map((call) => Number(call?.calledAt || call?.time || 0)).filter((time) => time > 0);
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
  updateStatistics();
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
  if (els.sassy) {
    els.sassy.textContent = `“General Sassy salutes ${currentWinner.name || "the winner"}. Everyone else, regroup.”`;
  }

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

els.open.addEventListener("click", async () => {
  await update(bingoRef, { status: "joining", joiningOpen: true, locked: false });
  await broadcastSassy("Recruitment is open. Step forward, brave dabbers.", "joining-open");
});

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
  await broadcastSassy("Eyes down, recruits. General Sassy is now in command of the balls.", "game-start");
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
    const nextCount = calledNumbers.length + 1;
    if (nextCount === 1 || nextCount % 6 === 0) {
      await broadcastSassy(pick(sassyCallLines), "call-comment");
    }
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
  await broadcastSassy(`One prize down. General Sassy now demands ${stageName(nextStage)}. Keep dabbing.`, "stage-continue");
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
      generalSassy: {
        message: pick(sassyRestartLines),
        event: "restart",
        time: Date.now()
      },
      kickedPlayers: null,
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

setInterval(updateStatistics, 1000);

initialise().catch((error) => {
  console.error(error);
  els.status.textContent = "Firebase connection failed.";
});
