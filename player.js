// ==========================
// BINGO PLAYER ORIGINAL
// ==========================

import { database } from "./firebase.js";

import {
    ref,
    get,
    onValue,
    set
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";


let playerID = localStorage.getItem("bingoPlayer");

let myCard = [];



const cardArea =
document.getElementById("card");


const welcome =
document.getElementById("welcomePlayer");




// LOAD PLAYER

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



    if(welcome){

        welcome.innerHTML =
        "Welcome " + player.name;

    }



    displayCard();


}






// DISPLAY CARD

function displayCard(){


    cardArea.innerHTML="";


    myCard.forEach(row=>{


        row.forEach(number=>{


            let square =
            document.createElement("div");


            square.className="number";


            square.innerHTML =
            number;



            if(number==="FREE"){


                square.classList.add("free");


            }



            else{


                square.onclick=function(){


                    square.classList.toggle("selected");


                };


            }



            cardArea.appendChild(square);


        });


    });


}






// CURRENT NUMBER

onValue(
ref(database,"bingo/currentCall"),
(snapshot)=>{


    let data =
    snapshot.val();


    if(!data)
    return;



    let display =
    document.getElementById("playerCurrent");


    if(display){

        display.innerHTML =
        data.call;

    }


});






// BINGO BUTTON

window.claimBingo=function(){


    alert("Bingo checked!");

};






loadPlayer();
