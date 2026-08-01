const card = document.getElementById("card");


function randomNumbers(min,max,total){

let numbers=[];


while(numbers.length < total){

let num = Math.floor(
Math.random()*(max-min+1)
)+min;


if(!numbers.includes(num)){

numbers.push(num);

}

}


return numbers;

}



function createCard(){


if(!card) return;


card.innerHTML="";


let columns=[

randomNumbers(1,15,5),

randomNumbers(16,30,5),

randomNumbers(31,45,5),

randomNumbers(46,60,5),

randomNumbers(61,75,5)

];



for(let row=0; row<5; row++){

for(let col=0; col<5; col++){


let square=document.createElement("div");

square.classList.add("number");



if(row===2 && col===2){

square.innerHTML="FREE";

square.classList.add("free");

}


else{


square.innerHTML=
columns[col][row];


square.onclick=function(){

square.classList.toggle("selected");

}


}


card.appendChild(square);


}


}


}



createCard();
