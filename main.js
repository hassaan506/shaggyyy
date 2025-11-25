import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, push, update } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

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
const resetBtn = document.getElementById("resetBtn");
const nightBtn = document.getElementById("nightBtn");
const dayBtn = document.getElementById("dayBtn");
const endVoteBtn = document.getElementById("endVoteBtn");
const cleanBtn = document.getElementById("cleanBtn");

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
// GLOBAL STATE (for name lookups)
// --------------------------------------------------
let allPlayersCache = {}; 

// --------------------------------------------------
// HELPERS
// --------------------------------------------------
function getName(id) {
    return allPlayersCache[id] ? allPlayersCache[id].name : "Unknown";
}

async function checkWinCondition() {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return;

    const players = Object.values(snap.val());
    const alivePlayers = players.filter(p => p.alive);
    
    const mafiaCount = alivePlayers.filter(p => p.role === "mafia" || p.role === "godfather").length;
    const civilCount = alivePlayers.length - mafiaCount;

    if (mafiaCount === 0 && alivePlayers.length > 0) {
        alert("🎉 CIVILIANS WIN! All Mafia have been eliminated.");
        set(ref(db, "room/gamePhase"), "GAME OVER - CIVILIANS WIN");
    } 
    else if (mafiaCount >= civilCount && alivePlayers.length > 0) {
        alert("💀 MAFIA WINS! They have taken over the town.");
        set(ref(db, "room/gamePhase"), "GAME OVER - MAFIA WINS");
    }
}

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
// EVENT LISTENERS
// --------------------------------------------------
joinHostBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) return alert("Enter host name.");

    const snap = await get(ref(db, "room/host"));
    if (snap.exists()) {
        if(!confirm("Host exists. Overwrite?")) return;
        await remove(ref(db, "room")); 
    }

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

    while (roles.length < players.length) roles.push("civilian");
    roles = roles.sort(() => Math.random() - 0.5);

    players.forEach(([pid], i) => {
        update(ref(db, `room/players/${pid}`), { 
            role: roles[i] ?? "civilian",
            alive: true
        });
    });

    set(ref(db, "room/gamePhase"), "Roles Assigned");
    alert("Roles assigned!");
});

resetBtn.addEventListener('click', async () => {
    if (confirm("Reset game?")) {
        await remove(ref(db, "room"));
        localStorage.clear();
        location.reload();
    }
});

cleanBtn.addEventListener('click', async () => {
    if (!confirm("Clear all players?")) return;
    await remove(ref(db, "room/players"));
    alert("Players cleared.");
});

nightBtn.addEventListener('click', () => {
    if (localStorage.getItem("isHost") !== "true") return;
    set(ref(db, "room/gamePhase"), "night");
    remove(ref(db, "room/night"));
});

dayBtn.addEventListener('click', async () => {
    if (localStorage.getItem("isHost") !== "true") return;
    
    const nightSnap = await get(ref(db, "room/night"));
    const night = nightSnap.val() || {};
    
    let victimId = null;
    let victimName = "Nobody";
    let statusMessage = "";

    // Calculate names for Host Report
    const mafiaTargetName = night.mafiaTarget ? getName(night.mafiaTarget) : "No one";
    const doctorSaveName = night.doctorSave ? getName(night.doctorSave) : "No one";

    // Resolve Mafia Kill
    if (night.mafiaTarget) {
        if (night.mafiaTarget === night.doctorSave) {
            statusMessage = `Mafia targeted ${mafiaTargetName}, but Doctor saved them!`;
        } else {
            victimId = night.mafiaTarget;
            victimName = mafiaTargetName;
            statusMessage = `${mafiaTargetName} was killed by Mafia.`;
            await update(ref(db, `room/players/${victimId}`), { alive: false });
        }
    } else {
        statusMessage = "Mafia did not select a target.";
    }

    // Clear votes and change phase
    await remove(ref(db, "room/votes"));
    await set(ref(db, "room/gamePhase"), "day");

    // ALERT ONLY FOR HOST
    alert(`📢 HOST REPORT (Private):\n\n- Mafia Targeted: ${mafiaTargetName}\n- Doctor Saved: ${doctorSaveName}\n\n👉 Outcome: ${statusMessage}`);

    checkWinCondition();
});

endVoteBtn.addEventListener('click', async () => {
    if (localStorage.getItem("isHost") !== "true") return;

    const votesSnap = await get(ref(db, "room/votes"));
    if (!votesSnap.exists()) return alert("No votes cast.");

    const votes = Object.values(votesSnap.val());
    const voteCount = {};

    votes.forEach(v => { voteCount[v] = (voteCount[v] || 0) + 1; });

    let maxVotes = 0;
    let eliminatedId = null;
    for (const playerId in voteCount) {
        if (voteCount[playerId] > maxVotes) {
            maxVotes = voteCount[playerId];
            eliminatedId = playerId;
        }
    }

    // Name Lookup
    let resultsMessage = `Voting Results:\n`;
    const playersSnap = await get(ref(db, "room/players"));
    const currentPlayers = playersSnap.val();
    
    for (const pid in voteCount) {
        const name = currentPlayers[pid] ? currentPlayers[pid].name : "Unknown";
        resultsMessage += `- ${name}: ${voteCount[pid]} votes\n`;
    }

    if (eliminatedId) {
        const elimName = currentPlayers[eliminatedId] ? currentPlayers[eliminatedId].name : "Unknown";
        resultsMessage += `\n${elimName} has been eliminated.`;
        alert(resultsMessage);
        await update(ref(db, `room/players/${eliminatedId}`), { alive: false });
        checkWinCondition();
    } else {
        alert("No majority found.");
    }

    await remove(ref(db, "room/votes"));
});

submitActionBtn.addEventListener('click', async () => {
    const myId = localStorage.getItem("playerId");
    const role = (await get(ref(db, `room/players/${myId}/role`))).val();
    const targetId = submitActionBtn.dataset.target;
    const targetName = getName(targetId);
    
    if (!targetId) return alert("Select a target!");

    if (role === "mafia" || role === "godfather") {
        await set(ref(db, "room/night/mafiaTarget"), targetId);
        appendLog(`You targeted: ${targetName}`);
    }
    else if (role === "doctor") {
        await set(ref(db, "room/night/doctorSave"), targetId);
        appendLog(`You chose to save: ${targetName}`);
    }
    else if (role === "detective") {
        const targetRoleSnap = await get(ref(db, `room/players/${targetId}/role`));
        const targetRole = targetRoleSnap.val();
        const result = (targetRole === "mafia" || targetRole === "godfather") ? "YES" : "NO";
        alert(`Investigation for ${targetName}: Is Mafia? -> ${result}`);
        appendLog(`Investigated ${targetName}: ${result}`);
    }

    submitActionBtn.disabled = true;
    actionPanel.classList.add("hidden");
});

submitVoteBtn.addEventListener('click', async () => {
    const myId = localStorage.getItem("playerId");
    const targetId = submitVoteBtn.dataset.vote;
    const targetName = getName(targetId);

    if (!targetId) return alert("Select a player!");
    
    await set(ref(db, `room/votes/${myId}`), targetId);
    
    submitVoteBtn.disabled = true;
    voteInstruction.innerText = `You voted for ${targetName}.`;
});

document.getElementById("exitBtn").addEventListener('click', () => {
    if (confirm("Exit game?")) {
        localStorage.clear();
        location.reload();
    }
});

window.closeModal = () => { roleModal.style.display = "none"; };

// --------------------------------------------------
// RENDER GAME STATE
// --------------------------------------------------
onValue(ref(db, "room"), (snap) => {
    const data = snap.val();
    if (!data) return;

    // Cache players
    allPlayersCache = data.players || {};

    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");

    if (data.host) {
        hostStatus.innerText = "Host: " + data.host.name;
        hostName.innerText = data.host.name;
    }
    hostControls.classList.toggle("hidden", !isHost);

    const phase = data.gamePhase || "Waiting";
    document.getElementById("phaseText").innerText = phase;
    document.body.className = phase === "night" ? "night" : "day";
    
    if (isHost) endVoteBtn.classList.toggle("hidden", phase !== "day");

    // Clear Lists
    playersList.innerHTML = "";
    if(phase !== "night") actionTargets.innerHTML = "";
    if(phase !== "day") voteTargets.innerHTML = "";

    const amIPlayer = data.players && data.players[myId];

    if (data.players) {
        Object.entries(data.players).forEach(([pid, p]) => {
            const isMe = pid === myId;
            const canSeeRole = isHost || isMe; 
            const imgName = (canSeeRole && p.role) ? p.role : "back";
            
            // CARD
            const div = document.createElement("div");
            div.classList.add("playerCard");
            if (!p.alive) div.style.opacity = "0.5";
            
            div.innerHTML = `
                <h3>${p.name}</h3>
                <img src="images/${imgName}.png" onerror="this.src='https://via.placeholder.com/80x115?text=Card'">
                <p>${p.alive ? "Alive" : "DEAD"}</p>
            `;

            div.addEventListener('click', () => {
                if (canSeeRole && p.alive) {
                    modalName.innerText = p.name;
                    modalRole.src = `images/${p.role}.png`;
                    modalRoleText.innerText = `Role: ${p.role}`;
                    roleModal.style.display = "flex";
                }
            });
            playersList.appendChild(div);

            // LOGIC FOR BUTTONS (Only if I am a player)
            if (amIPlayer && amIPlayer.alive && p.alive) {
                
                // NIGHT ACTIONS
                if (phase === "night") {
                    const myRole = amIPlayer.role;
                    
                    // DOCTOR EXCEPTION: Doctor CAN target self
                    const isDoctor = myRole === "doctor";
                    const canTargetSelf = isDoctor;

                    // If it's NOT me, OR if it IS me and I'm a Doctor
                    if (!isMe || canTargetSelf) {
                        if (["mafia", "godfather", "doctor", "detective"].includes(myRole)) {
                            if(actionTargets.innerHTML === "") actionPanel.classList.remove("hidden");
                            createTargetBtn(actionTargets, p.name, pid, submitActionBtn, "target");
                        }
                    }
                }

                // DAY VOTES (Cannot vote self)
                if (phase === "day" && !isMe) {
                    if(voteTargets.innerHTML === "") votingPanel.classList.remove("hidden");
                    createTargetBtn(voteTargets, p.name, pid, submitVoteBtn, "vote");
                }
            }
        });
    }

    if (!amIPlayer) {
        actionPanel.classList.add("hidden");
        votingPanel.classList.add("hidden");
    }
});

// Helper for mobile touch & click support
function createTargetBtn(container, name, pid, submitBtn, datasetKey) {
    const existing = Array.from(container.children).find(c => c.dataset.pid === pid);
    if(existing) return;

    const btn = document.createElement("button");
    btn.classList.add("targetBtn");
    btn.innerText = name;
    btn.dataset.pid = pid; 

    const selectHandler = (e) => {
        if(e.cancelable) e.preventDefault();
        Array.from(container.children).forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        submitBtn.disabled = false;
        submitBtn.dataset[datasetKey] = pid;
    };

    btn.addEventListener('click', selectHandler);
    btn.addEventListener('touchstart', selectHandler, {passive: false});

    container.appendChild(btn);
}

function appendLog(msg) {
    const li = document.createElement("li");
    li.innerText = msg;
    gameLog.appendChild(li);
    gameLog.scrollTop = gameLog.scrollHeight;
}
