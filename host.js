import { database } from "./firebase.js";
import { ref, get, set, update, push, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const bingoRef = ref(database, "bingo");
const playersRef = ref(database, "bingo/players");
const currentRef = ref(database, "bingo/currentCall");
const callsRef = ref(database, "bingo/calledNumbers");
const winnerRef = ref(database, "bingo/winner");

const els = {
  status: document.getElementById("gameStatus"), current: document.getElementById("currentNumber"),
  count: document.getElementById("playerCount"), list: document.getElementById("playerList"),
  last: document.getElementById("lastCalls"), all: document.getElementById("calledNumbers"),
  open: document.getElementById("openJoiningButton"), start: document.getElementById("startGameButton"),
  call: document.getElementById("callNumberButton"), reset: document.getElementById("resetGameButton"),
  mode: document.getElementById("gameModeSelect"), modeDesc: document.getElementById("gameModeDescription"),
  popup: document.getElementById("winnerPopup"), winnerName: document.getElementById("winnerName"),
  closeWinner: document.getElementById("closeWinnerButton"), winnerRestart: document.getElementById("winnerRestartButton")
};

let state = { status: "joining", joiningOpen: true, locked: false, gameMode: "one-line" };
let calledNumbers = [];

function randomNumbers(min, max, count) {
  const out = [];
  while (out.length < count) {
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
function createCard() {
  const c = [randomNumbers(1,15,5), randomNumbers(16,30,5), randomNumbers(31,45,5), randomNumbers(46,60,5), randomNumbers(61,75,5)];
  const card = [];
  for (let r=0;r<5;r+=1) for (let col=0;col<5;col+=1) card.push(r===2&&col===2 ? "FREE" : c[col][r]);
  return card;
}
function letter(n) { return n<=15?"B":n<=30?"I":n<=45?"N":n<=60?"G":"O"; }
function numberFrom(call) {
  if (typeof call === "number") return call;
  if (call && typeof call === "object" && Number.isFinite(Number(call.number))) return Number(call.number);
  const text = typeof call === "string" ? call : call?.call;
  const match = typeof text === "string" ? text.match(/\d+/) : null;
  return match ? Number(match[0]) : null;
}
function callText(call) { return typeof call === "string" ? call : call?.call || "--"; }
function modeName(mode) { return ({"one-line":"One Line","two-lines":"Two Lines","four-corners":"Four Corners","full-house":"Full House"})[mode] || "One Line"; }
function modeDescription(mode) { return ({"one-line":"Complete any horizontal line.","two-lines":"Complete any two horizontal lines.","four-corners":"Dab all four corner numbers.","full-house":"Dab every number on the card."})[mode] || "Complete any horizontal line."; }

function updateControls() {
  els.open.disabled = state.status === "joining" && state.joiningOpen;
  els.start.disabled = state.status === "playing" || state.status === "winner";
  els.call.disabled = state.status !== "playing" || state.locked || calledNumbers.length >= 75;
  els.mode.disabled = state.status === "playing" || state.status === "winner";
  els.mode.value = state.gameMode;
  els.modeDesc.textContent = modeDescription(state.gameMode);
}

async function initialise() {
  const snap = await get(bingoRef);
  if (!snap.exists()) {
    await set(bingoRef, { gameId:`game-${Date.now()}`, status:"joining", joiningOpen:true, locked:false, gameMode:"one-line", createdAt:Date.now() });
  } else {
    const game = snap.val();
    const patch = {};
    if (!game.gameId) patch.gameId = `game-${Date.now()}`;
    if (!game.status) patch.status = "joining";
    if (game.joiningOpen === undefined) patch.joiningOpen = true;
    if (game.locked === undefined) patch.locked = false;
    if (!game.gameMode) patch.gameMode = "one-line";
    if (Object.keys(patch).length) await update(bingoRef, patch);
  }
}

onValue(bingoRef, (snap) => {
  const game = snap.val() || {};
  state = { status: game.status || "joining", joiningOpen: game.joiningOpen !== false, locked: Boolean(game.locked), gameMode: game.gameMode || "one-line" };
  const statusText = state.status === "playing" ? `Game in progress — ${modeName(state.gameMode)}` : state.status === "winner" ? `Winner announced — ${modeName(state.gameMode)}` : `${state.joiningOpen ? "Joining open" : "Joining closed"} — ${modeName(state.gameMode)}`;
  els.status.textContent = statusText;
  updateControls();
});

onValue(playersRef, (snap) => {
  const entries = Object.entries(snap.val() || {});
  els.count.textContent = String(entries.length);
  els.list.innerHTML = "";
  if (!entries.length) { els.list.textContent = "No players yet."; return; }
  entries.sort((a,b)=>String(a[1].name||"").localeCompare(String(b[1].name||""))).forEach(([id, player]) => {
    const row = document.createElement("div"); row.className = "player-row";
    const name = document.createElement("span"); name.textContent = `👤 ${player.name || id}`;
    const btn = document.createElement("button"); btn.className = "mini danger"; btn.textContent = "Remove";
    btn.addEventListener("click", async () => {
      if (!confirm(`Remove ${player.name || id}?`)) return;
      await remove(ref(database, `bingo/players/${id}`));
    });
    row.append(name, btn); els.list.appendChild(row);
  });
});

onValue(currentRef, (snap) => {
  els.current.textContent = snap.exists() ? callText(snap.val()) : "--";
  if (snap.exists()) { els.current.classList.remove("number-pop"); void els.current.offsetWidth; els.current.classList.add("number-pop"); }
});

onValue(callsRef, (snap) => {
  const calls = Object.values(snap.val() || {});
  calledNumbers = [...new Set(calls.map(numberFrom).filter(Number.isFinite))];
  const newest = [...calls].reverse();
  const draw = (target, list) => { target.innerHTML = ""; list.forEach(call => { const ball=document.createElement("div"); ball.className="called"; ball.textContent=callText(call); target.appendChild(ball); }); };
  draw(els.last, newest.slice(0,10)); draw(els.all, newest); updateControls();
});

onValue(winnerRef, (snap) => {
  if (!snap.exists()) { els.popup.classList.remove("show"); return; }
  const winner = snap.val(); els.winnerName.textContent = `${winner.name || "A player"} has won ${modeName(winner.gameMode || state.gameMode)}!`; els.popup.classList.add("show");
});

els.mode.addEventListener("change", async () => {
  if (state.status === "playing" || state.status === "winner") return;
  await update(bingoRef, { gameMode: els.mode.value });
});
els.open.addEventListener("click", () => update(bingoRef, { status:"joining", joiningOpen:true, locked:false }));
els.start.addEventListener("click", async () => {
  const players = await get(playersRef);
  if (!players.exists()) { alert("No players have joined yet."); return; }
  await update(bingoRef, { status:"playing", joiningOpen:false, locked:false, gameMode:els.mode.value, startedAt:Date.now() });
});
els.call.addEventListener("click", async () => {
  if (state.status !== "playing" || state.locked) return;
  if (calledNumbers.length >= 75) { alert("All 75 numbers have been called."); return; }
  let n; do { n=Math.floor(Math.random()*75)+1; } while (calledNumbers.includes(n));
  const data = { call:`${letter(n)} ${n}`, number:n, calledAt:Date.now() };
  els.call.disabled = true;
  try { await set(currentRef, data); await push(callsRef, data); } finally { updateControls(); }
});

async function resetGame() {
  if (!confirm("Restart the game? Every player gets a new card and all dabs/calls are cleared.")) return;
  els.reset.disabled = true;
  try {
    const playersSnap = await get(playersRef);
    const players = playersSnap.val() || {};
    const gameId = `game-${Date.now()}`;
    const freshPlayers = {};
    Object.entries(players).forEach(([id,p]) => { freshPlayers[id] = {...p, card:createCard(), marked:null, gameId, locked:true, cardCreatedAt:Date.now()}; });
    await set(bingoRef, { gameId, status:"joining", joiningOpen:true, locked:false, gameMode:els.mode.value || state.gameMode, createdAt:Date.now(), restartTime:Date.now(), players:freshPlayers });
    els.popup.classList.remove("show");
  } finally { els.reset.disabled = false; }
}
els.reset.addEventListener("click", resetGame);
els.winnerRestart.addEventListener("click", resetGame);
els.closeWinner.addEventListener("click", () => els.popup.classList.remove("show"));

initialise().catch((error) => { console.error(error); els.status.textContent = "Firebase connection failed."; });
