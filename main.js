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

// Controls
const shuffleBtn = document.getElementById("shuffleBtn");
const dealBtn = document.getElementById("dealBtn");
const resetBtn = document.getElementById("resetBtn"); // Top bar reset
const nightBtn = document.getElementById("nightBtn");
const dayBtn = document.getElementById("dayBtn");
const endDayBtn = document.getElementById("endVoteBtn");
const exitBtn = document.getElementById("exitBtn");

// Panels & Modals
const centralDeck = document.getElementById("centralDeck");
const deckStatus = document.getElementById("deckStatus");
const roleModal = document.getElementById("roleModal");
const gameOverModal = document.getElementById("gameOverModal");
const actionPanel = document.getElementById("actionPanel");
const votingPanel = document.getElementById("votingPanel");

// Game Over Modal Buttons
const modalResetBtn = document.getElementById("modalResetBtn");
const modalExitBtn = document.getElementById("modalExitBtn");

// Action Buttons
const submitActionBtn = document.getElementById("submitActionBtn");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const actionTargets = document.getElementById("actionTargets");
const voteTargets = document.getElementById("voteTargets");

let allPlayersCache = {}; 
let myCurrentRole = null;
let mafiaSelections = []; 

// --------------------------------------------------
// SHUFFLE & DEAL
// --------------------------------------------------
shuffleBtn.addEventListener('click', async () => {
    await set(ref(db, "room/isShuffling"), true);
    setTimeout(async () => { await set(ref(db, "room/isShuffling"), false); }, 1500);
});

if (centralDeck) centralDeck.addEventListener('click', async () => {
    if (!centralDeck.classList.contains("hidden") && localStorage.getItem("isHost") === "true") {
        await set(ref(db, "room/isShuffling"), true);
        setTimeout(async () => { await set(ref(db, "room/isShuffling"), false); }, 1500);
    }
});

dealBtn.addEventListener('click', async () => {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return alert("No players.");

    const players = Object.entries(snap.val());
    const count = players.length;

    let roles = [];
    let badGuyCount = 1;
    if (count >= 6 && count <= 7) badGuyCount = 2;
    if (count >= 8) badGuyCount = 3;

    if (badGuyCount === 1) roles.push(Math.random() < 0.5 ? "godfather" : "mafia");
    else {
        roles.push("godfather");
        for (let i = 1; i < badGuyCount; i++) roles.push("mafia");
    }

    roles.push("doctor");
    roles.push("detective");
    roles.push("grandma");

    while (roles.length < count) roles.push("civilian");
    if (roles.length > count) roles = roles.slice(0, count);

    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    players.forEach(([pid], i) => {
        update(ref(db, `room/players/${pid}`), { role: roles[i], statusTags: "" });
    });

    await set(ref(db, "room/deckDealt"), true);
    await set(ref(db, "room/gamePhase"), "Roles Assigned");
});

// --------------------------------------------------
// HOST CONTROLS - NIGHT
// --------------------------------------------------
nightBtn.addEventListener('click', () => {
    set(ref(db, "room/gamePhase"), "night");
    remove(ref(db, "room/night")); 
    remove(ref(db, "room/pendingResults"));
});

// --------------------------------------------------
// HOST CONTROLS - DAY (CALCULATE)
// --------------------------------------------------
dayBtn.addEventListener('click', async () => {
    const nightSnap = await get(ref(db, "room/night"));
    const night = nightSnap.val() || {};
    const playersSnap = await get(ref(db, "room/players"));
    const players = playersSnap.val();
    
    // 1. Tally Mafia Votes
    const mafiaVotesRaw = night.mafiaVotes || {};
    let voteCounts = {};
    let grandmaVotes = 0;
    let grandmaAttacker = null;

    Object.entries(mafiaVotesRaw).forEach(([attackerId, targets]) => {
        targets.forEach(tid => {
            voteCounts[tid] = (voteCounts[tid] || 0) + 1;
            if (players[tid].role === "grandma") {
                grandmaVotes++;
                grandmaAttacker = attackerId;
            }
        });
    });

    // 2. Determine Victim (Random Tie Break)
    let maxVotes = 0;
    let potentialVictims = [];
    for (const [pid, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) { maxVotes = count; potentialVictims = [pid]; } 
        else if (count === maxVotes) { potentialVictims.push(pid); }
    }
    
    let victimId = null;
    if (potentialVictims.length > 0) {
        victimId = potentialVictims[Math.floor(Math.random() * potentialVictims.length)];
    }

    // 3. Logic Application
    let finalNightDeathId = victimId;
    let nightDeathReason = "Killed by Mafia";

    if (grandmaVotes >= 2) {
        const grandmaEntry = Object.entries(players).find(([k,v]) => v.role === "grandma");
        if(grandmaEntry) {
            finalNightDeathId = grandmaEntry[0];
            nightDeathReason = "Killed by Mafia (Grandma Overwhelmed)";
        }
    } else if (grandmaVotes === 1 && grandmaAttacker) {
        finalNightDeathId = grandmaAttacker;
        nightDeathReason = "Shot by Grandma (Revenge)";
    }

    // Doctor Save
    let wasSaved = false;
    let savedName = "Unknown";
    
    if (finalNightDeathId && finalNightDeathId === night.doctorSave) {
        wasSaved = true;
        savedName = getName(finalNightDeathId);
        finalNightDeathId = null; 
        nightDeathReason = "Saved by Doctor";
    }

    // Alert Host
    let alertMsg = `🌙 NIGHT RESULTS (Hidden):\n`;
    if (finalNightDeathId) {
        alertMsg += `💀 Casualty: ${getName(finalNightDeathId)}\nReason: ${nightDeathReason}`;
    } else if (wasSaved) {
        alertMsg += `🛡️ Mafia targeted ${savedName}, but they were SAVED by the Doctor!`;
    } else {
        alertMsg += `🛡️ No one died.`;
    }
    alert(alertMsg);

    await set(ref(db, "room/pendingResults"), { nightDeathId: finalNightDeathId || null });
    await remove(ref(db, "room/votes")); 
    await set(ref(db, "room/gamePhase"), "day");
});

// --------------------------------------------------
// HOST CONTROLS - REVEAL & END DAY
// --------------------------------------------------
endDayBtn.innerText = "Reveal & End Day";
endDayBtn.addEventListener('click', async () => {
    const pendingSnap = await get(ref(db, "room/pendingResults"));
    const pending = pendingSnap.val() || {};
    
    const votesSnap = await get(ref(db, "room/votes"));
    const votes = votesSnap.val() ? Object.values(votesSnap.val()) : [];
    
    let elimId = null;
    if (votes.length > 0) {
        const count = {};
        votes.forEach(v => { count[v] = (count[v] || 0) + 1; });
        let max = 0;
        let tied = [];
        for (const pid in count) { 
            if (count[pid] > max) { max = count[pid]; tied = [pid]; } 
            else if (count[pid] === max) { tied.push(pid); }
        }
        if(tied.length > 0) elimId = tied[Math.floor(Math.random() * tied.length)];
    }

    let report = "📢 DAY END REPORT:\n";
    if (pending.nightDeathId) {
        await pushTag(pending.nightDeathId, "KILLED");
        report += `💀 Night Casualty: ${getName(pending.nightDeathId)}\n`;
    } else {
        report += `🛡️ Night: No casualties.\n`;
    }

    if (elimId) {
        await pushTag(elimId, "ELIMINATED");
        report += `⚖️ Voted Out: ${getName(elimId)}\n`;
    } else {
        report += `⚖️ Day: No one eliminated.\n`;
    }

    await set(ref(db, "room/publicReport"), report);
    await checkWinCondition();
});

async function pushTag(pid, tag) {
    const refP = ref(db, `room/players/${pid}`);
    const snap = await get(refP);
    if (!snap.exists()) return;
    let currentTags = snap.val().statusTags || "";
    if (!currentTags.includes(tag)) {
        let newTags = currentTags ? `${currentTags} & ${tag}` : tag;
        await update(refP, { statusTags: newTags });
    }
}

// --------------------------------------------------
// PLAYER ACTIONS
// --------------------------------------------------
submitActionBtn.addEventListener('click', async () => {
    const pid = localStorage.getItem("playerId");
    const role = myCurrentRole; 

    if (role === "mafia" || role === "godfather") {
        const snap = await get(ref(db, "room/players"));
        const players = snap.val();
        
        const aliveMafiaCount = Object.values(players).filter(p => 
            (p.role === 'mafia' || p.role === 'godfather') && !p.statusTags
        ).length;

        const requiredVotes = aliveMafiaCount === 1 ? 1 : 2;

        if (mafiaSelections.length !== requiredVotes) {
            return alert(`There are ${aliveMafiaCount} Mafia alive.\nYou must select exactly ${requiredVotes} victim(s).`);
        }

        await set(ref(db, `room/night/mafiaVotes/${pid}`), mafiaSelections);
        submitActionBtn.innerText = "Votes Submitted";
        submitActionBtn.disabled = true;
        actionPanel.classList.add("hidden");
        return;
    }

    const target = submitActionBtn.dataset.target;
    if(!target) return alert("Select a target first!");

    if (role === "doctor") await set(ref(db, "room/night/doctorSave"), target);
    else if (role === "detective") {
        const tSnap = await get(ref(db, `room/players/${target}/role`));
        const tRole = tSnap.val();
        const isBad = (tRole === "mafia") ? "YES (Mafia)" : "NO (Innocent)"; 
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
});

// --------------------------------------------------
// GLOBAL LISTENERS
// --------------------------------------------------
onValue(ref(db, "room/publicReport"), (snap) => {
    const msg = snap.val();
    if (msg) alert(msg);
});

onValue(ref(db, "room"), (snap) => {
    const data = snap.val();

    // --- KICK LOGIC ---
    // If room is null, Host deleted it. Kick everyone.
    if (!data) {
        if (localStorage.getItem("playerId")) {
            localStorage.clear();
            alert("The Host has ended the game.");
            location.reload();
        }
        return;
    }

    allPlayersCache = data.players || {};
    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");
    const phase = data.gamePhase || "Waiting";
    
    // --- GAME OVER MODAL LOGIC ---
    if (phase === "GAME OVER") {
        gameOverModal.classList.remove("hidden");
        document.getElementById("winMessage").innerText = data.winMessage || "GAME OVER";
        
        // Host Reset Button
        if (isHost) {
            modalResetBtn.classList.remove("hidden");
            modalResetBtn.onclick = async () => {
                if (confirm("Kick everyone and restart?")) {
                    await remove(ref(db, "room")); // This triggers 'if (!data)' above for everyone
                }
            };
        }
        
        // Player Exit Button
        modalExitBtn.onclick = () => {
            localStorage.clear();
            location.reload();
        };

        return; // Stop rendering the rest of the game
    } else {
        gameOverModal.classList.add("hidden");
    }

    // Normal Game Loop UI
    if(isHost) {
        hostControls.classList.remove("hidden");
        endDayBtn.classList.toggle("hidden", phase !== "day");
    }

    const isDealt = data.deckDealt === true;
    if (isDealt) {
        centralDeck.classList.add("hidden");
        if(isHost) { shuffleBtn.disabled = true; dealBtn.disabled = true; }
    } else {
        centralDeck.classList.remove("hidden");
        const deckImg = document.querySelector(".cardDeck");
        if(deckImg) data.isShuffling ? deckImg.classList.add("shaking") : deckImg.classList.remove("shaking");
        deckStatus.innerText = data.isShuffling ? "Shuffling..." : "Ready";
        if(isHost) dealBtn.disabled = false;
    }

    document.getElementById("phaseText").innerText = phase;
    document.body.className = phase === "night" ? "night" : "day";
    
    if(phase !== "night") { actionTargets.innerHTML = ""; mafiaSelections = []; }
    if(phase !== "day") voteTargets.innerHTML = "";

    playersList.innerHTML = "";
    if (data.players) {
        const me = data.players[myId];
        myCurrentRole = me ? me.role : null;
        const amDead = me && me.statusTags && me.statusTags.length > 0;
        const amIMafia = (myCurrentRole === "mafia" || myCurrentRole === "godfather");
        const hasVoted = data.votes && data.votes[myId];

        Object.entries(data.players).forEach(([pid, p]) => {
            const isMe = pid === myId;
            const targetIsMafia = (p.role === "mafia" || p.role === "godfather");
            const canSeeRole = isHost || isMe || (amIMafia && targetIsMafia);
            
            let cardHtml = `<div class="emptySlot">Wait</div>`;
            if (isDealt) {
                const img = canSeeRole ? p.role : "back";
                cardHtml = `<img src="images/${img}.png" onerror="this.src='https://via.placeholder.com/80?text=${img}'">`;
            }

            let statusHtml = "";
            if (p.statusTags) {
                statusHtml = `<div style="background:red; color:white; font-weight:bold; font-size:12px; margin-top:5px; border-radius:4px;">${p.statusTags}</div>`;
            }

            const div = document.createElement("div");
            div.classList.add("playerCard");
            div.innerHTML = `<h3>${p.name}</h3>${cardHtml}${statusHtml}`;
            div.onclick = () => {
                if(isDealt && canSeeRole && p.role) {
                    document.getElementById("modalRole").src = `images/${p.role}.png`;
                    document.getElementById("modalName").innerText = p.name;
                    document.getElementById("modalRoleText").innerText = `Role: ${p.role.toUpperCase()}`;
                    document.getElementById("roleModal").style.display = "flex";
                }
            };
            playersList.appendChild(div);

            // BUTTON LOGIC
            if (me && !amDead) { 
                if (phase === "night") {
                    let canTarget = false;
                    if (amIMafia) canTarget = true;
                    else if (myCurrentRole === "doctor") canTarget = true;
                    else if (myCurrentRole === "detective" && !isMe) canTarget = true;

                    if (canTarget) {
                        createBtn(actionTargets, p.name, pid, submitActionBtn, "target");
                        actionPanel.classList.remove("hidden");
                    }
                }
                if (phase === "day" && !isMe) {
                    if (hasVoted) {
                        votingPanel.classList.remove("hidden");
                        votingPanel.innerHTML = "<h3>Day Vote</h3><p>Vote Submitted.</p>";
                    } else {
                        if(votingPanel.innerHTML.includes("Vote Submitted")) {
                             votingPanel.innerHTML = `<h3>Day Vote</h3><p id="voteInstruction">Who do you want to eliminate?</p><div id="voteTargets" class="targets"></div><button id="submitVoteBtn" class="primary" disabled>Submit Vote</button>`;
                        }
                        createBtn(voteTargets, p.name, pid, submitVoteBtn, "vote");
                        votingPanel.classList.remove("hidden");
                    }
                }
            } else if (amDead) {
                actionPanel.classList.add("hidden");
                votingPanel.classList.add("hidden");
            }
        });
    }
});

function createBtn(container, name, pid, btn, datasetKey) {
    const existing = Array.from(container.children).find(c => c.dataset.pid === pid);
    if(existing) return;

    const b = document.createElement("button");
    b.innerText = name;
    b.dataset.pid = pid;
    
    b.addEventListener('click', (e) => {
        if(e.cancelable) e.preventDefault(); 
        
        if ((myCurrentRole === "mafia" || myCurrentRole === "godfather") && datasetKey === "target") {
             if (mafiaSelections.includes(pid)) {
                mafiaSelections = mafiaSelections.filter(id => id !== pid);
                b.classList.remove("selected");
            } else {
                mafiaSelections.push(pid);
                b.classList.add("selected");
            }
            btn.disabled = false;
            return;
        }

        Array.from(container.children).forEach(c => c.classList.remove("selected"));
        b.classList.add("selected");
        btn.disabled = false;
        btn.dataset[datasetKey] = pid;
    });
    container.appendChild(b);
}

window.closeModal = () => document.getElementById("roleModal").style.display = "none";
function getName(id) { return allPlayersCache[id] ? allPlayersCache[id].name : "Unknown"; }

// Logic: Check Win and Save Message to DB (to trigger Modal)
async function checkWinCondition() {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return;
    const p = Object.values(snap.val());
    
    const activePlayers = p.filter(x => !x.statusTags);
    const mafiaCount = activePlayers.filter(x => x.role === "mafia" || x.role === "godfather").length;
    const civCount = activePlayers.length - mafiaCount;

    if (mafiaCount === 0 && activePlayers.length > 0) {
        await set(ref(db, "room/winMessage"), "CIVILIANS WIN!");
        await set(ref(db, "room/gamePhase"), "GAME OVER");
    } 
    else if (mafiaCount >= civCount && activePlayers.length > 0) {
        await set(ref(db, "room/winMessage"), "MAFIA WINS!");
        await set(ref(db, "room/gamePhase"), "GAME OVER");
    }
}

// Reset Logic for Top Bar Button (Same logic as Modal)
resetBtn.addEventListener('click', async () => {
    if (confirm("Reset Game? This will kick all players.")) {
        await remove(ref(db, "room"));
        localStorage.clear();
        location.reload();
    }
});

exitBtn.addEventListener('click', () => {
    if(confirm("Exit?")) { localStorage.clear(); location.reload(); }
});

if (localStorage.getItem("playerId")) {
    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
}
