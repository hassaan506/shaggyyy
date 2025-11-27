import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove, push, update } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyCflm17U7JTwkEMHjfyp4G5UU29KQzVs4I",
    authDomain: "mafia-wars-online.firebaseapp.com",
    databaseURL: "https://mafia-wars-online-default-rtdb.firebaseio.com/",
    projectId: "mafia-wars-online",
    storageBucket: "mafia-wars-online.appspot.com",
    messagingSenderId: "1069937976880",
    appId: "1:1069937976880:web:b082963b7964c8e25b8f30"
};

let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
} catch (e) {
    console.error(e);
}

// --- DOM ELEMENTS ---
const screenJoin = document.getElementById("screenJoin");
const screenLobby = document.getElementById("screenLobby");
const screenGame = document.getElementById("screenGame");
const playerNameInput = document.getElementById("playerName");
const firstJoinBtn = document.getElementById("firstJoinBtn");
const claimHostBtn = document.getElementById("claimHostBtn");
const joinStatus = document.getElementById("joinStatus");

const hostControls = document.getElementById("hostControls");
const playersList = document.getElementById("playersList");
const hostFeed = document.getElementById("hostFeed");
const liveVoteList = document.getElementById("liveVoteList");

const scoreboard = document.getElementById("scoreboard");
const scoreTown = document.getElementById("scoreTown");
const scoreMafia = document.getElementById("scoreMafia");

// Controls
const shuffleBtn = document.getElementById("shuffleBtn");
const dealBtn = document.getElementById("dealBtn");
const hardResetBtn = document.getElementById("hardResetBtn");
const nightBtn = document.getElementById("nightBtn");
const dayBtn = document.getElementById("dayBtn");
const endDayBtn = document.getElementById("endVoteBtn");

// Modals & Panels
const gameOverModal = document.getElementById("gameOverModal");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const modalExitBtn = document.getElementById("modalExitBtn");
const roleModal = document.getElementById("roleModal");
const centralDeck = document.getElementById("centralDeck");
const deckStatus = document.getElementById("deckStatus");
const actionPanel = document.getElementById("actionPanel");
const votingPanel = document.getElementById("votingPanel");

// Chat
const mafiaChat = document.getElementById("mafiaChat");
const chatHistory = document.getElementById("chatHistory");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

// Buttons
const submitActionBtn = document.getElementById("submitActionBtn");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const actionTargets = document.getElementById("actionTargets");
const voteTargets = document.getElementById("voteTargets");

// State
let allPlayersCache = {}; 
let myCurrentRole = null;

// --------------------------------------------------
// 1. INITIALIZATION & JOIN
// --------------------------------------------------

if (localStorage.getItem("playerId") && localStorage.getItem("name")) {
    screenJoin.classList.add("hidden");
} else {
    screenJoin.classList.remove("hidden");
}

firstJoinBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        joinStatus.innerText = "Please enter a name.";
        return;
    }

    firstJoinBtn.disabled = true;
    firstJoinBtn.innerText = "Joining...";
    joinStatus.innerText = "Connecting...";

    try {
        const refP = push(ref(db, "room/players"));
        
        localStorage.setItem("playerId", refP.key);
        localStorage.setItem("name", name);
        localStorage.setItem("isHost", "false");

        await set(refP, { name, role: null, statusTags: "" });

        screenJoin.classList.add("hidden");
        location.reload();

    } catch (e) {
        console.error(e);
        joinStatus.innerText = "Error: " + e.message;
        firstJoinBtn.disabled = false;
        firstJoinBtn.innerText = "Enter Game Room";
    }
});

// --------------------------------------------------
// 2. LOBBY & HOST CLAIM (ROBUST FIX)
// --------------------------------------------------
claimHostBtn.addEventListener('click', async () => {
    const myName = localStorage.getItem("name");
    const myTempId = localStorage.getItem("playerId");

    if(!myName) return location.reload();

    // 1. Set Host Name
    await set(ref(db, "room/host"), { name: myName });
    
    // 2. Force Remove Player Entry from DB
    if (myTempId && myTempId !== "HOST") {
        try {
            await remove(ref(db, `room/players/${myTempId}`));
        } catch (e) { console.log("Cleanup error", e); }
    }

    // 3. Set Game State
    await set(ref(db, "room/gamePhase"), "Waiting");
    
    // 4. Update Local Storage
    localStorage.setItem("isHost", "true");
    localStorage.setItem("playerId", "HOST");
    
    location.reload();
});

nextRoundBtn.addEventListener('click', async () => {
    if (confirm("Start Next Round? Scores will be kept.")) {
        const playersSnap = await get(ref(db, "room/players"));
        const players = playersSnap.val() || {};

        const updates = {};
        Object.keys(players).forEach(pid => {
            updates[`room/players/${pid}/role`] = null;
            updates[`room/players/${pid}/statusTags`] = "";
        });

        updates["room/night"] = null;
        updates["room/votes"] = null;
        updates["room/pendingResults"] = null;
        updates["room/publicReport"] = null;
        updates["room/winMessage"] = null;
        updates["room/deckDealt"] = false;
        updates["room/isShuffling"] = false;
        
        updates["room/gamePhase"] = "Lobby";
        updates["room/host"] = null;

        await update(ref(db), updates);
        
        localStorage.setItem("isHost", "false");
        location.reload();
    }
});

// --------------------------------------------------
// 3. HOST CONTROLS
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
    if (count > 5) roles.push("grandma");

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

onValue(ref(db, "room/votes"), (snap) => {
    if (localStorage.getItem("isHost") !== "true") return;
    const votes = snap.val() || {};
    liveVoteList.innerHTML = "";
    if (Object.keys(votes).length === 0) {
        liveVoteList.innerHTML = "<li>No votes yet...</li>";
        return;
    }
    Object.entries(votes).forEach(([voterId, targetId]) => {
        const li = document.createElement("li");
        li.innerText = `${getName(voterId)} ➝ ${getName(targetId)}`;
        liveVoteList.appendChild(li);
    });
});

nightBtn.addEventListener('click', () => {
    set(ref(db, "room/gamePhase"), "night");
    remove(ref(db, "room/night")); 
    remove(ref(db, "room/pendingResults"));
});

dayBtn.addEventListener('click', async () => {
    const nightSnap = await get(ref(db, "room/night"));
    const night = nightSnap.val() || {};
    const playersSnap = await get(ref(db, "room/players"));
    const players = playersSnap.val();
    
    const mafiaVotesRaw = night.mafiaVotes || {};
    let voteCounts = {};
    let grandmaVotes = 0;
    let grandmaAttacker = null;

    Object.entries(mafiaVotesRaw).forEach(([attackerId, targetId]) => {
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
        if (players[targetId].role === "grandma") {
            grandmaVotes++;
            grandmaAttacker = attackerId;
        }
    });

    let maxVotes = 0;
    let potentialVictims = [];
    for (const [pid, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) { maxVotes = count; potentialVictims = [pid]; } 
        else if (count === maxVotes) { potentialVictims.push(pid); }
    }
    
    let victimId = potentialVictims.length > 0 ? potentialVictims[Math.floor(Math.random() * potentialVictims.length)] : null;
    let finalNightDeathId = victimId;
    let nightDeathReason = "Killed by Mafia";

    if (grandmaVotes > 0) {
        if (grandmaVotes >= 2) {
            const badGuys = Object.entries(players).filter(([pid, p]) => (p.role === "mafia" || p.role === "godfather") && !p.statusTags);
            if (badGuys.length > 0) {
                finalNightDeathId = badGuys[Math.floor(Math.random() * badGuys.length)][0];
                nightDeathReason = "Grandma Ricochet";
            } else finalNightDeathId = null;
        } 
        else if (grandmaVotes === 1 && grandmaAttacker) {
            finalNightDeathId = grandmaAttacker;
            nightDeathReason = "Grandma Revenge";
        }
    }

    let wasSaved = false;
    let savedName = "Unknown";
    if (finalNightDeathId && finalNightDeathId === night.doctorSave) {
        wasSaved = true;
        savedName = getName(finalNightDeathId);
        finalNightDeathId = null; 
        nightDeathReason = "Saved by Doctor";
    }

    let alertMsg = `🌙 NIGHT RESULTS (Hidden):\n`;
    if (finalNightDeathId) alertMsg += `💀 Casualty: ${getName(finalNightDeathId)}\nReason: ${nightDeathReason}`;
    else if (wasSaved) alertMsg += `🛡️ Mafia targeted ${savedName}, but they were SAVED by the Doctor!`;
    else alertMsg += `🛡️ No one died.`;
    alert(alertMsg);

    await remove(ref(db, "room/night/chat"));
    await set(ref(db, "room/pendingResults"), { nightDeathId: finalNightDeathId || null });
    await remove(ref(db, "room/votes")); 
    await set(ref(db, "room/gamePhase"), "day");
});

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
    }
    if (elimId) {
        await pushTag(elimId, "ELIMINATED");
        report += `⚖️ Voted Out: ${getName(elimId)}\n`;
    }
    await set(ref(db, "room/publicReport"), report);
    await checkWinCondition();
});

// --------------------------------------------------
// 4. PLAYER ACTIONS & CHAT
// --------------------------------------------------
sendChatBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const myName = localStorage.getItem("name");
    const pid = localStorage.getItem("playerId");
    await push(ref(db, "room/night/chat"), { sender: myName, senderId: pid, text: text });
    chatInput.value = "";
});

onValue(ref(db, "room/night/chat"), (snap) => {
    chatHistory.innerHTML = "";
    const msgs = snap.val();
    if (!msgs) return;
    const myId = localStorage.getItem("playerId");
    Object.values(msgs).forEach(m => {
        const div = document.createElement("div");
        div.classList.add("chatMsg");
        div.classList.add(m.senderId === myId ? "me" : "them");
        div.innerHTML = `<b>${m.sender}</b>${m.text}`;
        chatHistory.appendChild(div);
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
});

submitActionBtn.addEventListener('click', async () => {
    const pid = localStorage.getItem("playerId");
    const role = myCurrentRole; 
    const target = submitActionBtn.dataset.target;
    if(!target) return alert("Select a target first!");

    if (role === "mafia" || role === "godfather") await set(ref(db, `room/night/mafiaVotes/${pid}`), target);
    else if (role === "doctor") await set(ref(db, "room/night/doctorSave"), target);
    else if (role === "detective") {
        await set(ref(db, `room/night/detectiveAction/${pid}`), true);
        const tSnap = await get(ref(db, `room/players/${target}/role`));
        const tRole = tSnap.val();
        const isBad = (tRole === "mafia") ? "YES (Mafia)" : "NO (Innocent)"; 
        alert(`Investigation Result:\n${getName(target)} is ${isBad}`);
    }
    submitActionBtn.innerText = "Submitted";
    submitActionBtn.disabled = true;
    actionPanel.classList.add("hidden");
});

submitVoteBtn.addEventListener('click', async () => {
    const pid = localStorage.getItem("playerId");
    const target = submitVoteBtn.dataset.vote;
    if(!target) return alert("Select a player first!");
    await set(ref(db, `room/votes/${pid}`), target);
});

onValue(ref(db, "room/publicReport"), (snap) => {
    const msg = snap.val();
    if (msg) alert(msg);
});

// --------------------------------------------------
// 5. MAIN SYNC LOOP (WITH VISUAL FIX)
// --------------------------------------------------
onValue(ref(db, "room"), (snap) => {
    const data = snap.val();
    if (!data) {
        if (localStorage.getItem("playerId")) {
            localStorage.clear();
            alert("Host cleared the game.");
            location.reload();
        }
        return;
    }

    const scores = data.scoreboard || { town: 0, mafia: 0 };
    scoreTown.innerText = scores.town;
    scoreMafia.innerText = scores.mafia;
    scoreboard.classList.remove("hidden");

    allPlayersCache = data.players || {};
    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");
    const phase = data.gamePhase || "Waiting";
    
    if (phase === "Lobby" || !data.host) {
        screenGame.classList.add("hidden");
        screenLobby.classList.remove("hidden");
        gameOverModal.classList.add("hidden");
        return;
    } else {
        screenLobby.classList.add("hidden");
        // Only show game screen if I am Host OR I have a valid Player ID
        if (isHost || (myId && myId !== "HOST")) {
            screenGame.classList.remove("hidden");
        }
    }

    if (phase === "GAME OVER") {
        gameOverModal.classList.remove("hidden");
        document.getElementById("winMessage").innerText = data.winMessage || "GAME OVER";
        if (isHost) {
            nextRoundBtn.classList.remove("hidden");
            document.getElementById("waitingForHostText").classList.add("hidden");
        } else {
            nextRoundBtn.classList.add("hidden");
            document.getElementById("waitingForHostText").classList.remove("hidden");
        }
        modalExitBtn.onclick = () => { localStorage.clear(); location.reload(); };
        return; 
    } else {
        gameOverModal.classList.add("hidden");
    }

    if(isHost) {
        hostControls.classList.remove("hidden");
        endDayBtn.classList.toggle("hidden", phase !== "day");
        hostFeed.classList.remove("hidden");
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
    
    if(phase !== "night") { actionTargets.innerHTML = ""; }
    if(phase !== "day") voteTargets.innerHTML = "";

    playersList.innerHTML = "";
    if (data.players) {
        const me = data.players[myId];
        myCurrentRole = me ? me.role : null;
        const amDead = me && me.statusTags && me.statusTags.length > 0;
        const amIMafia = (myCurrentRole === "mafia" || myCurrentRole === "godfather");
        const hasVotedDay = data.votes && data.votes[myId];

        if (phase === "night" && amIMafia) mafiaChat.classList.remove("hidden");
        else mafiaChat.classList.add("hidden");

        Object.entries(data.players).forEach(([pid, p]) => {
            // --- VISUAL GUARD: HIDE HOST FROM GRID ---
            // If this player's name matches the Host's name, skip rendering.
            if (data.host && p.name === data.host.name) return;

            const isMe = pid === myId;
            const targetIsMafia = (p.role === "mafia" || p.role === "godfather");
            const canSeeRole = isHost || isMe || (amIMafia && targetIsMafia);
            
            let cardHtml = `<div class="emptySlot">Wait</div>`;
            if (isDealt) {
                const img = canSeeRole ? p.role : "back";
                cardHtml = `<img src="images/${img}.png" onerror="this.src='https://via.placeholder.com/80?text=${img}'">`;
            }

            let statusHtml = "";
            if (p.statusTags) statusHtml = `<div style="background:red; color:white; font-weight:bold; font-size:12px; margin-top:5px; border-radius:4px;">${p.statusTags}</div>`;

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

            if (me && !amDead) { 
                const nightData = data.night || {};
                if (phase === "night") {
                    let alreadyVoted = false;
                    if (amIMafia && nightData.mafiaVotes && nightData.mafiaVotes[myId]) alreadyVoted = true;
                    if (myCurrentRole === "doctor" && nightData.doctorSave) alreadyVoted = true;
                    if (myCurrentRole === "detective" && nightData.detectiveAction && nightData.detectiveAction[myId]) alreadyVoted = true;

                    if (alreadyVoted) {
                        actionPanel.classList.remove("hidden");
                        actionPanel.innerHTML = "<h3>Night Action</h3><p>Action Submitted.</p>";
                    } else {
                        if(actionPanel.innerHTML.includes("Action Submitted")) actionPanel.innerHTML = `<h3>Night Action</h3><p id="actionInstruction">Select a target...</p><div id="actionTargets" class="targets"></div><button id="submitActionBtn" class="primary" disabled>Submit Action</button>`;
                        
                        let canTarget = false;
                        if (amIMafia && !targetIsMafia && !isMe) canTarget = true;
                        else if (myCurrentRole === "doctor") canTarget = true;
                        else if (myCurrentRole === "detective" && !isMe) canTarget = true;

                        if (canTarget) {
                            createBtn(actionTargets, p.name, pid, submitActionBtn, "target");
                            actionPanel.classList.remove("hidden");
                        }
                    }
                }
                
                if (phase === "day" && !isMe) {
                    if (hasVotedDay) {
                        votingPanel.classList.remove("hidden");
                        votingPanel.innerHTML = "<h3>Day Vote</h3><p>Vote Submitted.</p>";
                    } else {
                        if(votingPanel.innerHTML.includes("Vote Submitted")) votingPanel.innerHTML = `<h3>Day Vote</h3><p id="voteInstruction">Who to eliminate?</p><div id="voteTargets" class="targets"></div><button id="submitVoteBtn" class="primary" disabled>Submit Vote</button>`;
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
        Array.from(container.children).forEach(c => c.classList.remove("selected"));
        b.classList.add("selected");
        btn.disabled = false;
        btn.dataset[datasetKey] = pid;
    });
    container.appendChild(b);
}

window.closeModal = () => document.getElementById("roleModal").style.display = "none";
function getName(id) { return allPlayersCache[id] ? allPlayersCache[id].name : "Unknown"; }

async function checkWinCondition() {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return;
    const p = Object.values(snap.val());
    
    const activePlayers = p.filter(x => !x.statusTags);
    const mafiaCount = activePlayers.filter(x => x.role === "mafia" || x.role === "godfather").length;
    const townCount = activePlayers.filter(x => x.role === "civilian" || x.role === "grandma").length;

    if (mafiaCount === 0 && activePlayers.length > 0) {
        await set(ref(db, "room/winMessage"), "CIVILIANS WIN!");
        await set(ref(db, "room/gamePhase"), "GAME OVER");
    } 
    else if (mafiaCount > townCount && activePlayers.length > 0) {
        await set(ref(db, "room/winMessage"), "MAFIA WINS!");
        await set(ref(db, "room/gamePhase"), "GAME OVER");
    }
}

hardResetBtn.addEventListener('click', async () => {
    if (confirm("HARD RESET? This kicks everyone.")) {
        await remove(ref(db, "room"));
        localStorage.clear();
        location.reload();
    }
});

exitBtn.addEventListener('click', () => {
    if(confirm("Exit?")) { localStorage.clear(); location.reload(); }
});
