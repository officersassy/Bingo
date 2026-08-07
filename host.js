import { database } from "./firebase.js";
import { ref, get, set, update, push, remove, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const bingoRef = ref(database, "bingo");
const playersRef = ref(database, "bingo/players");
const currentRef = ref(database, "bingo/currentCall");
const callsRef = ref(database, "bingo/calledNumbers");
const claimsRef = ref(database, "bingo/claims");
const BLANK = "__BLANK__";

const els = {
  status: document.getElementById("gameStatus"), current: document.getElementById("currentNumber"),
  count: document.getElementById("playerCount"), list: document.getElementById("playerList"),
  last: document.getElementById("lastCalls"), all: document.getElementById("calledNumbers"),
  open: document.getElementById("openJoiningButton"), start: document.getElementById("startGameButton"),
  call: document.getElementById("callNumberButton"), reset: document.getElementById("resetGameButton"),
  mode: document.getElementById("gameModeSelect"), modeDesc: document.getElementById("gameModeDescription"),
  popup: document.getElementById("winnerPopup"), winnerName: document.getElementById("winnerName"),
  closeWinner: document.getElementById("closeWinnerButton"), winnerContinue: document.getElementById("winnerContinueButton"),
  winnerRestart: document.getElementById("winnerRestartButton"), statPlayers: document.getElementById("statPlayers"),
  statCalled: document.getElementById("statCalled"), statRemaining: document.getElementById("statRemaining"),
  statElapsed: document.getElementById("statElapsed"), statAverage: document.getElementById("statAverage"),
  statStage: document.getElementById("statStage"), historySummary: document.getElementById("historySummary")
};

let state = { gameId: null, status: "joining", joiningOpen: true, locked: false, gameMode: "progressive", progressiveStage: "one-line", drawOrder: [], paceProfile: null };
let calledNumbers = [];
let callTimes = [];
let currentClaims = [];
let startedAt = null;
let tieWindowTimer = null;
const TIE_WINDOW_MS = 5000;

function randomNumbers(min, max, count) {
  const out = [];
  while (out.length < count) {
    const number = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!out.includes(number)) out.push(number);
  }
  return out.sort((a, b) => a - b);
}

function is90Mode(mode) { return mode === "progressive" || mode === "full-house"; }
function maxBall(mode = state.gameMode) { return is90Mode(mode) ? 90 : 75; }

function create75Card() {
  const columns = [
    randomNumbers(1,15,5), randomNumbers(16,30,5), randomNumbers(31,45,5),
    randomNumbers(46,60,5), randomNumbers(61,75,5)
  ];
  const card = [];
  for (let row=0; row<5; row+=1) for (let col=0; col<5; col+=1) {
    card.push(row===2 && col===2 ? "FREE" : columns[col][row]);
  }
  return card;
}

function create90Card() {
  let rowColumns;
  do {
    rowColumns = Array.from({length:3}, () => {
      const cols=[];
      while (cols.length<5) {
        const c=Math.floor(Math.random()*9);
        if (!cols.includes(c)) cols.push(c);
      }
      return cols.sort((a,b)=>a-b);
    });
  } while (new Set(rowColumns.flat()).size < 9);

  const grid = Array.from({length:3},()=>Array(9).fill(BLANK));
  for (let col=0; col<9; col+=1) {
    const rows=[0,1,2].filter((row)=>rowColumns[row].includes(col));
    const min=col===0?1:col*10;
    const max=col===8?90:col*10+9;
    const nums=randomNumbers(min,max,rows.length);
    rows.forEach((row,index)=>{ grid[row][col]=nums[index]; });
  }
  return grid.flat();
}

function createCard(mode) { return is90Mode(mode) ? create90Card() : create75Card(); }
function letter(number) { return number<=15?"B":number<=30?"I":number<=45?"N":number<=60?"G":"O"; }
function displayCall(number, mode=state.gameMode) { return is90Mode(mode) ? String(number) : `${letter(number)} ${number}`; }
function numberFrom(call) {
  if (typeof call === "number") return call;
  if (call && typeof call === "object" && Number.isFinite(Number(call.number))) return Number(call.number);
  const text=typeof call==="string"?call:call?.call;
  const match=typeof text==="string"?text.match(/\d+/):null;
  return match?Number(match[0]):null;
}
function callText(call) { return typeof call === "string" ? call : call?.call || "--"; }
function stageName(stage) { return ({"one-line":"One Line","two-lines":"Two Lines","full-house":"Full House","four-corners":"Four Corners"})[stage] || "One Line"; }
function modeName(mode) { return ({progressive:"Progressive 90-Ball","one-line":"One Line 75-Ball","two-lines":"Two Lines 75-Ball","four-corners":"Four Corners 75-Ball","full-house":"Full House 90-Ball"})[mode] || "Progressive 90-Ball"; }
function activeTarget() { return state.gameMode === "progressive" ? state.progressiveStage : state.gameMode; }
function modeDescription(mode) {
  return ({
    progressive:"90-ball ticket. One continuous round: One Line, then Two Lines, then Full House.",
    "one-line":"Original 75-ball B/I/N/G/O card. Complete any horizontal line.",
    "two-lines":"Original 75-ball B/I/N/G/O card. Complete any two horizontal lines.",
    "four-corners":"Original 75-ball B/I/N/G/O card. Dab all four corners.",
    "full-house":"90-ball ticket. Dab all 15 numbers on the ticket."
  })[mode] || "Choose a game mode.";
}

function shuffleNumbers(max) {
  const numbers=Array.from({length:max},(_,index)=>index+1);
  for(let index=numbers.length-1;index>0;index-=1){
    const swapIndex=Math.floor(Math.random()*(index+1));
    [numbers[index],numbers[swapIndex]]=[numbers[swapIndex],numbers[index]];
  }
  return numbers;
}

function card90Milestones(card,order) {
  const position=new Map(order.map((number,index)=>[number,index+1]));
  const rows=[[0,1,2,3,4,5,6,7,8],[9,10,11,12,13,14,15,16,17],[18,19,20,21,22,23,24,25,26]];
  const rowFinishes=rows.map((row)=>{
    const numbers=row.map((index)=>card[index]).filter((value)=>value!==BLANK&&value!==""&&value!==null).map(Number);
    return Math.max(...numbers.map((number)=>position.get(number)||90));
  }).sort((a,b)=>a-b);

  return {
    oneLine:rowFinishes[0],
    twoLines:rowFinishes[1],
    fullHouse:rowFinishes[2]
  };
}

function earliest90Milestones(players,order) {
  const results=Object.values(players)
    .filter((player)=>String(player.cardType||"90")==="90"&&Array.isArray(player.card)&&player.card.length===27)
    .map((player)=>card90Milestones(player.card,order));

  if(!results.length)return null;

  return {
    oneLine:Math.min(...results.map((result)=>result.oneLine)),
    twoLines:Math.min(...results.map((result)=>result.twoLines)),
    fullHouse:Math.min(...results.map((result)=>result.fullHouse))
  };
}

function choosePaceProfile() {
  const roll=Math.random();
  if(roll<0.25)return {
    name:"quick",
    oneLine:[25,42],
    twoLines:[45,62],
    fullHouse:[65,80]
  };
  if(roll<0.75)return {
    name:"standard",
    oneLine:[35,52],
    twoLines:[52,68],
    fullHouse:[70,84]
  };
  return {
    name:"slow",
    oneLine:[45,60],
    twoLines:[60,75],
    fullHouse:[78,89]
  };
}

function milestoneDistance(value,range) {
  if(value<range[0])return range[0]-value;
  if(value>range[1])return value-range[1];
  return 0;
}

function createBalanced90Draw(players) {
  const profile=choosePaceProfile();
  let bestOrder=shuffleNumbers(90);
  let bestScore=Infinity;
  let bestMilestones=null;

  for(let attempt=0;attempt<5000;attempt+=1){
    const order=shuffleNumbers(90);
    const milestones=earliest90Milestones(players,order);
    if(!milestones){
      return {order,profile:"pure-random",milestones:null};
    }

    const score=
      milestoneDistance(milestones.oneLine,profile.oneLine)**2+
      milestoneDistance(milestones.twoLines,profile.twoLines)**2+
      milestoneDistance(milestones.fullHouse,profile.fullHouse)**2;

    if(score<bestScore){
      bestScore=score;
      bestOrder=order;
      bestMilestones=milestones;
    }

    if(score===0){
      return {order,profile:profile.name,milestones};
    }
  }

  return {order:bestOrder,profile:profile.name,milestones:bestMilestones};
}

function formatDuration(ms) {
  if (!ms || ms<0) return "00:00";
  const total=Math.floor(ms/1000), mins=Math.floor(total/60), secs=total%60;
  return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;
}
function updateStatistics() {
  const total=maxBall();
  const playerTotal=Number(els.count?.textContent||0);
  if (els.statPlayers) els.statPlayers.textContent=String(playerTotal);
  if (els.statCalled) els.statCalled.textContent=String(calledNumbers.length);
  if (els.statRemaining) els.statRemaining.textContent=String(Math.max(0,total-calledNumbers.length));
  if (els.statStage) els.statStage.textContent=stageName(activeTarget());
  if (els.historySummary) els.historySummary.textContent=`${calledNumbers.length} of ${total}`;
  if (els.statElapsed) {
    const running=startedAt && ["playing","stage-winner","winner"].includes(state.status);
    els.statElapsed.textContent=running?formatDuration(Date.now()-startedAt):"00:00";
  }
  if (els.statAverage) {
    if (callTimes.length<2) els.statAverage.textContent="—";
    else {
      const sorted=[...callTimes].sort((a,b)=>a-b);
      els.statAverage.textContent=`${Math.max(1,Math.round(((sorted.at(-1)-sorted[0])/(sorted.length-1))/1000))}s`;
    }
  }
}
function updateControls() {
  const total=maxBall();
  els.open.disabled=state.status==="joining"&&state.joiningOpen;
  els.start.disabled=["playing","stage-winner","winner"].includes(state.status);
  els.call.disabled=state.status!=="playing"||state.locked||calledNumbers.length>=total;
  els.mode.disabled=["playing","stage-winner","winner"].includes(state.status);
  els.mode.value=state.gameMode;
  els.modeDesc.textContent=modeDescription(state.gameMode);
}

async function initialise() {
  const snap=await get(bingoRef);
  if (!snap.exists()) {
    await set(bingoRef,{gameId:`game-${Date.now()}`,status:"joining",joiningOpen:true,locked:false,gameMode:"progressive",progressiveStage:"one-line",createdAt:Date.now()});
    return;
  }
  const game=snap.val(), patch={};
  if (!game.gameId) patch.gameId=`game-${Date.now()}`;
  if (!game.status) patch.status="joining";
  if (game.joiningOpen===undefined) patch.joiningOpen=true;
  if (game.locked===undefined) patch.locked=false;
  if (!game.gameMode) patch.gameMode="progressive";
  if (!game.progressiveStage) patch.progressiveStage="one-line";
  if (Object.keys(patch).length) await update(bingoRef,patch);
}

async function rebuildPlayersForMode(mode) {
  const playersSnap=await get(playersRef);
  const players=playersSnap.val()||{};
  const gameId=`game-${Date.now()}`;
  const rebuilt={};
  for (const [id,player] of Object.entries(players)) {
    rebuilt[id]={...player,card:createCard(mode),cardType:is90Mode(mode)?"90":"75",marked:null,gameId,locked:true,cardCreatedAt:Date.now()};
  }
  await set(bingoRef,{gameId,status:"joining",joiningOpen:true,locked:false,gameMode:mode,progressiveStage:"one-line",createdAt:Date.now(),restartTime:Date.now(),players:rebuilt});
}

onValue(bingoRef,(snap)=>{
  const game=snap.val()||{};
  state={gameId:game.gameId||null,status:game.status||"joining",joiningOpen:game.joiningOpen!==false,locked:Boolean(game.locked),gameMode:game.gameMode||"progressive",progressiveStage:game.progressiveStage||"one-line",drawOrder:Array.isArray(game.drawOrder)?game.drawOrder:[],paceProfile:game.paceProfile||null};
  const target=stageName(activeTarget());
  if (state.status==="playing") els.status.textContent=`${modeName(state.gameMode)} — playing for ${target}`;
  else if (state.status==="stage-winner") els.status.textContent=`${target} winner announced — continue when ready`;
  else if (state.status==="winner") els.status.textContent=`Final winner announced — ${target}`;
  else els.status.textContent=`${state.joiningOpen?"Joining open":"Joining closed"} — ${modeName(state.gameMode)}`;
  startedAt=Number(game.startedAt||game.createdAt||0)||null;
  updateControls(); updateStatistics();
});

onValue(playersRef,(snap)=>{
  const entries=Object.entries(snap.val()||{});
  els.count.textContent=String(entries.length); updateStatistics(); els.list.innerHTML="";
  if (!entries.length) { els.list.textContent="No players yet."; return; }
  entries.sort((a,b)=>String(a[1].name||"").localeCompare(String(b[1].name||""))).forEach(([id,player])=>{
    const row=document.createElement("div"); row.className="player-row";
    const name=document.createElement("span"); name.textContent=`👤 ${player.name||id} · ${player.cardType||"75"}-ball`;
    const button=document.createElement("button"); button.className="mini danger"; button.textContent="Remove";
    button.addEventListener("click",async()=>{ if(confirm(`Remove ${player.name||id}?`)) await remove(ref(database,`bingo/players/${id}`)); });
    row.append(name,button); els.list.appendChild(row);
  });
});

onValue(currentRef,(snap)=>{
  els.current.textContent=snap.exists()?callText(snap.val()):"--";
  if (snap.exists()) { els.current.classList.remove("number-pop"); void els.current.offsetWidth; els.current.classList.add("number-pop"); }
});

onValue(callsRef,(snap)=>{
  const calls=Object.values(snap.val()||{});
  calledNumbers=[...new Set(calls.map(numberFrom).filter(Number.isFinite))];
  callTimes=calls.map((call)=>Number(call?.calledAt||call?.time||0)).filter((time)=>time>0);
  const newest=[...calls].reverse();
  const draw=(target,list)=>{ target.innerHTML=""; list.forEach((call)=>{ const ball=document.createElement("div"); ball.className="called"; ball.textContent=callText(call); target.appendChild(ball); }); };
  draw(els.last,newest.slice(0,10)); draw(els.all,newest); updateControls(); updateStatistics();
});

onValue(claimsRef,(snap)=>{
  const claimsTree=snap.val()||{};
  const stage=activeTarget();
  const stageClaims=claimsTree[stage]||{};
  currentClaims=Object.values(stageClaims)
    .filter((claim)=>!claim.gameId||!state.gameId||claim.gameId===state.gameId)
    .sort((a,b)=>Number(a.claimedAt||0)-Number(b.claimedAt||0));

  if(!currentClaims.length){
    els.popup.classList.remove("show");
    els.winnerName.textContent="We have a winner!";
    return;
  }

  const names=currentClaims.map((claim)=>claim.name||"Player");
  els.winnerName.innerHTML=
    `${stageName(stage)} Winner${names.length>1?"s":""}!<br><br>`+
    names.map((name)=>`🏆 ${name}`).join("<br>");

  const progressiveNotFinished=state.gameMode==="progressive"&&stage!=="full-house";
  els.winnerContinue.style.display=progressiveNotFinished?"inline-flex":"none";
  els.popup.classList.add("show");

  if(tieWindowTimer){
    clearTimeout(tieWindowTimer);
    tieWindowTimer=null;
  }

  if(progressiveNotFinished){
    const earliestClaim=Math.min(...currentClaims.map((claim)=>Number(claim.claimedAt||Date.now())));
    const remaining=Math.max(0,TIE_WINDOW_MS-(Date.now()-earliestClaim));

    if(remaining>0){
      els.winnerContinue.disabled=true;
      els.winnerContinue.textContent="Collecting tied claims…";

      tieWindowTimer=setTimeout(()=>{
        els.winnerContinue.disabled=false;
        els.winnerContinue.textContent=stage==="one-line"?"Continue to Two Lines":"Continue to Full House";
        tieWindowTimer=null;
      },remaining);
    }else{
      els.winnerContinue.disabled=false;
      els.winnerContinue.textContent=stage==="one-line"?"Continue to Two Lines":"Continue to Full House";
    }
  }
});

els.mode.addEventListener("change",async()=>{
  if (["playing","stage-winner","winner"].includes(state.status)) return;
  const mode=els.mode.value;
  const players=await get(playersRef);
  const calls=await get(callsRef);
  if ((players.exists()||calls.exists()) && !confirm(`Switch to ${modeName(mode)}? Existing players will receive matching fresh cards and all calls/dabs will clear.`)) {
    els.mode.value=state.gameMode; return;
  }
  await rebuildPlayersForMode(mode);
});

els.open.addEventListener("click",()=>update(bingoRef,{status:"joining",joiningOpen:true,locked:false}));
els.start.addEventListener("click",async()=>{
  const playersSnap=await get(playersRef);
  if(!playersSnap.exists()){alert("No players have joined yet.");return;}

  const mode=els.mode.value;
  const patch={
    status:"playing",
    joiningOpen:false,
    locked:false,
    gameMode:mode,
    progressiveStage:"one-line",
    startedAt:Date.now()
  };

  if(is90Mode(mode)){
    const balanced=createBalanced90Draw(playersSnap.val()||{});
    patch.drawOrder=balanced.order;
    patch.paceProfile=balanced.profile;
    patch.paceMilestones=balanced.milestones||null;
  }else{
    patch.drawOrder=null;
    patch.paceProfile=null;
    patch.paceMilestones=null;
  }

  await update(bingoRef,patch);
});
els.call.addEventListener("click",async()=>{
  if(state.status!=="playing"||state.locked)return;

  const total=maxBall();
  if(calledNumbers.length>=total){
    alert(`All ${total} numbers have been called.`);
    return;
  }

  let number;

  if(is90Mode(state.gameMode)&&Array.isArray(state.drawOrder)&&state.drawOrder.length===90){
    number=Number(state.drawOrder[calledNumbers.length]);
  }else{
    do{
      number=Math.floor(Math.random()*total)+1;
    }while(calledNumbers.includes(number));
  }

  if(!Number.isFinite(number)||calledNumbers.includes(number)){
    const remaining=Array.from({length:total},(_,index)=>index+1).filter((candidate)=>!calledNumbers.includes(candidate));
    number=remaining[Math.floor(Math.random()*remaining.length)];
  }

  const data={call:displayCall(number),number,calledAt:Date.now()};
  els.call.disabled=true;
  try{
    await set(currentRef,data);
    await push(callsRef,data);
  }finally{
    updateControls();
  }
});

async function continueProgressiveGame(){
  if(!currentClaims.length||state.gameMode!=="progressive")return;

  const earliestClaim=Math.min(...currentClaims.map((claim)=>Number(claim.claimedAt||Date.now())));
  if(Date.now()-earliestClaim<TIE_WINDOW_MS)return;

  const wonStage=state.progressiveStage;
  if(wonStage==="full-house")return;

  const nextStage=wonStage==="one-line"?"two-lines":"full-house";

  if(tieWindowTimer){
    clearTimeout(tieWindowTimer);
    tieWindowTimer=null;
  }

  await remove(ref(database,`bingo/claims/${wonStage}`));
  await update(bingoRef,{status:"playing",locked:false,progressiveStage:nextStage,stageStartedAt:Date.now()});
  currentClaims=[];
  els.popup.classList.remove("show");
}
async function resetGame(){
  if(!confirm("Restart the game? Every player gets a fresh matching card and all dabs/calls are cleared."))return;
  els.reset.disabled=true;
  try{await rebuildPlayersForMode(els.mode.value||state.gameMode);els.popup.classList.remove("show");}finally{els.reset.disabled=false;}
}
els.winnerContinue.addEventListener("click",continueProgressiveGame);
els.reset.addEventListener("click",resetGame);
els.winnerRestart.addEventListener("click",resetGame);
els.closeWinner.addEventListener("click",()=>els.popup.classList.remove("show"));
setInterval(updateStatistics,1000);
initialise().catch((error)=>{console.error(error);els.status.textContent="Firebase connection failed.";});


// Responsive host navigation: page stays fixed while mobile sections switch in-place.
const hostShell = document.querySelector(".host-shell");
const hostNavButtons = document.querySelectorAll("[data-host-view]");
function setHostView(view) {
  if (!hostShell) return;
  hostShell.dataset.hostView = view;
  hostNavButtons.forEach((button) => button.classList.toggle("active", button.dataset.hostView === view));
}
hostNavButtons.forEach((button) => button.addEventListener("click", () => setHostView(button.dataset.hostView)));
setHostView("control");
