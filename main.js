import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase, ref, set, get, child, onValue, remove, push } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// ---------------------------------------------
// FIREBASE CONFIG
// ---------------------------------------------
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

// ---------------------------------------------
// HTML ELEMENTS
// ---------------------------------------------
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

// ---------------------------------------------
// PAGE LOAD: auto-restore session
// ---------------------------------------------
window.onload = () => {
    const savedName = localStorage.getItem("name");
    const savedId = localStorage.getItem("playerId");

    if (savedName && savedId) {
        screenJoin.classList.add("hidden");
        screenGame.classList.remove("hidden");
    }
};

// ---------------------------------------------
// JOIN AS HOST
// ---------------------------------------------
joinHostBtn.onclick = async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter host name.");

    const roomRef = ref(db, "room");

    const snap = await get(child(roomRef, "host"));
    if (snap.exists()) return alert("Host already exists.");

    await set(ref(db, "room/host"), { name });

    localStorage.setItem("playerId", "HOST");
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "true");

    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
};

// ---------------------------------------------
// JOIN AS PLAYER
// ---------------------------------------------
joinPlayerBtn.onclick = async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter your name.");

    const playersRef = ref(db, "room/players");

    // Create unique player
    const newPlayer = push(playersRef);

    await set(newPlayer, {
        name,
        role: null,
        alive: true
    });

    localStorage.setItem("playerId", newPlayer.key);
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "false");

    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
};

// ---------------------------------------------
// RENDER GAME STATE
// ---------------------------------------------
onValue(ref(db, "room"), (snap) => {
    const data = snap.val();
    if (!data) return;

    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");

    // Handle host
    if (data.host) {
        hostStatus.innerText = "Host: " + data.host.name;
    }

    hostControls.classList.toggle("hidden", !isHost);

    playersList.innerHTML = "";

    if (data.players) {
        Object.entries(data.players).forEach(([pid, player]) => {
            const div = document.createElement("div");
            div.classList.add("playerCard");

            div.innerHTML = `
                <h3>${player.name}</h3>
                <img src="images/back.png">
                <p>${player.alive ? "Alive" : "Dead"}</p>
            `;

            div.onclick = () => {
                if (pid === myId) {
                    modalName.innerText = player.name;
                    modalRole.src = player.role ? "images/" + player.role + ".png" : "images/back.png";
                    roleModal.style.display = "flex";
                }
            };

            playersList.appendChild(div);
        });
    }
});

// ---------------------------------------------
// HOST ACTIONS
// ---------------------------------------------
dealBtn.onclick = async () => {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return alert("No players.");

    const players = Object.entries(snap.val());

    const roles = [
        "mafia", "mafia",
        "godfather",
        "doctor",
        "detective",
        "civilian", "civilian", "civilian", "civilian"
    ];

    roles.sort(() => Math.random() - 0.5);

    for (let i = 0; i < players.length; i++) {
        const [pid] = players[i];
        await set(ref(db, "room/players/" + pid + "/role"), roles[i]);
    }
};

shuffleBtn.onclick = dealBtn;

// ---------------------------------------------
// RESET GAME
// ---------------------------------------------
resetBtn.onclick = async () => {
    await remove(ref(db, "room"));
    localStorage.clear();
    location.reload();
};

// ---------------------------------------------
// NIGHT & DAY PHASE
// ---------------------------------------------
nightBtn.onclick = () => {
    document.body.classList.add("night");
};
dayBtn.onclick = () => {
    document.body.classList.remove("night");
};

// ---------------------------------------------
// CLOSE MODAL
// ---------------------------------------------
window.closeModal = function () {
    roleModal.style.display = "none";
};
