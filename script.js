// ==========================
// FIREBASE
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";



const firebaseConfig = {
  apiKey: "AIzaSyDme5iZZNPN0O128vw0MP9aGjLZXD3oKy8",
  authDomain: "bingo-5174e.firebaseapp.com",
  databaseURL: "https://bingo-5174e-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bingo-5174e",
  storageBucket: "bingo-5174e.firebasestorage.app",
  messagingSenderId: "647984877295",
  appId: "1:647984877295:web:a74b477fa7d46dc9cc551a"
};



const app = initializeApp(firebaseConfig);

const database = getDatabase(app);


const gameRef = ref(database,"bingo/game");





// ==========================
// VARIABLES
// ==========================


let myCard=[];

let playerName="";

let gameLocked=false;







// ==========================
// CREATE CARD
// ==========================


const card=document.getElementById("card");



function randomNumbers(min,max,total){

let nums=[];


while(nums.length<total){

let n=Math.floor(Math.random()*(max-min+1))+min;


if(!nums.includes(n)){

nums.push(n);

}

}


return nums;

}





window.createCard=function(){


if(!card)return;


card.innerHTML="";


myCard=[];



let columns=[

randomNumbers(1,15,5),
randomNumbers(16,30,5),
randomNumbers(31,45,5),
randomNumbers(46,60,5),
randomNumbers(61,75,5)

];





for(let r=0;r<5;r++){


let row=[];


for(let c=0;c<5;c++){


let box=document.createElement("div");

box.className="number";



if(r===2 && c===2){

box.innerHTML="FREE";

box.classList.add("free");

row.push("FREE");


}

else{


let value=columns[c][r];


box.innerHTML=value;


row.push(value);



box.onclick=function(){

box.classList.toggle("selected");

};


}



card.appendChild(box);


}



myCard.push(row);


}



}



createCard();







// ==========================
// PLAYER NAME
// ==========================


window.saveName=function(){


let input=document.getElementById("playerName");


if(!input.value){

alert("Enter your name");

return;

}


playerName=input.value;


};









// ==========================
// HOST CALL NUMBER
// ==========================


window.callNumber=function(){


if(gameLocked)return;



let number=Math.floor(Math.random()*75)+1;



let letter;


if(number<=15)letter="B";
else if(number<=30)letter="I";
else if(number<=45)letter="N";
else if(number<=60)letter="G";
else letter="O";



let call=letter+" "+number;




update(gameRef,{

currentCall:call

});


};








// ==========================
// BINGO CHECK
// ==========================


window.claimBingo=function(){


if(gameLocked)return;



let selected=[];


document.querySelectorAll(".selected")
.forEach(x=>{

selected.push(Number(x.innerHTML));

});



let win=false;



// rows

for(let r=0;r<5;r++){


let good=true;


for(let c=0;c<5;c++){


let n=myCard[r][c];


if(n!="FREE" && !selected.includes(Number(n))){

good=false;

}


}


if(good)win=true;


}






// columns

for(let c=0;c<5;c++){


let good=true;


for(let r=0;r<5;r++){


let n=myCard[r][c];


if(n!="FREE" && !selected.includes(Number(n))){

good=false;

}


}



if(good)win=true;


}






if(!win){

alert("Not a valid Bingo!");

return;

}




update(gameRef,{

winner:playerName || "Unknown Player",

locked:true

});


};








// ==========================
// FIREBASE LISTENER
// ==========================


onValue(gameRef,(snap)=>{


let data=snap.val();


if(!data)return;



if(data.currentCall){


let p=document.getElementById("playerCurrent");

if(p)p.innerHTML=data.currentCall;



let h=document.getElementById("currentNumber");

if(h)h.innerHTML=data.currentCall;


}



if(data.locked){


gameLocked=true;


document.querySelectorAll(".winner-popup")
.forEach(x=>{


x.style.display="block";


x.innerHTML=

"🎉 BINGO WINNER 🎉<br><br>"
+
data.winner
+
" has won!";


});


}



});









// ==========================
// RESET
// ==========================


window.resetGame=function(){


gameLocked=false;


set(gameRef,{

currentCall:"--",

winner:null,

locked:false

});


};
