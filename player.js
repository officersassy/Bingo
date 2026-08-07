import { database } from "./firebase.js";
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const playerId = localStorage.getItem("bingoPlayerId") || localStorage.getItem("bingoPlayer");
const BLANK = "__BLANK__";
const els = {
  welcome: document.getElementById("welcomePlayer"), status: document.getElementById("playerStatus"),
  current: document.getElementById("playerCurrent"), card: document.getElementById("card"),
  bingo: document.getElementById("bingoButton"), popup: document.getElementById("winnerPopup"),
  winnerName: document.getElementById("winnerName"), closeWinner: document.getElementById("closeWinnerButton"),
  stageBadge: document.getElementById("stageBadge"), targetInstruction: document.getElementById("targetInstruction"),
  calledCount: document.getElementById("playerCalledCount"), dabbedCount: document.getElementById("playerDabbedCount"),
  bingoSection: document.getElementById("bingoSection"), bingoHeaders: document.getElementById("bingoHeaders")
};

let player = null;
let card = [];
let cardType = "75";
let marked = [];
let called = [];
let state = { status: "joining", locked: false, gameMode: "progressive", progressiveStage: "one-line" };
let gameId = null;
let lastWinnerKey = null;

function is90Mode(mode) { return mode === "progressive" || mode === "full-house"; }
function stageName(stage) { return ({"one-line":"One Line","two-lines":"Two Lines","full-house":"Full House","four-corners":"Four Corners"})[stage] || "One Line"; }
function activeTarget() { return state.gameMode === "progressive" ? state.progressiveStage : state.gameMode; }
function targetInstruction(target) {
  if (is90Mode(state.gameMode)) {
    return ({"one-line":"Complete all 5 numbers on any one row.","two-lines":"Complete any two rows on your 90-ball ticket.","full-house":"Dab all 15 numbers on your 90-ball ticket."})[target] || "Complete one row.";
  }
  return ({"one-line":"Complete any horizontal line.","two-lines":"Complete any two horizontal lines.","four-corners":"Dab all four corner numbers.","full-house":"Dab every number on your card."})[target] || "Complete any horizontal line.";
}
function updatePlayerDashboard() {
  const target=activeTarget();
  if (els.stageBadge) els.stageBadge.textContent=`${stageName(target)} · ${cardType}-ball`;
  if (els.targetInstruction) els.targetInstruction.textContent=targetInstruction(target);
  if (els.calledCount) els.calledCount.textContent=String(called.length);
  if (els.dabbedCount) els.dabbedCount.textContent=String(marked.length);
}
function arrayOf(data) { return !data ? [] : (Array.isArray(data) ? data.flat() : Object.values(data).flat()); }
function numberFrom(call) {
  if (typeof call === "number") return call;
  if (call && typeof call === "object" && Number.isFinite(Number(call.number))) return Number(call.number);
  const text=typeof call==="string"?call:call?.call; const match=typeof text==="string"?text.match(/\d+/):null;
  return match?Number(match[0]):null;
}
function show(message,type="") { els.status.textContent=message; els.status.dataset.type=type; }
function clearStorage() { ["bingoPlayerId","bingoPlayer","bingoPlayerName","bingoGameId"].forEach((key)=>localStorage.removeItem(key)); }

function drawCard() {
  const expected=cardType==="90"?27:25;
  if(card.length!==expected)return;
  els.card.innerHTML="";
  updatePlayerDashboard();
  els.bingoSection?.classList.toggle("card-90",cardType==="90");
  els.card.classList.toggle("card-90-grid",cardType==="90");
  if(els.bingoHeaders) els.bingoHeaders.style.display=cardType==="90"?"none":"grid";

  card.forEach((value)=>{
    const square=document.createElement("div"); square.className="number";
    if(value===BLANK || value==="" || value===null){ square.classList.add("blank"); square.setAttribute("aria-hidden","true"); els.card.appendChild(square); return; }
    square.textContent=value;
    if(value==="FREE") square.classList.add("free");
    else {
      const number=Number(value);
      if(called.includes(number))square.classList.add("called");
      if(marked.includes(number))square.classList.add("selected");
      square.addEventListener("click",()=>dab(number));
    }
    els.card.appendChild(square);
  });
}

async function dab(number) {
  if(state.status!=="playing"||state.locked){show("The game is not open for dabbing.","error");return;}
  if(!called.includes(number)){show("That number has not been called yet.","warning");return;}
  marked=marked.includes(number)?marked.filter((value)=>value!==number):[...marked,number].sort((a,b)=>a-b);
  drawCard(); updatePlayerDashboard();
  try{await set(ref(database,`bingo/players/${playerId}/marked`),marked.length?marked:null);}catch(error){console.error(error);show("Your dab could not be saved.","error");}
}

function cellComplete(index) {
  const value=card[index];
  if(value===BLANK||value===""||value===null)return true;
  if(value==="FREE")return true;
  const number=Number(value);
  return marked.includes(number)&&called.includes(number);
}
function validWin75(target) {
  const rows=[[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24]];
  const completeRows=rows.filter((row)=>row.every(cellComplete)).length;
  if(target==="two-lines")return completeRows>=2;
  if(target==="four-corners")return [0,4,20,24].every(cellComplete);
  if(target==="full-house")return card.every((_,index)=>cellComplete(index));
  return completeRows>=1;
}
function validWin90(target) {
  const rows=[[0,1,2,3,4,5,6,7,8],[9,10,11,12,13,14,15,16,17],[18,19,20,21,22,23,24,25,26]];
  const completeRows=rows.filter((row)=>row.every(cellComplete)).length;
  if(target==="two-lines")return completeRows>=2;
  if(target==="full-house")return card.every((value,index)=>value===BLANK||value===""||value===null||cellComplete(index));
  return completeRows>=1;
}
function validWin(){ const target=activeTarget(); return cardType==="90"?validWin90(target):validWin75(target); }

els.bingo.addEventListener("click",async()=>{
  const target=activeTarget();
  if(!player||state.status!=="playing"||state.locked){show("The game is not ready for a Bingo claim.","warning");return;}
  if(!validWin()){show(`That is not a valid ${stageName(target)} yet.`,"error");return;}
  els.bingo.disabled=true;
  try{
    const winnerSnap=await get(ref(database,"bingo/winner"));
    if(winnerSnap.exists()){show("A winner has already been submitted for this stage.","warning");return;}
    const isFinal=state.gameMode!=="progressive"||target==="full-house";
    await set(ref(database,"bingo/winner"),{playerId,name:player.name||playerId,card,cardType,marked,gameId,gameMode:state.gameMode,stage:target,claimedAt:Date.now(),verified:true});
    await update(ref(database,"bingo"),{status:isFinal?"winner":"stage-winner",locked:true});
  }finally{els.bingo.disabled=false;}
});

onValue(ref(database,`bingo/players/${playerId||"missing"}`),(snap)=>{
  if(!playerId||!snap.exists()){if(playerId)alert("You have been removed from the game.");clearStorage();window.location.href="join.html";return;}
  const oldGameId=gameId; player=snap.val(); card=arrayOf(player.card); marked=arrayOf(player.marked).map(Number).filter(Number.isFinite);
  gameId=player.gameId||null; cardType=String(player.cardType||((card.length===27)?"90":"75"));
  els.welcome.textContent=`Welcome, ${player.name||playerId}`;
  if(oldGameId&&gameId&&oldGameId!==gameId)show(`New round: your dabs were cleared and you received a fresh ${cardType}-ball card!`,"success");
  drawCard();
});

onValue(ref(database,"bingo/currentCall"),(snap)=>{
  const value=snap.val(); els.current.textContent=value?(typeof value==="string"?value:value.call||"--"):"--";
  if(value){els.current.classList.remove("number-pop");void els.current.offsetWidth;els.current.classList.add("number-pop");}
});
onValue(ref(database,"bingo/calledNumbers"),(snap)=>{called=[...new Set(Object.values(snap.val()||{}).map(numberFrom).filter(Number.isFinite))];drawCard();updatePlayerDashboard();});
onValue(ref(database,"bingo"),(snap)=>{
  const game=snap.val()||{}; state={status:game.status||"joining",locked:Boolean(game.locked),gameMode:game.gameMode||"progressive",progressiveStage:game.progressiveStage||"one-line"};
  updatePlayerDashboard(); const target=stageName(activeTarget());
  if(state.status==="playing")show(`Playing for ${target} — good luck!`,"success");
  else if(state.status==="stage-winner")show(`${target} winner announced. Waiting for the host to continue.`,"warning");
  else if(state.status==="winner")show(`Final ${target} winner announced.`,"warning");
  else show(`Waiting for host — ${is90Mode(state.gameMode)?"90-ball":"75-ball"} ${state.gameMode==="progressive"?"Progressive Game":target}.`);
});
onValue(ref(database,"bingo/winner"),(snap)=>{
  if(!snap.exists()){els.popup.classList.remove("show");lastWinnerKey=null;return;}
  const winner=snap.val(),wonStage=winner.stage||activeTarget(); els.winnerName.textContent=`${winner.name||"A player"} has won ${stageName(wonStage)}!`; els.popup.classList.add("show");
  const key=`${winner.claimedAt||0}-${wonStage}`; if(key!==lastWinnerKey){lastWinnerKey=key;fireConfetti();}
});
els.closeWinner.addEventListener("click",()=>els.popup.classList.remove("show"));

let confettiActive=false;
function fireConfetti(){
  if(confettiActive)return;confettiActive=true;const canvas=document.createElement("canvas");canvas.className="confetti-canvas";document.body.appendChild(canvas);const context=canvas.getContext("2d");const pieces=[];const colours=["#facc15","#38bdf8","#22c55e","#ef4444","#a855f7","#fff"];
  const resize=()=>{canvas.width=innerWidth;canvas.height=innerHeight;};resize();addEventListener("resize",resize);
  for(const side of [0,innerWidth])for(let index=0;index<140;index+=1)pieces.push({x:side,y:innerHeight*.75,vx:(side===0?1:-1)*(4+Math.random()*10),vy:-(7+Math.random()*13),gravity:.2+Math.random()*.08,rotation:Math.random()*6.28,rotationSpeed:(Math.random()-.5)*.3,colour:colours[Math.floor(Math.random()*colours.length)],width:5+Math.random()*8,height:4+Math.random()*7,alpha:1});
  const start=performance.now();function frame(now){context.clearRect(0,0,canvas.width,canvas.height);pieces.forEach((piece)=>{piece.vy+=piece.gravity;piece.x+=piece.vx;piece.y+=piece.vy;piece.rotation+=piece.rotationSpeed;if(now-start>3500)piece.alpha-=.02;context.save();context.globalAlpha=Math.max(0,piece.alpha);context.translate(piece.x,piece.y);context.rotate(piece.rotation);context.fillStyle=piece.colour;context.fillRect(-piece.width/2,-piece.height/2,piece.width,piece.height);context.restore();});if(now-start<6000)requestAnimationFrame(frame);else{removeEventListener("resize",resize);canvas.remove();confettiActive=false;}}requestAnimationFrame(frame);
}
