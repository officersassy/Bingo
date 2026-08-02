// ==========================
// FIREBASE CONNECTION
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { 
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


// ==========================
// PASTE YOUR FIREBASE CONFIG HERE
// ==========================

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

const gameRef = ref(database, "bingo/currentCall");




// ==========================
// PLAYER BINGO CARD
// ==========================

const card = document.getElementById("card");



function randomNumbers(min,max,total){

    let numbers=[];


    while(numbers.length < total){

        let number =
        Math.floor(Math.random()*(max-min+1))+min;


        if(!numbers.includes(number)){

            numbers.push(number);

        }

    }


    return numbers;

}





function createCard(){

    if(!card){

        return;

    }


    card.innerHTML="";


    let columns=[

        randomNumbers(1,15,5),

        randomNumbers(16,30,5),

        randomNumbers(31,45,5),

        randomNumbers(46,60,5),

        randomNumbers(61,75,5)

    ];




    for(let row=0; row<5; row++){


        for(let col=0; col<5; col++){


            let square=document.createElement("div");


            square.className="number";



            if(row===2 && col===2){


                square.innerHTML="FREE";

                square.classList.add("free");


            }

            else{


                square.innerHTML=columns[col][row];


                square.onclick=function(){

                    square.classList.toggle("selected");

                };


            }


            card.appendChild(square);


        }

    }


}



createCard();





// ==========================
// HOST NUMBER CALLER
// ==========================


let calledNumbers=[];




function getLetter(number){


    if(number<=15) return "B";

    if(number<=30) return "I";

    if(number<=45) return "N";

    if(number<=60) return "G";

    return "O";

}





window.callNumber = function(){



    let number;



    do{


        number =
        Math.floor(Math.random()*75)+1;



    }while(calledNumbers.includes(number));



    calledNumbers.push(number);



    let bingoCall =
    getLetter(number)+" "+number;



    // SEND TO FIREBASE

    set(gameRef, {

        call: bingoCall,

        time: Date.now()

    });





    updateHostDisplay(bingoCall);



}





function updateHostDisplay(call){



    let current =
    document.getElementById("currentNumber");



    if(current){

        current.innerHTML=call;


        current.classList.remove("ball-pop");


        void current.offsetWidth;


        current.classList.add("ball-pop");

    }



    let history =
    document.getElementById("calledNumbers");



    if(history){


        let item=document.createElement("div");


        item.className="called";


        item.innerHTML=call;


        history.prepend(item);


    }


}





// ==========================
// LIVE PLAYER LISTENER
// ==========================


onValue(gameRef,(snapshot)=>{


    const data=snapshot.val();



    if(!data){

        return;

    }



    let call=data.call;



    let playerCurrent =
    document.getElementById("playerCurrent");



    if(playerCurrent){


        playerCurrent.innerHTML=call;


    }



    let current =
    document.getElementById("currentNumber");



    if(current){


        current.innerHTML=call;


    }



});







// ==========================
// RESET GAME
// ==========================


window.resetGame=function(){


    set(gameRef,{

        call:"--",

        time:Date.now()

    });



    let current =
    document.getElementById("currentNumber");


    if(current){

        current.innerHTML="--";

    }



    let player =
    document.getElementById("playerCurrent");


    if(player){

        player.innerHTML="--";

    }



    let history =
    document.getElementById("calledNumbers");


    if(history){

        history.innerHTML="";

    }


}
