import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, push, update } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

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

// UI Elements
const screenJoin = document.getElementById("screenJoin");
const screenGame = document.getElementById("screenGame");
const playerNameInput = document.getElementById("playerName");
const joinHostBtn = document.getElementById("joinHostBtn");
const joinPlayerBtn = document.getElementById("joinPlayerBtn");
const hostControls = document.getElementById("hostControls");
const playersList = document.getElementById("playersList");

// Buttons
const shuffleBtn = document.getElementById("shuffleBtn");
const dealBtn = document.getElementById("dealBtn");
const resetBtn = document.getElementById("resetBtn");
const nightBtn = document.getElementById("nightBtn");
const dayBtn = document.getElementById("dayBtn");
const endVoteBtn = document.getElementById("endVoteBtn");
const cleanBtn = document.getElementById("cleanBtn");
const exitBtn = document.getElementById("exitBtn");

// Deck Elements
const centralDeck = document.getElementById("centralDeck");
const deckStatus = document.getElementById("deckStatus");

// Modal & Panels
const roleModal = document.getElementById("roleModal");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");
const modalRoleText = document.getElementById("modalRoleText");
const actionPanel = document.getElementById("actionPanel");
const actionTargets = document.getElementById("actionTargets");
const submitActionBtn = document.getElementById("submitActionBtn");
const votingPanel = document.getElementById("votingPanel");
const voteTargets = document.getElementById("voteTargets");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const gameLog = document.getElementById("gameLog");

let allPlayersCache = {}; 

// --------------------------------------------------
// HOST ACTIONS
// --------------------------------------------------

shuffleBtn.addEventListener('click', () => {
    const deckImg = document.querySelector(".cardDeck");
    deckImg.classList.add("shaking");
    deckStatus.innerText = "Shuffling...";
    setTimeout(() => {
        deckImg.classList.remove("shaking");
        deckStatus.innerText = "Deck Ready!";
        dealBtn.disabled = false;
        dealBtn.style.opacity = "1";
    }, 1500);
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
    set(ref(db, "room/deckDealt"), true);
});

resetBtn.addEventListener('click', async () => {
    if (confirm("Reset entire game?")) {
        await remove(ref(db, "room"));
        localStorage.clear();
        location.reload();
    }
});

cleanBtn.addEventListener('click', async () => {
    if (confirm("Clear all players?")) await remove(ref(db, "room/players"));
});

nightBtn.addEventListener('click', () => {
    set(ref(db, "room/gamePhase"), "night");
    remove(ref(db, "room/night"));
});

dayBtn.addEventListener('click', async () => {
    const nightSnap = await get(ref(db, "room/night"));
    const night = nightSnap.val() || {};
    
    let statusMessage = "Mafia did not select a target.";
    let mafiaTargetName = "No one";
    let doctorSaveName = "No one";

    if (night.mafiaTarget) {
        mafiaTargetName = getName(night.mafiaTarget);
        if (night.mafiaTarget === night.doctorSave) {
            doctorSaveName = getName(night.doctorSave);
            statusMessage = `Mafia targeted ${mafiaTargetName}, but Doctor saved them!`;
        } else {
            const victimId = night.mafiaTarget;
            statusMessage = `${mafiaTargetName} was killed.`;
            await update(ref(db, `room/players/${victimId}`), { alive: false });
        }
    }

    await remove(ref(db, "room/votes"));
    await set(ref(db, "room/gamePhase"), "day");

    // Host sees the truth, but players see nothing
    alert(`📢 HOST REPORT (Private):\n\nTarget: ${mafiaTargetName}\nSave: ${doctorSaveName}\nResult: ${statusMessage}`);
    checkWinCondition();
});

endVoteBtn.addEventListener('click', async () => {
    const votesSnap = await get(ref(db, "room/votes"));
    if (!votesSnap.exists()) return alert("No votes cast.");

    const votes = Object.values(votesSnap.val());
    const voteCount = {};
    votes.forEach(v => { voteCount[v] = (voteCount[v] || 0) + 1; });

    let maxVotes = 0;
    let eliminatedId = null;
    for (const pid in voteCount) {
        if (voteCount[pid] > maxVotes) {
            maxVotes = voteCount[pid];
            eliminatedId = pid;
        }
    }

    let results = "Voting Results:\n";
    const pSnap = await get(ref(db, "room/players"));
    const currentP = pSnap.val();
    
    for (const pid in voteCount) {
        results += `- ${currentP[pid]?.name || 'Unknown'}: ${voteCount[pid]}\n`;
    }

    if (eliminatedId) {
        results += `\n${currentP[eliminatedId]?.name} eliminated.`;
        alert(results);
        await update(ref(db, `room/players/${eliminatedId}`), { alive: false });
        checkWinCondition();
    } else {
        alert("No majority.");
    }
    await remove(ref(db, "room/votes"));
});

// --------------------------------------------------
// PLAYER ACTIONS
// --------------------------------------------------
submitActionBtn.addEventListener('click', async () => {
    const myId = localStorage.getItem("playerId");
    const role = (await get(ref(db, `room/players/${myId}/role`))).val();
    const targetId = submitActionBtn.dataset.target;
    
    if (!targetId) return;

    if (role === "mafia" || role === "godfather") await set(ref(db, "room/night/mafiaTarget"), targetId);
    else if (role === "doctor") await set(ref(db, "room/night/doctorSave"), targetId);
    else if (role === "detective") {
        const tSnap = await get(ref(db, `room/players/${targetId}/role`));
        const res = (tSnap.val() === "mafia" || tSnap.val() === "godfather") ? "YES" : "NO";
        alert(`Investigation Result: ${res}`);
    }
    submitActionBtn.disabled = true;
    actionPanel.classList.add("hidden");
});

submitVoteBtn.addEventListener('click', async () => {
    const myId = localStorage.getItem("playerId");
    const targetId = submitVoteBtn.dataset.vote;
    if (!targetId) return;
    await set(ref(db, `room/votes/${myId}`), targetId);
    submitVoteBtn.disabled = true;
});

// --------------------------------------------------
// JOIN / STATE
// --------------------------------------------------
window.onload = () => {
    if (localStorage.getItem("playerId")) {
        screenJoin.classList.add("hidden");
        screenGame.classList.remove("hidden");
    }
};

joinHostBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) return;
    const snap = await get(ref(db, "room/host"));
    if (snap.exists() && !confirm("Overwrite host?")) return;
    if (snap.exists()) await remove(ref(db, "room"));

    await set(ref(db, "room/host"), { name });
    localStorage.setItem("playerId", "HOST");
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "true");
    location.reload();
});

joinPlayerBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) return;
    const refP = push(ref(db, "room/players"));
    await set(refP, { name, role: null, alive: true });
    localStorage.setItem("playerId", refP.key);
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "false");
    location.reload();
});

exitBtn.addEventListener('click', () => {
    if(confirm("Exit?")) { localStorage.clear(); location.reload(); }
});

window.closeModal = () => roleModal.style.display = "none";
function getName(id) { return allPlayersCache[id]?.name || "Unknown"; }

async function checkWinCondition() {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return;
    const p = Object.values(snap.val());
    const alive = p.filter(x => x.alive);
    const maf = alive.filter(x => x.role === "mafia" || x.role === "godfather").length;
    const civ = alive.length - maf;

    if (maf === 0 && alive.length > 0) alert("CIVILIANS WIN!");
    else if (maf >= civ && alive.length > 0) alert("MAFIA WINS!");
}

// --------------------------------------------------
// RENDER LOOP
// --------------------------------------------------
onValue(ref(db, "room"), (snap) => {
    const data = snap.val();
    if (!data) return;

    allPlayersCache = data.players || {};
    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");
    
    // Host Name
    if (data.host) document.getElementById("hostName").innerText = "Host: " + data.host.name;
    
    // Controls Visibility
    hostControls.classList.toggle("hidden", !isHost);
    if (isHost) {
        endVoteBtn.classList.toggle("hidden", data.gamePhase !== "day");
        if (data.deckDealt) {
            shuffleBtn.disabled = true;
            dealBtn.disabled = true;
            centralDeck.classList.add("hidden");
        } else {
            centralDeck.classList.remove("hidden");
        }
    } else {
        if (data.deckDealt) centralDeck.classList.add("hidden");
        else centralDeck.classList.remove("hidden");
    }

    const phase = data.gamePhase || "Waiting";
    
    // STATUS BANNER LOGIC FOR VICTIM
    const amIPlayer = data.players && data.players[myId];
    const amIDead = amIPlayer && !amIPlayer.alive;

    if (amIDead) {
        document.getElementById("phaseText").innerText = "YOU ARE DEAD 💀";
        document.body.className = "night"; // Keep dark theme for dead
        document.getElementById("phaseBanner").style.background = "#d32f2f"; // Red banner
    } else {
        document.getElementById("phaseText").innerText = phase;
        document.body.className = phase === "night" ? "night" : "day";
        document.getElementById("phaseBanner").style.background = "#2f2f2f"; // Reset banner
    }

    // RENDER PLAYERS
    playersList.innerHTML = "";
    if(phase !== "night") document.getElementById("actionTargets").innerHTML = "";
    if(phase !== "day") document.getElementById("voteTargets").innerHTML = "";

    if (data.players) {
        Object.entries(data.players).forEach(([pid, p]) => {
            const isMe = pid === myId;
            const canSeeRole = isHost || isMe; 

            // --- HIDDEN DEATH LOGIC ---
            // If I am Host OR I am the specific player -> I see the true 'Alive/Dead' status.
            // Everyone else -> Sees "Alive" (even if the player is actually dead)
            const showRealStatus = isHost || isMe;
            const displayAlive = showRealStatus ? p.alive : true; 
            
            // CARD DISPLAY
            let cardContent = "";
            if (!p.role) {
                cardContent = `<div class="emptySlot">Empty Slot</div>`;
            } else {
                const imgName = (canSeeRole) ? p.role : "back";
                cardContent = `<img src="images/${imgName}.png" onerror="this.src='https://via.placeholder.com/80x115?text=Card'">`;
            }

            const div = document.createElement("div");
            div.classList.add("playerCard");
            
            // Only dim the card if we are allowed to see they are dead
            if (!displayAlive) div.style.opacity = "0.5";
            
            div.innerHTML = `<h3>${p.name}</h3>${cardContent}<p>${displayAlive ? "Alive" : "DEAD"}</p>`;

            div.addEventListener('click', () => {
                if (canSeeRole && p.alive && p.role) {
                    modalName.innerText = p.name;
                    modalRole.src = `images/${p.role}.png`;
                    modalRoleText.innerText = `Role: ${p.role}`;
                    roleModal.style.display = "flex";
                }
            });
            playersList.appendChild(div);

            // BUTTON LOGIC
            // If I am dead, I cannot do actions (even if others think I am alive)
            if (amIPlayer && amIPlayer.alive) {
                // If I am alive, I can only interact with people I THINK are alive (displayAlive)
                // Note: In this mode, since others always look "Alive", you can try to target them.
                if (displayAlive) { 
                    if (phase === "night" && p.alive) { // Night logic usually strictly follows reality
                        const myRole = amIPlayer.role;
                        if (!isMe || myRole === "doctor") {
                            if (["mafia", "godfather", "doctor", "detective"].includes(myRole)) {
                                createBtn(document.getElementById("actionTargets"), p.name, pid, submitActionBtn, "target");
                                actionPanel.classList.remove("hidden");
                            }
                        }
                    }
                    if (phase === "day" && !isMe) {
                        createBtn(document.getElementById("voteTargets"), p.name, pid, submitVoteBtn, "vote");
                        votingPanel.classList.remove("hidden");
                    }
                }
            }
        });
    }
});

function createBtn(container, name, pid, btn, key) {
    const existing = Array.from(container.children).find(c => c.dataset.pid === pid);
    if(existing) return;
    const b = document.createElement("button");
    b.innerText = name;
    b.dataset.pid = pid;
    const handler = (e) => {
        if(e.cancelable) e.preventDefault();
        Array.from(container.children).forEach(c => c.classList.remove("selected"));
        b.classList.add("selected");
        btn.disabled = false;
        btn.dataset[key] = pid;
    };
    b.addEventListener('click', handler);
    b.addEventListener('touchstart', handler, {passive:false});
    container.appendChild(b);
}
