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
  historySummary: document.getElementById("historySummary")
};

let state = { status: "joining", joiningOpen: true, locked: false, gameMode: "progressive", progressiveStage: "one-line" };
let calledNumbers = [];
let callTimes = [];
let startedAt = null;
let currentWinner = null;

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function columnRange(column) {
  if (column === 0) return [1, 9];
  if (column === 8) return [80, 90];
  return [column * 10, column * 10 + 9];
}

function randomUnique(min, max, count) {
  return shuffle(Array.from({ length: max - min + 1 }, (_, index) => min + index))
    .slice(0, count)
    .sort((a, b) => a - b);
}

function create90BallTicket() {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const columnCounts = Array(9).fill(1);
    let remaining = 6;
    while (remaining > 0) {
      const column = Math.floor(Math.random() * 9);
      if (columnCounts[column] < 3) {
        columnCounts[column] += 1;
        remaining -= 1;
      }
    }

    const occupied = Array.from({ length: 3 }, () => Array(9).fill(false));
    const rowCounts = [0, 0, 0];
    let valid = true;
    const order = shuffle(Array.from({ length: 9 }, (_, index) => index))
      .sort((a, b) => columnCounts[b] - columnCounts[a]);

    for (const column of order) {
      const count = columnCounts[column];
      const combos = count === 3 ? [[0, 1, 2]] : count === 2
        ? shuffle([[0, 1], [0, 2], [1, 2]])
        : shuffle([[0], [1], [2]]);
      const choice = combos.find((combo) => combo.every((row) => rowCounts[row] < 5));
      if (!choice) {
        valid = false;
        break;
      }
      choice.forEach((row) => {
        occupied[row][column] = true;
        rowCounts[row] += 1;
      });
    }

    if (!valid || rowCounts.some((count) => count !== 5)) continue;

    const ticket = Array.from({ length: 3 }, () => Array(9).fill(null));
    for (let column = 0; column < 9; column += 1) {
      const rows = [0, 1, 2].filter((row) => occupied[row][column]);
      const [min, max] = columnRange(column);
      const numbers = randomUnique(min, max, rows.length);
      rows.forEach((row, index) => { ticket[row][column] = numbers[index]; });
    }
    return ticket.flat();
  }
  throw new Error("Unable to generate a valid 90-ball ticket.");
}

function numberFrom(call) {
  if (typeof call === "number") return call;
  if (call && typeof call === "object" && Number.isFinite(Number(call.number))) return Number(call.number);
  const text = typeof call === "string" ? call : call?.call;
  const match = typeof text === "string" ? text.match(/\d+/) : null;
  return match ? Number(match[0]) : null;
}

function callText(call) {
  if (typeof call === "number") return String(call);
  return typeof call === "string" ? call : call?.call || "--";
}

function stageName(stage) {
  return ({ "one-line": "One Line", "two-lines": "Two Lines", "full-house": "Full House" })[stage] || "One Line";
}

function modeName(mode) {
  return ({ progressive: "Progressive 90-Ball", "one-line": "One Line", "two-lines": "Two Lines", "full-house": "Full House" })[mode] || "Progressive 90-Ball";
}

function activeTarget() {
  return state.gameMode === "progressive" ? state.progressiveStage : state.gameMode;
}

function modeDescription(mode) {
  return ({
    progressive: "One continuous 90-ball round: One Line, then Two Lines, then Full House. Tickets, dabs and called numbers carry forward.",
    "one-line": "90-ball ticket: complete any one row.",
    "two-lines": "90-ball ticket: complete any two rows.",
    "full-house": "90-ball ticket: dab all 15 numbers."
  })[mode] || "One continuous 90-ball progressive round.";
}

function formatDuration(milliseconds) {
  if (!milliseconds || milliseconds < 0) return "00:00";
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function updateStatistics() {
  const players = Number(els.count?.textContent || 0);
  if (els.statPlayers) els.statPlayers.textContent = String(players);
  if (els.statCalled) els.statCalled.textContent = String(calledNumbers.length);
  if (els.statRemaining) els.statRemaining.textContent = String(Math.max(0, 90 - calledNumbers.length));
  if (els.statStage) els.statStage.textContent = stageName(activeTarget());
  if (els.historySummary) els.historySummary.textContent = `${calledNumbers.length} of 90`;
  if (els.statElapsed) {
    const running = startedAt && ["playing", "stage-winner", "winner"].includes(state.status);
    els.statElapsed.textContent = running ? formatDuration(Date.now() - startedAt) : "00:00";
  }
  if (els.statAverage) {
    if (callTimes.length < 2) els.statAverage.textContent = "—";
    else {
      const times = [...callTimes].sort((a, b) => a - b);
      els.statAverage.textContent = `${Math.max(1, Math.round(((times.at(-1) - times[0]) / (times.length - 1)) / 1000))}s`;
    }
  }
}

function updateControls() {
  els.open.disabled = state.status === "joining" && state.joiningOpen;
  els.start.disabled = ["playing", "stage-winner", "winner"].includes(state.status);
  els.call.disabled = state.status !== "playing" || state.locked || calledNumbers.length >= 90;
  els.mode.disabled = ["playing", "stage-winner", "winner"].includes(state.status);
  els.mode.value = state.gameMode;
  els.modeDesc.textContent = modeDescription(state.gameMode);
}

async function initialise() {
  const snap = await get(bingoRef);
  if (!snap.exists()) {
    await set(bingoRef, { gameId: `game-${Date.now()}`, status: "joining", joiningOpen: true, locked: false, gameMode: "progressive", progressiveStage: "one-line", ballCount: 90, createdAt: Date.now() });
    return;
  }
  const game = snap.val();
  const patch = {};
  if (!game.gameId) patch.gameId = `game-${Date.now()}`;
  if (!game.status) patch.status = "joining";
  if (game.joiningOpen === undefined) patch.joiningOpen = true;
  if (game.locked === undefined) patch.locked = false;
  if (!game.gameMode || game.gameMode === "four-corners") patch.gameMode = "progressive";
  if (!game.progressiveStage) patch.progressiveStage = "one-line";
  if (game.ballCount !== 90) patch.ballCount = 90;
  if (Object.keys(patch).length) await update(bingoRef, patch);
}

onValue(bingoRef, (snap) => {
  const game = snap.val() || {};
  state = {
    status: game.status || "joining",
    joiningOpen: game.joiningOpen !== false,
    locked: Boolean(game.locked),
    gameMode: game.gameMode === "four-corners" ? "progressive" : (game.gameMode || "progressive"),
    progressiveStage: game.progressiveStage || "one-line"
  };
  const target = stageName(activeTarget());
  if (state.status === "playing") els.status.textContent = `${modeName(state.gameMode)} — playing for ${target}`;
  else if (state.status === "stage-winner") els.status.textContent = `${target} winner announced — continue when ready`;
  else if (state.status === "winner") els.status.textContent = `Final winner announced — ${target}`;
  else els.status.textContent = `${state.joiningOpen ? "Joining open" : "Joining closed"} — ${modeName(state.gameMode)}`;
  startedAt = Number(game.startedAt || game.createdAt || 0) || null;
  updateControls();
  updateStatistics();
});

onValue(playersRef, (snap) => {
  const entries = Object.entries(snap.val() || {});
  els.count.textContent = String(entries.length);
  updateStatistics();
  els.list.innerHTML = "";
  if (!entries.length) {
    els.list.textContent = "No players yet.";
    return;
  }
  entries.sort((a, b) => String(a[1].name || "").localeCompare(String(b[1].name || ""))).forEach(([id, player]) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const name = document.createElement("span");
    name.textContent = `👤 ${player.name || id}`;
    const button = document.createElement("button");
    button.className = "mini danger";
    button.textContent = "Remove";
    button.addEventListener("click", async () => {
      if (confirm(`Remove ${player.name || id}?`)) await remove(ref(database, `bingo/players/${id}`));
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
  callTimes = calls.map((call) => Number(call?.calledAt || call?.time || 0)).filter(Boolean);
  const newest = [...calls].reverse();
  const draw = (container, items) => {
    container.innerHTML = "";
    items.forEach((call) => {
      const ball = document.createElement("div");
      ball.className = "called";
      ball.textContent = callText(call);
      container.appendChild(ball);
    });
  };
  draw(els.last, newest.slice(0, 10));
  draw(els.all, newest);
  updateControls();
  updateStatistics();
});

onValue(winnerRef, (snap) => {
  currentWinner = snap.val();
  if (!currentWinner) {
    els.popup.classList.remove("show");
    return;
  }
  els.winnerName.textContent = `${currentWinner.name || "A player"} has won ${stageName(currentWinner.stage || activeTarget())}!`;
  els.popup.classList.add("show");
  const canContinue = state.gameMode === "progressive" && (currentWinner.stage || activeTarget()) !== "full-house";
  els.winnerContinue.style.display = canContinue ? "inline-flex" : "none";
});

els.mode.addEventListener("change", async () => {
  await update(bingoRef, { gameMode: els.mode.value, progressiveStage: "one-line", ballCount: 90 });
});
els.open.addEventListener("click", () => update(bingoRef, { status: "joining", joiningOpen: true, locked: false }));
els.start.addEventListener("click", async () => {
  if (!(await get(playersRef)).exists()) {
    alert("No players have joined yet.");
    return;
  }
  await update(bingoRef, { status: "playing", joiningOpen: false, locked: false, gameMode: els.mode.value, progressiveStage: "one-line", ballCount: 90, startedAt: Date.now() });
});
els.call.addEventListener("click", async () => {
  if (state.status !== "playing" || state.locked || calledNumbers.length >= 90) return;
  let number;
  do number = Math.floor(Math.random() * 90) + 1;
  while (calledNumbers.includes(number));
  const data = { call: String(number), number, calledAt: Date.now() };
  await set(currentRef, data);
  await push(callsRef, data);
});
els.closeWinner.addEventListener("click", () => els.popup.classList.remove("show"));
els.winnerContinue.addEventListener("click", async () => {
  const currentStage = currentWinner?.stage || state.progressiveStage;
  const nextStage = currentStage === "one-line" ? "two-lines" : "full-house";
  await remove(winnerRef);
  await update(bingoRef, { status: "playing", locked: false, progressiveStage: nextStage });
  els.popup.classList.remove("show");
});

async function resetGame() {
  if (!confirm("Force restart? Every player will receive a new 90-ball ticket and all dabs/calls will be cleared.")) return;
  const players = (await get(playersRef)).val() || {};
  const gameId = `game-${Date.now()}`;
  const freshPlayers = {};
  Object.entries(players).forEach(([id, player]) => {
    freshPlayers[id] = { ...player, card: create90BallTicket(), marked: null, gameId, ticketType: "90-ball", cardCreatedAt: Date.now() };
  });
  await set(bingoRef, { gameId, status: "joining", joiningOpen: true, locked: false, gameMode: els.mode.value || "progressive", progressiveStage: "one-line", ballCount: 90, createdAt: Date.now(), restartTime: Date.now(), players: freshPlayers });
  els.popup.classList.remove("show");
}
els.reset.addEventListener("click", resetGame);
els.winnerRestart.addEventListener("click", resetGame);

setInterval(updateStatistics, 1000);
initialise().catch(console.error);
