// ==========================
// PLAYER BINGO CARD
// ==========================


const card = document.getElementById("card");



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





function createCard(){


    if(!card){

        return;

    }



    card.innerHTML="";



    let columns=[


        randomNumbers(1,15,5),

        randomNumbers(16,30,5),

        randomNumbers(31,45,5),

        randomNumbers(46,60,5),

        randomNumbers(61,75,5)


    ];





    for(let row=0;row<5;row++){



        for(let col=0;col<5;col++){



            let square =
            document.createElement("div");



            square.className="number";



            if(row===2 && col===2){


                square.innerHTML="FREE";


                square.classList.add("free");


            }

            else{


                square.innerHTML =
                columns[col][row];



                square.onclick=function(){


                    square.classList.toggle("selected");


                };


            }



            card.appendChild(square);



        }


    }


}



createCard();





// ==========================
// HOST BINGO SYSTEM
// ==========================


let calledNumbers=[];




function getLetter(number){



    if(number<=15){

        return "B";

    }



    if(number<=30){

        return "I";

    }



    if(number<=45){

        return "N";

    }



    if(number<=60){

        return "G";

    }



    return "O";


}







function callNumber(){



    if(calledNumbers.length>=75){


        alert("All numbers called!");

        return;


    }





    let number;



    do{


        number =
        Math.floor(Math.random()*75)+1;



    }

    while(calledNumbers.includes(number));





    calledNumbers.push(number);





    let bingoCall =
    getLetter(number)+" "+number;





    let current =
    document.getElementById("currentNumber");



    if(current){


        current.innerHTML=bingoCall;


        current.classList.remove("ball-pop");


        void current.offsetWidth;


        current.classList.add("ball-pop");


    }





// Save current call for player page

localStorage.setItem("currentBingoCall", bingoCall);


let playerCurrent =
document.getElementById("playerCurrent");


if(playerCurrent){

    playerCurrent.innerHTML=bingoCall;

}






    let item =
    document.createElement("div");



    item.className="called";


    item.innerHTML=bingoCall;





    let history =
    document.getElementById("calledNumbers");



    if(history){


        history.prepend(item);


    }






    let last =
    document.getElementById("lastCalls");



    if(last){


        last.prepend(item.cloneNode(true));



        while(last.children.length>5){


            last.removeChild(last.lastChild);


        }


    }





    updateStats();


}







function updateStats(){



    let count =
    document.getElementById("calledCount");



    let remaining =
    document.getElementById("remainingCount");



    if(count){


        count.innerHTML =
        calledNumbers.length;


    }





    if(remaining){


        remaining.innerHTML =
        75-calledNumbers.length;


    }



}







function resetGame(){



    calledNumbers=[];



    let current =
    document.getElementById("currentNumber");



    if(current){


        current.innerHTML="--";


    }





    let history =
    document.getElementById("calledNumbers");



    if(history){


        history.innerHTML="";


    }






    let last =
    document.getElementById("lastCalls");



    if(last){


        last.innerHTML="";


    }





    let player =
    document.getElementById("playerCurrent");



    if(player){


        player.innerHTML="--";


    }





    updateStats();



}
