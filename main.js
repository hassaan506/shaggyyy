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

let app, db;
try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
} catch (e) { console.error(e); }

// --- SOUND SYSTEM (HTML TAG METHOD) ---
function playSound(id) {
    const el = document.getElementById("snd_" + id);
    if(el) {
        el.currentTime = 0;
        el.play().catch(() => console.log("Audio Blocked"));
    }
}

// UNLOCK AUDIO ON FIRST CLICK
document.addEventListener('click', () => {
    ["shuffle","deal","wolf","rooster","win","victory","shotgun"].forEach(id => {
        const el = document.getElementById("snd_" + id);
        if(el) { el.muted = true; el.play().catch(()=>{}); el.pause(); el.currentTime=0; el.muted=false; }
    });
}, { once: true });

// --- DOM ---
const screenJoin = document.getElementById("screenJoin");
const screenLobby = document.getElementById("screenLobby");
const screenGame = document.getElementById("screenGame");
const playerNameInput = document.getElementById("playerName");
const firstJoinBtn = document.getElementById("firstJoinBtn");
const claimHostBtn = document.getElementById("claimHostBtn");
const joinStatus = document.getElementById("joinStatus");

const hostControls = document.getElementById("hostControls");
const playersList = document.getElementById("playersList");
const liveVoteList = document.getElementById("liveVoteList");

const scoreboard = document.getElementById("scoreboard");
const scoreTown = document.getElementById("scoreTown");
const scoreMafia = document.getElementById("scoreMafia");
const scoreJester = document.getElementById("scoreJester");
const jesterContainer = document.getElementById("jesterContainer");

const shuffleBtn = document.getElementById("shuffleBtn");
const dealBtn = document.getElementById("dealBtn");
const hardResetBtn = document.getElementById("hardResetBtn");
const softResetBtn = document.getElementById("softResetBtn");
const nightBtn = document.getElementById("nightBtn");
const dayBtn = document.getElementById("dayBtn");
const endDayBtn = document.getElementById("endVoteBtn");

const gameOverModal = document.getElementById("gameOverModal");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const modalExitBtn = document.getElementById("modalExitBtn");
const roleModal = document.getElementById("roleModal");
const centralDeck = document.getElementById("centralDeck");
const deckStatus = document.getElementById("deckStatus");
const actionPanel = document.getElementById("actionPanel");
const votingPanel = document.getElementById("votingPanel");

const nightResultModal = document.getElementById("nightResultModal");
const nrCardInner = document.getElementById("nrCardInner");
const nrIcon = document.getElementById("nrIcon");
const nrName = document.getElementById("nrName");
const nrDetail = document.getElementById("nrDetail");
const nrTitle = document.getElementById("nrTitle");
const nrCloseBtn = document.getElementById("nrCloseBtn");

const reportModal = document.getElementById("reportModal");
const reportTitle = document.getElementById("reportTitle");
const reportText = document.getElementById("reportText");
const reportBtn = document.getElementById("reportBtn");

const mafiaChat = document.getElementById("mafiaChat");
const chatHistory = document.getElementById("chatHistory");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

const submitActionBtn = document.getElementById("submitActionBtn");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const actionTargets = document.getElementById("actionTargets");
const voteTargets = document.getElementById("voteTargets");

let allPlayersCache = {}; 
let myCurrentRole = null;
let lastPhase = "Waiting";

// --- UTILS ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showReport(title, msg, callback) {
    reportTitle.innerText = title;
    reportText.innerText = msg;
    reportModal.classList.remove("hidden");
    const newBtn = reportBtn.cloneNode(true);
    reportBtn.parentNode.replaceChild(newBtn, reportBtn);
    newBtn.addEventListener('click', () => {
        reportModal.classList.add("hidden");
        if(callback) callback();
    });
}

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
    if (!name) return;
    firstJoinBtn.disabled = true;
    firstJoinBtn.innerText = "Joining...";
    
    try {
        const refP = push(ref(db, "room/players"));
        localStorage.setItem("playerId", refP.key);
        localStorage.setItem("name", name);
        localStorage.setItem("isHost", "false");
        await set(refP, { name, role: null, statusTags: "" });
        screenJoin.classList.add("hidden");
    } catch (e) {
        firstJoinBtn.disabled = false;
    }
});

// --------------------------------------------------
// 2. LOBBY & HOST
// --------------------------------------------------
claimHostBtn.addEventListener('click', async () => {
    const myName = localStorage.getItem("name");
    const myTempId = localStorage.getItem("playerId");
    if(!myName) return location.reload();

    await set(ref(db, "room/host"), { name: myName });
    if (myTempId && myTempId !== "HOST") {
        try { await remove(ref(db, `room/players/${myTempId}`)); } catch (e) {}
    }
    await set(ref(db, "room/gamePhase"), "Waiting");
    localStorage.setItem("isHost", "true");
    localStorage.setItem("playerId", "HOST");
    location.reload();
});

// AUTO-KICK
onValue(ref(db, "room/players"), (snap) => {
    const players = snap.val();
    const myId = localStorage.getItem("playerId");
    const isHost = localStorage.getItem("isHost") === "true";
    if (myId && myId !== "HOST" && !isHost && (!players || !players[myId])) {
        localStorage.clear();
        location.reload();
    }
});

// SOFT RESET
async function performSoftReset() {
    const playersSnap = await get(ref(db, "room/players"));
    const players = playersSnap.val() || {};
    const updates = {};
    Object.keys(players).forEach(pid => {
        updates[`room/players/${pid}/role`] = null;
        updates[`room/players/${pid}/statusTags`] = "";
        updates[`room/players/${pid}/vestUsed`] = false;
        updates[`room/players/${pid}/vestActive`] = false;
    });
    const myName = localStorage.getItem("name");
    if (myName) {
        const newRef = push(ref(db, "room/players"));
        updates[`room/players/${newRef.key}`] = { name: myName, role: null, statusTags: "" };
        localStorage.setItem("playerId", newRef.key);
    }
    updates["room/night"] = null;
    updates["room/votes"] = null;
    updates["room/pendingResults"] = null;
    updates["room/publicReport"] = null;
    updates["room/winMessage"] = null;
    updates["room/deckDealt"] = false;
    updates["room/isShuffling"] = false;
    updates["room/hasShuffled"] = false;
    updates["room/gamePhase"] = "Lobby";
    updates["room/host"] = null;
    await update(ref(db), updates);
    localStorage.setItem("isHost", "false");
}

nextRoundBtn.addEventListener('click', async () => {
    if (confirm("Start Next Round?")) {
        await performSoftReset();
        location.reload();
    }
});

softResetBtn.addEventListener('click', async () => {
    if (confirm("RESTART ROUND?")) {
        await performSoftReset();
        location.reload();
    }
});

// --------------------------------------------------
// 3. HOST CONTROLS & DELEGATION
// --------------------------------------------------
playersList.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('kickBtn')) {
        e.stopPropagation();
        if(confirm(`Kick ${target.dataset.name}?`)) remove(ref(db, `room/players/${target.dataset.pid}`));
    }
    if (target.classList.contains('lateDealBtn')) {
        e.stopPropagation();
        playSound('deal');
        update(ref(db, `room/players/${target.dataset.pid}`), { role: "civilian", statusTags: "" });
    }
    if (target.classList.contains('viewRoleBtn')) {
        e.stopPropagation();
        const role = target.dataset.role;
        document.getElementById("modalRole").src = `images/${role}.png`;
        document.getElementById("modalName").innerText = target.dataset.name;
        document.getElementById("modalRoleText").innerText = `Role: ${role.toUpperCase()}`;
        document.getElementById("roleModal").style.display = "flex";
    }
});

window.onclick = function(event) {
    if (event.target == roleModal) roleModal.style.display = "none";
    if (event.target == nightResultModal) nightResultModal.classList.add("hidden");
}
window.closeModal = () => document.getElementById("roleModal").style.display = "none";

shuffleBtn.addEventListener('click', async () => {
    await set(ref(db, "room/isShuffling"), true);
    await set(ref(db, "room/hasShuffled"), false);
    setTimeout(async () => {
        await set(ref(db, "room/isShuffling"), false);
        await set(ref(db, "room/hasShuffled"), true);
    }, 4500);
});

dealBtn.addEventListener('click', async () => {
    const snap = await get(ref(db, "room/players"));
    if (!snap.exists()) return alert("No players.");
    
    let playersArr = Object.entries(snap.val());
    shuffleArray(playersArr);

    const count = playersArr.length;
    let roles = [];
    let badGuyCount = count >= 8 ? 3 : (count >= 6 ? 2 : 1);

    if (badGuyCount === 1) roles.push(Math.random() < 0.5 ? "godfather" : "mafia");
    else {
        roles.push("godfather");
        for (let i = 1; i < badGuyCount; i++) roles.push("mafia");
    }
    roles.push("doctor");
    roles.push("detective");
    if (count > 5) roles.push("grandma");
    if (count > 7) roles.push("jester");
    while (roles.length < count) roles.push("civilian");
    if (roles.length > count) roles = roles.slice(0, count);

    shuffleArray(roles);

    playersArr.forEach(([pid], i) => {
        update(ref(db, `room/players/${pid}`), { role: roles[i], statusTags: "", vestUsed: false, vestActive: false });
    });
    await set(ref(db, "room/deckDealt"), true);
    await set(ref(db, "room/gamePhase"), "Roles Assigned");
});

nightBtn.addEventListener('click', () => {
    set(ref(db, "room/gamePhase"), "night");
    remove(ref(db, "room/night")); 
    remove(ref(db, "room/pendingResults"));
});

dayBtn.addEventListener('click', async () => {
    // Replaces Alert with Report Modal
    try {
        const nightSnap = await get(ref(db, "room/night"));
        const night = nightSnap.val() || {};
        const playersSnap = await get(ref(db, "room/players"));
        const players = playersSnap.val();
        if (!players) throw new Error("No players found");

        const mafiaVotesRaw = night.mafiaVotes || {};
        let voteCounts = {};
        let grandmaVotes = 0;
        let grandmaAttacker = null;

        Object.entries(mafiaVotesRaw).forEach(([attackerId, targetId]) => {
            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
            if (players[targetId] && players[targetId].role === "grandma") {
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

        let vestSaved = false;
        if (finalNightDeathId && players[finalNightDeathId] && players[finalNightDeathId].vestActive) {
            vestSaved = true;
            finalNightDeathId = null;
            nightDeathReason = "Bulletproof Vest";
        }

        let reportMsg = "";
        if (finalNightDeathId) reportMsg = `💀 Casualty: ${getName(finalNightDeathId)}\nReason: ${nightDeathReason}`;
        else if (wasSaved) reportMsg = `🛡️ Mafia targeted ${savedName}, but they were SAVED by the Doctor!`;
        else if (vestSaved) reportMsg = `🛡️ The Mafia attacked someone, but the bullet bounced off! (Vest Used)`;
        else reportMsg = `🛡️ No one died tonight.`;

        // SHOW REPORT MODAL (Wait for Host to click Proceed)
        showReport("🌙 NIGHT RESULTS (HIDDEN)", reportMsg, async () => {
            const resetVests = {};
            Object.keys(players).forEach(pid => { resetVests[`room/players/${pid}/vestActive`] = false; });
            await update(ref(db), resetVests);
            await remove(ref(db, "room/night/chat"));
            await set(ref(db, "room/pendingResults"), { nightDeathId: finalNightDeathId || null, reason: nightDeathReason, savedName: savedName, wasSaved: wasSaved });
            await remove(ref(db, "room/votes")); 
            await set(ref(db, "room/gamePhase"), "day");
        });
    
    } catch (e) { console.error(e); }
});

nrCloseBtn.addEventListener('click', () => {
    nightResultModal.classList.add("hidden");
});

endDayBtn.addEventListener('click', async () => {
    const pendingSnap = await get(ref(db, "room/pendingResults"));
    const pending = pendingSnap.val() || {};
    const votesSnap = await get(ref(db, "room/votes"));
    const votes = votesSnap.val() ? Object.values(votesSnap.val()) : [];
    const playersSnap = await get(ref(db, "room/players"));
    const players = playersSnap.val();
    
    let elimId = null;
    if (votes.length > 0) {
        const count = {};
        votes.forEach(v => { count[v] = (count[v] || 0) + 1; });
        let max = 0;
        for (const pid in count) { 
            if (count[pid] > max) { max = count[pid]; elimId = pid; } 
        }
    }

    if (elimId && elimId !== "SKIP" && players[elimId] && players[elimId].role === "jester") {
        const scoreSnap = await get(ref(db, "room/scoreboard"));
        let scores = scoreSnap.val() || { town: 0, mafia: 0, jester: 0 };
        scores.jester = (scores.jester || 0) + 1;
        await update(ref(db, "room/scoreboard"), scores);
        await set(ref(db, "room/winMessage"), "🤡 JESTER WINS!");
        await set(ref(db, "room/gamePhase"), "GAME OVER");
        return; 
    }

    let report = "";
    if (pending.nightDeathId) report += `💀 Night Casualty: ${getName(pending.nightDeathId)}\n`;
    else report += `🛡️ Night: No casualties.\n`;

    if (elimId && elimId !== "SKIP") {
        await pushTag(elimId, "ELIMINATED");
        report += `⚖️ Voted Out: ${getName(elimId)}\n`;
    } else if (elimId === "SKIP") {
        report += `💤 Town voted to SKIP.\n`;
    } else {
        report += `⚖️ Day: No majority/votes.\n`;
    }
    
    await set(ref(db, "room/publicReport"), report);
    await checkWinCondition();
});

// --------------------------------------------------
// 4. PLAYER ACTIONS
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
        showReport("INVESTIGATION", `${getName(target)} is ${isBad}`);
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
    if (msg) showReport("📢 DAILY NEWS", msg);
});

// --------------------------------------------------
// 5. MAIN UI LOOP
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

    // SCOREBOARD & JESTER TOGGLE
    const scores = data.scoreboard || { town: 0, mafia: 0, jester: 0 };
    scoreTown.innerText = scores.town;
    scoreMafia.innerText = scores.mafia;
    if(scoreJester) scoreJester.innerText = scores.jester || 0;
    scoreboard.classList.remove("hidden");

    const playerCount = Object.keys(data.players || {}).length;
    if (playerCount > 7) jesterContainer.classList.remove("hidden");
    else jesterContainer.classList.add("hidden");

    allPlayersCache = data.players || {};
    const isHost = localStorage.getItem("isHost") === "true";
    const myId = localStorage.getItem("playerId");
    const phase = data.gamePhase || "Waiting";
    
    // SOUNDS
    if (phase !== lastPhase) {
        if (phase === "night") playSound('night');
        if (phase === "day") {
            playSound('day');
            const pending = data.pendingResults || {};
            if (pending.nightDeathId) {
                 if (pending.reason && (pending.reason.includes("Mafia") || pending.reason.includes("Revenge"))) playSound('shotgun');
                 nrTitle.innerText = "TRAGEDY!";
                 nrIcon.innerText = "💀";
                 nrName.innerText = getName(pending.nightDeathId);
                 nrDetail.innerText = pending.reason;
                 document.querySelector('.flip-card-back').className = "flip-card-back death";
            } else if (pending.wasSaved) {
                 nrTitle.innerText = "MIRACLE!";
                 nrIcon.innerText = "🛡️";
                 nrName.innerText = pending.savedName;
                 nrDetail.innerText = "Saved by Doctor";
                 document.querySelector('.flip-card-back').className = "flip-card-back save";
            } else {
                 nrTitle.innerText = "PEACEFUL NIGHT";
                 nrIcon.innerText = "🌙";
                 nrName.innerText = "No One";
                 nrDetail.innerText = "Everyone Survived";
                 document.querySelector('.flip-card-back').className = "flip-card-back safe";
            }
            
            nrCardInner.classList.remove("flipped");
            nightResultModal.classList.remove("hidden");
            setTimeout(() => { nrCardInner.classList.add("flipped"); }, 100);
        }
        lastPhase = phase;
    }

    if (data.isShuffling) playSound('shuffle');
    if (data.deckDealt && !allPlayersCache[myId]?.role) playSound('deal'); 

    if(data.host) {
        document.getElementById("hostName").innerText = data.host.name;
        document.getElementById("hostStatus").innerText = "Host Online";
        document.getElementById("hostStatus").style.color = "#28a745";
    }

    document.getElementById("phaseText").innerText = phase;
    if(phase === "night") {
        document.body.className = "night";
        actionTargets.innerHTML = "";
    } else if (phase === "day") {
        document.body.className = "day";
        voteTargets.innerHTML = "";
    } else {
        document.body.className = "";
    }

    if (phase === "Lobby" || !data.host) {
        screenGame.classList.add("hidden");
        screenLobby.classList.remove("hidden");
        gameOverModal.classList.add("hidden");
        return;
    } else {
        screenLobby.classList.add("hidden");
        if (isHost || (myId && myId !== "HOST")) screenGame.classList.remove("hidden");
    }

    if (phase === "GAME OVER") {
        if(data.winMessage.includes("MAFIA") || data.winMessage.includes("JESTER")) playSound('mafiaWin');
        else playSound('civWin');

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
        if(isHost) {
            const canDeal = data.hasShuffled === true;
            dealBtn.disabled = !canDeal;
            dealBtn.style.opacity = canDeal ? "1" : "0.5";
        }
    }

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
            if (data.host && p.name === data.host.name) return;

            const isMe = pid === myId;
            const canSeeRole = isHost || isMe || (amIMafia && (p.role === "mafia" || p.role === "godfather"));
            
            let cardHtml = `<div class="emptySlot">Wait</div>`;
            if (isDealt) {
                const img = canSeeRole ? p.role : "back";
                cardHtml = `<img src="images/${img}.png" onerror="this.src='https://via.placeholder.com/80?text=${img}'">`;
            }

            let statusHtml = "";
            if (p.statusTags) statusHtml = `<div style="background:red; color:white; font-weight:bold; font-size:12px; margin-top:5px; border-radius:4px;">${p.statusTags}</div>`;

            const div = document.createElement("div");
            div.classList.add("playerCard");
            
            if(isHost) {
                const kickBtn = document.createElement("button");
                kickBtn.className = "kickBtn";
                kickBtn.innerText = "X";
                kickBtn.dataset.pid = pid;
                kickBtn.dataset.name = p.name;
                div.appendChild(kickBtn);

                if(isDealt && !p.role && phase !== "night") {
                    const lateDealBtn = document.createElement("button");
                    lateDealBtn.className = "lateDealBtn";
                    lateDealBtn.innerText = "🃏 Deal Entry";
                    lateDealBtn.dataset.pid = pid;
                    div.appendChild(lateDealBtn);
                }
            }

            if (isDealt && canSeeRole && p.role) {
                const viewBtn = document.createElement("button");
                viewBtn.className = "viewRoleBtn";
                viewBtn.innerText = "👁️";
                viewBtn.dataset.role = p.role;
                viewBtn.dataset.name = p.name;
                div.appendChild(viewBtn);
            }

            div.innerHTML += `<h3>${p.name}</h3>${cardHtml}${statusHtml}`;
            playersList.appendChild(div);

            if (me && !amDead && me.role) { 
                const nightData = data.night || {};
                if (phase === "night") {
                    let alreadyVoted = false;
                    if (amIMafia && nightData.mafiaVotes && nightData.mafiaVotes[myId]) alreadyVoted = true;
                    if (myCurrentRole === "doctor" && nightData.doctorSave) alreadyVoted = true;
                    if (myCurrentRole === "detective" && nightData.detectiveAction && nightData.detectiveAction[myId]) alreadyVoted = true;
                    if (myCurrentRole === "civilian" && me.vestActive) alreadyVoted = true;

                    if (alreadyVoted) {
                        actionPanel.classList.remove("hidden");
                        actionPanel.innerHTML = "<h3>Night Action</h3><p>Action Submitted.</p>";
                    } else {
                        if(actionPanel.innerHTML.includes("Action Submitted")) actionPanel.innerHTML = `<h3>Night Action</h3><p id="actionInstruction">Select a target...</p><div id="actionTargets" class="targets"></div><button id="submitActionBtn" class="primary" disabled>Submit Action</button>`;
                        
                        let canTarget = false;
                        if (amIMafia && (p.role !== "mafia" && p.role !== "godfather") && !isMe) canTarget = true;
                        else if (myCurrentRole === "doctor") canTarget = true;
                        else if (myCurrentRole === "detective" && !isMe) canTarget = true;

                        if (myCurrentRole === "civilian" && !me.vestUsed && isMe) {
                            if(!document.getElementById("vestBtn")) {
                                const vestBtn = document.createElement("button");
                                vestBtn.id = "vestBtn";
                                vestBtn.className = "vestBtn";
                                vestBtn.innerText = "🛡️ WEAR VEST (One Time)";
                                vestBtn.onclick = async () => {
                                    if(confirm("Use your ONE bulletproof vest tonight?")) {
                                        await update(ref(db, `room/players/${myId}`), { vestUsed: true, vestActive: true });
                                    }
                                };
                                actionPanel.prepend(vestBtn);
                                actionPanel.classList.remove("hidden");
                            }
                        }

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
                        
                        const skipExists = Array.from(voteTargets.children).find(c => c.dataset.pid === "SKIP");
                        if(!skipExists) {
                            const skipBtn = document.createElement("button");
                            skipBtn.innerText = "😴 SKIP VOTE";
                            skipBtn.dataset.pid = "SKIP";
                            skipBtn.className = "skipBtn";
                            skipBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                Array.from(voteTargets.children).forEach(c => c.classList.remove("selected"));
                                skipBtn.classList.add("selected");
                                submitVoteBtn.disabled = false;
                                submitVoteBtn.dataset.vote = "SKIP";
                            });
                            voteTargets.prepend(skipBtn);
                        }
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
        e.preventDefault(); 
        Array.from(container.children).forEach(c => c.classList.remove("selected"));
        b.classList.add("selected");
        btn.disabled = false;
        btn.dataset[datasetKey] = pid;
    });
    container.appendChild(b);
}

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
        const scoreSnap = await get(ref(db, "room/scoreboard"));
        let scores = scoreSnap.val() || { town: 0, mafia: 0, jester: 0 };
        scores.town++;
        await update(ref(db, "room/scoreboard"), scores);
    } 
    else if (mafiaCount > townCount && activePlayers.length > 0) {
        await set(ref(db, "room/winMessage"), "MAFIA WINS!");
        await set(ref(db, "room/gamePhase"), "GAME OVER");
        const scoreSnap = await get(ref(db, "room/scoreboard"));
        let scores = scoreSnap.val() || { town: 0, mafia: 0, jester: 0 };
        scores.mafia++;
        await update(ref(db, "room/scoreboard"), scores);
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
