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

// DOM Elements
const screenJoin = document.getElementById("screenJoin");
const screenGame = document.getElementById("screenGame");
const playerNameInput = document.getElementById("playerName");
const joinHostBtn = document.getElementById("joinHostBtn");
const joinPlayerBtn = document.getElementById("joinPlayerBtn");
const hostControls = document.getElementById("hostControls");
const playersList = document.getElementById("playersList");
const hostFeed = document.getElementById("hostFeed");
const liveVoteList = document.getElementById("liveVoteList");

// Controls
const shuffleBtn = document.getElementById("shuffleBtn");
const dealBtn = document.getElementById("dealBtn");
const resetBtn = document.getElementById("resetBtn");
const nightBtn = document.getElementById("nightBtn");
const dayBtn = document.getElementById("dayBtn");
const endVoteBtn = document.getElementById("endVoteBtn");
const exitBtn = document.getElementById("exitBtn");

// Panels
const centralDeck = document.getElementById("centralDeck");
const deckStatus = document.getElementById("deckStatus");
const roleModal = document.getElementById("roleModal");
const actionPanel = document.getElementById("actionPanel");
const votingPanel = document.getElementById("votingPanel");
const gameLog = document.getElementById("gameLog");

// Action Buttons
const submitActionBtn = document.getElementById("submitActionBtn");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const actionTargets = document.getElementById("actionTargets");
const voteTargets = document.getElementById("voteTargets");

let allPlayersCache = {}; 
let myCurrentRole = null;

// --------------------------------------------------
// SHUFFLE & DEAL
// --------------------------------------------------
function triggerShuffle() {
    deckStatus.innerText = "Shuffling...";
    const deckImg = document.querySelector(".cardDeck");
    if(deckImg) {
        deckImg.classList.remove("shaking");
        void deckImg.offsetWidth; 
        deckImg.classList.add("shaking");
    }
    setTimeout(() => {
        if(deckImg) deckImg.classList.remove("shaking");
        deckStatus.innerText = "Ready to Deal!";
        dealBtn.disabled = false;
        dealBtn.style.opacity = "1";
    }, 1200);
}

shuffleBtn.addEventListener('click', triggerShuffle);
if (centralDeck) centralDeck.addEventListener('click', () => {
    if (!centralDeck.classList.contains("hidden") && localStorage.getItem("isHost") === "true") triggerShuffle();
});

dealBtn.addEventListener('click', async () => {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return alert("No players.");

    const players = Object.entries(snap.val());
    let roles = ["mafia", "mafia", "godfather", "doctor", "detective"];

    while (roles.length < players.length) roles.push("civilian");
    roles = roles.sort(() => Math.random() - 0.5);

    players.forEach(([pid], i) => {
        update(ref(db, `room/players/${pid}`), { role: roles[i] ?? "civilian", alive: true });
    });

    await set(ref(db, "room/deckDealt"), true);
    await set(ref(db, "room/gamePhase"), "Roles Assigned");
});

// --------------------------------------------------
// HOST PHASE CONTROLS
// --------------------------------------------------
nightBtn.addEventListener('click', () => {
    set(ref(db, "room/gamePhase"), "night");
    remove(ref(db, "room/night"));
});

dayBtn.addEventListener('click', async () => {
    const nightSnap = await get(ref(db, "room/night"));
    const night = nightSnap.val() || {};
    
    let msg = "No one died.";
    let targetName = getName(night.mafiaTarget);
    let saveName = getName(night.doctorSave);

    if (night.mafiaTarget) {
        if (night.mafiaTarget === night.doctorSave) {
            msg = `Mafia attacked ${targetName}, but Doctor saved them!`;
        } else {
            msg = `${targetName} was killed by Mafia.`;
            await update(ref(db, `room/players/${night.mafiaTarget}`), { alive: false });
        }
    }

    await remove(ref(db, "room/votes"));
    await set(ref(db, "room/gamePhase"), "day");
    alert(`📢 REPORT:\nTarget: ${targetName}\nSave: ${saveName}\nResult: ${msg}`);
    checkWinCondition();
});

endVoteBtn.addEventListener('click', async () => {
    const votesSnap = await get(ref(db, "room/votes"));
    if (!votesSnap.exists()) return alert("No votes.");

    const votes = Object.values(votesSnap.val());
    const count = {};
    votes.forEach(v => { count[v] = (count[v] || 0) + 1; });

    let max = 0;
    let elimId = null;
    for (const pid in count) {
        if (count[pid] > max) { max = count[pid]; elimId = pid; }
    }

    let report = "Votes:\n";
    for (const pid in count) report += `${getName(pid)}: ${count[pid]}\n`;

    if (elimId) {
        report += `\n${getName(elimId)} Eliminated!`;
        await update(ref(db, `room/players/${elimId}`), { alive: false });
        checkWinCondition();
    } else {
        report += "\nNo majority.";
    }
    
    alert(report);
    await remove(ref(db, "room/votes"));
});

resetBtn.addEventListener('click', async () => {
    if (confirm("Reset Game?")) {
        await remove(ref(db, "room"));
        localStorage.clear();
        location.reload();
    }
});

// --------------------------------------------------
// PLAYER ACTIONS
// --------------------------------------------------
submitActionBtn.addEventListener('click', async () => {
    const pid = localStorage.getItem("playerId");
    const target = submitActionBtn.dataset.target;
    if(!target) return alert("Select a target first!");

    const role = myCurrentRole; 
    
    if (role === "mafia" || role === "godfather") await set(ref(db, "room/night/mafiaTarget"), target);
    else if (role === "doctor") await set(ref(db, "room/night/doctorSave"), target);
    else if (role === "detective") {
        const tSnap = await get(ref(db, `room/players/${target}/role`));
        const tRole = tSnap.val();
        const isBad = (tRole === "mafia" || tRole === "godfather") ? "YES (Mafia)" : "NO (Innocent)";
        alert(`Investigation Result:\n${getName(target)} is ${isBad}`);
    }
    
    submitActionBtn.disabled = true;
    submitActionBtn.innerText = "Submitted";
    actionPanel.classList.add("hidden");
});

submitVoteBtn.addEventListener('click', async () => {
    const pid = localStorage.getItem("playerId");
    const target = submitVoteBtn.dataset.vote;
    if(!target) return alert("Select a player first!");
    
    await set(ref(db, `room/votes/${pid}`), target);
    
    submitVoteBtn.disabled = true;
    submitVoteBtn.innerText = "Vote Cast";
    document.getElementById("voteInstruction").innerText = `You voted for ${getName(target)}`;
});

// --------------------------------------------------
// LIVE MONITOR (HOST)
// --------------------------------------------------
onValue(ref(db, "room/votes"), (snap) => {
    if (localStorage.getItem("isHost") !== "true") return;
    
    const votes = snap.val() || {};
    liveVoteList.innerHTML = "";
    
    if (Object.keys(votes).length === 0) {
        liveVoteList.innerHTML = "<li>No votes yet...</li>";
        return;
    }

    Object.entries(votes).forEach(([voterId, targetId]) => {
        const voterName = getName(voterId);
        const targetName = getName(targetId);
        const li = document.createElement("li");
        li.innerText = `${voterName} ➝ ${targetName}`;
        liveVoteList.appendChild(li);
    });
});

// --------------------------------------------------
// MAIN GAME LOOP
// --------------------------------------------------
onValue(ref(db, "room"), (snap) => {
    const data = snap.val();
    if (!data) return;

    allPlayersCache = data.players || {};
    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");
    
    // UI Setup
    if(data.host) document.getElementById("hostName").innerText = data.host.name;
    hostControls.classList.toggle("hidden", !isHost);
    hostFeed.classList.toggle("hidden", !isHost);

    // Deck Visibility
    const isDealt = data.deckDealt === true;
    centralDeck.classList.toggle("hidden", isDealt || (!isHost && !isDealt)); // Only host sees deck before deal
    if(isHost && isDealt) { shuffleBtn.disabled = true; dealBtn.disabled = true; }

    const phase = data.gamePhase || "Waiting";
    document.getElementById("phaseText").innerText = phase;
    document.body.className = phase === "night" ? "night" : "day";
    
    // Host Vote Button Visibility
    if(isHost) endVoteBtn.classList.toggle("hidden", phase !== "day");

    // Clear Button Containers (We rebuild to ensure state is fresh)
    if(phase !== "night") actionTargets.innerHTML = "";
    if(phase !== "day") voteTargets.innerHTML = "";

    // Render Players
    playersList.innerHTML = "";
    
    if (data.players) {
        const me = data.players[myId];
        myCurrentRole = me ? me.role : null;
        const amIMafia = (myCurrentRole === "mafia" || myCurrentRole === "godfather");

        Object.entries(data.players).forEach(([pid, p]) => {
            const isMe = pid === myId;
            const targetIsMafia = (p.role === "mafia" || p.role === "godfather");
            
            // --- VISIBILITY RULES ---
            // 1. Host sees all.
            // 2. I see myself.
            // 3. Mafia see other Mafia.
            const canSeeRole = isHost || isMe || (amIMafia && targetIsMafia);
            
            // Card Graphic
            let cardHtml = `<div class="emptySlot">Wait</div>`;
            if (isDealt) {
                const img = canSeeRole ? p.role : "back";
                cardHtml = `<img src="images/${img}.png" onerror="this.src='https://via.placeholder.com/80?text=${img}'">`;
            }

            // Death Status
            const realStatus = isHost || isMe; // Only host/me know if I'm dead
            const displayAlive = realStatus ? p.alive : true; // Others see me as alive

            // Render Card
            const div = document.createElement("div");
            div.classList.add("playerCard");
            div.innerHTML = `<h3>${p.name}</h3>${cardHtml}<p>${displayAlive?"Alive":"DEAD"}</p>`;
            if(!displayAlive) div.style.opacity = "0.5";
            
            div.onclick = () => {
                if(isDealt && canSeeRole && p.role) {
                    document.getElementById("modalRole").src = `images/${p.role}.png`;
                    document.getElementById("modalName").innerText = p.name;
                    document.getElementById("roleModal").style.display = "flex";
                }
            };
            playersList.appendChild(div);

            // --- BUTTON GENERATION ---
            // Only generate buttons if I am alive and Phase matches
            if (me && me.alive && displayAlive) {
                
                // NIGHT ACTIONS
                if (phase === "night" && p.alive) {
                    // Logic: 
                    // 1. Mafia CANNOT target Mafia.
                    // 2. Doctor CAN target self.
                    // 3. Others CANNOT target self.
                    
                    let canTarget = false;
                    
                    if (amIMafia) {
                        // Mafia: Target anyone EXCEPT other Mafia
                        if (!targetIsMafia) canTarget = true;
                    } 
                    else if (myCurrentRole === "doctor") {
                        // Doctor: Target anyone (including self)
                        canTarget = true;
                    } 
                    else if (myCurrentRole === "detective") {
                        // Detective: Target anyone EXCEPT self
                        if (!isMe) canTarget = true;
                    }

                    if (canTarget) {
                        createBtn(actionTargets, p.name, pid, submitActionBtn, "target");
                        actionPanel.classList.remove("hidden");
                    }
                }

                // DAY VOTES
                // Logic: Vote anyone except self
                if (phase === "day" && !isMe) {
                    createBtn(voteTargets, p.name, pid, submitVoteBtn, "vote");
                    votingPanel.classList.remove("hidden");
                }
            }
        });
    }

    // Dead Banner
    if (me && !me.alive) {
        document.getElementById("phaseText").innerText = "YOU ARE DEAD 💀";
        document.body.className = "night";
    }
});

function createBtn(container, name, pid, btn, datasetKey) {
    // Prevent duplicates
    const existing = Array.from(container.children).find(c => c.dataset.pid === pid);
    if(existing) return;

    const b = document.createElement("button");
    b.innerText = name;
    b.dataset.pid = pid;
    
    // Universal Click/Touch Handler
    const handleSelect = (e) => {
        if(e.cancelable) e.preventDefault(); // Stop double-firing on mobile
        
        // Visual select
        Array.from(container.children).forEach(c => c.classList.remove("selected"));
        b.classList.add("selected");
        
        // Enable Submit
        btn.disabled = false;
        btn.dataset[datasetKey] = pid; // Store ID in the submit button
    };

    b.addEventListener('click', handleSelect);
    b.addEventListener('touchstart', handleSelect, {passive: false});
    
    container.appendChild(b);
}

// Global Helpers
window.closeModal = () => document.getElementById("roleModal").style.display = "none";
function getName(id) { return allPlayersCache[id] ? allPlayersCache[id].name : "Unknown"; }

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

// Join Logic
joinHostBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) return;
    await set(ref(db, "room/host"), { name });
    await set(ref(db, "room/deckDealt"), false); 
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

// Init
if (localStorage.getItem("playerId")) {
    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
}
