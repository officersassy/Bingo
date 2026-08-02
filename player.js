import { database } from "./firebase.js";

import {
ref,
get,
onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";



let playerID =
localStorage.getItem("bingoPlayer");

let myCard=[];



const card =
document.getElementById("card");

const welcome =
document.getElementById("welcomePlayer");





async function loadPlayer(){


if(!playerID){

window.location.href="join.html";

return;

}



let playerRef =
ref(database,"bingo/players/"+playerID);



let snapshot =
await get(playerRef);



if(!snapshot.exists()){

window.location.href="join.html";

return;

}



let player =
snapshot.val();



myCard =
player.card;



welcome.innerHTML =
"Welcome " + player.name;



drawCard();


}







function drawCard(){


card.innerHTML="";



myCard.forEach(row=>{


row.forEach(number=>{


let box =
document.createElement("div");



box.className="number";

box.innerHTML =
number;



if(number==="FREE"){

box.classList.add("free");

}



else{


box.onclick=function(){

box.classList.toggle("selected");

};


}



card.appendChild(box);



});


});


}







onValue(
ref(database,"bingo/currentCall"),
(snapshot)=>{


let data =
snapshot.val();


if(!data)
return;



document.getElementById("playerCurrent")
.innerHTML=data.call;


});






window.claimBingo=function(){


alert("Bingo submitted");


};






loadPlayer();
