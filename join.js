// ======================================
// BINGO V2 — JOIN SYSTEM
// ======================================

import { database } from "./firebase.js";

import {
    ref,
    get,
    set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// ======================================
// PAGE ELEMENTS
// ======================================

const nameInput = document.getElementById("playerName");
const joinButton = document.getElementById("joinButton");
const joinStatus = document.getElementById("joinStatus");


// ======================================
// CREATE RANDOM UNIQUE NUMBERS
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


// ======================================
// CREATE 5 × 5 BINGO CARD
// ======================================

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
// CREATE SAFE FIREBASE PLAYER ID
// ======================================

function createPlayerId(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[.#$[\]/]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


// ======================================
// SHOW STATUS MESSAGE
// ======================================

function showStatus(message, type = "normal") {
    if (!joinStatus) {
        return;
    }

    joinStatus.textContent = message;

    if (type === "error") {
        joinStatus.style.color = "#fca5a5";
    } else if (type === "success") {
        joinStatus.style.color = "#86efac";
    } else {
        joinStatus.style.color = "";
    }
}


// ======================================
// JOIN GAME
// ======================================

window.joinGame = async function joinGame() {
    const playerName = nameInput?.value.trim() || "";

    if (!playerName) {
        showStatus("Please enter your name.", "error");
        nameInput?.focus();
        return;
    }

    if (playerName.length < 2) {
        showStatus("Your name must contain at least 2 characters.", "error");
        nameInput?.focus();
        return;
    }

    const playerId = createPlayerId(playerName);

    if (!playerId) {
        showStatus("Please use letters or numbers in your name.", "error");
        nameInput?.focus();
        return;
    }

    joinButton.disabled = true;
    showStatus("Checking the game...");

    try {
        const bingoSnapshot = await get(ref(database, "bingo"));
        const bingoData = bingoSnapshot.val() || {};

        const status = bingoData.status || "waiting";
        const joiningOpen =
            bingoData.joiningOpen === undefined
                ? true
                : bingoData.joiningOpen;

        if (
            joiningOpen === false ||
            status === "playing" ||
            status === "winner"
        ) {
            showStatus(
                "Joining is currently closed. Please speak to the host.",
                "error"
            );

            joinButton.disabled = false;
            return;
        }

        const playerRef = ref(
            database,
            `bingo/players/${playerId}`
        );

        const existingPlayer = await get(playerRef);

        if (existingPlayer.exists()) {
            showStatus(
                "That player name is already in use. Please choose another name.",
                "error"
            );

            joinButton.disabled = false;
            nameInput?.focus();
            return;
        }

        const gameId =
            bingoData.gameId || `game-${Date.now()}`;

        const bingoCard = createBingoCard();

        await set(playerRef, {
            id: playerId,
            name: playerName,
            card: bingoCard,
            joinedAt: Date.now(),
            gameId,
            locked: true
        });

        localStorage.setItem("bingoPlayerId", playerId);
        localStorage.setItem("bingoPlayerName", playerName);
        localStorage.setItem("bingoGameId", gameId);

        // Compatibility with the earlier version.
        localStorage.setItem("bingoPlayer", playerId);

        showStatus(
            "You have joined successfully. Loading your card...",
            "success"
        );

        window.setTimeout(() => {
            window.location.href = "player.html";
        }, 700);

    } catch (error) {
        console.error("Unable to join Bingo:", error);

        showStatus(
            "The game could not be joined. Please try again.",
            "error"
        );

        joinButton.disabled = false;
    }
};


// ======================================
// ENTER KEY SUPPORT
// ======================================

nameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        window.joinGame();
    }
});

nameInput?.focus();
