import { database } from "./firebase.js";
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const playerId = localStorage.getItem("bingoPlayerId") || localStorage.getItem("bingoPlayer");
const els = {
  welcome: document.getElementById("welcomePlayer"), status: document.getElementById("playerStatus"),
  current: document.getElementById("playerCurrent"), tabs: document.getElementById("cardTabs"),
  container: document.getElementById("cardsContainer"), bingo: document.getElementById("bingoButton"),
  popup: document.getElementById("winnerPopup"), winnerName: document.getElementById("winnerName"),
  closeWinner: document.getElementById("closeWinnerButton"), stageBadge: document.getElementById("stageBadge"),
  targetInstruction: document.getElementById("targetInstruction"), calledCount: document.getElementById("playerCalledCount"),
  dabbedCount: document.getElementById("playerDabbedCount"), sassy: document.getElementById("playerSassyMessage")
};

let player=null,cards=[],markedCards=[],called=[],gameId=null,activeCard=0,lastWinnerKey=null;
let state={status:"joining",locked:false,gameMode:"progressive",progressiveStage:"one-line"};
const invalid=["General Sassy checked every ticket. Nice try.","That claim has been denied with theatrical disappointment.","Almost is not a recognised prize category.","General Sassy sees enthusiasm, but not a winning ticket."];
const pick=(a)=>a[Math.floor(Math.random()*a.length)];
function stageName(s){return ({"one-line":"One Line","two-lines":"Two Lines","full-house":"Full House"})[s]||"One Line"}
function activeTarget(){return state.gameMode==="progressive"?state.progressiveStage:state.gameMode}
function instruction(t){return ({"one-line":"Complete any horizontal line on one ticket.","two-lines":"Complete any two horizontal lines on one ticket.","full-house":"Dab all 15 numbers on one ticket."})[t]||"Complete a line."}
function normaliseCards(data){if(!data)return[];const top=Array.isArray(data)?data:Object.values(data);return top.map(card=>Array.isArray(card)?card:Object.values(card))}
function normaliseMarks(data,count){const result=Array.from({length:count},()=>[]);if(!data)return result;const source=Array.isArray(data)?data:Object.values(data);source.forEach((marks,index)=>{if(index<count&&marks)result[index]=(Array.isArray(marks)?marks:Object.values(marks)).map(Number).filter(Number.isFinite)});return result}
function numberFrom(call){if(typeof call==="number")return call;if(call&&Number.isFinite(Number(call.number)))return Number(call.number);const m=String(typeof call==="string"?call:call?.call||"").match(/\d+/);return m?Number(m[0]):null}
function show(message,type=""){els.status.textContent=message;els.status.dataset.type=type}
function clearStorage(){["bingoPlayerId","bingoPlayer","bingoPlayerName","bingoGameId"].forEach(k=>localStorage.removeItem(k))}
function updateDashboard(){const t=activeTarget();els.stageBadge.textContent=stageName(t);els.targetInstruction.textContent=instruction(t);els.calledCount.textContent=String(called.length);els.dabbedCount.textContent=String(markedCards.reduce((sum,m)=>sum+m.length,0))}

function drawTabs(){els.tabs.innerHTML="";cards.forEach((_,index)=>{const button=document.createElement("button");button.type="button";button.className=`card-tab${index===activeCard?" active":""}`;button.textContent=`Ticket ${index+1}`;button.onclick=()=>{activeCard=index;drawAll()};els.tabs.appendChild(button)});els.tabs.style.display=cards.length>1?"flex":"none"}
function drawAll(){if(!cards.length)return;activeCard=Math.min(activeCard,cards.length-1);drawTabs();els.container.innerHTML="";cards.forEach((card,index)=>{const ticket=document.createElement("section");ticket.className=`ninety-ticket${index===activeCard?" active":""}`;ticket.dataset.cardIndex=String(index);card.forEach((value,cellIndex)=>{const cell=document.createElement("div");cell.className="ninety-cell";if(value==="BLANK"||value===null||value===undefined){cell.classList.add("blank");cell.setAttribute("aria-hidden","true")}else{const n=Number(value);cell.textContent=String(n);if(called.includes(n))cell.classList.add("called");if(markedCards[index]?.includes(n))cell.classList.add("selected");cell.onclick=()=>dab(index,n)}ticket.appendChild(cell)});els.container.appendChild(ticket)});updateDashboard()}

async function dab(cardIndex,number){
  if(state.status!=="playing"||state.locked){show("The game is not open for dabbing.","error");return}
  if(!called.includes(number)){show("That ball has not been called yet.","warning");return}
  const marks=markedCards[cardIndex]||[];
  markedCards[cardIndex]=marks.includes(number)?marks.filter(n=>n!==number):[...marks,number].sort((a,b)=>a-b);
  drawAll();
  try{await set(ref(database,`bingo/players/${playerId}/markedCards`),markedCards.some(m=>m.length)?markedCards:null)}catch(e){console.error(e);show("Your dab could not be saved.","error")}
}

function rowComplete(cardIndex,row){const card=cards[cardIndex],marks=markedCards[cardIndex]||[];return Array.from({length:9},(_,col)=>card[row*9+col]).filter(v=>v!=="BLANK").every(v=>marks.includes(Number(v))&&called.includes(Number(v)))}
function winningCardIndex(){const target=activeTarget();for(let i=0;i<cards.length;i++){const rows=[0,1,2].filter(r=>rowComplete(i,r)).length;if(target==="one-line"&&rows>=1)return i;if(target==="two-lines"&&rows>=2)return i;if(target==="full-house"&&rows===3)return i}return -1}

els.bingo.addEventListener("click",async()=>{
  const target=activeTarget();
  if(!player||state.status!=="playing"||state.locked){show("The game is not ready for a claim.","warning");return}
  const cardIndex=winningCardIndex();
  if(cardIndex<0){show(`${pick(invalid)} You still need ${stageName(target)} on one ticket.`,"error");return}
  els.bingo.disabled=true;
  try{
    if((await get(ref(database,"bingo/winner"))).exists()){show("A winner has already claimed this stage.","warning");return}
    const final=state.gameMode!=="progressive"||target==="full-house";
    await set(ref(database,"bingo/winner"),{playerId,name:player.name||playerId,cards,markedCards,winningCardIndex:cardIndex,gameId,gameMode:state.gameMode,stage:target,claimedAt:Date.now(),verified:true});
    await update(ref(database,"bingo"),{status:final?"winner":"stage-winner",locked:true});
  } finally {els.bingo.disabled=false}
});

onValue(ref(database,`bingo/kickedPlayers/${playerId||"missing"}`),(snap)=>{if(!snap.exists())return;alert(`🎖️ ${snap.val()?.message||"General Sassy has removed you."}`);clearStorage();window.location.href="join.html"});
onValue(ref(database,"bingo/generalSassy"),(snap)=>{if(snap.val()?.message&&els.sassy)els.sassy.textContent=`“${snap.val().message}”`});
onValue(ref(database,`bingo/players/${playerId||"missing"}`),(snap)=>{if(!playerId||!snap.exists()){if(!playerId){clearStorage();window.location.href="join.html"}return}const old=gameId;player=snap.val();cards=normaliseCards(player.cards||player.card);markedCards=normaliseMarks(player.markedCards||player.marked,cards.length);gameId=player.gameId||null;els.welcome.textContent=`Welcome, ${player.name||playerId} — ${cards.length} ticket${cards.length===1?"":"s"}`;if(old&&gameId&&old!==gameId)show("Fresh round: new tickets, cleared dabs, same General Sassy.","success");drawAll()});
onValue(ref(database,"bingo/currentCall"),(snap)=>{const v=snap.val();els.current.textContent=v?(typeof v==="string"?v:v.call||"--"):"--";if(v){els.current.classList.remove("number-pop");void els.current.offsetWidth;els.current.classList.add("number-pop")}});
onValue(ref(database,"bingo/calledNumbers"),(snap)=>{called=[...new Set(Object.values(snap.val()||{}).map(numberFrom).filter(Number.isFinite))];drawAll()});
onValue(ref(database,"bingo"),(snap)=>{const g=snap.val()||{};state={status:g.status||"joining",locked:Boolean(g.locked),gameMode:g.gameMode||"progressive",progressiveStage:g.progressiveStage||"one-line"};updateDashboard();const target=stageName(activeTarget());if(state.status==="playing")show(`90-ball game in progress — playing for ${target}.`,"success");else if(state.status==="stage-winner")show(`${target} winner announced. Waiting for the next stage.`,"warning");else if(state.status==="winner")show(`Final ${target} winner announced.`,"warning");else show(`Waiting for General Sassy — ${target}.`)});
onValue(ref(database,"bingo/winner"),(snap)=>{if(!snap.exists()){els.popup.classList.remove("show");lastWinnerKey=null;return}const w=snap.val(),stage=w.stage||activeTarget();els.winnerName.textContent=`${w.name||"A player"} has won ${stageName(stage)} on Ticket ${(w.winningCardIndex??0)+1}!`;els.popup.classList.add("show");const key=`${w.claimedAt||0}-${stage}`;if(key!==lastWinnerKey){lastWinnerKey=key;fireConfetti()}});
els.closeWinner.addEventListener("click",()=>els.popup.classList.remove("show"));

let confettiActive=false;function fireConfetti(){if(confettiActive)return;confettiActive=true;const canvas=document.createElement("canvas");canvas.className="confetti-canvas";document.body.appendChild(canvas);const c=canvas.getContext("2d"),pieces=[],colours=["#facc15","#38bdf8","#22c55e","#ef4444","#a855f7","#fff"];const resize=()=>{canvas.width=innerWidth;canvas.height=innerHeight};resize();addEventListener("resize",resize);for(const side of[0,innerWidth])for(let i=0;i<130;i++)pieces.push({x:side,y:innerHeight*.75,vx:(side===0?1:-1)*(4+Math.random()*10),vy:-(7+Math.random()*13),g:.2+Math.random()*.08,r:Math.random()*6.28,rs:(Math.random()-.5)*.3,col:pick(colours),w:5+Math.random()*8,h:4+Math.random()*7,a:1});const start=performance.now();function frame(now){c.clearRect(0,0,canvas.width,canvas.height);pieces.forEach(p=>{p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.r+=p.rs;if(now-start>3500)p.a-=.02;c.save();c.globalAlpha=Math.max(0,p.a);c.translate(p.x,p.y);c.rotate(p.r);c.fillStyle=p.col;c.fillRect(-p.w/2,-p.h/2,p.w,p.h);c.restore()});if(now-start<6000)requestAnimationFrame(frame);else{removeEventListener("resize",resize);canvas.remove();confettiActive=false}}requestAnimationFrame(frame)}
