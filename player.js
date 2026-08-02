// ==========================
// BINGO PLAYER SYSTEM V5
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

let calledNumbers = [];

let markedNumbers =
JSON.parse(localStorage.getItem("bingoMarked")) || [];



const cardArea =
document.getElementById("card");

const welcome =
document.getElementById("welcomePlayer");




// LOAD CARD

async function loadPlayer(){


    const playerRef =
    ref(database,"bingo/players/"+playerID);


    const snapshot =
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



    drawCard();

}






// DRAW CARD

function drawCard(){


    cardArea.innerHTML="";



    myCard.forEach(row=>{


        row.forEach(number=>{


            let square =
            document.createElement("div");



            square.className="number";


            square.innerHTML=number;




            if(number==="FREE"){


                square.classList.add("free");


            }




            if(calledNumbers.includes(number)){


                square.classList.add("called");


            }




            if(markedNumbers.includes(String(number))){


                square.classList.add("selected");


            }





            square.onclick=function(){


                if(number==="FREE")
                return;



                let value =
                String(number);



                if(markedNumbers.includes(value)){


                    markedNumbers =
                    markedNumbers.filter(
                        n=>n!==value
                    );


                }
                else{


                    markedNumbers.push(value);


                }



                localStorage.setItem(

                    "bingoMarked",

                    JSON.stringify(markedNumbers)

                );



                drawCard();



            };




            cardArea.appendChild(square);



        });


    });


}









// CURRENT NUMBER LISTENER

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

        display.innerHTML=data.call;

    }



    if(data.number){


        calledNumbers.push(data.number);



        drawCard();


    }



});









// BINGO BUTTON

window.claimBingo=function(){


    if(checkBingo()){


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









function checkBingo(){


    for(let r=0;r<5;r++){


        let win=true;


        for(let c=0;c<5;c++){


            let value =
            myCard[r][c];



            if(

            value!=="FREE" &&

            !markedNumbers.includes(String(value))

            ){

                win=false;

            }


        }


        if(win)
        return true;


    }





    for(let c=0;c<5;c++){


        let win=true;



        for(let r=0;r<5;r++){


            let value =
            myCard[r][c];



            if(

            value!=="FREE" &&

            !markedNumbers.includes(String(value))

            ){

                win=false;

            }


        }



        if(win)
        return true;


    }



    return false;


}







loadPlayer();
