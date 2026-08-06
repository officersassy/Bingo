import { database } from "./firebase.js";
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const playerId = localStorage.getItem("bingoPlayerId") || localStorage.getItem("bingoPlayer");
const els = {
  welcome: document.getElementById("welcomePlayer"),
  status: document.getElementById("playerStatus"),
  current: document.getElementById("playerCurrent"),
  card: document.getElementById("card"),
  bingo: document.getElementById("bingoButton"),
  popup: document.getElementById("winnerPopup"),
  winnerName: document.getElementById("winnerName"),
  closeWinner: document.getElementById("closeWinnerButton"),
  stageBadge: document.getElementById("stageBadge"),
  targetInstruction: document.getElementById("targetInstruction"),
  calledCount: document.getElementById("playerCalledCount"),
  dabbedCount: document.getElementById("playerDabbedCount")
};

let player = null;
let card = [];
let marked = [];
let called = [];
let gameId = null;
let lastWinnerKey = null;
let state = { status: "joining", locked: false, gameMode: "progressive", progressiveStage: "one-line" };

function arrayOf(value) {
  if (!value) return [];
  return Array.isArray(value) ? value.flat() : Object.values(value).flat();
}

function numberFrom(call) {
  if (typeof call === "number") return call;
  if (call && typeof call === "object" && Number.isFinite(Number(call.number))) return Number(call.number);
  const text = typeof call === "string" ? call : call?.call;
  const match = typeof text === "string" ? text.match(/\d+/) : null;
  return match ? Number(match[0]) : null;
}

function stageName(stage) {
  return ({ "one-line": "One Line", "two-lines": "Two Lines", "full-house": "Full House" })[stage] || "One Line";
}

function activeTarget() {
  return state.gameMode === "progressive" ? state.progressiveStage : state.gameMode;
}

function instruction(stage) {
  return ({
    "one-line": "Complete all 5 numbers in any one row.",
    "two-lines": "Complete all numbers in any two rows.",
    "full-house": "Dab all 15 numbers on your ticket."
  })[stage] || "Complete any one row.";
}

function show(message, type = "normal") {
  els.status.textContent = message;
  els.status.dataset.type = type;
}

function updatePlayerDashboard() {
  const target = activeTarget();
  els.stageBadge.textContent = stageName(target);
  els.targetInstruction.textContent = instruction(target);
  els.calledCount.textContent = String(called.length);
  els.dabbedCount.textContent = String(marked.length);
}

function clearStorage() {
  ["bingoPlayerId", "bingoPlayer", "bingoPlayerName", "bingoGameId"].forEach((key) => localStorage.removeItem(key));
}

function drawCard() {
  if (card.length !== 27) return;
  els.card.innerHTML = "";
  updatePlayerDashboard();
  card.forEach((value) => {
    const square = document.createElement("div");
    square.className = "number";
    if (value === null || value === "" || value === false) {
      square.classList.add("blank");
      square.setAttribute("aria-hidden", "true");
    } else {
      const number = Number(value);
      square.textContent = String(number);
      if (called.includes(number)) square.classList.add("called");
      if (marked.includes(number)) square.classList.add("selected");
      square.addEventListener("click", () => dab(number));
    }
    els.card.appendChild(square);
  });
}

async function dab(number) {
  if (state.status !== "playing" || state.locked) {
    show("The game is not open for dabbing.", "error");
    return;
  }
  if (!called.includes(number)) {
    show("That number has not been called yet.", "warning");
    return;
  }
  marked = marked.includes(number)
    ? marked.filter((value) => value !== number)
    : [...marked, number].sort((a, b) => a - b);
  drawCard();
  try {
    await set(ref(database, `bingo/players/${playerId}/marked`), marked.length ? marked : null);
  } catch (error) {
    console.error(error);
    show("Your dab could not be saved.", "error");
  }
}

function rowComplete(rowIndex) {
  const row = card.slice(rowIndex * 9, rowIndex * 9 + 9).filter((value) => value !== null && value !== "" && value !== false);
  return row.length === 5 && row.every((value) => marked.includes(Number(value)) && called.includes(Number(value)));
}

function validWin() {
  const target = activeTarget();
  const completeRows = [0, 1, 2].filter(rowComplete).length;
  if (target === "two-lines") return completeRows >= 2;
  if (target === "full-house") {
    const numbers = card.filter((value) => value !== null && value !== "" && value !== false).map(Number);
    return numbers.length === 15 && numbers.every((number) => marked.includes(number) && called.includes(number));
  }
  return completeRows >= 1;
}

els.bingo.addEventListener("click", async () => {
  const target = activeTarget();
  if (!player || state.status !== "playing" || state.locked) {
    show("The game is not ready for a Bingo claim.", "warning");
    return;
  }
  if (!validWin()) {
    show(`That is not a valid ${stageName(target)} yet.`, "error");
    return;
  }

  els.bingo.disabled = true;
  try {
    const winnerSnap = await get(ref(database, "bingo/winner"));
    if (winnerSnap.exists()) {
      show("A winner has already been submitted for this stage.", "warning");
      return;
    }
    const isFinal = state.gameMode !== "progressive" || target === "full-house";
    await set(ref(database, "bingo/winner"), {
      playerId,
      name: player.name || playerId,
      card,
      marked,
      gameId,
      gameMode: state.gameMode,
      stage: target,
      ticketType: "90-ball",
      claimedAt: Date.now(),
      verified: true
    });
    await update(ref(database, "bingo"), { status: isFinal ? "winner" : "stage-winner", locked: true });
  } finally {
    els.bingo.disabled = false;
  }
});

onValue(ref(database, `bingo/players/${playerId || "missing"}`), (snap) => {
  if (!playerId || !snap.exists()) {
    if (playerId) alert("You have been removed from the game.");
    clearStorage();
    window.location.href = "join.html";
    return;
  }
  const oldGameId = gameId;
  player = snap.val();
  card = arrayOf(player.card).map((value) => value === "null" ? null : value);
  marked = arrayOf(player.marked).map(Number).filter(Number.isFinite);
  gameId = player.gameId || null;
  els.welcome.textContent = `Welcome, ${player.name || playerId}`;
  if (oldGameId && gameId && oldGameId !== gameId) show("New round: your dabs were cleared and you received a fresh 90-ball ticket!", "success");
  drawCard();
});

onValue(ref(database, "bingo/currentCall"), (snap) => {
  const value = snap.val();
  els.current.textContent = value ? String(typeof value === "string" ? value : value.call || value.number || "--") : "--";
  if (value) {
    els.current.classList.remove("number-pop");
    void els.current.offsetWidth;
    els.current.classList.add("number-pop");
  }
});

onValue(ref(database, "bingo/calledNumbers"), (snap) => {
  called = [...new Set(Object.values(snap.val() || {}).map(numberFrom).filter(Number.isFinite))];
  drawCard();
});

onValue(ref(database, "bingo"), (snap) => {
  const game = snap.val() || {};
  state = {
    status: game.status || "joining",
    locked: Boolean(game.locked),
    gameMode: game.gameMode === "four-corners" ? "progressive" : (game.gameMode || "progressive"),
    progressiveStage: game.progressiveStage || "one-line"
  };
  updatePlayerDashboard();
  const target = stageName(activeTarget());
  if (state.status === "playing") show(`90-ball game: playing for ${target} — good luck!`, "success");
  else if (state.status === "stage-winner") show(`${target} winner announced. Waiting for the host to continue.`, "warning");
  else if (state.status === "winner") show(`Final ${target} winner announced.`, "warning");
  else show(`Waiting for host — 90-ball ${state.gameMode === "progressive" ? "Progressive Game" : target}.`);
});

onValue(ref(database, "bingo/winner"), (snap) => {
  if (!snap.exists()) {
    els.popup.classList.remove("show");
    lastWinnerKey = null;
    return;
  }
  const winner = snap.val();
  const wonStage = winner.stage || activeTarget();
  els.winnerName.textContent = `${winner.name || "A player"} has won ${stageName(wonStage)}!`;
  els.popup.classList.add("show");
  const key = `${winner.claimedAt || 0}-${wonStage}`;
  if (key !== lastWinnerKey) {
    lastWinnerKey = key;
    fireConfetti();
  }
});

els.closeWinner.addEventListener("click", () => els.popup.classList.remove("show"));

let confettiActive = false;
function fireConfetti() {
  if (confettiActive) return;
  confettiActive = true;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.appendChild(canvas);
  const context = canvas.getContext("2d");
  const pieces = [];
  const colours = ["#facc15", "#38bdf8", "#22c55e", "#ef4444", "#a855f7", "#fff"];
  const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  resize();
  addEventListener("resize", resize);
  for (const side of [0, innerWidth]) {
    for (let index = 0; index < 140; index += 1) {
      const direction = side === 0 ? 1 : -1;
      pieces.push({ x: side, y: innerHeight * (.65 + Math.random() * .25), vx: direction * (5 + Math.random() * 10), vy: -(8 + Math.random() * 14), g: .22 + Math.random() * .08, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, colour: colours[Math.floor(Math.random() * colours.length)], life: 1 });
    }
  }
  const start = performance.now();
  function animate(now) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((piece) => {
      piece.vy += piece.g; piece.x += piece.vx; piece.y += piece.vy; piece.r += piece.vr;
      if (now - start > 3500) piece.life -= .02;
      context.save(); context.globalAlpha = Math.max(piece.life, 0); context.translate(piece.x, piece.y); context.rotate(piece.r); context.fillStyle = piece.colour; context.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h); context.restore();
    });
    if (now - start < 6000) requestAnimationFrame(animate);
    else { removeEventListener("resize", resize); canvas.remove(); confettiActive = false; }
  }
  requestAnimationFrame(animate);
}
