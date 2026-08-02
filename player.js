// ==========================
// FIREBASE PLAYER SYSTEM
// ==========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
    getDatabase,
    ref,
    set,
    onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";



// KEEP YOUR FIREBASE CONFIG THE SAME AS HOST

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





// DATABASE

const currentRef =
ref(database,"bingo/currentCall");


const winnerRef =
ref(database,"bingo/winner");






// PLAYER VARIABLES

let playerName = "";

let myCard = [];







// ==========================
// CREATE BINGO CARD
// ==========================


const card =
document.getElementById("card");




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






window.createCard=function(){


    if(!card)
        return;



    card.innerHTML="";


    myCard=[];



    let columns=[


        randomNumbers(1,15,5),

        randomNumbers(16,30,5),

        randomNumbers(31,45,5),

        randomNumbers(46,60,5),

        randomNumbers(61,75,5)


    ];





    for(let row=0; row<5; row++){



        let newRow=[];



        for(let col=0; col<5; col++){



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
// SAVE PLAYER NAME
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
        "Welcome " + playerName
    );


};









// ==========================
// SHOW CURRENT NUMBER
// ==========================


onValue(currentRef,(snapshot)=>{


    let data =
    snapshot.val();



    if(!data)
        return;



    let current =
    document.getElementById("playerCurrent");



    if(current){


        current.innerHTML=data.call;


    }


});









// ==========================
// CLAIM BINGO
// ==========================


window.claimBingo=function(){



    let marked=[];



    document.querySelectorAll(".selected")
    .forEach(square=>{


        marked.push(
            Number(square.innerHTML)
        );


    });




    let win=false;





    // CHECK ROWS

    for(let r=0;r<5;r++){


        let complete=true;



        for(let c=0;c<5;c++){


            let value =
            myCard[r][c];



            if(value!="FREE" &&
            !marked.includes(Number(value))){


                complete=false;


            }


        }



        if(complete)
            win=true;


    }







    // CHECK COLUMNS

    for(let c=0;c<5;c++){


        let complete=true;



        for(let r=0;r<5;r++){


            let value =
            myCard[r][c];



            if(value!="FREE" &&
            !marked.includes(Number(value))){


                complete=false;


            }


        }



        if(complete)
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



};









// ==========================
// WINNER POPUP
// ==========================


onValue(winnerRef,(snapshot)=>{


    let winner =
    snapshot.val();



    if(!winner)
        return;




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
