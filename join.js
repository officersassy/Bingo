import { database } from "./firebase.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const nameInput = document.getElementById("playerName");
const joinButton = document.getElementById("joinButton");
const joinStatus = document.getElementById("joinStatus");

function randomNumbers(min, max, count) {
  const result = [];
  while (result.length < count) {
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!result.includes(n)) result.push(n);
  }
  return result;
}

function createCard() {
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

function makePlayerId(name) {
  return name.trim().toLowerCase().replace(/[.#$[\]/]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const joinQuips = [
  (name) => `General Sassy has approved ${name}'s enlistment… against his better judgement.`,
  (name) => `${name}, your card is locked. No swapping it when the numbers get spicy.`,
  (name) => `Welcome, ${name}. General Sassy is watching, so dab responsibly.`,
  (name) => `${name} has entered General Sassy's arena. Dignity is optional; luck is not.`,
  (name) => `Card issued to ${name}. Complaints about the numbers can be directed to absolutely nobody.`,
  (name) => `General Sassy welcomes ${name}. Try not to shout “Bingo” after one ball.`
];

function randomJoinQuip(name) {
  return joinQuips[Math.floor(Math.random() * joinQuips.length)](name);
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

    if (!joiningOpen || gameStatus === "playing" || gameStatus === "winner") {
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
      status(`Welcome back, ${existing.name || name}. Your card missed you.`, "success");
      window.location.href = "player.html";
      return;
    }

    const gameId = game.gameId || `game-${Date.now()}`;
    await remove(ref(database, `bingo/kickedPlayers/${playerId}`));
    await set(playerRef, {
      id: playerId,
      name,
      card: createCard(),
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
    const welcomeLine = randomJoinQuip(name);
    await set(ref(database, "bingo/generalSassy"), {
      message: welcomeLine,
      event: "join",
      time: Date.now()
    });
    status(welcomeLine, "success");
    setTimeout(() => { window.location.href = "player.html"; }, 650);
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
