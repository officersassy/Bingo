import { database } from "./firebase.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const nameInput = document.getElementById("playerName");
const joinButton = document.getElementById("joinButton");
const joinStatus = document.getElementById("joinStatus");
const BLANK = "__BLANK__";

function randomNumbers(min, max, count) {
  const result = [];
  while (result.length < count) {
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!result.includes(n)) result.push(n);
  }
  return result.sort((a, b) => a - b);
}

function is90Mode(mode) {
  return mode === "progressive" || mode === "full-house";
}

function create75Card() {
  const columns = [
    randomNumbers(1, 15, 5), randomNumbers(16, 30, 5), randomNumbers(31, 45, 5),
    randomNumbers(46, 60, 5), randomNumbers(61, 75, 5)
  ];
  const card = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      card.push(row === 2 && col === 2 ? "FREE" : columns[col][row]);
    }
  }
  return card;
}

function create90Card() {
  let rowColumns;
  do {
    rowColumns = Array.from({ length: 3 }, () => {
      const columns = [];
      while (columns.length < 5) {
        const column = Math.floor(Math.random() * 9);
        if (!columns.includes(column)) columns.push(column);
      }
      return columns.sort((a, b) => a - b);
    });
  } while (new Set(rowColumns.flat()).size < 9);

  const grid = Array.from({ length: 3 }, () => Array(9).fill(BLANK));
  for (let col = 0; col < 9; col += 1) {
    const rows = [0, 1, 2].filter((row) => rowColumns[row].includes(col));
    const min = col === 0 ? 1 : col * 10;
    const max = col === 8 ? 90 : col * 10 + 9;
    const numbers = randomNumbers(min, max, rows.length);
    rows.forEach((row, index) => { grid[row][col] = numbers[index]; });
  }
  return grid.flat();
}

function createCard(mode) {
  return is90Mode(mode) ? create90Card() : create75Card();
}

function makePlayerId(name) {
  return name.trim().toLowerCase().replace(/[.#$[\]/]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function status(message, type = "normal") {
  joinStatus.textContent = message;
  joinStatus.dataset.type = type;
}

async function joinGame() {
  const name = nameInput.value.trim();
  if (name.length < 2) {
    status("Please enter at least 2 characters.", "error");
    return;
  }
  const playerId = makePlayerId(name);
  if (!playerId) {
    status("Please use letters or numbers in your name.", "error");
    return;
  }

  joinButton.disabled = true;
  status("Checking the game…");

  try {
    const gameSnap = await get(ref(database, "bingo"));
    const game = gameSnap.val() || {};
    const gameStatus = game.status || "joining";
    const joiningOpen = game.joiningOpen !== false;
    const gameMode = game.gameMode || "progressive";

    if (!joiningOpen || ["playing", "stage-winner", "winner"].includes(gameStatus)) {
      status("Joining is closed. Please speak to the host.", "error");
      return;
    }

    const playerRef = ref(database, `bingo/players/${playerId}`);
    const existingSnap = await get(playerRef);
    const savedId = localStorage.getItem("bingoPlayerId") || localStorage.getItem("bingoPlayer");

    if (existingSnap.exists()) {
      if (savedId !== playerId) {
        status("That name is already in use. Choose another name.", "error");
        return;
      }
      const existing = existingSnap.val();
      localStorage.setItem("bingoPlayerId", playerId);
      localStorage.setItem("bingoPlayer", playerId);
      localStorage.setItem("bingoPlayerName", existing.name || name);
      localStorage.setItem("bingoGameId", existing.gameId || game.gameId || "");
      status("Welcome back! Loading your card…", "success");
      window.location.href = "player.html";
      return;
    }

    const gameId = game.gameId || `game-${Date.now()}`;
    const cardType = is90Mode(gameMode) ? "90" : "75";
    await set(playerRef, {
      id: playerId,
      name,
      card: createCard(gameMode),
      cardType,
      marked: null,
      gameId,
      locked: true,
      joinedAt: Date.now(),
      cardCreatedAt: Date.now()
    });

    localStorage.setItem("bingoPlayerId", playerId);
    localStorage.setItem("bingoPlayer", playerId);
    localStorage.setItem("bingoPlayerName", name);
    localStorage.setItem("bingoGameId", gameId);
    status(`Joined! Your ${cardType}-ball card is ready…`, "success");
    window.location.href = "player.html";
  } catch (error) {
    console.error(error);
    status("Could not join. Please try again.", "error");
  } finally {
    joinButton.disabled = false;
  }
}

joinButton.addEventListener("click", joinGame);
nameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinGame();
});
nameInput.value = localStorage.getItem("bingoPlayerName") || "";
nameInput.focus();
