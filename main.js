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
const exitBtn = document.getElementById("exitBtn");
const roleModal = document.getElementById("roleModal");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");

// -------------------- HELPERS --------------------
function showJoinScreen() {
    screenJoin.classList.remove("hidden");
    screenGame.classList.add("hidden");
    hostControls.classList.add("hidden");
}
function showGameScreen() {
    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
    hostControls.classList.toggle("hidden", localStorage.getItem("isHost") !== "true");
}
function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function escapeHtml(text) {
    return text.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

// -------------------- PAGE LOAD --------------------
window.addEventListener("load", async () => {
    const id = localStorage.getItem("playerId");
    const name = localStorage.getItem("name");

    // If no local session
    if (!id || !name) {
        showJoinScreen();
        return;
    }

    // Check host or player exists
    if (id === "HOST") {
        const hostSnap = await get(ref(db, "room/host"));
        if (!hostSnap.exists() || hostSnap.val().name !== name) {
            localStorage.clear();
            showJoinScreen();
            return;
        }
        showGameScreen();
        return;
    } else {
        const playerSnap = await get(ref(db, `room/players/${id}`));
        if (!playerSnap.exists()) {
            localStorage.clear();
            showJoinScreen();
            return;
        }
        showGameScreen();
    }
});

// -------------------- JOIN --------------------
joinHostBtn.onclick = async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter host name.");

    const hostSnap = await get(ref(db, "room/host"));
    if (hostSnap.exists()) return alert("Host already exists.");

    await set(ref(db, "room/host"), { name });

    localStorage.setItem("playerId", "HOST");
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "true");

    showGameScreen();
};

joinPlayerBtn.onclick = async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter your name.");

    const hostSnap = await get(ref(db, "room/host"));
    if (!hostSnap.exists()) return alert("Host must join first.");

    const newPlayerRef = push(ref(db, "room/players"));
    await set(newPlayerRef, { name, role: null, alive: true });

    localStorage.setItem("playerId", newPlayerRef.key);
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "false");

    showGameScreen();
};

// -------------------- RENDER --------------------
onValue(ref(db, "room"), (snap) => {
    const data = snap.val() || {};
    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");

    hostStatus.innerText = data.host?.name ? `Host: ${data.host.name}` : "Waiting for host...";
    hostControls.classList.toggle("hidden", !isHost);

    playersList.innerHTML = "";

    const playersObj = data.players || {};
    Object.entries(playersObj).forEach(([pid, player]) => {
        const div = document.createElement("div");
        div.className = "playerCard";

        let cardImage = "images/back.png";
        if (isHost && player.role) cardImage = `images/${player.role}.png`;
        else if (!isHost && pid === myId && player.role) cardImage = `images/${player.role}.png`;

        div.innerHTML = `
            <h3 class="pc-name">${escapeHtml(player.name)}</h3>
            <img class="pc-img" src="${cardImage}" alt="card">
            <p class="pc-alive">${player.alive ? "Alive" : "Dead"}</p>
        `;

        div.onclick = () => {
            if (isHost || pid === myId) {
                modalName.innerText = player.name;
                modalRole.src = player.role ? `images/${player.role}.png` : "images/back.png";
                roleModal.style.display = "flex";
            }
        };

        playersList.appendChild(div);
    });
});

// -------------------- HOST ACTIONS --------------------
dealBtn.onclick = async () => {
    if (localStorage.getItem("isHost") !== "true") return alert("Only host can deal.");
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return alert("No players.");

    const players = Object.entries(snap.val());
    const roles = ["mafia","mafia","godfather","doctor","detective","civilian","civilian","civilian","civilian"];
    const shuffled = shuffleArray(roles).slice(0, players.length);

    for (let i = 0; i < players.length; i++) {
        await set(ref(db, `room/players/${players[i][0]}/role`), shuffled[i]);
    }
    alert("Roles dealt!");
};
shuffleBtn.onclick = dealBtn;

// -------------------- RESET --------------------
resetBtn.onclick = async () => {
    if (localStorage.getItem("isHost") !== "true") return alert("Only host can reset.");
    await remove(ref(db, "room"));
    localStorage.clear();
    location.reload();
};

// -------------------- NIGHT / DAY --------------------
nightBtn.onclick = () => document.body.classList.add("night");
dayBtn.onclick = () => document.body.classList.remove("night");

// -------------------- EXIT --------------------
exitBtn.onclick = async () => {
    const id = localStorage.getItem("playerId");
    if (!id) return location.reload();

    if (id === "HOST") await remove(ref(db, "room"));
    else await remove(ref(db, `room/players/${id}`));

    localStorage.clear();
    location.reload();
};

// -------------------- MODAL --------------------
window.closeModal = () => roleModal.style.display = "none";
