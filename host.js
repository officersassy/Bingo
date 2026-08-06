// ======================================
// BINGO V2 — HOST SYSTEM
// Fresh cards and cleared dabs on restart
// ======================================

import { database } from "./firebase.js";

import {
    ref,
    get,
    set,
    update,
    push,
    onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ======================================
// FIREBASE LOCATIONS
// ======================================

const bingoRef = ref(database, "bingo");
const playersRef = ref(database, "bingo/players");
const currentCallRef = ref(database, "bingo/currentCall");
const calledNumbersRef = ref(database, "bingo/calledNumbers");
const winnerRef = ref(database, "bingo/winner");


// ======================================
// PAGE ELEMENTS
// ======================================

const gameStatusDisplay =
    document.getElementById("gameStatus");

const currentNumberDisplay =
    document.getElementById("currentNumber");

const playerCountDisplay =
    document.getElementById("playerCount");

const playerListDisplay =
    document.getElementById("playerList");

const lastCallsDisplay =
    document.getElementById("lastCalls");

const calledNumbersDisplay =
    document.getElementById("calledNumbers");

const openJoiningButton =
    document.getElementById("openJoiningButton");

const startGameButton =
    document.getElementById("startGameButton");

const callNumberButton =
    document.getElementById("callNumberButton");

const resetGameButton =
    document.getElementById("resetGameButton");

const winnerPopup =
    document.getElementById("winnerPopup");

const winnerNameDisplay =
    document.getElementById("winnerName");


// ======================================
// GAME STATE
// ======================================

let gameStatus = "waiting";
let gameLocked = false;
let joiningOpen = false;
let calledNumbers = [];


// ======================================
// CREATE RANDOM BINGO CARD
// ======================================

function randomNumbers(min, max, amount) {
    const numbers = [];

    while (numbers.length < amount) {
        const number =
            Math.floor(Math.random() * (max - min + 1)) + min;

        if (!numbers.includes(number)) {
            numbers.push(number);
        }
    }

    return numbers;
}


function createBingoCard() {
    const columns = [
        randomNumbers(1, 15, 5),
        randomNumbers(16, 30, 5),
        randomNumbers(31, 45, 5),
        randomNumbers(46, 60, 5),
        randomNumbers(61, 75, 5)
    ];

    const card = [];

    for (let row = 0; row < 5; row += 1) {
        for (let column = 0; column < 5; column += 1) {
            if (row === 2 && column === 2) {
                card.push("FREE");
            } else {
                card.push(columns[column][row]);
            }
        }
    }

    return card;
}


// ======================================
// HELPERS
// ======================================

function getLetter(number) {
    if (number <= 15) return "B";
    if (number <= 30) return "I";
    if (number <= 45) return "N";
    if (number <= 60) return "G";

    return "O";
}


function extractNumber(callData) {
    if (typeof callData === "number") {
        return callData;
    }

    if (typeof callData === "string") {
        const match = callData.match(/\d+/);
        return match ? Number(match[0]) : null;
    }

    if (callData && typeof callData === "object") {
        if (Number.isFinite(Number(callData.number))) {
            return Number(callData.number);
        }

        if (typeof callData.call === "string") {
            const match = callData.call.match(/\d+/);
            return match ? Number(match[0]) : null;
        }
    }

    return null;
}


function extractCallText(callData) {
    if (typeof callData === "string") {
        return callData;
    }

    if (
        callData &&
        typeof callData === "object" &&
        typeof callData.call === "string"
    ) {
        return callData.call;
    }

    return "--";
}


function showStatus(text, colour = "") {
    if (!gameStatusDisplay) return;

    gameStatusDisplay.textContent = text;
    gameStatusDisplay.style.color = colour;
}


function animateCurrentNumber() {
    if (!currentNumberDisplay) return;

    currentNumberDisplay.classList.remove("number-pop");
    void currentNumberDisplay.offsetWidth;
    currentNumberDisplay.classList.add("number-pop");
}


function setButtonState() {
    if (openJoiningButton) {
        openJoiningButton.disabled =
            joiningOpen && gameStatus === "joining";
    }

    if (startGameButton) {
        startGameButton.disabled =
            gameStatus === "playing" ||
            gameStatus === "winner";
    }

    if (callNumberButton) {
        callNumberButton.disabled =
            gameStatus !== "playing" ||
            gameLocked ||
            calledNumbers.length >= 75;
    }
}


// ======================================
// INITIALISE GAME
// ======================================

async function initialiseGame() {
    try {
        const snapshot = await get(bingoRef);
        const game = snapshot.val();

        if (!game) {
            await set(bingoRef, {
                gameId: `game-${Date.now()}`,
                status: "joining",
                joiningOpen: true,
                locked: false,
                createdAt: Date.now()
            });

            return;
        }

        const changes = {};

        if (!game.gameId) {
            changes.gameId = `game-${Date.now()}`;
        }

        if (!game.status) {
            changes.status = "joining";
        }

        if (game.joiningOpen === undefined) {
            changes.joiningOpen = true;
        }

        if (game.locked === undefined) {
            changes.locked = false;
        }

        if (Object.keys(changes).length > 0) {
            await update(bingoRef, changes);
        }

    } catch (error) {
        console.error("Unable to initialise game:", error);

        showStatus(
            "Firebase connection failed.",
            "#fca5a5"
        );
    }
}


// ======================================
// GAME STATUS LISTENER
// ======================================

onValue(bingoRef, (snapshot) => {
    const game = snapshot.val() || {};

    gameStatus = game.status || "waiting";
    gameLocked = Boolean(game.locked);
    joiningOpen = Boolean(game.joiningOpen);

    if (gameStatus === "joining") {
        showStatus(
            joiningOpen
                ? "Joining is open"
                : "Joining is closed",
            joiningOpen ? "#86efac" : "#fde68a"
        );
    } else if (gameStatus === "playing") {
        showStatus(
            "Game in progress",
            "#86efac"
        );
    } else if (gameStatus === "winner") {
        showStatus(
            "Winner announced",
            "#fde68a"
        );
    } else {
        showStatus(
            "Waiting for players",
            "#bfdbfe"
        );
    }

    setButtonState();
});


// ======================================
// PLAYER LISTENER
// ======================================

onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};
    const playerArray = Object.values(players);

    if (playerCountDisplay) {
        playerCountDisplay.textContent =
            String(playerArray.length);
    }

    if (!playerListDisplay) return;

    playerListDisplay.innerHTML = "";

    if (playerArray.length === 0) {
        playerListDisplay.textContent =
            "No players have joined yet.";

        return;
    }

    playerArray
        .sort((a, b) =>
            String(a.name || "").localeCompare(
                String(b.name || "")
            )
        )
        .forEach((player) => {
            const item =
                document.createElement("div");

            item.className = "player-list-item";

            item.textContent =
                `👤 ${player.name || player.id || "Player"}`;

            playerListDisplay.appendChild(item);
        });
});


// ======================================
// CURRENT CALL LISTENER
// ======================================

onValue(currentCallRef, (snapshot) => {
    const currentCall = snapshot.val();

    if (!currentNumberDisplay) return;

    if (!currentCall) {
        currentNumberDisplay.textContent = "--";
        return;
    }

    currentNumberDisplay.textContent =
        extractCallText(currentCall);

    animateCurrentNumber();
});


// ======================================
// CALLED NUMBERS LISTENER
// ======================================

onValue(calledNumbersRef, (snapshot) => {
    const data = snapshot.val() || {};
    const calls = Object.values(data);

    calledNumbers = [];

    calls.forEach((call) => {
        const number = extractNumber(call);

        if (
            number !== null &&
            !calledNumbers.includes(number)
        ) {
            calledNumbers.push(number);
        }
    });

    drawCallHistory(calls);
    setButtonState();
});


// ======================================
// DRAW CALL HISTORY
// ======================================

function createCalledBall(callData) {
    const ball =
        document.createElement("div");

    ball.className = "called";
    ball.textContent = extractCallText(callData);

    return ball;
}


function drawCallHistory(calls) {
    const newestFirst = [...calls].reverse();

    if (lastCallsDisplay) {
        lastCallsDisplay.innerHTML = "";

        newestFirst
            .slice(0, 10)
            .forEach((call) => {
                lastCallsDisplay.appendChild(
                    createCalledBall(call)
                );
            });
    }

    if (calledNumbersDisplay) {
        calledNumbersDisplay.innerHTML = "";

        newestFirst.forEach((call) => {
            calledNumbersDisplay.appendChild(
                createCalledBall(call)
            );
        });
    }
}


// ======================================
// OPEN JOINING
// ======================================

window.openJoining = async function openJoining() {
    try {
        await update(bingoRef, {
            status: "joining",
            joiningOpen: true,
            locked: false
        });
    } catch (error) {
        console.error("Unable to open joining:", error);

        alert("Joining could not be opened.");
    }
};


// ======================================
// START GAME
// ======================================

window.startGame = async function startGame() {
    try {
        const playersSnapshot = await get(playersRef);

        if (!playersSnapshot.exists()) {
            alert("No players have joined yet.");
            return;
        }

        await update(bingoRef, {
            status: "playing",
            joiningOpen: false,
            locked: false,
            startedAt: Date.now()
        });

    } catch (error) {
        console.error("Unable to start game:", error);

        alert("The game could not be started.");
    }
};


// ======================================
// CALL NEXT NUMBER
// ======================================

window.callNumber = async function callNumber() {
    if (gameStatus !== "playing") {
        alert("Start the game before calling numbers.");
        return;
    }

    if (gameLocked) {
        alert(
            "The game is locked because a winner has been announced."
        );

        return;
    }

    if (calledNumbers.length >= 75) {
        alert("All 75 numbers have been called.");
        return;
    }

    let number;

    do {
        number =
            Math.floor(Math.random() * 75) + 1;
    } while (calledNumbers.includes(number));

    const callText =
        `${getLetter(number)} ${number}`;

    if (callNumberButton) {
        callNumberButton.disabled = true;
    }

    try {
        const callData = {
            call: callText,
            number,
            calledAt: Date.now()
        };

        await set(currentCallRef, callData);
        await push(calledNumbersRef, callData);

    } catch (error) {
        console.error("Unable to call number:", error);

        alert(
            "The number could not be saved."
        );

    } finally {
        setButtonState();
    }
};


// ======================================
// WINNER LISTENER
// ======================================

onValue(winnerRef, (snapshot) => {
    const winner = snapshot.val();

    if (!winner) {
        winnerPopup?.classList.remove("show");
        return;
    }

    if (winnerNameDisplay) {
        winnerNameDisplay.textContent =
            `${winner.name || "A player"} has won!`;
    }

    winnerPopup?.classList.add("show");
});


window.closeWinnerPopup =
    function closeWinnerPopup() {
        winnerPopup?.classList.remove("show");
    };


// ======================================
// FORCE RESTART
// Keeps players but gives new cards
// ======================================

window.resetGame = async function resetGame() {
    const confirmed = window.confirm(
        "Force restart the Bingo game?\n\n" +
        "Every player will receive a new card and all dabs will be cleared."
    );

    if (!confirmed) return;

    if (resetGameButton) {
        resetGameButton.disabled = true;
    }

    try {
        const playersSnapshot = await get(playersRef);
        const existingPlayers =
            playersSnapshot.val() || {};

        const newGameId =
            `game-${Date.now()}`;

        const updatedPlayers = {};

        Object.entries(existingPlayers)
            .forEach(([playerId, player]) => {
                updatedPlayers[playerId] = {
                    ...player,

                    card: createBingoCard(),

                    marked: null,

                    gameId: newGameId,

                    locked: true,

                    cardCreatedAt: Date.now()
                };
            });

        await set(bingoRef, {
            gameId: newGameId,

            status: "joining",

            joiningOpen: true,

            locked: false,

            createdAt: Date.now(),

            restartTime: Date.now(),

            players: updatedPlayers
        });

        calledNumbers = [];

        if (currentNumberDisplay) {
            currentNumberDisplay.textContent = "--";
        }

        if (lastCallsDisplay) {
            lastCallsDisplay.innerHTML = "";
        }

        if (calledNumbersDisplay) {
            calledNumbersDisplay.innerHTML = "";
        }

        winnerPopup?.classList.remove("show");

        alert(
            "Game restarted. Every player has received a fresh card and all dabs have been cleared."
        );

    } catch (error) {
        console.error("Unable to restart game:", error);

        alert(
            "The game could not be restarted."
        );

    } finally {
        if (resetGameButton) {
            resetGameButton.disabled = false;
        }
    }
};


// ======================================
// START HOST PAGE
// ======================================

initialiseGame();
