import { database } from "./firebase.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const nameInput = document.getElementById("playerName");
const joinButton = document.getElementById("joinButton");
const joinStatus = document.getElementById("joinStatus");

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function columnRange(column) {
  if (column === 0) return [1, 9];
  if (column === 8) return [80, 90];
  return [column * 10, column * 10 + 9];
}

function randomUnique(min, max, count) {
  return shuffle(Array.from({ length: max - min + 1 }, (_, index) => min + index))
    .slice(0, count)
    .sort((a, b) => a - b);
}

function create90BallTicket() {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const columnCounts = Array(9).fill(1);
    let remaining = 6;
    while (remaining > 0) {
      const column = Math.floor(Math.random() * 9);
      if (columnCounts[column] < 3) {
        columnCounts[column] += 1;
        remaining -= 1;
      }
    }

    const rows = Array.from({ length: 3 }, () => Array(9).fill(false));
    const rowCounts = [0, 0, 0];
    let valid = true;

    const order = shuffle(Array.from({ length: 9 }, (_, index) => index))
      .sort((a, b) => columnCounts[b] - columnCounts[a]);

    for (const column of order) {
      const count = columnCounts[column];
      const combinations = count === 3
        ? [[0, 1, 2]]
        : count === 2
          ? shuffle([[0, 1], [0, 2], [1, 2]])
          : shuffle([[0], [1], [2]]);

      const choice = combinations.find((combo) =>
        combo.every((row) => rowCounts[row] < 5)
      );

      if (!choice) {
        valid = false;
        break;
      }

      choice.forEach((row) => {
        rows[row][column] = true;
        rowCounts[row] += 1;
      });
    }

    if (!valid || rowCounts.some((count) => count !== 5)) continue;

    const ticket = Array.from({ length: 3 }, () => Array(9).fill("BLANK"));
    for (let column = 0; column < 9; column += 1) {
      const occupiedRows = [0, 1, 2].filter((row) => rows[row][column]);
      const [min, max] = columnRange(column);
      const numbers = randomUnique(min, max, occupiedRows.length);
      occupiedRows.forEach((row, index) => {
        ticket[row][column] = numbers[index];
      });
    }

    return ticket.flat();
  }

  throw new Error("Unable to generate a valid 90-ball ticket.");
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
      status("Welcome back! Loading your ticket…", "success");
      window.location.href = "player.html";
      return;
    }

    const gameId = game.gameId || `game-${Date.now()}`;
    await set(playerRef, {
      id: playerId,
      name,
      card: create90BallTicket(),
      marked: null,
      gameId,
      locked: true,
      ticketType: "90-ball",
      joinedAt: Date.now(),
      cardCreatedAt: Date.now()
    });

    localStorage.setItem("bingoPlayerId", playerId);
    localStorage.setItem("bingoPlayer", playerId);
    localStorage.setItem("bingoPlayerName", name);
    localStorage.setItem("bingoGameId", gameId);
    status("Joined! Loading your 90-ball ticket…", "success");
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
