// ==========================
// FIREBASE CONNECTION
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue,
    push
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


// KEEP YOUR OWN FIREBASE CONFIG HERE

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

const currentRef = ref(database,"bingo/currentCall");

const callsRef = ref(database,"bingo/calledNumbers");

const winnerRef = ref(database,"bingo/winner");

const lockedRef = ref(database,"bingo/locked");




// VARIABLES

let calledNumbers = [];

let myCard = [];

let playerName = "";

let gameLocked = false;





// ==========================
// BINGO CARD CREATION
// ==========================


const card = document.getElementById("card");


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


    if(!card) return;


    card.innerHTML="";


    myCard=[];



    let columns=[

        randomNumbers(1,15,5),
        randomNumbers(16,30,5),
        randomNumbers(31,45,5),
        randomNumbers(46,60,5),
        randomNumbers(61,75,5)

    ];




    for(let row=0;row<5;row++){


        let newRow=[];


        for(let col=0;col<5;col++){


            let square =
            document.createElement("div");


            square.className="number";



            if(row===2 && col===2){


                square.innerHTML="FREE";

                square.classList.add("free");

                newRow.push("FREE");


            }
            else{


                let number =
                columns[col][row];


                square.innerHTML=number;


                newRow.push(number);



                square.onclick=function(){

                    square.classList.toggle("selected");

                };


            }


            card.appendChild(square);


        }


        myCard.push(newRow);


    }


};



createCard();







// ==========================
// PLAYER NAME
// ==========================


window.saveName=function(){


    let input =
    document.getElementById("playerName");


    if(!input.value){

        alert("Enter your name");

        return;

    }


    playerName=input.value;


    alert(
        "Welcome "+playerName
    );


};









// ==========================
// HOST CALL NUMBER
// ==========================


window.callNumber=function(){


    if(gameLocked){

        alert("Game finished");

        return;

    }



    let number;


    do{

        number =
        Math.floor(Math.random()*75)+1;


    }
    while(calledNumbers.includes(number));



    calledNumbers.push(number);



    let letter;


    if(number<=15)
    letter="B";

    else if(number<=30)
    letter="I";

    else if(number<=45)
    letter="N";

    else if(number<=60)
    letter="G";

    else
    letter="O";



    let call =
    letter+" "+number;



    set(currentRef,{

        call:call,

        time:Date.now()

    });



    push(callsRef,call);


};









// ==========================
// LIVE NUMBER DISPLAY
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
// CALLED NUMBERS DISPLAY
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



    let list =
    Object.values(data).reverse();




    list.forEach((call,index)=>{


        let div =
        document.createElement("div");


        div.className="called";

        div.innerHTML=call;



        if(history){

            history.appendChild(
                div.cloneNode(true)
            );

        }



        if(last && index<5){

            last.appendChild(
                div.cloneNode(true)
            );

        }


    });


});









// ==========================
// BINGO CHECK
// ==========================


window.claimBingo=function(){


    if(gameLocked)return;



    let marked=[];



    document.querySelectorAll(".selected")
    .forEach(item=>{


        marked.push(
            Number(item.innerHTML)
        );


    });




    let win=false;




    // ROWS

    for(let r=0;r<5;r++){


        let good=true;


        for(let c=0;c<5;c++){


            let n=myCard[r][c];


            if(n!="FREE" &&
            !marked.includes(Number(n))){

                good=false;

            }


        }


        if(good)
        win=true;


    }






    // COLUMNS

    for(let c=0;c<5;c++){


        let good=true;


        for(let r=0;r<5;r++){


            let n=myCard[r][c];


            if(n!="FREE" &&
            !marked.includes(Number(n))){

                good=false;

            }


        }


        if(good)
        win=true;


    }







    if(!win){

        alert("❌ Not a valid Bingo");

        return;

    }





    set(winnerRef,{

        name:
        playerName || "Unknown Player",

        time:Date.now()

    });



    set(lockedRef,true);


};









// ==========================
// WINNER POPUP
// ==========================


onValue(winnerRef,(snap)=>{


    let winner=snap.val();


    if(!winner)return;



    gameLocked=true;



    document.querySelectorAll(".winner-popup")
    .forEach(p=>{


        p.classList.add("show");


        p.innerHTML=

        "🎉 BINGO WINNER 🎉<br><br>"
        +
        winner.name
        +
        "<br><br>🏆 HAS WON!";


    });


});









// ==========================
// RESET
// ==========================


window.resetGame=function(){


    set(currentRef,null);

    set(callsRef,null);

    set(winnerRef,null);

    set(lockedRef,false);



    calledNumbers=[];

    gameLocked=false;


};
