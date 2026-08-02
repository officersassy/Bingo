// ==========================
// FIREBASE
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    push,
    onValue
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





// DATABASE PATHS

const currentRef =
ref(database,"bingo/currentCall");


const callsRef =
ref(database,"bingo/calledNumbers");


const winnerRef =
ref(database,"bingo/winner");


const lockedRef =
ref(database,"bingo/locked");





let calledNumbers=[];

let gameLocked=false;






// ==========================
// BINGO LETTER
// ==========================


function getLetter(number){

    if(number<=15)
        return "B";

    if(number<=30)
        return "I";

    if(number<=45)
        return "N";

    if(number<=60)
        return "G";

    return "O";

}







// ==========================
// HOST CALL NUMBER
// ==========================


window.callNumber=function(){


    if(gameLocked){

        return;

    }



    let number;



    do {


        number =
        Math.floor(Math.random()*75)+1;


    }
    while(calledNumbers.includes(number));





    calledNumbers.push(number);



    let call =
    getLetter(number)+" "+number;





    set(currentRef,{

        call:call,

        time:Date.now()

    });





    push(callsRef,call);



};









// ==========================
// CURRENT NUMBER DISPLAY
// ==========================


onValue(currentRef,(snapshot)=>{


    let data=snapshot.val();


    if(!data)
        return;



    let current =
    document.getElementById("currentNumber");


    if(current){

        current.innerHTML=data.call;

    }



});









// ==========================
// CALL HISTORY
// ==========================


onValue(callsRef,(snapshot)=>{


    let data=snapshot.val();



    let history =
    document.getElementById("calledNumbers");


    let last =
    document.getElementById("lastCalls");



    if(history)
        history.innerHTML="";



    if(last)
        last.innerHTML="";




    if(!data)
        return;




    let list =
    Object.values(data).reverse();





    list.forEach((call,index)=>{


        let box =
        document.createElement("div");


        box.className="called";

        box.innerHTML=call;





        if(history){

            history.appendChild(
                box.cloneNode(true)
            );

        }




        if(last && index < 5){

            last.appendChild(
                box.cloneNode(true)
            );

        }


    });





    let count =
    document.getElementById("calledCount");


    let remaining =
    document.getElementById("remainingCount");



    if(count){

        count.innerHTML=list.length;

    }


    if(remaining){

        remaining.innerHTML=75-list.length;

    }




});









// ==========================
// WINNER POPUP
// ==========================


onValue(winnerRef,(snapshot)=>{


    let winner =
    snapshot.val();



    if(!winner)
        return;



    gameLocked=true;



    let popup =
    document.getElementById("winnerPopup");


    let text =
    document.getElementById("winnerText");



    if(popup && text){


        text.innerHTML =

        "🎉 BINGO WINNER 🎉<br><br>"
        +
        winner.name
        +
        "<br><br>🏆 HAS WON!";



        popup.classList.add("show");


    }



});









// ==========================
// CLOSE WINNER
// ==========================


window.closeWinner=function(){


    let popup =
    document.getElementById("winnerPopup");



    if(popup){

        popup.classList.remove("show");

    }


};









// ==========================
// RESET GAME
// ==========================


window.resetGame=function(){


    if(!confirm("Start a new Bingo game?"))
        return;



    set(ref(database,"bingo"),{


        currentCall:null,


        calledNumbers:null,


        winner:null,


        locked:false,


        restartTime:Date.now()


    });



    calledNumbers=[];


    gameLocked=false;



    let popup =
    document.getElementById("winnerPopup");



    if(popup){

        popup.classList.remove("show");

    }



};
