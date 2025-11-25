import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue, remove, push } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// -------------------- FIREBASE CONFIG --------------------
const firebaseConfig = {
    apiKey: "AIzaSyCflm17U7JTwkEMHjfyp4G5UU29KQzVs4I",
    authDomain: "mafia-wars-online.firebaseapp.com",
    databaseURL: "https://mafia-wars-online-default-rtdb.firebaseio.com/",
    projectId: "mafia-wars-online",
    storageBucket: "mafia-wars-online.appspot.com",
    messagingSenderId: "1069937976880",
    appId: "1:1069937976880:web:b082963b7964c8e25b8f30"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// -------------------- DOM --------------------
const screenJoin = document.getElementById("screenJoin");
const screenGame = document.getElementById("screenGame");

const playerNameInput = document.getElementById("playerName");
const joinHostBtn = document.getElementById("joinHostBtn");
const joinPlayerBtn = document.getElementById("joinPlayerBtn");

const hostControls = document.getElementById("hostControls");
const hostStatus = document.getElementById("hostStatus");

const playersList = document.getElementById("playersList");

const dealBtn = document.getElementById("dealBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const nightBtn = document.getElementById("nightBtn");
const dayBtn = document.getElementById("dayBtn");

const roleModal = document.getElementById("roleModal");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");

const exitBtn = document.getElementById("exitBtn");

// -------------------- STATE HELPERS --------------------
const savedPlayerId = () => localStorage.getItem("playerId");
const savedName = () => localStorage.getItem("name");
const savedIsHost = () => localStorage.getItem("isHost") === "true";

// -------------------- SAFE UI SHOW/HIDE --------------------
function showJoinScreen() {
    screenGame.classList.add("hidden");
    screenJoin.classList.remove("hidden");
    hostControls.classList.add("hidden");
}
function showGameScreen() {
    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
    hostControls.classList.toggle("hidden", !savedIsHost());
}

// -------------------- BOOT: validate stored session then show appropriate screen ----
window.addEventListener("load", async () => {
    const id = savedPlayerId();
    const name = savedName();

    // no saved session -> show join
    if (!id || !name) {
        showJoinScreen();
        return;
    }

    // If saved id is HOST, validate host exists.
    if (id === "HOST") {
        const hostSnap = await get(ref(db, "room/host"));
        if (!hostSnap.exists() || hostSnap.val().name !== name) {
            // stale host entry locally (was removed from DB) => clear and show join
            localStorage.clear();
            showJoinScreen();
            return;
        }
        // host exists and matches -> show game
        showGameScreen();
        return;
    }

    // saved id is a player key: verify player exists in DB
    const playerSnap = await get(ref(db, `room/players/${id}`));
    if (!playerSnap.exists()) {
        // stale local player, clear and show join
        localStorage.clear();
        showJoinScreen();
        return;
    }

    // valid player session
    showGameScreen();
});

// -------------------- JOIN AS HOST --------------------
joinHostBtn.onclick = async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter host name.");

    // check existing host
    const hostSnap = await get(ref(db, "room/host"));
    if (hostSnap.exists()) return alert("Host already exists.");

    // set host
    await set(ref(db, "room/host"), { name });

    // save locally
    localStorage.setItem("playerId", "HOST");
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "true");

    showGameScreen();
};

// -------------------- JOIN AS PLAYER --------------------
joinPlayerBtn.onclick = async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter your name.");

    // verify host present
    const hostSnap = await get(ref(db, "room/host"));
    if (!hostSnap.exists()) return alert("Host not present. Ask someone to join as host first.");

    // push new player
    const newPlayerRef = push(ref(db, "room/players"));
    await set(newPlayerRef, {
        name,
        role: null,
        alive: true
    });

    localStorage.setItem("playerId", newPlayerRef.key);
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "false");

    showGameScreen();
};

// -------------------- RENDER ROOM (host + players) --------------------
onValue(ref(db, "room"), (snap) => {
    const data = snap.val() || {};

    const isHost = savedIsHost();
    const myId = savedPlayerId();

    // Host header (top) - always show hostStatus text
    if (data.host && data.host.name) {
        hostStatus.innerText = "Host: " + data.host.name;
    } else {
        hostStatus.innerText = "Waiting for host...";
    }

    // hostControls visible only to host
    hostControls.classList.toggle("hidden", !isHost);

    // Build players grid (only players list under room/players)
    playersList.innerHTML = "";

    const playersObj = data.players || {};

    // Convert to array of entries so order is stable-ish
    Object.entries(playersObj).forEach(([pid, player]) => {
        const div = document.createElement("div");
        div.className = "playerCard";

        // choose card image:
        // - If host: show role image if assigned, otherwise back
        // - If player and it's the current user: show role image if assigned
        // - Otherwise show back
        let cardImage = "images/back.png";
        if (isHost && player.role) {
            cardImage = `images/${player.role}.png`;
        } else if (!isHost && pid === myId && player.role) {
            cardImage = `images/${player.role}.png`;
        }

        const aliveText = player.alive ? "Alive" : "Dead";

        div.innerHTML = `
            <h3 class="pc-name">${escapeHtml(player.name)}</h3>
            <img class="pc-img" src="${cardImage}" alt="card">
            <p class="pc-alive">${escapeHtml(aliveText)}</p>
        `;

        // Click behavior: host can open any player's modal; players can open only their own
        div.addEventListener("click", () => {
            if (isHost || pid === myId) {
                modalName.innerText = player.name;
                modalRole.src = player.role ? `images/${player.role}.png` : "images/back.png";
                roleModal.style.display = "flex";
            }
        });

        playersList.appendChild(div);
    });
});

// -------------------- HOST ACTIONS: deal/shuffle --------------------
dealBtn.onclick = async () => {
    if (!savedIsHost()) return alert("Only host can deal.");

    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return alert("No players to deal roles to.");

    const players = Object.entries(snap.val()); // array of [pid, player]

    // prepare roles: if fewer players than roles, we assign only as many as players
    const rolesTemplate = [
        "mafia","mafia","godfather","doctor","detective",
        "civilian","civilian","civilian","civilian"
    ];

    // Shuffle roles and trim to players.length
    const shuffled = shuffleArray(rolesTemplate).slice(0, players.length);

    // Assign roles in order
    for (let i = 0; i < players.length; i++) {
        const [pid] = players[i];
        const role = shuffled[i];
        await set(ref(db, `room/players/${pid}/role`), role);
    }

    alert("Roles dealt.");
};

shuffleBtn.onclick = dealBtn;

// -------------------- RESET --------------------
resetBtn.onclick = async () => {
    if (!savedIsHost()) return alert("Only host can reset.");
    await remove(ref(db, "room"));
    localStorage.clear();
    location.reload();
};

// -------------------- NIGHT / DAY (visual only) --------------------
nightBtn.onclick = () => document.body.classList.add("night");
dayBtn.onclick = () => document.body.classList.remove("night");

// -------------------- EXIT --------------------
exitBtn.onclick = async () => {
    const id = savedPlayerId();
    if (!id) {
        localStorage.clear();
        showJoinScreen();
        return;
    }

    if (id === "HOST") {
        // host leaving clears the room
        await remove(ref(db, "room"));
    } else {
        // remove only this player
        await remove(ref(db, `room/players/${id}`));
    }

    localStorage.clear();
    location.reload();
};

// -------------------- MODAL CLOSE --------------------
window.closeModal = function () {
    roleModal.style.display = "none";
};

// -------------------- UTILITIES --------------------
function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// small helper to avoid XSS if names contain strange chars
function escapeHtml(unsafe) {
    return unsafe
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
