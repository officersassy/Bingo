import { database } from "./firebase.js";
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const playerId = localStorage.getItem("bingoPlayerId") || localStorage.getItem("bingoPlayer");
const els = {
  welcome: document.getElementById("welcomePlayer"), status: document.getElementById("playerStatus"),
  current: document.getElementById("playerCurrent"), card: document.getElementById("card"),
  bingo: document.getElementById("bingoButton"), popup: document.getElementById("winnerPopup"),
  winnerName: document.getElementById("winnerName"), closeWinner: document.getElementById("closeWinnerButton")
};
let player = null, card = [], marked = [], called = [];
let state = { status:"joining", locked:false, gameMode:"one-line" };
let gameId = null;

function modeName(mode) { return ({"one-line":"One Line","two-lines":"Two Lines","four-corners":"Four Corners","full-house":"Full House"})[mode] || "One Line"; }
function arrayOf(data) { return !data ? [] : (Array.isArray(data) ? data.flat() : Object.values(data).flat()); }
function numberFrom(call) {
  if (typeof call === "number") return call;
  if (call && typeof call === "object" && Number.isFinite(Number(call.number))) return Number(call.number);
  const text = typeof call === "string" ? call : call?.call;
  const match = typeof text === "string" ? text.match(/\d+/) : null;
  return match ? Number(match[0]) : null;
}
function show(message, type="") { els.status.textContent = message; els.status.dataset.type = type; }
function clearStorage() { ["bingoPlayerId","bingoPlayer","bingoPlayerName","bingoGameId"].forEach(k=>localStorage.removeItem(k)); }

function drawCard() {
  if (card.length !== 25) return;
  els.card.innerHTML = "";
  card.forEach(value => {
    const square = document.createElement("div"); square.className = "number"; square.textContent = value;
    if (value === "FREE") square.classList.add("free");
    else {
      const n = Number(value);
      if (called.includes(n)) square.classList.add("called");
      if (marked.includes(n)) square.classList.add("selected");
      square.addEventListener("click", () => dab(n));
    }
    els.card.appendChild(square);
  });
}

async function dab(n) {
  if (state.status !== "playing" || state.locked) { show("The game is not open for dabbing.", "error"); return; }
  if (!called.includes(n)) { show("That number has not been called yet.", "warning"); return; }
  marked = marked.includes(n) ? marked.filter(x=>x!==n) : [...marked,n].sort((a,b)=>a-b);
  drawCard();
  try { await set(ref(database, `bingo/players/${playerId}/marked`), marked.length ? marked : null); }
  catch (error) { console.error(error); show("Your dab could not be saved.", "error"); }
}

function lineComplete(indexes) {
  return indexes.every(index => card[index] === "FREE" || (marked.includes(Number(card[index])) && called.includes(Number(card[index]))));
}
function validWin() {
  const rows = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24]];
  const completeRows = rows.filter(lineComplete).length;
  if (state.gameMode === "two-lines") return completeRows >= 2;
  if (state.gameMode === "four-corners") return [0,4,20,24].every(i=>lineComplete([i]));
  if (state.gameMode === "full-house") return card.every((_,i)=>lineComplete([i]));
  return completeRows >= 1;
}

els.bingo.addEventListener("click", async () => {
  if (!player || state.status !== "playing" || state.locked) { show("The game is not ready for a Bingo claim.", "warning"); return; }
  if (!validWin()) { show(`That is not a valid ${modeName(state.gameMode)} yet.`, "error"); return; }
  els.bingo.disabled = true;
  try {
    const winnerSnap = await get(ref(database, "bingo/winner"));
    if (winnerSnap.exists()) { show("A winner has already been submitted.", "warning"); return; }
    await set(ref(database, "bingo/winner"), { playerId, name:player.name || playerId, card, marked, gameId, gameMode:state.gameMode, claimedAt:Date.now(), verified:true });
    await update(ref(database, "bingo"), { status:"winner", locked:true });
  } finally { els.bingo.disabled = false; }
});

onValue(ref(database, `bingo/players/${playerId || "missing"}`), snap => {
  if (!playerId || !snap.exists()) {
    if (playerId) alert("You have been removed from the game.");
    clearStorage(); window.location.href = "join.html"; return;
  }
  const oldGameId = gameId;
  player = snap.val(); card = arrayOf(player.card); marked = arrayOf(player.marked).map(Number).filter(Number.isFinite); gameId = player.gameId || null;
  els.welcome.textContent = `Welcome, ${player.name || playerId}`;
  if (oldGameId && gameId && oldGameId !== gameId) show("New round: your dabs were cleared and you received a fresh card!", "success");
  drawCard();
});

onValue(ref(database, "bingo/currentCall"), snap => {
  const value = snap.val(); els.current.textContent = value ? (typeof value === "string" ? value : value.call || "--") : "--";
  if (value) { els.current.classList.remove("number-pop"); void els.current.offsetWidth; els.current.classList.add("number-pop"); }
});
onValue(ref(database, "bingo/calledNumbers"), snap => {
  called = [...new Set(Object.values(snap.val() || {}).map(numberFrom).filter(Number.isFinite))]; drawCard();
});
onValue(ref(database, "bingo"), snap => {
  const game = snap.val() || {}; state = { status:game.status || "joining", locked:Boolean(game.locked), gameMode:game.gameMode || "one-line" };
  show(state.status === "playing" ? `${modeName(state.gameMode)} game in progress — good luck!` : state.status === "winner" ? "A winner has been announced." : `Waiting for host — ${modeName(state.gameMode)}.`, state.status === "playing" ? "success" : "");
});
onValue(ref(database, "bingo/winner"), snap => {
  if (!snap.exists()) { els.popup.classList.remove("show"); return; }
  const winner = snap.val(); els.winnerName.textContent = `${winner.name || "A player"} has won ${modeName(winner.gameMode || state.gameMode)}!`; els.popup.classList.add("show"); fireConfetti();
});
els.closeWinner.addEventListener("click", () => els.popup.classList.remove("show"));

let confettiActive = false;
function fireConfetti() {
  if (confettiActive) return; confettiActive = true;
  const canvas = document.createElement("canvas"); canvas.className = "confetti-canvas"; document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d"); const pieces=[]; const colours=["#facc15","#38bdf8","#22c55e","#ef4444","#a855f7","#fff"];
  const resize=()=>{canvas.width=innerWidth;canvas.height=innerHeight;}; resize(); addEventListener("resize",resize);
  for (const side of [0,innerWidth]) for(let i=0;i<140;i+=1) pieces.push({x:side,y:innerHeight*.75,vx:(side===0?1:-1)*(4+Math.random()*10),vy:-(7+Math.random()*13),g:.2+Math.random()*.08,r:Math.random()*6.28,vr:(Math.random()-.5)*.3,c:colours[Math.floor(Math.random()*colours.length)],w:5+Math.random()*8,h:4+Math.random()*7,a:1});
  const start=performance.now();
  function frame(now){ctx.clearRect(0,0,canvas.width,canvas.height);pieces.forEach(p=>{p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;if(now-start>3500)p.a-=.02;ctx.save();ctx.globalAlpha=Math.max(0,p.a);ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();});if(now-start<6000){requestAnimationFrame(frame);}else{removeEventListener("resize",resize);canvas.remove();confettiActive=false;}}
  requestAnimationFrame(frame);
}
