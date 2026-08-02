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



// KEEP YOUR FIREBASE CONFIG

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





const currentRef =
ref(database,"bingo/currentCall");


const callsRef =
ref(database,"bingo/calledNumbers");


const winnerRef =
ref(database,"bingo/winner");






let playerName =
localStorage.getItem("bingoName") || "";


let myCard =
JSON.parse(localStorage.getItem("bingoCard")) || null;


let calledNumbers=[];






const card =
document.getElementById("card");









// ==========================
// RANDOM NUMBERS
// ==========================


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









// ==========================
// CREATE / LOAD CARD
// ==========================


window.createCard=function(){


    if(!card)
    return;



    card.innerHTML="";



    if(!myCard){


        let columns=[


            randomNumbers(1,15,5),

            randomNumbers(16,30,5),

            randomNumbers(31,45,5),

            randomNumbers(46,60,5),

            randomNumbers(61,75,5)

        ];



        myCard=[];



        for(let row=0;row<5;row++){


            let line=[];


            for(let col=0;col<5;col++){



                if(row===2 && col===2){

                    line.push("FREE");


                }
                else{


                    line.push(
                        columns[col][row]
                    );


                }


            }


            myCard.push(line);


        }



        localStorage.setItem(
            "bingoCard",
            JSON.stringify(myCard)
        );


    }






    myCard.forEach((row)=>{


        row.forEach((number)=>{


            let square =
            document.createElement("div");


            square.className="number";



            square.innerHTML=number;





            if(number==="FREE"){


                square.classList.add("free");


            }
            else{


                square.onclick=function(){


                    square.classList.toggle("selected");


                };


            }



            card.appendChild(square);



        });


    });




    updateCalledHighlights();


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



    localStorage.setItem(
        "bingoName",
        playerName
    );



    alert(
        "Welcome "+playerName
    );


};






// Load saved name

let nameBox =
document.getElementById("playerName");


if(nameBox && playerName){

    nameBox.value=playerName;

}









// ==========================
// CURRENT CALL
// ==========================


onValue(currentRef,(snapshot)=>{


    let data=snapshot.val();



    if(!data)
    return;



    let display =
    document.getElementById("playerCurrent");



    if(display){

        display.innerHTML=data.call;

    }


});









// ==========================
// CALLED NUMBERS
// ==========================


onValue(callsRef,(snapshot)=>{


    let data=snapshot.val();


    calledNumbers=[];



    if(data){


        calledNumbers =
        Object.values(data);


    }



    updateCalledHighlights();



});









// ==========================
// HIGHLIGHT CALLED NUMBERS
// ==========================


function updateCalledHighlights(){



    document.querySelectorAll(".number")
    .forEach(square=>{


        square.classList.remove("called");



        let value =
        Number(square.innerHTML);



        if(!value)
        return;



        let letter =
        getLetter(value);



        if(
        calledNumbers.includes(
            letter+" "+value
        )){


            square.classList.add("called");


        }



    });



}








function getLetter(number){


    if(number<=15)
    return "B";


    if(number<=30)
    return "I";


    if(number<=45)
    return "N";


    if(number<=60)
    return "G";


    return "O";

}









// ==========================
// BINGO CLAIM
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





    for(let r=0;r<5;r++){


        let complete=true;


        for(let c=0;c<5;c++){


            let value=myCard[r][c];


            if(value!="FREE" &&
            !marked.includes(Number(value))){

                complete=false;

            }


        }


        if(complete)
        win=true;


    }






    for(let c=0;c<5;c++){


        let complete=true;


        for(let r=0;r<5;r++){


            let value=myCard[r][c];


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
// WINNER DISPLAY
// ==========================


onValue(winnerRef,(snapshot)=>{


    let winner=snapshot.val();



    if(!winner)
    return;



    let popup =
    document.getElementById("winnerPopup");


    let text =
    document.getElementById("winnerText");



    if(popup && text){


        text.innerHTML=

        "🎉 BINGO WINNER 🎉<br><br>"
        +
        winner.name
        +
        "<br><br>🏆 HAS WON!";



        popup.classList.add("show");


    }


});
