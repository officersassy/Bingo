// ==========================
// BINGO JOIN SYSTEM
// ==========================

import { database } from "./firebase.js";

import {
    ref,
    get,
    set
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";




// ==========================
// CREATE RANDOM BINGO CARD
// ==========================

function randomNumbers(min, max, total) {

    let numbers = [];

    while (numbers.length < total) {

        let number =
            Math.floor(Math.random() * (max - min + 1)) + min;


        if (!numbers.includes(number)) {

            numbers.push(number);

        }

    }

    return numbers;

}




function createBingoCard() {


    let columns = [

        randomNumbers(1,15,5),

        randomNumbers(16,30,5),

        randomNumbers(31,45,5),

        randomNumbers(46,60,5),

        randomNumbers(61,75,5)

    ];



    let card = [];



    for(let row = 0; row < 5; row++) {


        let line = [];


        for(let col = 0; col < 5; col++) {


            if(row === 2 && col === 2) {


                line.push("FREE");


            } else {


                line.push(
                    columns[col][row]
                );


            }


        }


        card.push(line);


    }



    return card;

}









// ==========================
// JOIN GAME
// ==========================


window.joinGame = async function() {


    let input =
    document.getElementById("playerName");


    let status =
    document.getElementById("joinStatus");



    let name =
    input.value.trim();





    if(name === "") {


        status.innerHTML =
        "❌ Please enter your name";


        return;


    }






    let cleanName =
    name.toLowerCase();




    let playerRef =
    ref(database,"bingo/players/" + cleanName);






    let existing =
    await get(playerRef);






    if(existing.exists()) {


        status.innerHTML =
        "❌ That name is already taken";


        return;


    }








    let card =
    createBingoCard();






    await set(playerRef,{


        name:name,


        joined:true,


        card:card,


        joinedAt:Date.now()


    });







    localStorage.setItem(
        "bingoPlayer",
        cleanName
    );





    status.innerHTML =
    "✅ Joined! Loading your card...";





    setTimeout(()=>{


        window.location.href =
        "player.html";


    },1000);



};
