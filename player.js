// ==========================
// BINGO PLAYER SYSTEM V3
// ==========================

import { database } from "./firebase.js";

import {
    ref,
    get,
    onValue,
    set
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";



let playerID =
localStorage.getItem("bingoPlayer");


let myCard = [];

let calledNumber = null;



const cardArea =
document.getElementById("card");


const welcome =
document.getElementById("welcomePlayer");







// ==========================
// LOAD PLAYER
// ==========================

async function loadPlayer(){


    if(!playerID){


        window.location.href="join.html";

        return;

    }



    const playerRef =
    ref(database,"bingo/players/"+playerID);



    const snapshot =
    await get(playerRef);



    if(!snapshot.exists()){


        window.location.href="join.html";

        return;

    }



    const player =
    snapshot.val();



    myCard =
    player.card;



    if(welcome){

        welcome.innerHTML =
        "Welcome " + player.name;

    }



    displayCard();


}









// ==========================
// DISPLAY CARD
// ==========================

function displayCard(){


    cardArea.innerHTML="";



    myCard.forEach((row)=>{


        row.forEach((number)=>{


            const square =
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






            // CHECK CALLED NUMBER

            if(
                number === calledNumber
            ){


                square.classList.add("called");


            }




            cardArea.appendChild(square);



        });


    });


}









// ==========================
// CURRENT CALL
// ==========================

const currentRef =
ref(database,"bingo/currentCall");





onValue(currentRef,(snapshot)=>{


    const data =
    snapshot.val();



    if(!data)
    return;




    const display =
    document.getElementById("playerCurrent");



    if(display){


        display.innerHTML =
        data.call;


    }




    if(data.number){


        calledNumber =
        data.number;


        displayCard();


    }



});









// ==========================
// BINGO BUTTON
// ==========================

window.claimBingo=function(){


    let marked=[];



    document
    .querySelectorAll(".selected")
    .forEach(square=>{


        marked.push(
            square.innerHTML
        );


    });




    if(checkBingo(marked)){


        set(
        ref(database,"bingo/winner"),
        {

            name:playerID,

            time:Date.now()

        });



    }

    else{


        alert("❌ Not Bingo");


    }



};









function checkBingo(marked){



    // ROWS

    for(let r=0;r<5;r++){


        let complete=true;


        for(let c=0;c<5;c++){



            let value =
            myCard[r][c];



            if(
                value !== "FREE" &&
                !marked.includes(String(value))
            ){


                complete=false;


            }


        }



        if(complete)
        return true;


    }





    // COLUMNS

    for(let c=0;c<5;c++){


        let complete=true;


        for(let r=0;r<5;r++){



            let value =
            myCard[r][c];



            if(
                value !== "FREE" &&
                !marked.includes(String(value))
            ){


                complete=false;


            }


        }



        if(complete)
        return true;


    }



    return false;


}






loadPlayer();
