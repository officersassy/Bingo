// ======================================
// BINGO V2 — PLAYER SYSTEM
// ======================================

import { database } from "./firebase.js";

import {
    ref,
    get,
    set,
    update,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ======================================
// PLAYER DETAILS
// ======================================

const playerId =
    localStorage.getItem("bingoPlayerId") ||
    localStorage.getItem("bingoPlayer");

const welcomePlayer =
    document.getElementById("welcomePlayer");

const playerStatus =
    document.getElementById("playerStatus");

const playerCurrent =
    document.getElementById("playerCurrent");

const cardArea =
    document.getElementById("card");

const bingoButton =
    document.getElementById("bingoButton");

const winnerPopup =
    document.getElementById("winnerPopup");

const winnerName =
    document.getElementById("winnerName");


// ======================================
// GAME VARIABLES
// ======================================

let playerData = null;
let bingoCard = [];
let calledNumbers = [];
let markedNumbers = [];
let gameStatus = "waiting";
let gameLocked = false;


// ======================================
// STATUS DISPLAY
// ======================================

function showPlayerStatus(message, colour = "") {
    if (!playerStatus) {
        return;
    }

    playerStatus.textContent = message;
    playerStatus.style.color = colour;
}


// ======================================
// NORMALISE CARD FORMAT
// ======================================

function normaliseCard(cardData) {
    if (!cardData) {
        return [];
    }

    if (Array.isArray(cardData)) {
        return cardData.flat();
    }

    return Object.values(cardData).flat();
}


// ======================================
// NORMALISE MARKED NUMBERS
// ======================================

function normaliseMarkedNumbers(markedData) {
    if (!markedData) {
        return [];
    }

    if (Array.isArray(markedData)) {
        return markedData.map(Number);
    }

    return Object.values(markedData).map(Number);
}


// ======================================
// READ CALLED NUMBER VALUE
// ======================================

function extractCalledNumber(call) {
    if (typeof call === "number") {
        return call;
    }

    if (typeof call !== "string") {
        return null;
    }

    const match = call.match(/\d+/);

    return match ? Number(match[0]) : null;
}


// ======================================
// LOAD PLAYER
// ======================================

async function loadPlayer() {
    if (!playerId) {
        window.location.href = "join.html";
        return;
    }

    showPlayerStatus("Loading your locked Bingo card...");

    try {
        const playerSnapshot = await get(
            ref(database, `bingo/players/${playerId}`)
        );

        if (!playerSnapshot.exists()) {
            localStorage.removeItem("bingoPlayerId");
            localStorage.removeItem("bingoPlayer");

            window.location.href = "join.html";
            return;
        }

        playerData = playerSnapshot.val();
        bingoCard = normaliseCard(playerData.card);
        markedNumbers = normaliseMarkedNumbers(playerData.marked);

        if (bingoCard.length !== 25) {
            throw new Error("The saved Bingo card is invalid.");
        }

        if (welcomePlayer) {
            welcomePlayer.textContent =
                `Welcome, ${playerData.name || playerId}`;
        }

        drawCard();
        updatePlayerStatus();

    } catch (error) {
        console.error("Unable to load player:", error);

        showPlayerStatus(
            "Your player card could not be loaded.",
            "#fca5a5"
        );
    }
}


// ======================================
// DRAW LOCKED CARD
// ======================================

function drawCard() {
    if (!cardArea) {
        return;
    }

    cardArea.innerHTML = "";

    bingoCard.forEach((value) => {
        const square = document.createElement("button");

        square.type = "button";
        square.className = "number";
        square.textContent = value;

        if (value === "FREE") {
            square.classList.add("free");
            square.disabled = true;
        } else {
            const number = Number(value);

            if (calledNumbers.includes(number)) {
                square.classList.add("called");
            }

            if (markedNumbers.includes(number)) {
                square.classList.add("selected");
            }

            square.addEventListener("click", () => {
                toggleMarkedNumber(number);
            });
        }

        cardArea.appendChild(square);
    });
}


// ======================================
// MANUAL DABBING
// ======================================

async function toggleMarkedNumber(number) {
    if (gameStatus === "winner" || gameLocked) {
        showPlayerStatus(
            "The game is currently locked.",
            "#fca5a5"
        );

        return;
    }

    if (!calledNumbers.includes(number)) {
        showPlayerStatus(
            "That number has not been called yet.",
            "#fde68a"
        );

        return;
    }

    if (markedNumbers.includes(number)) {
        markedNumbers =
            markedNumbers.filter((item) => item !== number);
    } else {
        markedNumbers.push(number);
    }

    markedNumbers.sort((a, b) => a - b);

    drawCard();

    try {
        await set(
            ref(database, `bingo/players/${playerId}/marked`),
            markedNumbers
        );
    } catch (error) {
        console.error("Unable to save marked number:", error);

        showPlayerStatus(
            "Your dab could not be saved. Please try again.",
            "#fca5a5"
        );
    }
}


// ======================================
// CURRENT NUMBER LISTENER
// ======================================

onValue(
    ref(database, "bingo/currentCall"),
    (snapshot) => {
        const currentCall = snapshot.val();

        if (!currentCall) {
            if (playerCurrent) {
                playerCurrent.textContent = "--";
            }

            return;
        }

        const callText =
            typeof currentCall === "string"
                ? currentCall
                : currentCall.call || "--";

        if (playerCurrent) {
            playerCurrent.textContent = callText;

            playerCurrent.classList.remove("number-pop");

            void playerCurrent.offsetWidth;

            playerCurrent.classList.add("number-pop");
        }
    }
);


// ======================================
// CALLED NUMBERS LISTENER
// ======================================

onValue(
    ref(database, "bingo/calledNumbers"),
    (snapshot) => {
        const calledData = snapshot.val();

        calledNumbers = [];

        if (calledData) {
            Object.values(calledData).forEach((call) => {
                const number = extractCalledNumber(call);

                if (
                    number !== null &&
                    !calledNumbers.includes(number)
                ) {
                    calledNumbers.push(number);
                }
            });
        }

        drawCard();
    }
);


// ======================================
// GAME STATUS LISTENER
// ======================================

onValue(
    ref(database, "bingo"),
    (snapshot) => {
        const gameData = snapshot.val() || {};

        gameStatus = gameData.status || "waiting";
        gameLocked = Boolean(gameData.locked);

        updatePlayerStatus();
    }
);


// ======================================
// PLAYER STATUS MESSAGE
// ======================================

function updatePlayerStatus() {
    if (!playerData) {
        return;
    }

    if (gameStatus === "winner") {
        showPlayerStatus(
            "A winner has been announced.",
            "#fde68a"
        );

        return;
    }

    if (gameStatus === "playing") {
        showPlayerStatus(
            "Game in progress — good luck!",
            "#86efac"
        );

        return;
    }

    if (gameStatus === "joining") {
        showPlayerStatus(
            "Waiting for the host to start the game.",
            "#bfdbfe"
        );

        return;
    }

    showPlayerStatus(
        "Waiting for the game to begin.",
        "#bfdbfe"
    );
}


// ======================================
// CHECK BINGO LINE
// ======================================

function hasValidBingo() {
    const markedSet = new Set(markedNumbers);

    const isComplete = (indexes) => {
        return indexes.every((index) => {
            const value = bingoCard[index];

            return (
                value === "FREE" ||
                (
                    markedSet.has(Number(value)) &&
                    calledNumbers.includes(Number(value))
                )
            );
        });
    };

    const winningLines = [
        // Rows
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8, 9],
        [10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24],

        // Columns
        [0, 5, 10, 15, 20],
        [1, 6, 11, 16, 21],
        [2, 7, 12, 17, 22],
        [3, 8, 13, 18, 23],
        [4, 9, 14, 19, 24],

        // Diagonals
        [0, 6, 12, 18, 24],
        [4, 8, 12, 16, 20]
    ];

    return winningLines.some(isComplete);
}


// ======================================
// CLAIM BINGO
// ======================================

window.claimBingo = async function claimBingo() {
    if (!playerData) {
        return;
    }

    if (gameStatus !== "playing") {
        showPlayerStatus(
            "The game has not started yet.",
            "#fde68a"
        );

        return;
    }

    if (gameLocked) {
        showPlayerStatus(
            "The game is currently locked.",
            "#fca5a5"
        );

        return;
    }

    if (!hasValidBingo()) {
        showPlayerStatus(
            "That is not a valid Bingo yet.",
            "#fca5a5"
        );

        return;
    }

    if (bingoButton) {
        bingoButton.disabled = true;
    }

    try {
        const winnerSnapshot = await get(
            ref(database, "bingo/winner")
        );

        if (winnerSnapshot.exists()) {
            showPlayerStatus(
                "A winner has already been submitted.",
                "#fde68a"
            );

            return;
        }

        await set(
            ref(database, "bingo/winner"),
            {
                playerId,
                name: playerData.name || playerId,
                card: bingoCard,
                marked: markedNumbers,
                claimedAt: Date.now(),
                verified: true
            }
        );

        await update(
            ref(database, "bingo"),
            {
                status: "winner",
                locked: true
            }
        );

        showPlayerStatus(
            "Bingo confirmed!",
            "#86efac"
        );

    } catch (error) {
        console.error("Unable to submit Bingo:", error);

        showPlayerStatus(
            "Your Bingo claim could not be submitted.",
            "#fca5a5"
        );

    } finally {
        if (bingoButton) {
            bingoButton.disabled = false;
        }
    }
};


// ======================================
// WINNER LISTENER
// ======================================

onValue(
    ref(database, "bingo/winner"),
    (snapshot) => {
        const winner = snapshot.val();

        if (!winner) {
            hideWinnerPopup();
            return;
        }

        if (winnerName) {
            winnerName.textContent =
                `${winner.name || "A player"} has won!`;
        }

        winnerPopup?.classList.add("show");
    }
);


// ======================================
// WINNER POPUP CONTROLS
// ======================================

function hideWinnerPopup() {
    winnerPopup?.classList.remove("show");
}

window.closeWinnerPopup = function closeWinnerPopup() {
    hideWinnerPopup();
};


// ======================================
// START PLAYER PAGE
// ======================================

loadPlayer();
