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
  closeWinner: document.getElementById("closeWinnerButton"), winnerContinue: document.getElementById("winnerContinueButton"),
  winnerRestart: document.getElementById("winnerRestartButton"), statPlayers: document.getElementById("statPlayers"),
  statCalled: document.getElementById("statCalled"), statRemaining: document.getElementById("statRemaining"),
  statElapsed: document.getElementById("statElapsed"), statAverage: document.getElementById("statAverage"),
  statStage: document.getElementById("statStage"), historySummary: document.getElementById("historySummary"),
  sassy: document.getElementById("generalSassyMessage")
};

let state = { status: "joining", joiningOpen: true, locked: false, gameMode: "progressive", progressiveStage: "one-line" };
let calledNumbers = [], callTimes = [], currentWinner = null, startedAt = null;

const ranges = [[1,9],[10,19],[20,29],[30,39],[40,49],[50,59],[60,69],[70,79],[80,90]];
const sassyCalls = [
  "Eyes down. Ninety balls, zero excuses.",
  "General Sassy reminds you that shouting ‘nearly’ changes nothing.",
  "Somebody is sweating over a missing number. Delicious.",
  "Keep dabbing, recruits. Hope is not a recognised strategy.",
  "Ninety-ball Bingo: because seventy-five apparently wasn't dramatic enough."
];
const sassyRestarts = [
  "Fresh tickets issued. Same players, brand-new opportunities for disappointment.",
  "General Sassy has reset the battlefield. Try harder this time.",
  "New tickets, cleared dabs, and absolutely no refunds."
];
const pick = (items) => items[Math.floor(Math.random() * items.length)];

async function broadcast(message, event="comment") {
  if (els.sassy) els.sassy.textContent = `“${message}”`;
  await set(ref(database, "bingo/generalSassy"), { message, event, time: Date.now() });
}

const tabs = document.querySelectorAll("[data-host-tab]");
const views = document.querySelectorAll("[data-host-view]");
tabs.forEach((tab) => tab.addEventListener("click", () => {
  tabs.forEach((item) => item.classList.toggle("active", item === tab));
  views.forEach((view) => view.classList.toggle("active", view.dataset.hostView === tab.dataset.hostTab));
}));

function unique(min,max,count){const a=[];while(a.length<count){const n=Math.floor(Math.random()*(max-min+1))+min;if(!a.includes(n))a.push(n)}return a.sort((x,y)=>x-y)}
function createTicket(){
  let rows;
  do {
    rows=Array.from({length:3},()=>{const c=[];while(c.length<5){const n=Math.floor(Math.random()*9);if(!c.includes(n))c.push(n)}return c.sort((a,b)=>a-b)});
  } while (!Array.from({length:9},(_,c)=>rows.some(r=>r.includes(c))).every(Boolean));
  const ticket=Array(27).fill("BLANK");
  for(let c=0;c<9;c++){const active=[0,1,2].filter(r=>rows[r].includes(c));const nums=unique(ranges[c][0],ranges[c][1],active.length);active.forEach((r,i)=>ticket[r*9+c]=nums[i])}
  return ticket;
}
function createTickets(count){return Array.from({length:Math.min(3,Math.max(1,Number(count)||1))},createTicket)}
function numberFrom(call){if(typeof call==="number")return call;if(call&&Number.isFinite(Number(call.number)))return Number(call.number);const m=String(typeof call==="string"?call:call?.call||"").match(/\d+/);return m?Number(m[0]):null}
function callText(call){return typeof call==="string"?call:call?.call||"--"}
function stageName(stage){return ({"one-line":"One Line","two-lines":"Two Lines","full-house":"Full House"})[stage]||"One Line"}
function modeName(mode){return ({progressive:"Progressive 90-Ball","one-line":"One Line","two-lines":"Two Lines","full-house":"Full House"})[mode]||"Progressive 90-Ball"}
function activeTarget(){return state.gameMode==="progressive"?state.progressiveStage:state.gameMode}
function modeDescription(mode){return ({progressive:"One continuous 90-ball round: One Line, then Two Lines, then Full House. Tickets and calls carry forward.","one-line":"First complete horizontal line on one ticket wins.","two-lines":"Complete two horizontal lines on one ticket.","full-house":"Dab all 15 numbers on one ticket."})[mode]||"90-ball Bingo."}
function format(ms){const t=Math.floor(Math.max(0,ms)/1000);return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`}
function updateStats(){
  if(els.statPlayers)els.statPlayers.textContent=els.count?.textContent||"0";
  if(els.statCalled)els.statCalled.textContent=String(calledNumbers.length);
  if(els.statRemaining)els.statRemaining.textContent=String(Math.max(0,90-calledNumbers.length));
  if(els.statStage)els.statStage.textContent=stageName(activeTarget());
  if(els.historySummary)els.historySummary.textContent=`${calledNumbers.length} of 90`;
  if(els.statElapsed)els.statElapsed.textContent=startedAt?format(Date.now()-startedAt):"00:00";
  if(els.statAverage)els.statAverage.textContent=callTimes.length<2?"—":`${Math.max(1,Math.round((Math.max(...callTimes)-Math.min(...callTimes))/(callTimes.length-1)/1000))}s`;
}
function updateControls(){
  els.open.disabled=state.status==="joining"&&state.joiningOpen;
  els.start.disabled=["playing","stage-winner","winner"].includes(state.status);
  els.call.disabled=state.status!=="playing"||state.locked||calledNumbers.length>=90;
  els.mode.disabled=["playing","stage-winner","winner"].includes(state.status);
  els.mode.value=state.gameMode;els.modeDesc.textContent=modeDescription(state.gameMode);
}

async function initialise(){
  const snap=await get(bingoRef);
  if(!snap.exists())await set(bingoRef,{gameId:`game-${Date.now()}`,status:"joining",joiningOpen:true,locked:false,gameMode:"progressive",progressiveStage:"one-line",ballCount:90,createdAt:Date.now()});
  else {const g=snap.val(),patch={};if(!g.gameId)patch.gameId=`game-${Date.now()}`;if(!g.status)patch.status="joining";if(g.joiningOpen===undefined)patch.joiningOpen=true;if(g.locked===undefined)patch.locked=false;if(!g.gameMode)patch.gameMode="progressive";if(!g.progressiveStage)patch.progressiveStage="one-line";patch.ballCount=90;if(Object.keys(patch).length)await update(bingoRef,patch)}
}

onValue(bingoRef,(snap)=>{const g=snap.val()||{};state={status:g.status||"joining",joiningOpen:g.joiningOpen!==false,locked:Boolean(g.locked),gameMode:g.gameMode||"progressive",progressiveStage:g.progressiveStage||"one-line"};startedAt=Number(g.startedAt||0)||null;const target=stageName(activeTarget());els.status.textContent=state.status==="playing"?`${modeName(state.gameMode)} — playing for ${target}`:state.status==="stage-winner"?`${target} winner — continue when ready`:state.status==="winner"?`Final ${target} winner`:`${state.joiningOpen?"Joining open":"Joining closed"} — ${modeName(state.gameMode)}`;updateControls();updateStats()});
onValue(ref(database,"bingo/generalSassy"),(snap)=>{if(snap.val()?.message&&els.sassy)els.sassy.textContent=`“${snap.val().message}”`});
onValue(playersRef,(snap)=>{const entries=Object.entries(snap.val()||{});els.count.textContent=String(entries.length);els.list.innerHTML="";if(!entries.length){els.list.textContent="No players yet.";updateStats();return}entries.sort((a,b)=>String(a[1].name||"").localeCompare(String(b[1].name||""))).forEach(([id,p])=>{const row=document.createElement("div");row.className="player-row";const name=document.createElement("span");name.textContent=`👤 ${p.name||id} — ${p.cardCount||p.cards?.length||1} ticket${(p.cardCount||p.cards?.length||1)===1?"":"s"}`;const btn=document.createElement("button");btn.className="mini danger";btn.textContent="Remove";btn.onclick=async()=>{if(!confirm(`General Sassy would like permission to evict ${p.name||id}. Proceed?`))return;const msg=`General Sassy has revoked ${p.name||id}'s 90-ball privileges.`;await set(ref(database,`bingo/kickedPlayers/${id}`),{message:msg,time:Date.now()});await remove(ref(database,`bingo/players/${id}`));await broadcast(msg,"kick")};row.append(name,btn);els.list.appendChild(row)});updateStats()});
onValue(currentRef,(snap)=>{els.current.textContent=snap.exists()?callText(snap.val()):"--";if(snap.exists()){els.current.classList.remove("number-pop");void els.current.offsetWidth;els.current.classList.add("number-pop")}});
onValue(callsRef,(snap)=>{const calls=Object.values(snap.val()||{});calledNumbers=[...new Set(calls.map(numberFrom).filter(Number.isFinite))];callTimes=calls.map(c=>Number(c.calledAt||0)).filter(Boolean);const newest=[...calls].reverse();const draw=(el,list)=>{el.innerHTML="";list.forEach(c=>{const b=document.createElement("div");b.className="called";b.textContent=callText(c);el.appendChild(b)})};draw(els.last,newest.slice(0,10));draw(els.all,newest);updateControls();updateStats()});
onValue(winnerRef,(snap)=>{if(!snap.exists()){currentWinner=null;els.popup.classList.remove("show");return}currentWinner=snap.val();const won=currentWinner.stage||activeTarget();els.winnerName.textContent=`${currentWinner.name||"A player"} has won ${stageName(won)} on Ticket ${(currentWinner.winningCardIndex??0)+1}!`;const more=state.gameMode==="progressive"&&won!=="full-house";els.winnerContinue.style.display=more?"inline-flex":"none";els.winnerContinue.textContent=won==="one-line"?"Continue to Two Lines":"Continue to Full House";els.popup.classList.add("show")});

els.mode.addEventListener("change",()=>update(bingoRef,{gameMode:els.mode.value,progressiveStage:"one-line",ballCount:90}));
els.open.addEventListener("click",async()=>{await update(bingoRef,{status:"joining",joiningOpen:true,locked:false});await broadcast("Recruitment is open. Choose up to three tickets and try to keep up.","joining-open")});
els.start.addEventListener("click",async()=>{if(!(await get(playersRef)).exists()){alert("No players have joined yet.");return}await update(bingoRef,{status:"playing",joiningOpen:false,locked:false,gameMode:els.mode.value,progressiveStage:"one-line",ballCount:90,startedAt:Date.now()});await broadcast("Eyes down. Ninety balls are now under General Sassy's command.","game-start")});
els.call.addEventListener("click",async()=>{if(state.status!=="playing"||state.locked)return;if(calledNumbers.length>=90){alert("All 90 balls have been called.");return}let n;do{n=Math.floor(Math.random()*90)+1}while(calledNumbers.includes(n));const data={call:String(n),number:n,calledAt:Date.now()};els.call.disabled=true;try{await set(currentRef,data);await push(callsRef,data);if((calledNumbers.length+1)%7===0)await broadcast(pick(sassyCalls),"call-comment")}finally{updateControls()}});

async function continueGame(){if(!currentWinner||state.gameMode!=="progressive")return;const won=currentWinner.stage||state.progressiveStage;const next=won==="one-line"?"two-lines":"full-house";await remove(winnerRef);await update(bingoRef,{status:"playing",locked:false,progressiveStage:next,stageStartedAt:Date.now()});await broadcast(`General Sassy now demands ${stageName(next)}. Same tickets, same calls, more pressure.`,"stage-continue");els.popup.classList.remove("show")}
async function resetGame(){if(!confirm("Restart? Every player keeps their chosen ticket count but receives brand-new 90-ball tickets."))return;els.reset.disabled=true;try{const players=(await get(playersRef)).val()||{},gameId=`game-${Date.now()}`,fresh={};Object.entries(players).forEach(([id,p])=>{const count=Math.min(3,Math.max(1,Number(p.cardCount||p.cards?.length||1)));fresh[id]={...p,cards:createTickets(count),cardCount:count,markedCards:null,gameId,cardCreatedAt:Date.now()}});await set(bingoRef,{gameId,status:"joining",joiningOpen:true,locked:false,gameMode:els.mode.value||state.gameMode,progressiveStage:"one-line",ballCount:90,createdAt:Date.now(),restartTime:Date.now(),generalSassy:{message:pick(sassyRestarts),event:"restart",time:Date.now()},players:fresh});els.popup.classList.remove("show")}finally{els.reset.disabled=false}}
els.winnerContinue.addEventListener("click",continueGame);els.reset.addEventListener("click",resetGame);els.winnerRestart.addEventListener("click",resetGame);els.closeWinner.addEventListener("click",()=>els.popup.classList.remove("show"));
setInterval(updateStats,1000);initialise().catch(e=>{console.error(e);els.status.textContent="Firebase connection failed."});
