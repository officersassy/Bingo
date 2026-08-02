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



// Main game location

const bingoRef = ref(database,"bingo");

const callsRef = ref(database,"bingo/calledNumbers");





let calledNumbers=[];

let gameLocked=false;





// ==========================
// GET BINGO LETTER
// ==========================

function getLetter(number){

    if(number<=15) return "B";

    if(number<=30) return "I";

    if(number<=45) return "N";

    if(number<=60) return "G";

    return "O";

}





// ==========================
// HOST CALL NUMBER
// ==========================


window.callNumber=function(){


    if(gameLocked){

        alert("Game already won!");

        return;

    }



    let number;



    do {

        number =
        Math.floor(Math.random()*75)+1;


    } while(calledNumbers.includes(number));



    calledNumbers.push(number);



    let call =
    getLetter(number)+" "+number;




    // Save current call

    set(
        ref(database,"bingo/currentCall"),
        {

            call:call,

            time:Date.now()

        }

    );




    // Save history

    push(
        callsRef,
        call
    );


};







// ==========================
// CURRENT CALL DISPLAY
// ==========================


onValue(
ref(database,"bingo/currentCall"),
(snapshot)=>{


    let data=snapshot.val();



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
// CALLED NUMBERS DISPLAY
// ==========================


onValue(
callsRef,
(snapshot)=>{


    let data=snapshot.val();



    let history =
    document.getElementById("calledNumbers");


    let last =
    document.getElementById("lastCalls");



    if(history){

        history.innerHTML="";

    }


    if(last){

        last.innerHTML="";

    }



    if(!data)return;



    let numbers =
    Object.values(data).reverse();




    numbers.forEach((item,index)=>{



        let box =
        document.createElement("div");


        box.className="called";


        box.innerHTML=item;



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

        count.innerHTML=numbers.length;

    }


    if(remaining){

        remaining.innerHTML=75-numbers.length;

    }



});








// ==========================
// WINNER LISTENER
// ==========================


onValue(
ref(database,"bingo/winner"),
(snapshot)=>{


    let winner=snapshot.val();



    if(!winner){

        return;

    }



    gameLocked=true;



    document.querySelectorAll(".winner-popup")
    .forEach(p=>{


        p.style.display="block";


        p.innerHTML=

        "🎉 BINGO WINNER 🎉<br><br>"
        +
        winner
        +
        " has won!";


    });


});









// ==========================
// RESET GAME
// ==========================


window.resetGame=function(){



    set(
        bingoRef,
        {

            currentCall:null,

            calledNumbers:null,

            winner:null,

            locked:false

        }

    );



    calledNumbers=[];

    gameLocked=false;



};
