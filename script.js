let called = [];

let currentNumber = null;



function callNumber(){


    let number;


    do {

        number =
        Math.floor(Math.random()*75)+1;


    }
    while(called.includes(number));



    called.push(number);


    currentNumber = number;


    let display =
    document.getElementById("currentNumber");


    if(display){

        display.innerHTML = number;

    }


    let history =
    document.getElementById("calledNumbers");


    if(history){

        history.innerHTML="";


        called.forEach(num=>{


            let item =
            document.createElement("div");


            item.className="called";

            item.innerHTML=num;


            history.appendChild(item);


        });


    }


}




function resetGame(){


    called=[];

    currentNumber=null;


    let display =
    document.getElementById("currentNumber");


    if(display){

        display.innerHTML="--";

    }


    let history =
    document.getElementById("calledNumbers");


    if(history){

        history.innerHTML="";

    }


}
