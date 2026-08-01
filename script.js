const board = document.getElementById("board");
const newGame = document.getElementById("newGame");


function generateNumbers(min,max,count){

let numbers=[];


while(numbers.length<count){

let number=Math.floor(Math.random()*(max-min+1))+min;


if(!numbers.includes(number)){
numbers.push(number);
}

}

return numbers;

}



function createBoard(){


board.innerHTML="";


let columns=[

generateNumbers(1,15,5),
generateNumbers(16,30,5),
generateNumbers(31,45,5),
generateNumbers(46,60,5),
generateNumbers(61,75,5)

];



for(let row=0;row<5;row++){

for(let col=0;col<5;col++){


let square=document.createElement("div");

square.className="square";


if(row===2 && col===2){

square.innerHTML="FREE";

square.classList.add("marked");

}

else{

square.innerHTML=columns[col][row];


square.onclick=()=>{

square.classList.toggle("marked");

}

}


board.appendChild(square);


}

}

}



newGame.onclick=createBoard;


createBoard();
