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
const endDayBtn = document.getElementById("endVoteBtn"); // Reused button for "End Day & Reveal"
const exitBtn = document.getElementById("exitBtn");

// Panels
const centralDeck = document.getElementById("centralDeck");
const deckStatus = document.getElementById("deckStatus");
const roleModal = document.getElementById("roleModal");
const actionPanel = document.getElementById("actionPanel");
const votingPanel = document.getElementById("votingPanel");

// Action Buttons
const submitActionBtn = document.getElementById("submitActionBtn");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const actionTargets = document.getElementById("actionTargets");
const voteTargets = document.getElementById("voteTargets");

let allPlayersCache = {}; 
let myCurrentRole = null;
let mafiaSelections = []; // Store local selections for Mafia (needs 2)

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

    // Bad Guy Distribution
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

    // Fisher-Yates Shuffle
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    players.forEach(([pid], i) => {
        // Reset status tags on deal
        update(ref(db, `room/players/${pid}`), { 
            role: roles[i], 
            statusTags: "" // Clear tags
        });
    });

    await set(ref(db, "room/deckDealt"), true);
    await set(ref(db, "room/gamePhase"), "Roles Assigned");
});

// --------------------------------------------------
// HOST PHASE 1: START NIGHT
// --------------------------------------------------
nightBtn.addEventListener('click', () => {
    set(ref(db, "room/gamePhase"), "night");
    remove(ref(db, "room/night")); 
    remove(ref(db, "room/pendingResults")); // Clear pending calculations
});

// --------------------------------------------------
// HOST PHASE 2: START DAY (Calculate Night Results)
// --------------------------------------------------
dayBtn.addEventListener('click', async () => {
    const nightSnap = await get(ref(db, "room/night"));
    const night = nightSnap.val() || {};
    const playersSnap = await get(ref(db, "room/players"));
    const players = playersSnap.val();
    
    // 1. Tally Mafia Votes (Each Mafia submitted 2 targets)
    // Structure: room/night/mafiaVotes/{mafiaID} = [target1, target2]
    const mafiaVotesRaw = night.mafiaVotes || {};
    let voteCounts = {};
    let grandmaVotes = 0;
    let grandmaAttacker = null;

    Object.entries(mafiaVotesRaw).forEach(([attackerId, targets]) => {
        targets.forEach(tid => {
            voteCounts[tid] = (voteCounts[tid] || 0) + 1;
            // Check Grandma Logic specific to this vote
            if (players[tid].role === "grandma") {
                grandmaVotes++;
                grandmaAttacker = attackerId; // Store the last one who did it
            }
        });
    });

    // 2. Determine Night Kill Candidate
    let victimId = null;
    let maxVotes = 0;
    for (const [pid, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            victimId = pid;
        }
    }

    // 3. Resolve Grandma Logic
    // If Grandma got 1 vote -> Attacker dies. 
    // If Grandma got 2+ votes -> Grandma dies (overrides standard vote).
    let finalNightDeathId = victimId;
    let nightDeathReason = "Killed by Mafia";

    if (grandmaVotes >= 2) {
        // Find Grandma ID
        const grandmaEntry = Object.entries(players).find(([k,v]) => v.role === "grandma");
        if(grandmaEntry) {
            finalNightDeathId = grandmaEntry[0];
            nightDeathReason = "Killed by Mafia (Grandma Overwhelmed)";
        }
    } else if (grandmaVotes === 1 && grandmaAttacker) {
        // Revenge Kill
        finalNightDeathId = grandmaAttacker;
        nightDeathReason = "Shot by Grandma (Revenge)";
    }

    // 4. Doctor Save
    const saveId = night.doctorSave;
    if (finalNightDeathId && finalNightDeathId === saveId) {
        finalNightDeathId = null; // Saved!
        nightDeathReason = "Saved by Doctor";
    }

    // 5. Store Pending Result (Do NOT update player status yet)
    // The Host sees this, but players don't.
    const pendingData = {
        nightDeathId: finalNightDeathId || null,
        nightReason: nightDeathReason
    };
    
    await set(ref(db, "room/pendingResults"), pendingData);
    await remove(ref(db, "room/votes")); // Clear old day votes
    await set(ref(db, "room/gamePhase"), "day");

    // Host Alert
    let alertMsg = `🌙 NIGHT RESULTS (Hidden from Players):\n`;
    alertMsg += finalNightDeathId ? `💀 Casualty: ${getName(finalNightDeathId)}\nReason: ${nightDeathReason}` : `🛡️ No one died.`;
    alert(alertMsg);
});

// --------------------------------------------------
// HOST PHASE 3: END DAY (Reveal All & Apply Tags)
// --------------------------------------------------
endDayBtn.innerText = "Reveal & End Day"; // Rename button via JS
endDayBtn.addEventListener('click', async () => {
    // 1. Get Pending Night Results
    const pendingSnap = await get(ref(db, "room/pendingResults"));
    const pending = pendingSnap.val() || {};
    
    // 2. Get Day Voting Results
    const votesSnap = await get(ref(db, "room/votes"));
    const votes = votesSnap.val() ? Object.values(votesSnap.val()) : [];
    
    let elimId = null;
    if (votes.length > 0) {
        const count = {};
        votes.forEach(v => { count[v] = (count[v] || 0) + 1; });
        let max = 0;
        for (const pid in count) {
            if (count[pid] > max) { max = count[pid]; elimId = pid; }
        }
    }

    // 3. Apply Tags to Database
    let report = "📢 DAY END REPORT:\n";

    // Apply Night Death
    if (pending.nightDeathId) {
        await pushTag(pending.nightDeathId, "KILLED");
        report += `💀 Night Casualty: ${getName(pending.nightDeathId)}\n`;
    } else {
        report += `🛡️ Night: No casualties.\n`;
    }

    // Apply Day Elimination
    if (elimId) {
        await pushTag(elimId, "ELIMINATED");
        report += `⚖️ Voted Out: ${getName(elimId)}\n`;
    } else {
        report += `⚖️ Day: No one eliminated.\n`;
    }

    // 4. Show Public Alert
    await set(ref(db, "room/publicReport"), report);
    
    // 5. Check Win
    checkWinCondition();
});

// Helper to append tags (handles double tagging)
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

    // --- MAFIA MULTI-VOTE LOGIC ---
    if (role === "mafia" || role === "godfather") {
        if (mafiaSelections.length !== 2) {
            return alert("You must select exactly 2 targets.");
        }
        await set(ref(db, `room/night/mafiaVotes/${pid}`), mafiaSelections);
        submitActionBtn.innerText = "Votes Submitted";
        submitActionBtn.disabled = true;
        actionPanel.classList.add("hidden");
        return;
    }

    // --- STANDARD LOGIC ---
    const target = submitActionBtn.dataset.target;
    if(!target) return alert("Select a target first!");

    if (role === "doctor") {
        await set(ref(db, "room/night/doctorSave"), target);
    }
    else if (role === "detective") {
        const tSnap = await get(ref(db, `room/players/${target}/role`));
        const tRole = tSnap.val();
        // GODFATHER APPEARS INNOCENT
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
    submitVoteBtn.disabled = true;
    submitVoteBtn.innerText = "Vote Cast";
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
    if (!data) return; // Game deleted

    allPlayersCache = data.players || {};
    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");
    
    // Host UI
    if(isHost) {
        hostControls.classList.remove("hidden");
        // Only show "End Day" during Day phase
        endDayBtn.classList.toggle("hidden", data.gamePhase !== "day");
    }

    // Deck Visibility
    const isDealt = data.deckDealt === true;
    const centralDeck = document.getElementById("centralDeck");
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

    // Phase UI
    const phase = data.gamePhase || "Waiting";
    document.getElementById("phaseText").innerText = phase;
    document.body.className = phase === "night" ? "night" : "day";
    
    // Clear Panels if Phase Changed
    if(phase !== "night") { actionTargets.innerHTML = ""; mafiaSelections = []; }
    if(phase !== "day") voteTargets.innerHTML = "";

    // RENDER PLAYERS
    playersList.innerHTML = "";
    if (data.players) {
        const me = data.players[myId];
        myCurrentRole = me ? me.role : null;
        const amIMafia = (myCurrentRole === "mafia" || myCurrentRole === "godfather");

        Object.entries(data.players).forEach(([pid, p]) => {
            const isMe = pid === myId;
            const targetIsMafia = (p.role === "mafia" || p.role === "godfather");
            const canSeeRole = isHost || isMe || (amIMafia && targetIsMafia);
            
            // --- CARD CONTENT ---
            let cardHtml = `<div class="emptySlot">Wait</div>`;
            if (isDealt) {
                const img = canSeeRole ? p.role : "back";
                cardHtml = `<img src="images/${img}.png" onerror="this.src='https://via.placeholder.com/80?text=${img}'">`;
            }

            // --- TAGS (No Grayscale, Just Text) ---
            let statusHtml = "";
            if (p.statusTags) {
                statusHtml = `<div style="background:red; color:white; font-weight:bold; font-size:12px; margin-top:5px; border-radius:4px;">${p.statusTags}</div>`;
            }

            const div = document.createElement("div");
            div.classList.add("playerCard");
            // No opacity reduction, pure card + tags
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

            // --- ACTIONS GENERATION ---
            if (me && !me.statusTags) { // Only if I am not dead
                
                // NIGHT BUTTONS
                if (phase === "night") {
                    let canTarget = false;
                    
                    if (amIMafia) canTarget = true; // Mafia can vote anyone (including other mafia if they want to betray?)
                    else if (myCurrentRole === "doctor") canTarget = true;
                    else if (myCurrentRole === "detective" && !isMe) canTarget = true;

                    if (canTarget) {
                        createBtn(actionTargets, p.name, pid, submitActionBtn, "target");
                        actionPanel.classList.remove("hidden");
                    }
                }

                // DAY BUTTONS
                if (phase === "day" && !isMe) {
                    createBtn(voteTargets, p.name, pid, submitVoteBtn, "vote");
                    votingPanel.classList.remove("hidden");
                }
            }
        });
    }
});

// --- HELPER FOR BUTTONS (Supports Multi-Select for Mafia) ---
function createBtn(container, name, pid, btn, datasetKey) {
    const existing = Array.from(container.children).find(c => c.dataset.pid === pid);
    if(existing) return;

    const b = document.createElement("button");
    b.innerText = name;
    b.dataset.pid = pid;
    
    b.addEventListener('click', (e) => {
        if(e.cancelable) e.preventDefault(); 
        
        // MAFIA MULTI-SELECT LOGIC
        if ((myCurrentRole === "mafia" || myCurrentRole === "godfather") && datasetKey === "target") {
            // Toggle selection
            if (mafiaSelections.includes(pid)) {
                mafiaSelections = mafiaSelections.filter(id => id !== pid);
                b.classList.remove("selected");
            } else {
                if (mafiaSelections.length < 2) {
                    mafiaSelections.push(pid);
                    b.classList.add("selected");
                } else {
                    alert("You can only select 2 victims.");
                }
            }
            
            // Enable button only if 2 selected
            btn.disabled = (mafiaSelections.length !== 2);
            btn.innerText = `Submit (${mafiaSelections.length}/2)`;
            return;
        }

        // STANDARD SINGLE SELECT
        Array.from(container.children).forEach(c => c.classList.remove("selected"));
        b.classList.add("selected");
        btn.disabled = false;
        btn.dataset[datasetKey] = pid;
    });
    
    container.appendChild(b);
}

window.closeModal = () => document.getElementById("roleModal").style.display = "none";
function getName(id) { return allPlayersCache[id] ? allPlayersCache[id].name : "Unknown"; }

// Win Condition: Count players who do NOT have tags
async function checkWinCondition() {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return;
    const p = Object.values(snap.val());
    
    const activePlayers = p.filter(x => !x.statusTags); // Alive if no tags
    const mafiaCount = activePlayers.filter(x => x.role === "mafia" || x.role === "godfather").length;
    const civCount = activePlayers.length - mafiaCount;

    if (mafiaCount === 0 && activePlayers.length > 0) alert("CIVILIANS WIN!");
    else if (mafiaCount >= civCount && activePlayers.length > 0) alert("MAFIA WINS!");
}

// Join/Exit/Init Logic
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
    await set(refP, { name, role: null, statusTags: "" });
    localStorage.setItem("playerId", refP.key);
    localStorage.setItem("name", name);
    localStorage.setItem("isHost", "false");
    location.reload();
});

if (localStorage.getItem("playerId")) {
    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
}
