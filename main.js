import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, push } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// --------------------------------------------------
// FIREBASE CONFIG
// --------------------------------------------------
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

// --------------------------------------------------
// UI ELEMENTS
// --------------------------------------------------
const screenJoin = document.getElementById("screenJoin");
const screenGame = document.getElementById("screenGame");
const playerNameInput = document.getElementById("playerName");
const joinHostBtn = document.getElementById("joinHostBtn");
const joinPlayerBtn = document.getElementById("joinPlayerBtn");
const hostControls = document.getElementById("hostControls");
const hostStatus = document.getElementById("hostStatus");
const hostName = document.getElementById("hostName");
const playersList = document.getElementById("playersList");
const dealBtn = document.getElementById("dealBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const nightBtn = document.getElementById("nightBtn");
const dayBtn = document.getElementById("dayBtn");
const roleModal = document.getElementById("roleModal");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");

// --------------------------------------------------
// AUTO RESTORE SESSION
// --------------------------------------------------
window.onload = () => {
    if (localStorage.getItem("playerId")) {
        screenJoin.classList.add("hidden");
        screenGame.classList.remove("hidden");
    }
};

// --------------------------------------------------
// JOIN HOST
// --------------------------------------------------
joinHostBtn.onclick = async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter host name.");

    const snap = await get(ref(db, "room/host"));
    if (snap.exists()) return alert("Host already exists.");

    await set(ref(db, "room/host"), { name });
    localStorage.setItem("playerId", "HOST");
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "true");

    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
};

// --------------------------------------------------
// JOIN PLAYER
// --------------------------------------------------
joinPlayerBtn.onclick = async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter your name.");

    const playerRef = push(ref(db, "room/players"));
    await set(playerRef, { name, role: null, alive: true });

    localStorage.setItem("playerId", playerRef.key);
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "false");

    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
};

// --------------------------------------------------
// RENDER GAME STATE
// --------------------------------------------------
onValue(ref(db, "room"), (snap) => {
    const data = snap.val();
    if (!data) return;

    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");

    if (data.host) {
        hostStatus.innerText = "Host: " + data.host.name;
        hostName.innerText = data.host.name;
    }

    // HOST CONTROLS visible ONLY for host
    hostControls.classList.toggle("hidden", !isHost);

    // Render players
    playersList.innerHTML = "";

    if (data.players) {
        Object.entries(data.players).forEach(([pid, p]) => {

            const canSeeCard = isHost || pid === myId;
            const img = canSeeCard && p.role ? p.role : "back";

            const div = document.createElement("div");
            div.classList.add("playerCard");

            div.innerHTML = `
                <h3>${p.name}</h3>
                <img src="images/${img}.png">
                <p>${p.alive ? "Alive" : "Dead"}</p>
            `;

            // --- Night Actions ---
            div.onclick = () => {
                if (!data.gamePhase) return;

                // -----------------------------------
                // Mafia selecting a kill target
                // -----------------------------------
                if (data.gamePhase === "night" && p.alive) {

                    // Mafia can kill NON-mafia players
                    if (data.players[myId]?.role === "mafia") {
                        if (p.role !== "mafia") {
                            set(ref(db, "room/night/mafiaTarget"), pid);
                            alert("You selected " + p.name + " for elimination.");
                        }
                    }

                    // Doctor save ability
                    if (data.players[myId]?.role === "doctor") {
                        set(ref(db, "room/night/doctorSave"), pid);
                        alert("You selected " + p.name + " to save tonight.");
                    }
                }

                // Show card modal for host or yourself
                if (canSeeCard) {
                    modalName.innerText = p.name;
                    modalRole.src = `images/${p.role ? p.role : "back"}.png`;
                    roleModal.style.display = "flex";
                }
            };

            playersList.appendChild(div);
        });
    }

    if (data.gamePhase) setPhaseUI(data.gamePhase);
});

// --------------------------------------------------
// DEAL ROLES
// --------------------------------------------------
dealBtn.onclick = async () => {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return alert("No players.");

    const players = Object.entries(snap.val());
    const roles = ["mafia", "mafia", "godfather", "doctor", "detective",
                   "civilian", "civilian", "civilian", "civilian"];

    roles.sort(() => Math.random() - 0.5);

    players.forEach(([pid], i) => {
        set(ref(db, `room/players/${pid}/role`), roles[i] ?? "civilian");
    });

    alert("Roles have been assigned!");
};

// --------------------------------------------------
// RESET GAME
// --------------------------------------------------
resetBtn.onclick = async () => {
    await remove(ref(db, "room"));
    localStorage.clear();
    location.reload();
};

// --------------------------------------------------
// DAY / NIGHT
// --------------------------------------------------
function setPhaseUI(phase) {
    document.body.classList.toggle("night", phase === "night");
    document.body.classList.toggle("day", phase === "day");
}

// Host sets phase
nightBtn.onclick = () => {
    if (localStorage.getItem("isHost") !== "true") return;
    set(ref(db, "room/gamePhase"), "night");
};

dayBtn.onclick = async () => {
    if (localStorage.getItem("isHost") !== "true") return;

    const night = (await get(ref(db, "room/night"))).val() || {};

    // Resolve night death BEFORE day discussion
    if (night.mafiaTarget && night.mafiaTarget !== night.doctorSave) {
        await set(ref(db, `room/players/${night.mafiaTarget}/alive`), false);
    }

    // Clear night data
    await remove(ref(db, "room/night"));

    set(ref(db, "room/gamePhase"), "day");
};

// Sync phase to all clients
onValue(ref(db, "room/gamePhase"), (snap) => {
    if (snap.exists()) setPhaseUI(snap.val());
});

// --------------------------------------------------
// CLOSE MODAL
// --------------------------------------------------
window.closeModal = () => roleModal.style.display = "none";

// --------------------------------------------------
// EXIT GAME
// --------------------------------------------------
document.getElementById("exitBtn").onclick = () => {
    localStorage.clear();
    location.reload();
};
