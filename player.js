// ======================================
// BINGO V2 — PLAYER SYSTEM
// New cards and cleared dabs on restart
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
// PAGE ELEMENTS
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
// PLAYER AND GAME DATA
// ======================================

let playerData = null;
let bingoCard = [];
let calledNumbers = [];
let markedNumbers = [];

let gameStatus = "waiting";
let gameLocked = false;
let currentGameId = null;


// ======================================
// STATUS MESSAGE
// ======================================

function showPlayerStatus(message, colour = "") {
    if (!playerStatus) return;

    playerStatus.textContent = message;
    playerStatus.style.color = colour;
}


// ======================================
// FIREBASE DATA HELPERS
// ======================================

function convertCardToArray(cardData) {
    if (!cardData) return [];

    if (Array.isArray(cardData)) {
        return cardData.flat();
    }

    return Object.values(cardData).flat();
}


function convertMarksToArray(markedData) {
    if (!markedData) return [];

    const values = Array.isArray(markedData)
        ? markedData
        : Object.values(markedData);

    return values
        .map(Number)
        .filter(Number.isFinite);
}


function getNumberFromCall(callData) {
    if (typeof callData === "number") {
        return callData;
    }

    if (typeof callData === "string") {
        const result = callData.match(/\d+/);
        return result ? Number(result[0]) : null;
    }

    if (callData && typeof callData === "object") {
        if (Number.isFinite(Number(callData.number))) {
            return Number(callData.number);
        }

        if (typeof callData.call === "string") {
            const result = callData.call.match(/\d+/);
            return result ? Number(result[0]) : null;
        }
    }

    return null;
}


// ======================================
// CHECK PLAYER EXISTS
// ======================================

async function checkPlayerExists() {
    if (!playerId) {
        window.location.href = "join.html";
        return false;
    }

    try {
        const snapshot = await get(
            ref(database, `bingo/players/${playerId}`)
        );

        if (!snapshot.exists()) {
            localStorage.removeItem("bingoPlayerId");
            localStorage.removeItem("bingoPlayer");
            localStorage.removeItem("bingoPlayerName");
            localStorage.removeItem("bingoGameId");

            window.location.href = "join.html";
            return false;
        }

        return true;

    } catch (error) {
        console.error("Unable to find player:", error);

        showPlayerStatus(
            "Unable to connect to your player card.",
            "#fca5a5"
        );

        return false;
    }
}


// ======================================
// LIVE PLAYER CARD LISTENER
// ======================================

function startPlayerListener() {
    onValue(
        ref(database, `bingo/players/${playerId}`),
        (snapshot) => {
            if (!snapshot.exists()) {
                window.location.href = "join.html";
                return;
            }

            const previousGameId =
                currentGameId;

            playerData = snapshot.val();

            bingoCard =
                convertCardToArray(playerData.card);

            markedNumbers =
                convertMarksToArray(playerData.marked);

            currentGameId =
                playerData.gameId || null;

            if (bingoCard.length !== 25) {
                showPlayerStatus(
                    "Your saved Bingo card is invalid.",
                    "#fca5a5"
                );

                return;
            }

            if (welcomePlayer) {
                welcomePlayer.textContent =
                    `Welcome, ${playerData.name || playerId}`;
            }

            if (
                previousGameId &&
                currentGameId &&
                previousGameId !== currentGameId
            ) {
                showPlayerStatus(
                    "A new game has started. You have received a fresh Bingo card!",
                    "#86efac"
                );
            } else {
                updateStatusMessage();
            }

            localStorage.setItem(
                "bingoGameId",
                currentGameId || ""
            );

            drawCard();
        }
    );
}


// ======================================
// DRAW PLAYER CARD
// ======================================

function drawCard() {
    if (
        !cardArea ||
        bingoCard.length !== 25
    ) {
        return;
    }

    cardArea.innerHTML = "";

    bingoCard.forEach((value) => {
        const square =
            document.createElement("div");

        square.className = "number";
        square.textContent = value;

        if (value === "FREE") {
            square.classList.add("free");
        } else {
            const number = Number(value);

            if (calledNumbers.includes(number)) {
                square.classList.add("called");
            }

            if (markedNumbers.includes(number)) {
                square.classList.add("selected");
            }

            square.addEventListener("click", () => {
                dabNumber(number);
            });
        }

        cardArea.appendChild(square);
    });
}


// ======================================
// DAB / UNDAB NUMBER
// ======================================

async function dabNumber(number) {
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

    const wasMarked =
        markedNumbers.includes(number);

    if (wasMarked) {
        markedNumbers =
            markedNumbers.filter(
                (markedNumber) =>
                    markedNumber !== number
            );
    } else {
        markedNumbers.push(number);
    }

    markedNumbers.sort((a, b) => a - b);
    drawCard();

    try {
        await set(
            ref(
                database,
                `bingo/players/${playerId}/marked`
            ),
            markedNumbers.length > 0
                ? markedNumbers
                : null
        );

        showPlayerStatus(
            wasMarked
                ? `${number} has been undabbed.`
                : `${number} has been dabbed.`,
            "#bfdbfe"
        );

    } catch (error) {
        console.error("Unable to save dab:", error);

        showPlayerStatus(
            "Your dab could not be saved.",
            "#fca5a5"
        );
    }
}


// ======================================
// CURRENT CALL
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

            playerCurrent.classList.remove(
                "number-pop"
            );

            void playerCurrent.offsetWidth;

            playerCurrent.classList.add(
                "number-pop"
            );
        }
    }
);


// ======================================
// CALLED NUMBERS
// ======================================

onValue(
    ref(database, "bingo/calledNumbers"),
    (snapshot) => {
        const calls = snapshot.val();

        calledNumbers = [];

        if (calls) {
            Object.values(calls)
                .forEach((callData) => {
                    const number =
                        getNumberFromCall(callData);

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
// GAME STATUS
// ======================================

onValue(
    ref(database, "bingo"),
    (snapshot) => {
        const game = snapshot.val() || {};

        gameStatus =
            game.status || "waiting";

        gameLocked =
            Boolean(game.locked);

        updateStatusMessage();
    }
);


function updateStatusMessage() {
    if (!playerData) return;

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
// CHECK FOR BINGO
// ======================================

function hasValidBingo() {
    const markedSet =
        new Set(markedNumbers);

    function lineIsComplete(indexes) {
        return indexes.every((index) => {
            const value = bingoCard[index];

            if (value === "FREE") {
                return true;
            }

            const number = Number(value);

            return (
                markedSet.has(number) &&
                calledNumbers.includes(number)
            );
        });
    }

    const winningLines = [
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8, 9],
        [10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24],

        [0, 5, 10, 15, 20],
        [1, 6, 11, 16, 21],
        [2, 7, 12, 17, 22],
        [3, 8, 13, 18, 23],
        [4, 9, 14, 19, 24],

        [0, 6, 12, 18, 24],
        [4, 8, 12, 16, 20]
    ];

    return winningLines.some(
        lineIsComplete
    );
}


// ======================================
// CLAIM BINGO
// ======================================

window.claimBingo =
    async function claimBingo() {

        if (!playerData) return;

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

                    name:
                        playerData.name || playerId,

                    card: bingoCard,

                    marked: markedNumbers,

                    gameId: currentGameId,

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
            console.error(
                "Unable to submit Bingo:",
                error
            );

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
// WINNER POPUP
// ======================================

onValue(
    ref(database, "bingo/winner"),
    (snapshot) => {
        const winner = snapshot.val();

        if (!winner) {
            winnerPopup?.classList.remove("show");
            return;
        }

        if (winnerName) {
            winnerName.textContent =
                `${winner.name || "A player"} has won!`;
        }

        winnerPopup?.classList.add("show");
    }
);


window.closeWinnerPopup =
    function closeWinnerPopup() {
        winnerPopup?.classList.remove("show");
    };


// ======================================
// START PLAYER PAGE
// ======================================

async function startPlayerPage() {
    const exists =
        await checkPlayerExists();

    if (exists) {
        startPlayerListener();
    }
}


startPlayerPage();
