// ======================================
// BINGO V2 — JOIN SYSTEM
// Supports returning players safely
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

const nameInput =
    document.getElementById("playerName");

const joinButton =
    document.getElementById("joinButton");

const joinStatus =
    document.getElementById("joinStatus");


// ======================================
// RANDOM NUMBERS
// ======================================

function randomNumbers(min, max, amount) {
    const numbers = [];

    while (numbers.length < amount) {
        const number =
            Math.floor(
                Math.random() * (max - min + 1)
            ) + min;

        if (!numbers.includes(number)) {
            numbers.push(number);
        }
    }

    return numbers;
}


// ======================================
// CREATE LOCKED BINGO CARD
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
        for (
            let column = 0;
            column < 5;
            column += 1
        ) {
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
// CREATE SAFE PLAYER ID
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
// STATUS MESSAGE
// ======================================

function showStatus(message, type = "normal") {
    if (!joinStatus) {
        return;
    }

    joinStatus.textContent = message;

    if (type === "error") {
        joinStatus.style.color = "#fca5a5";
        return;
    }

    if (type === "success") {
        joinStatus.style.color = "#86efac";
        return;
    }

    joinStatus.style.color = "#bfdbfe";
}


// ======================================
// SAVE PLAYER IN BROWSER
// ======================================

function saveLocalPlayer(
    playerId,
    playerName,
    gameId
) {
    localStorage.setItem(
        "bingoPlayerId",
        playerId
    );

    localStorage.setItem(
        "bingoPlayer",
        playerId
    );

    localStorage.setItem(
        "bingoPlayerName",
        playerName
    );

    localStorage.setItem(
        "bingoGameId",
        gameId || ""
    );
}


// ======================================
// OPEN PLAYER PAGE
// ======================================

function openPlayerPage() {
    window.location.href = "player.html";
}


// ======================================
// JOIN GAME
// ======================================

window.joinGame =
    async function joinGame() {
        const playerName =
            nameInput?.value.trim() || "";

        if (!playerName) {
            showStatus(
                "Please enter your name.",
                "error"
            );

            nameInput?.focus();
            return;
        }

        if (playerName.length < 2) {
            showStatus(
                "Your name must contain at least 2 characters.",
                "error"
            );

            nameInput?.focus();
            return;
        }

        const playerId =
            createPlayerId(playerName);

        if (!playerId) {
            showStatus(
                "Please use letters or numbers in your name.",
                "error"
            );

            nameInput?.focus();
            return;
        }

        if (joinButton) {
            joinButton.disabled = true;
        }

        showStatus("Checking the game...");

        try {
            const gameSnapshot =
                await get(
                    ref(database, "bingo")
                );

            const game =
                gameSnapshot.val() || {};

            const status =
                game.status || "joining";

            const joiningOpen =
                game.joiningOpen !== false;

            if (
                !joiningOpen ||
                status === "playing" ||
                status === "winner"
            ) {
                showStatus(
                    "Joining is currently closed. Please speak to the host.",
                    "error"
                );

                return;
            }

            const gameId =
                game.gameId ||
                `game-${Date.now()}`;

            const playerRef =
                ref(
                    database,
                    `bingo/players/${playerId}`
                );

            const existingSnapshot =
                await get(playerRef);

            const savedPlayerId =
                localStorage.getItem(
                    "bingoPlayerId"
                ) ||
                localStorage.getItem(
                    "bingoPlayer"
                );

            // Existing player on this same browser:
            // safely reopen their card.
            if (
                existingSnapshot.exists() &&
                savedPlayerId === playerId
            ) {
                const existingPlayer =
                    existingSnapshot.val();

                saveLocalPlayer(
                    playerId,
                    existingPlayer.name ||
                        playerName,
                    existingPlayer.gameId ||
                        gameId
                );

                showStatus(
                    "Welcome back! Loading your card...",
                    "success"
                );

                window.setTimeout(
                    openPlayerPage,
                    500
                );

                return;
            }

            // Someone else already owns this name.
            if (existingSnapshot.exists()) {
                showStatus(
                    "That player name is already in use. Please choose another name.",
                    "error"
                );

                nameInput?.focus();
                return;
            }

            const bingoCard =
                createBingoCard();

            await set(playerRef, {
                id: playerId,
                name: playerName,
                card: bingoCard,
                marked: null,
                joinedAt: Date.now(),
                cardCreatedAt: Date.now(),
                gameId,
                locked: true
            });

            saveLocalPlayer(
                playerId,
                playerName,
                gameId
            );

            showStatus(
                "You have joined successfully. Loading your card...",
                "success"
            );

            window.setTimeout(
                openPlayerPage,
                500
            );

        } catch (error) {
            console.error(
                "Unable to join Bingo:",
                error
            );

            showStatus(
                "The game could not be joined. Please try again.",
                "error"
            );

        } finally {
            if (joinButton) {
                joinButton.disabled = false;
            }
        }
    };


// ======================================
// ENTER KEY SUPPORT
// ======================================

nameInput?.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Enter") {
            window.joinGame();
        }
    }
);


// ======================================
// LOAD SAVED NAME
// ======================================

const savedName =
    localStorage.getItem(
        "bingoPlayerName"
    );

if (nameInput && savedName) {
    nameInput.value = savedName;
}

nameInput?.focus();
