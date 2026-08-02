// ==========================
// FIREBASE CONNECTION
// ==========================


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { 
    getDatabase 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";




// YOUR FIREBASE CONFIG

const firebaseConfig = {

    apiKey: "AIzaSyDme5iZZNPN0O128vw0MP9aGjLZXD3oKy8",

    authDomain: "bingo-5174e.firebaseapp.com",

    databaseURL: "https://bingo-5174e-default-rtdb.europe-west1.firebasedatabase.app",

    projectId: "bingo-5174e",

    storageBucket: "bingo-5174e.firebasestorage.app",

    messagingSenderId: "647984877295",

    appId: "1:647984877295:web:a74b477fa7d46dc9cc551a"

};





// START FIREBASE

const app = initializeApp(firebaseConfig);



// DATABASE CONNECTION

const database = getDatabase(app);




// EXPORT FOR OTHER FILES

export { database };
