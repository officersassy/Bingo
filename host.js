<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Bingo Host</title>

    <link rel="stylesheet" href="style.css">
</head>

<body>

    <div class="background"></div>

    <main class="host-container">

        <h1>🎤 BINGO HOST</h1>

        <div id="gameStatus" class="status-pill">
            Loading game...
        </div>

        <section class="host-grid">

            <div class="host-box">

                <h2>Current Number</h2>

                <div id="currentNumber">
                    --
                </div>

            </div>

            <div class="host-box">

                <h2>Players Joined</h2>

                <span id="playerCount">
                    0
                </span>

                <div id="playerList">
                    No players have joined yet.
                </div>

            </div>

        </section>

        <section class="host-box">

            <h2>Game Mode</h2>

            <select
                id="gameModeSelect"
                style="
                    width: min(100%, 380px);
                    min-height: 56px;
                    padding: 12px 18px;
                    border-radius: 14px;
                    border: 1px solid rgba(125, 211, 252, 0.3);
                    background: #071a3d;
                    color: white;
                    font-size: 18px;
                    font-weight: bold;
                    text-align: center;
                "
            >
                <option value="one-line">
                    One Line
                </option>

                <option value="two-lines">
                    Two Lines
                </option>

                <option value="four-corners">
                    Four Corners
                </option>

                <option value="full-house">
                    Full House
                </option>
            </select>

            <p id="gameModeDescription" class="helper-text">
                Complete any horizontal line.
            </p>

        </section>

        <div class="host-buttons">

            <button
                id="openJoiningButton"
                type="button"
                onclick="openJoining()"
            >
                🟢 Open Joining
            </button>

            <button
                id="startGameButton"
                class="success"
                type="button"
                onclick="startGame()"
            >
                ▶️ Start Game
            </button>

            <button
                id="callNumberButton"
                type="button"
                onclick="callNumber()"
            >
                🎱 Call Next Number
            </button>

            <button
                id="resetGameButton"
                class="danger"
                type="button"
                onclick="resetGame()"
            >
                🔄 Force Restart
            </button>

        </div>

        <section class="host-box">

            <h2>Last 10 Calls</h2>

            <div id="lastCalls"></div>

        </section>

        <section class="host-box">

            <h2>All Called Numbers</h2>

            <div id="calledNumbers"></div>

        </section>

        <p class="helper-text">
            The Remove button deletes an individual player and their card.
            Force Restart keeps registered players but gives everyone a fresh
            card and clears all dabs.
        </p>

    </main>

    <div id="winnerPopup" class="winner-popup">

        <div class="winner-box">

            <div class="winner-title">
                🎉 BINGO WINNER 🎉
            </div>

            <div id="winnerName" class="winner-name">
                We have a winner!
            </div>

            <div class="action-buttons">

                <button
                    type="button"
                    onclick="closeWinnerPopup()"
                >
                    Close Popup
                </button>

                <button
                    class="danger"
                    type="button"
                    onclick="resetGame()"
                >
                    🔄 Start New Game
                </button>

            </div>

        </div>

    </div>

    <script type="module" src="./host.js"></script>

</body>

</html>
