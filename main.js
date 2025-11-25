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
const endVoteBtn = document.getElementById("endVoteBtn");

const roleModal = document.getElementById("roleModal");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");
const modalRoleText = document.getElementById("modalRoleText");

const actionPanel = document.getElementById("actionPanel");
const actionInstruction = document.getElementById("actionInstruction");
const actionTargets = document.getElementById("actionTargets");
const submitActionBtn = document.getElementById("submitActionBtn");

const votingPanel = document.getElementById("votingPanel");
const voteInstruction = document.getElementById("voteInstruction");
const voteTargets = document.getElementById("voteTargets");
const submitVoteBtn = document.getElementById("submitVoteBtn");

const gameLog = document.getElementById("gameLog");

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
// EVENT LISTENERS (using addEventListener for better compatibility)
// --------------------------------------------------
joinHostBtn.addEventListener('click', async () => {
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
});

joinPlayerBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter your name.");

    const playerRef = push(ref(db, "room/players"));
    await set(playerRef, { name, role: null, alive: true });

    localStorage.setItem("playerId", playerRef.key);
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "false");

    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
});

dealBtn.addEventListener('click', async () => {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return alert("No players.");

    const players = Object.entries(snap.val());
    let roles = ["mafia", "mafia", "godfather", "doctor", "detective"];

    // Fill remaining players with civilians
    while (roles.length < players.length) roles.push("civilian");

    roles = roles.sort(() => Math.random() - 0.5);

    players.forEach(([pid], i) => {
        set(ref(db, `room/players/${pid}/role`), roles[i] ?? "civilian");
    });

    alert("Roles assigned!");
});

resetBtn.addEventListener('click', async () => {
    if (confirm("Are you sure you want to reset the entire game?")) {
        await remove(ref(db, "room"));
        localStorage.clear();
        location.reload();
    }
});

nightBtn.addEventListener('click', () => {
    if (localStorage.getItem("isHost") !== "true") return;
    set(ref(db, "room/gamePhase"), "night");
});

dayBtn.addEventListener('click', async () => {
    if (localStorage.getItem("isHost") !== "true") return;
    const night = (await get(ref(db, "room/night"))).val() || {};

    // Resolve night kill silently
    if (night.mafiaTarget && night.mafiaTarget !== night.doctorSave) {
        await set(ref(db, `room/players/${night.mafiaTarget}/alive`), false);
    }

    // Clear night data
    await remove(ref(db, "room/night"));

    // Clear any previous votes before starting the new day phase
    await remove(ref(db, "room/votes"));

    // Set the game phase to "day"
    set(ref(db, "room/gamePhase"), "day");
});

endVoteBtn.addEventListener('click', async () => {
    if (localStorage.getItem("isHost") !== "true") return;

    const votesSnap = await get(ref(db, "room/votes"));
    if (!votesSnap.exists()) {
        return alert("No votes have been cast yet.");
    }

    const votes = Object.values(votesSnap.val());
    const voteCount = {};

    // Tally the votes
    votes.forEach(v => {
        voteCount[v] = (voteCount[v] || 0) + 1;
    });

    // Find the player with the most votes
    let maxVotes = 0;
    let eliminatedId = null;
    for (const playerId in voteCount) {
        if (voteCount[playerId] > maxVotes) {
            maxVotes = voteCount[playerId];
            eliminatedId = playerId;
        }
    }

    if (eliminatedId) {
        // Get the eliminated player's name to show the host
        const eliminatedSnap = await get(ref(db, `room/players/${eliminatedId}`));
        const eliminatedName = eliminatedSnap.val().name;

        // Show results ONLY to the host
        let resultsMessage = `Voting Results:\n\n`;
        for (const playerId in voteCount) {
            const nameSnap = await get(ref(db, `room/players/${playerId}`));
            const name = nameSnap.val().name;
            resultsMessage += `- ${name}: ${voteCount[playerId]} votes\n`;
        }
        resultsMessage += `\n${eliminatedName} has been eliminated.`;
        alert(resultsMessage);

        // Secretly eliminate the player in the database
        await set(ref(db, `room/players/${eliminatedId}/alive`), false);

    } else {
        alert("Votes were cast, but no one received a majority to be eliminated.");
    }

    // Clear the votes after the round is over
    await remove(ref(db, "room/votes"));
});

submitActionBtn.addEventListener('click', async () => {
    const myId = localStorage.getItem("playerId");
    const role = (await get(ref(db, `room/players/${myId}/role`))).val();
    const target = submitActionBtn.dataset.target;
    if (!target) return alert("Select a target!");

    if (role === "mafia" || role === "godfather") {
        await set(ref(db, "room/night/mafiaTarget", target));
        appendLog(`Mafia selected a target.`);
    }
    else if (role === "doctor") {
        await set(ref(db, "room/night/doctorSave", target));
        appendLog(`Doctor will try to save ${target}.`);
    }
    else if (role === "detective") {
        const targetRoleSnap = await get(ref(db, `room/players/${target}/role`));
        const targetRole = targetRoleSnap.val();
        const result = (targetRole === "mafia" || targetRole === "godfather") ? "YES" : "NO";
        await set(ref(db, `room/night/detectiveResult/${myId}`, {
            target,
            result
        }));
        alert(`Investigation result for ${target}: ${result}`);
    }

    submitActionBtn.disabled = true;
    Array.from(actionTargets.children).forEach(b => b.classList.remove("selected"));
});

submitVoteBtn.addEventListener('click', async () => {
    const myId = localStorage.getItem("playerId");
    const vote = submitVoteBtn.dataset.vote;
    if (!vote) return alert("Select a player to vote!");
    await set(ref(db, `room/votes/${myId}`), vote);
    submitVoteBtn.disabled = true;
    Array.from(voteTargets.children).forEach(b => b.classList.remove("selected"));
    // Optional: Give feedback to the user
    voteInstruction.innerText = "Vote submitted. Waiting for other players...";
});

document.getElementById("exitBtn").addEventListener('click', () => {
    if (confirm("Are you sure you want to exit the game?")) {
        localStorage.clear();
        location.reload();
    }
});

window.closeModal = () => roleModal.style.display = "none";


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

    hostControls.classList.toggle("hidden", !isHost);

    // Control visibility of the 'End Vote' button for the host
    const phase = data.gamePhase;
    if (isHost) {
        endVoteBtn.classList.toggle("hidden", phase !== "day");
    }

    // Clear panels and buttons
    actionTargets.innerHTML = "";
    voteTargets.innerHTML = "";
    actionPanel.classList.add("hidden");
    votingPanel.classList.add("hidden");
    submitActionBtn.disabled = true;
    submitVoteBtn.disabled = true;

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

            div.addEventListener('click', () => {
                if (!p.alive) return;
                if (canSeeCard) {
                    modalName.innerText = p.name;
                    modalRole.src = `images/${p.role ? p.role : "back"}.png`;
                    modalRoleText.innerText = p.role ?? "";
                    roleModal.style.display = "flex";
                }
            });

            playersList.appendChild(div);
        });
    }

    // Render night actions if alive
    if (data.gamePhase === "night" && data.players[myId]?.alive) {
        const role = data.players[myId].role;
        if (["mafia", "godfather", "doctor", "detective"].includes(role)) {
            actionPanel.classList.remove("hidden");

            let instruction = "";
            if (role === "mafia" || role === "godfather") instruction = "Select a player to eliminate";
            else if (role === "doctor") instruction = "Select a player to save";
            else if (role === "detective") instruction = "Select a player to investigate";

            actionInstruction.innerText = instruction;

            Object.entries(data.players).forEach(([pid, p]) => {
                if (!p.alive || pid === myId) return;
                const btn = document.createElement("button");
                btn.classList.add("targetBtn");
                btn.innerText = p.name;

                const handleActionTargetClick = () => {
                    Array.from(actionTargets.children).forEach(b => b.classList.remove("selected"));
                    btn.classList.add("selected");
                    submitActionBtn.disabled = false;
                    submitActionBtn.dataset.target = pid;
                };

                // Listen for both click and touchstart for maximum compatibility
                btn.addEventListener('click', handleActionTargetClick);
                btn.addEventListener('touchstart', handleActionTargetClick);

                actionTargets.appendChild(btn);
            });
        }
    }

    // Render voting during day
    if (data.gamePhase === "day") {
        votingPanel.classList.remove("hidden");
        voteInstruction.innerText = "Select a player to vote"; // Reset instruction text
        Object.entries(data.players).forEach(([pid, p]) => {
            if (!p.alive || pid === myId) return;
            const btn = document.createElement("button");
            btn.classList.add("targetBtn");
            btn.innerText = p.name;

            const handleVoteTargetClick = () => {
                Array.from(voteTargets.children).forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
                submitVoteBtn.disabled = false;
                submitVoteBtn.dataset.vote = pid;
            };
            
            // Listen for both click and touchstart for maximum compatibility
            btn.addEventListener('click', handleVoteTargetClick);
            btn.addEventListener('touchstart', handleVoteTargetClick);

            voteTargets.appendChild(btn);
        });
    }

    // Update phase text
    const phaseText = document.getElementById("phaseText");
    phaseText.innerText = data.gamePhase ?? "Waiting";
});

// --------------------------------------------------
// PHASE UI
// --------------------------------------------------
function appendLog(msg) {
    const li = document.createElement("li");
    li.innerText = msg;
    gameLog.appendChild(li);
    gameLog.scrollTop = gameLog.scrollHeight;
}

onValue(ref(db, "room/gamePhase"), (snap) => {
    if (!snap.exists()) return;
    const phase = snap.val();
    document.body.classList.toggle("night", phase === "night");
    document.body.classList.toggle("day", phase === "day");
    document.getElementById("phaseText").innerText = phase;
});
