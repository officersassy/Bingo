// =======================
// PLAYER BINGO CARD
// =======================

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


            let square=document.createElement("div");

            square.className="number";


            if(row===2 && col===2){

                square.innerHTML="FREE";

                square.classList.add("free");

            }

            else{


                square.innerHTML=columns[col][row];


                square.onclick=function(){

                    square.classList.toggle("selected");

                };

            }


            card.appendChild(square);


        }

    }

}



createCard();




// =======================
// HOST NUMBER CALLER
// =======================

let calledNumbers = [];

// Work out the Bingo letter
function getLetter(number) {

    if (number <= 15) return "B";
    if (number <= 30) return "I";
    if (number <= 45) return "N";
    if (number <= 60) return "G";

    return "O";
}

function callNumber() {

    if (calledNumbers.length >= 75) {
        alert("All numbers have been called!");
        return;
    }

    let number;

    do {
        number = Math.floor(Math.random() * 75) + 1;
    } while (calledNumbers.includes(number));

    calledNumbers.push(number);

    const bingoCall = getLetter(number) + " " + number;

    const current = document.getElementById("currentNumber");

    if (current) {
        current.textContent = bingoCall;
        current.classList.remove("flash");

        // Restart animation
        void current.offsetWidth;

        current.classList.add("flash");
    }

    const history = document.getElementById("calledNumbers");

    if (history) {

        const item = document.createElement("div");
        item.className = "called";
        item.textContent = bingoCall;

        history.prepend(item);

    }

}

function resetGame() {

    calledNumbers = [];

    const current = document.getElementById("currentNumber");
    if (current) current.textContent = "--";

    const history = document.getElementById("calledNumbers");
    if (history) history.innerHTML = "";

}
