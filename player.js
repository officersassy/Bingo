// ======================================
// BINGO V2 — PLAYER SYSTEM + CONFETTI
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
// GAME DATA
// ======================================

let playerData = null;
let bingoCard = [];
let calledNumbers = [];
let markedNumbers = [];

let gameStatus = "waiting";
let gameLocked = false;

let confettiRunning = false;
let lastWinnerTime = null;


// ======================================
// STATUS MESSAGE
// ======================================

function showPlayerStatus(message, colour = "") {
    if (!playerStatus) {
        return;
    }

    playerStatus.textContent = message;
    playerStatus.style.color = colour;
}


// ======================================
// CONVERT FIREBASE DATA TO ARRAYS
// ======================================

function convertCardToArray(cardData) {
    if (!cardData) {
        return [];
    }

    if (Array.isArray(cardData)) {
        return cardData.flat();
    }

    return Object.values(cardData).flat();
}


function convertMarksToArray(markedData) {
    if (!markedData) {
        return [];
    }

    if (Array.isArray(markedData)) {
        return markedData
            .map(Number)
            .filter(Number.isFinite);
    }

    return Object.values(markedData)
        .map(Number)
        .filter(Number.isFinite);
}


// ======================================
// READ CALLED NUMBER
// ======================================

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

        bingoCard =
            convertCardToArray(playerData.card);

        markedNumbers =
            convertMarksToArray(playerData.marked);

        if (bingoCard.length !== 25) {
            throw new Error("Saved Bingo card is invalid.");
        }

        if (welcomePlayer) {
            welcomePlayer.textContent =
                `Welcome, ${playerData.name || playerId}`;
        }

        drawCard();
        updateStatusMessage();

    } catch (error) {
        console.error("Unable to load player:", error);

        showPlayerStatus(
            "Your Bingo card could not be loaded.",
            "#fca5a5"
        );
    }
}


// ======================================
// DRAW PLAYER CARD
// ======================================

function drawCard() {
    if (!cardArea || bingoCard.length !== 25) {
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

    if (markedNumbers.includes(number)) {
        markedNumbers =
            markedNumbers.filter(
                (markedNumber) => markedNumber !== number
            );
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

        showPlayerStatus(
            markedNumbers.includes(number)
                ? `${number} has been dabbed.`
                : `${number} has been undabbed.`,
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

            playerCurrent.classList.remove("number-pop");

            void playerCurrent.offsetWidth;

            playerCurrent.classList.add("number-pop");
        }
    }
);


// ======================================
// ALL CALLED NUMBERS
// ======================================

onValue(
    ref(database, "bingo/calledNumbers"),
    (snapshot) => {
        const calls = snapshot.val();

        calledNumbers = [];

        if (calls) {
            Object.values(calls).forEach((callData) => {
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

    return winningLines.some(lineIsComplete);
}


// ======================================
// CLAIM BINGO
// ======================================

window.claimBingo =
    async function claimBingo() {

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
                    name:
                        playerData.name || playerId,
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
// CONFETTI CANNONS
// ======================================

function startConfettiCannons() {
    if (confettiRunning) {
        return;
    }

    confettiRunning = true;

    const canvas =
        document.createElement("canvas");

    canvas.id = "confettiCanvas";

    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "20000";

    document.body.appendChild(canvas);

    const context =
        canvas.getContext("2d");

    const resizeCanvas = () => {
        canvas.width =
            window.innerWidth * window.devicePixelRatio;

        canvas.height =
            window.innerHeight * window.devicePixelRatio;

        context.setTransform(
            window.devicePixelRatio,
            0,
            0,
            window.devicePixelRatio,
            0,
            0
        );
    };

    resizeCanvas();

    window.addEventListener(
        "resize",
        resizeCanvas
    );

    const colours = [
        "#facc15",
        "#38bdf8",
        "#2563eb",
        "#22c55e",
        "#ef4444",
        "#a855f7",
        "#ffffff"
    ];

    const pieces = [];

    function fireCannon(side) {
        const startX =
            side === "left"
                ? 0
                : window.innerWidth;

        const direction =
            side === "left"
                ? 1
                : -1;

        for (let index = 0; index < 110; index += 1) {
            pieces.push({
                x: startX,
                y:
                    window.innerHeight *
                    (0.65 + Math.random() * 0.25),

                velocityX:
                    direction *
                    (5 + Math.random() * 11),

                velocityY:
                    -(8 + Math.random() * 14),

                gravity:
                    0.22 + Math.random() * 0.09,

                rotation:
                    Math.random() * Math.PI * 2,

                rotationSpeed:
                    (Math.random() - 0.5) * 0.35,

                width:
                    7 + Math.random() * 8,

                height:
                    4 + Math.random() * 7,

                colour:
                    colours[
                        Math.floor(
                            Math.random() *
                            colours.length
                        )
                    ],

                life: 1
            });
        }
    }

    fireCannon("left");
    fireCannon("right");

    window.setTimeout(() => {
        fireCannon("left");
        fireCannon("right");
    }, 650);

    window.setTimeout(() => {
        fireCannon("left");
        fireCannon("right");
    }, 1300);

    const startTime =
        performance.now();

    function animateConfetti(currentTime) {
        context.clearRect(
            0,
            0,
            window.innerWidth,
            window.innerHeight
        );

        pieces.forEach((piece) => {
            piece.velocityY += piece.gravity;

            piece.x += piece.velocityX;
            piece.y += piece.velocityY;

            piece.velocityX *= 0.993;

            piece.rotation +=
                piece.rotationSpeed;

            if (
                currentTime - startTime >
                4300
            ) {
                piece.life -= 0.018;
            }

            context.save();

            context.globalAlpha =
                Math.max(piece.life, 0);

            context.translate(
                piece.x,
                piece.y
            );

            context.rotate(
                piece.rotation
            );

            context.fillStyle =
                piece.colour;

            context.fillRect(
                -piece.width / 2,
                -piece.height / 2,
                piece.width,
                piece.height
            );

            context.restore();
        });

        for (
            let index = pieces.length - 1;
            index >= 0;
            index -= 1
        ) {
            const piece = pieces[index];

            if (
                piece.y >
                window.innerHeight + 100 ||
                piece.life <= 0
            ) {
                pieces.splice(index, 1);
            }
        }

        if (
            pieces.length > 0 &&
            currentTime - startTime < 7000
        ) {
            requestAnimationFrame(
                animateConfetti
            );

            return;
        }

        window.removeEventListener(
            "resize",
            resizeCanvas
        );

        canvas.remove();

        confettiRunning = false;
    }

    requestAnimationFrame(
        animateConfetti
    );
}


// ======================================
// WINNER POPUP
// ======================================

onValue(
    ref(database, "bingo/winner"),
    (snapshot) => {
        const winner = snapshot.val();

        if (!winner) {
            winnerPopup?.classList.remove("show");
            lastWinnerTime = null;
            return;
        }

        if (winnerName) {
            winnerName.textContent =
                `${winner.name || "A player"} has won!`;
        }

        winnerPopup?.classList.add("show");

        const winnerTime =
            winner.claimedAt || winner.time || 0;

        if (winnerTime !== lastWinnerTime) {
            lastWinnerTime = winnerTime;

            startConfettiCannons();
        }
    }
);


window.closeWinnerPopup =
    function closeWinnerPopup() {
        winnerPopup?.classList.remove("show");
    };


// ======================================
// START
// ======================================

loadPlayer();
