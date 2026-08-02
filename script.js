// ==========================
// FIREBASE
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



// YOUR FIREBASE CONFIG

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

const callsRef = ref(database,"bingo/game/calledNumbers");





let gameLocked=false;

let calledNumbers=[];







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


    } while(calledNumbers.includes(number));




    calledNumbers.push(number);




    let letter;


    if(number<=15) letter="B";
    else if(number<=30) letter="I";
    else if(number<=45) letter="N";
    else if(number<=60) letter="G";
    else letter="O";



    let call =
    letter+" "+number;




    // save current call

    update(gameRef,{

        currentCall:call

    });





    // save history

    push(callsRef,call);



};








// ==========================
// FIREBASE LIVE UPDATE
// ==========================


onValue(gameRef,(snapshot)=>{


    let data=snapshot.val();



    if(!data)return;




    if(data.currentCall){



        let host =
        document.getElementById("currentNumber");


        if(host){

            host.innerHTML =
            data.currentCall;

        }





        let player =
        document.getElementById("playerCurrent");


        if(player){

            player.innerHTML =
            data.currentCall;

        }


    }





    if(data.locked){

        gameLocked=true;

    }



});









// ==========================
// SHOW CALLED NUMBERS
// ==========================


onValue(callsRef,(snapshot)=>{


    let calls =
    snapshot.val();



    let history =
    document.getElementById("calledNumbers");


    let last =
    document.getElementById("lastCalls");




    if(!history && !last){

        return;

    }



    if(history){

        history.innerHTML="";

    }



    if(last){

        last.innerHTML="";

    }





    if(calls){



        let list =
        Object.values(calls).reverse();



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


    }



});










// ==========================
// RESET GAME
// ==========================


window.resetGame=function(){


    set(gameRef,{

        currentCall:"--",

        winner:null,

        locked:false,

        calledNumbers:null

    });



    gameLocked=false;

    calledNumbers=[];


};
