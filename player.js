// ==========================
// BINGO PLAYER SYSTEM V2
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






const cardArea =
document.getElementById("card");


const welcome =
document.getElementById("welcomePlayer");






// ==========================
// LOAD PLAYER CARD
// ==========================


async function loadPlayer(){


    if(!playerID){


        alert("No player found. Please join first.");

        window.location.href="join.html";

        return;


    }




    let playerRef =
    ref(database,"bingo/players/"+playerID);





    let snapshot =
    await get(playerRef);






    if(!snapshot.exists()){


        alert("Player not found.");

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









// ==========================
// DISPLAY CARD
// ==========================


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

            else {



                square.onclick=function(){


                    square.classList.toggle("selected");


                };


            }





            cardArea.appendChild(square);



        });


    });



}









// ==========================
// CURRENT NUMBER
// ==========================


const currentRef =
ref(database,"bingo/currentCall");





onValue(currentRef,(snapshot)=>{


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









// ==========================
// BINGO CLAIM
// ==========================


window.claimBingo=function(){


    let marked=[];




    document.querySelectorAll(".selected")
    .forEach(square=>{


        marked.push(
            square.innerHTML
        );


    });





    let won =
    checkBingo(marked);





    if(!won){


        alert("❌ Not a Bingo");

        return;


    }







    set(
        ref(database,"bingo/winner"),
        {

            name: playerID,

            time: Date.now()

        }

    );



};









function checkBingo(marked){


    // rows

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





    // columns

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
