// ======================================
// BINGO V2 — HOST SYSTEM
// ======================================

import { database } from "./firebase.js";

import {
    ref,
    get,
    set,
    update,
    push,
    remove,
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
// LOCAL GAME STATE
// ======================================

let gameStatus = "waiting";
let gameLocked = false;
let joiningOpen = false;
let calledNumbers = [];


// ======================================
// HELPERS
// ======================================

function getLetter(number) {
    if (number <= 15) {
        return "B";
    }

    if (number <= 30) {
        return "I";
    }

    if (number <= 45) {
        return "N";
    }

    if (number <= 60) {
        return "G";
    }

    return "O";
}


function extractNumber(call) {
    if (typeof call === "number") {
        return call;
    }

    if (typeof call === "object" && call !== null) {
        if (typeof call.number === "number") {
            return call.number;
        }

        if (typeof call.call === "string") {
            const match = call.call.match(/\d+/);
            return match ? Number(match[0]) : null;
        }
    }

    if (typeof call === "string") {
        const match = call.match(/\d+/);
        return match ? Number(match[0]) : null;
    }

    return null;
}


function extractCallText(call) {
    if (typeof call === "string") {
        return call;
    }

    if (
        typeof call === "object" &&
        call !== null &&
        typeof call.call === "string"
    ) {
        return call.call;
    }

    return "--";
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


function showStatus(text, colour = "") {
    if (!gameStatusDisplay) {
        return;
    }

    gameStatusDisplay.textContent = text;
    gameStatusDisplay.style.color = colour;
}


function animateCurrentNumber() {
    if (!currentNumberDisplay) {
        return;
    }

    currentNumberDisplay.classList.remove("number-pop");

    void currentNumberDisplay.offsetWidth;

    currentNumberDisplay.classList.add("number-pop");
}


// ======================================
// INITIALISE DATABASE
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

        const updates = {};

        if (!game.gameId) {
            updates.gameId = `game-${Date.now()}`;
        }

        if (!game.status) {
            updates.status = "joining";
        }

        if (game.joiningOpen === undefined) {
            updates.joiningOpen = true;
        }

        if (game.locked === undefined) {
            updates.locked = false;
        }

        if (Object.keys(updates).length > 0) {
            await update(bingoRef, updates);
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

onValue(
    bingoRef,
    (snapshot) => {
        const game = snapshot.val() || {};

        gameStatus = game.status || "waiting";
        gameLocked = Boolean(game.locked);
        joiningOpen = Boolean(game.joiningOpen);

        if (gameStatus === "joining") {
            showStatus(
                joiningOpen
                    ? "Joining is open"
                    : "Joining is closed",
                "#86efac"
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
    },
    (error) => {
        console.error("Game listener failed:", error);

        showStatus(
            "Unable to load the game.",
            "#fca5a5"
        );
    }
);


// ======================================
// PLAYER LISTENER
// ======================================

onValue(
    playersRef,
    (snapshot) => {
        const players = snapshot.val() || {};
        const playerArray = Object.values(players);

        if (playerCountDisplay) {
            playerCountDisplay.textContent =
                String(playerArray.length);
        }

        if (!playerListDisplay) {
            return;
        }

        playerListDisplay.innerHTML = "";

        if (playerArray.length === 0) {
            playerListDisplay.textContent =
                "No players have joined yet.";

            return;
        }

        playerArray
            .sort((a, b) => {
                const nameA =
                    String(a.name || "").toLowerCase();

                const nameB =
                    String(b.name || "").toLowerCase();

                return nameA.localeCompare(nameB);
            })
            .forEach((player) => {
                const item =
                    document.createElement("div");

                item.className = "player-list-item";
                item.textContent =
                    `👤 ${player.name || player.id || "Player"}`;

                playerListDisplay.appendChild(item);
            });
    },
    (error) => {
        console.error("Player listener failed:", error);

        if (playerListDisplay) {
            playerListDisplay.textContent =
                "Unable to load players.";
        }
    }
);


// ======================================
// CURRENT CALL LISTENER
// ======================================

onValue(
    currentCallRef,
    (snapshot) => {
        const currentCall = snapshot.val();

        if (!currentNumberDisplay) {
            return;
        }

        if (!currentCall) {
            currentNumberDisplay.textContent = "--";
            return;
        }

        currentNumberDisplay.textContent =
            extractCallText(currentCall);

        animateCurrentNumber();
    },
    (error) => {
        console.error("Current-call listener failed:", error);
    }
);


// ======================================
// CALLED NUMBERS LISTENER
// ======================================

onValue(
    calledNumbersRef,
    (snapshot) => {
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
    },
    (error) => {
        console.error("Called-number listener failed:", error);
    }
);


// ======================================
// DRAW CALL HISTORY
// ======================================

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


function createCalledBall(call) {
    const ball = document.createElement("div");

    ball.className = "called";
    ball.textContent = extractCallText(call);

    return ball;
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

        alert(
            "Joining could not be opened. Please try again."
        );
    }
};


// ======================================
// START GAME
// ======================================

window.startGame = async function startGame() {
    try {
        const playersSnapshot = await get(playersRef);

        if (!playersSnapshot.exists()) {
            alert(
                "No players have joined yet."
            );

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

        alert(
            "The game could not be started."
        );
    }
};


// ======================================
// CALL NEXT NUMBER
// ======================================

window.callNumber = async function callNumber() {
    if (gameStatus !== "playing") {
        alert(
            "Start the game before calling numbers."
        );

        return;
    }

    if (gameLocked) {
        alert(
            "The game is locked because a winner has been announced."
        );

        return;
    }

    if (calledNumbers.length >= 75) {
        alert(
            "All 75 numbers have been called."
        );

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
            "The number could not be saved. Please try again."
        );

    } finally {
        setButtonState();
    }
};


// ======================================
// WINNER LISTENER
// ======================================

onValue(
    winnerRef,
    (snapshot) => {
        const winner = snapshot.val();

        if (!winner) {
            hideWinnerPopup();
            return;
        }

        if (winnerNameDisplay) {
            winnerNameDisplay.textContent =
                `${winner.name || "A player"} has won!`;
        }

        winnerPopup?.classList.add("show");
    },
    (error) => {
        console.error("Winner listener failed:", error);
    }
);


// ======================================
// WINNER POPUP CONTROLS
// ======================================

function hideWinnerPopup() {
    winnerPopup?.classList.remove("show");
}


window.closeWinnerPopup =
    function closeWinnerPopup() {
        hideWinnerPopup();
    };


// ======================================
// FORCE RESTART
// ======================================

window.resetGame = async function resetGame() {
    const confirmed = window.confirm(
        "Force restart the Bingo game?\n\n" +
        "This will delete all players, cards, marks, called numbers and the winner."
    );

    if (!confirmed) {
        return;
    }

    if (resetGameButton) {
        resetGameButton.disabled = true;
    }

    try {
        await remove(bingoRef);

        await set(bingoRef, {
            gameId: `game-${Date.now()}`,
            status: "joining",
            joiningOpen: true,
            locked: false,
            createdAt: Date.now()
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

        hideWinnerPopup();

        alert(
            "A new Bingo game has been created. Joining is open."
        );

    } catch (error) {
        console.error("Unable to reset game:", error);

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
