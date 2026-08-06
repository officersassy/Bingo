import { database } from "./firebase.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const nameInput = document.getElementById("playerName");
const countInput = document.getElementById("cardCount");
const joinButton = document.getElementById("joinButton");
const joinStatus = document.getElementById("joinStatus");

const columnRanges = [
  [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
  [50, 59], [60, 69], [70, 79], [80, 90]
];

function randomUnique(min, max, count) {
  const values = [];
  while (values.length < count) {
    const value = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!values.includes(value)) values.push(value);
  }
  return values.sort((a, b) => a - b);
}

function create90BallTicket() {
  let rowColumns;
  do {
    rowColumns = Array.from({ length: 3 }, () => {
      const cols = [];
      while (cols.length < 5) {
        const col = Math.floor(Math.random() * 9);
        if (!cols.includes(col)) cols.push(col);
      }
      return cols.sort((a, b) => a - b);
    });
  } while (!Array.from({ length: 9 }, (_, col) => rowColumns.some((row) => row.includes(col))).every(Boolean));

  const ticket = Array(27).fill("BLANK");
  for (let col = 0; col < 9; col += 1) {
    const rows = [0, 1, 2].filter((row) => rowColumns[row].includes(col));
    const [min, max] = columnRanges[col];
    const numbers = randomUnique(min, max, rows.length);
    rows.forEach((row, index) => {
      ticket[(row * 9) + col] = numbers[index];
    });
  }
  return ticket;
}

function createTickets(count) {
  return Array.from({ length: count }, () => create90BallTicket());
}

function makePlayerId(name) {
  return name.trim().toLowerCase().replace(/[.#$[\]/]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const joinQuips = [
  (name, count) => `General Sassy has issued ${name} ${count} ticket${count === 1 ? "" : "s"}. Try not to waste them.`,
  (name) => `${name} has joined the 90-ball battlefield. Dignity remains optional.`,
  (name) => `Welcome, ${name}. General Sassy is watching every dab.`,
  (name, count) => `${count} ticket${count === 1 ? "" : "s"} secured for ${name}. Complaints go directly in the bin.`
];

function status(message, type = "normal") {
  joinStatus.textContent = message;
  joinStatus.dataset.type = type;
}

async function joinGame() {
  const name = nameInput.value.trim();
  const cardCount = Math.min(3, Math.max(1, Number(countInput.value) || 1));
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
  status("General Sassy is checking the guest list…");
  try {
    const gameSnap = await get(ref(database, "bingo"));
    const game = gameSnap.val() || {};
    if (game.joiningOpen === false || ["playing", "stage-winner", "winner"].includes(game.status)) {
      status("Joining is closed. General Sassy has sealed the gates.", "error");
      return;
    }

    const playerRef = ref(database, `bingo/players/${playerId}`);
    const existingSnap = await get(playerRef);
    const savedId = localStorage.getItem("bingoPlayerId") || localStorage.getItem("bingoPlayer");
    if (existingSnap.exists()) {
      if (savedId !== playerId) {
        status("That name is already in use. Pick another identity.", "error");
        return;
      }
      const existing = existingSnap.val();
      localStorage.setItem("bingoPlayerId", playerId);
      localStorage.setItem("bingoPlayer", playerId);
      localStorage.setItem("bingoPlayerName", existing.name || name);
      localStorage.setItem("bingoGameId", existing.gameId || game.gameId || "");
      status(`Welcome back, ${existing.name || name}. Your tickets missed you.`, "success");
      setTimeout(() => { window.location.href = "player.html"; }, 450);
      return;
    }

    const gameId = game.gameId || `game-${Date.now()}`;
    await remove(ref(database, `bingo/kickedPlayers/${playerId}`));
    await set(playerRef, {
      id: playerId,
      name,
      cards: createTickets(cardCount),
      cardCount,
      markedCards: null,
      gameId,
      locked: true,
      joinedAt: Date.now(),
      cardCreatedAt: Date.now()
    });

    localStorage.setItem("bingoPlayerId", playerId);
    localStorage.setItem("bingoPlayer", playerId);
    localStorage.setItem("bingoPlayerName", name);
    localStorage.setItem("bingoGameId", gameId);

    const welcomeLine = joinQuips[Math.floor(Math.random() * joinQuips.length)](name, cardCount);
    await set(ref(database, "bingo/generalSassy"), { message: welcomeLine, event: "join", time: Date.now() });
    status(welcomeLine, "success");
    setTimeout(() => { window.location.href = "player.html"; }, 650);
  } catch (error) {
    console.error(error);
    status("Could not join. General Sassy blames the internet.", "error");
  } finally {
    joinButton.disabled = false;
  }
}

joinButton.addEventListener("click", joinGame);
nameInput.addEventListener("keydown", (event) => { if (event.key === "Enter") joinGame(); });
nameInput.value = localStorage.getItem("bingoPlayerName") || "";
nameInput.focus();
