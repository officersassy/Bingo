// ==========================
// FIREBASE CONNECTION
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    update,
    onValue,
    push
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";




// KEEP YOUR FIREBASE CONFIG

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





// DATABASE LOCATIONS

const currentRef =
ref(database,"bingo/currentCall");


const callsRef =
ref(database,"bingo/calledNumbers");


const winnerRef =
ref(database,"bingo/winner");






let calledNumbers=[];

let myCard=[];

let playerName="";

let gameLocked=false;








// ==========================
// BINGO CARD
// ==========================


const card =
document.getElementById("card");



function randomNumbers(min,max,total){


let numbers=[];


while(numbers.length < total){


let n =
Math.floor(Math.random()*(max-min+1))+min;



if(!numbers.includes(n)){

numbers.push(n);

}


}


return numbers;


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



let square =
document.createElement("div");


square.className="number";



if(r===2 && c===2){


square.innerHTML="FREE";

row.push("FREE");

square.classList.add("free");


}

else{


let value =
columns[c][r];


square.innerHTML=value;


row.push(value);



square.onclick=function(){

square.classList.toggle("selected");

};


}


card.appendChild(square);


}


myCard.push(row);


}


}



createCard();









// ==========================
// PLAYER NAME
// ==========================


window.saveName=function(){


let box =
document.getElementById("playerName");


if(!box.value){

alert("Enter your name");

return;

}



playerName=box.value;



alert(
"Welcome "+playerName
);


};









// ==========================
// HOST NUMBER CALL
// ==========================


window.callNumber=function(){



if(gameLocked){

return;

}



let number;



do{


number =
Math.floor(Math.random()*75)+1;


}while(calledNumbers.includes(number));




calledNumbers.push(number);




let letter;


if(number<=15) letter="B";
else if(number<=30) letter="I";
else if(number<=45) letter="N";
else if(number<=60) letter="G";
else letter="O";




let call =
letter+" "+number;





set(currentRef,{

call:call,

time:Date.now()

});





push(callsRef,call);


};









// ==========================
// LIVE CURRENT NUMBER
// ==========================


onValue(currentRef,(snap)=>{


let data=snap.val();


if(!data)return;



let host =
document.getElementById("currentNumber");


if(host){

host.innerHTML=data.call;

}




let player =
document.getElementById("playerCurrent");


if(player){

player.innerHTML=data.call;

}


});









// ==========================
// CALLED HISTORY
// ==========================


onValue(callsRef,(snap)=>{


let data=snap.val();



let history =
document.getElementById("calledNumbers");


let last =
document.getElementById("lastCalls");



if(history)
history.innerHTML="";


if(last)
last.innerHTML="";




if(!data)return;



let numbers =
Object.values(data).reverse();




numbers.forEach((call,index)=>{


let item =
document.createElement("div");


item.className="called";


item.innerHTML=call;



if(history){

history.appendChild(
item.cloneNode(true)
);

}



if(last && index<5){

last.appendChild(
item.cloneNode(true)
);

}


});



});









// ==========================
// BINGO CHECK
// ==========================


window.claimBingo=function(){



if(gameLocked){

return;

}



let marked=[];



document.querySelectorAll(".selected")
.forEach(x=>{


marked.push(
Number(x.innerHTML)
);


});





let win=false;



// ROWS

for(let r=0;r<5;r++){


let complete=true;


for(let c=0;c<5;c++){


let n=myCard[r][c];


if(n!="FREE" &&
!marked.includes(Number(n))){

complete=false;

}


}


if(complete){

win=true;

}

}





// COLUMNS

for(let c=0;c<5;c++){


let complete=true;


for(let r=0;r<5;r++){


let n=myCard[r][c];


if(n!="FREE" &&
!marked.includes(Number(n))){

complete=false;

}


}



if(complete){

win=true;

}


}





if(!win){


alert(
"❌ Not a valid Bingo"
);


return;


}





set(winnerRef,{

name:
playerName || "Unknown Player",

time:Date.now()

});



};









// ==========================
// WINNER DISPLAY
// ==========================


onValue(winnerRef,(snap)=>{


let data=snap.val();



if(!data)return;



gameLocked=true;



document.querySelectorAll(".winner-popup")
.forEach(p=>{


p.style.display="block";


p.innerHTML=

"🎉 BINGO WINNER 🎉<br><br>"
+
data.name
+
" has won!";


});


});









// ==========================
// RESET
// ==========================


window.resetGame=function(){



set(winnerRef,null);



set(currentRef,{

call:"--",

time:Date.now()

});



set(callsRef,null);



calledNumbers=[];

gameLocked=false;


};
