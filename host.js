// ==========================
// BINGO HOST SYSTEM V2
// ==========================

import { database } from "./firebase.js";

import {
    ref,
    set,
    push,
    onValue,
    remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";



const gameRef = ref(database, "bingo");

const currentRef = ref(database, "bingo/currentCall");

const callsRef = ref(database, "bingo/calledNumbers");

const playersRef = ref(database, "bingo/players");



let calledNumbers = [];

let gameLocked = false;



// ==========================
// STATUS
// ==========================

onValue(gameRef, (snapshot)=>{

    const game = snapshot.val();

    if(!game) return;


    gameLocked = game.locked || false;


    const status =
    document.getElementById("gameStatus");


    if(status){

        status.innerHTML =
        game.status || "Waiting";

    }

});




// ==========================
// PLAYERS
// ==========================

onValue(playersRef,(snapshot)=>{


    const players = snapshot.val();


    const list =
    document.getElementById("playerList");


    const count =
    document.getElementById("playerCount");


    if(!list) return;


    list.innerHTML="";


    if(!players){

        list.innerHTML="No players yet";

        if(count)
        count.innerHTML="0";

        return;

    }



    const playerArray =
    Object.values(players);



    if(count)
    count.innerHTML =
    playerArray.length;



    playerArray.forEach(player=>{


        const div =
        document.createElement("div");


        div.innerHTML =
        "👤 " + player.name;


        list.appendChild(div);


    });


});





// ==========================
// CURRENT NUMBER DISPLAY
// ==========================

onValue(currentRef,(snapshot)=>{


    console.log("Current number update received");


    const data =
    snapshot.val();



    if(!data){

        console.log("No current number");

        return;

    }



    console.log(data);



    const display =
    document.getElementById("currentNumber");



    if(display){


        display.innerHTML =
        data.call;


    }


});






// ==========================
// OPEN JOINING
// ==========================

window.openJoining=function(){


    set(gameRef,{

        status:"Joining Open",

        locked:false

    });


};






// ==========================
// START GAME
// ==========================

window.startGame=function(){


    set(gameRef,{

        status:"Game Started",

        locked:true

    });


};






// ==========================
// CALL NUMBER
// ==========================

window.callNumber=function(){



    if(!gameLocked){

        alert("Start the game first");

        return;

    }



    let number;


    do{

        number =
        Math.floor(Math.random()*75)+1;


    }while(
        calledNumbers.includes(number)
    );



    calledNumbers.push(number);



    const letter =
    getLetter(number);



    const call =
    letter+" "+number;




    set(currentRef,{

        call:call,

        number:number,

        time:Date.now()

    });



    push(callsRef,call);



};






function getLetter(number){


    if(number<=15) return "B";

    if(number<=30) return "I";

    if(number<=45) return "N";

    if(number<=60) return "G";


    return "O";

}







// ==========================
// HISTORY
// ==========================

onValue(callsRef,(snapshot)=>{


    const data =
    snapshot.val();


    const history =
    document.getElementById("calledNumbers");


    if(!history) return;



    history.innerHTML="";



    if(data){


        Object.values(data)
        .reverse()
        .forEach(call=>{


            const div =
            document.createElement("div");


            div.className="called";


            div.innerHTML =
            call;


            history.appendChild(div);


        });


    }


});






// ==========================
// RESET
// ==========================

window.resetGame=function(){


    if(!confirm("Reset Bingo game?"))
    return;


    set(gameRef,{

        status:"Waiting for players",

        locked:false

    });


    remove(currentRef);

    remove(callsRef);

    remove(ref(database,"bingo/winner"));


};
