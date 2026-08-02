// ==========================
// BINGO HOST SYSTEM V2
// ==========================

import { database } from "./firebase.js";

import {
    ref,
    set,
    get,
    push,
    onValue,
    remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";




// DATABASE

const gameRef =
ref(database,"bingo");


const currentRef =
ref(database,"bingo/currentCall");


const callsRef =
ref(database,"bingo/calledNumbers");



let calledNumbers = [];

let gameLocked = false;






// ==========================
// LOAD GAME STATUS
// ==========================


onValue(gameRef,(snapshot)=>{


    let game =
    snapshot.val();



    if(!game)
    return;




    gameLocked =
    game.locked || false;



    let status =
    document.getElementById("gameStatus");



    if(status){


        status.innerHTML =
        game.status || "Waiting";


    }


});









// ==========================
// LOAD PLAYERS
// ==========================


onValue(ref(database,"bingo/players"),(snapshot)=>{


    let players =
    snapshot.val();



    let list =
    document.getElementById("playerList");



    let count =
    document.getElementById("playerCount");



    if(!list)
    return;



    list.innerHTML="";



    if(!players){


        list.innerHTML =
        "No players yet";


        if(count)
        count.innerHTML=0;


        return;


    }




    let names =
    Object.values(players);




    if(count)
    count.innerHTML =
    names.length;





    names.forEach(player=>{


        let item =
        document.createElement("div");



        item.innerHTML =
        "👤 " + player.name;



        list.appendChild(item);



    });



});









// ==========================
// OPEN JOINING
// ==========================


window.openJoining=function(){


    set(gameRef,{

        status:
        "Joining Open",

        locked:false

    });



};








// ==========================
// START GAME
// ==========================


window.startGame=function(){



    set(gameRef,{

        status:
        "Game Started",

        locked:true

    });



};









// ==========================
// CALL NUMBER
// ==========================


window.callNumber=function(){


    if(!gameLocked){


        alert(
        "Start the game first"
        );


        return;


    }




    let number;



    do{


        number =
        Math.floor(Math.random()*75)+1;



    }
    while(
        calledNumbers.includes(number)
    );






    calledNumbers.push(number);



    let call =
    getLetter(number)+" "+number;





    set(currentRef,{

        call:call,

        time:Date.now()

    });






    push(callsRef,call);



};









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
// LOAD CALL HISTORY
// ==========================


onValue(callsRef,(snapshot)=>{


    let data =
    snapshot.val();



    let history =
    document.getElementById("calledNumbers");



    if(!history)
    return;



    history.innerHTML="";



    if(data){


        Object.values(data)
        .reverse()
        .forEach(call=>{


            let div =
            document.createElement("div");


            div.className="called";


            div.innerHTML=call;


            history.appendChild(div);


        });


    }



});









// ==========================
// RESET GAME
// ==========================


window.resetGame=function(){



    if(!confirm("Reset Bingo game?"))
    return;



    set(gameRef,{

        status:
        "Waiting for players",

        locked:false

    });



    remove(callsRef);

    set(currentRef,null);


    set(ref(database,"bingo/winner"),null);



    alert("Game reset");


};
