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
} catch (e) { console.error(e); }

// --- SOUND ENGINE ---
// STRICT RULES: No generic clicks.
const sounds = {
    shuffle: new Audio('sound/shuffle.mp3'),
    deal: new Audio('sound/deal.mp3'),          
    night: new Audio('sound/night.mp3'),
    day: new Audio('sound/rooster.mp3'),
    mafiaWin: new Audio('sound/win.mp3'),       
    civWin: new Audio('sound/victory.mp3'),     
    shotgun: new Audio('sound/shotgun.mp3')
};

// Global Unlocker for Mobile (Silent)
document.addEventListener('click', () => {
    Object.values(sounds).forEach(s => {
        if(s.readyState === 0) s.load();
    });
}, { once: true });

function playSound(name) {
    try {
        if(sounds[name]) {
            sounds[name].currentTime = 0;
            sounds[name].volume = 0.7; 
            sounds[name].muted = false; 
            let p = sounds[name].play();
            if (p !== undefined) p.catch(e => { /* Ignore auto-play errors */ });
        }
    } catch(e) { /* Ignore missing sounds */ }
}

// --- UTILS ---
let allPlayersCache = {}; 

function getName(pid, snapshotPlayers = null) {
    const source = snapshotPlayers || allPlayersCache;
    if (source && source[pid]) {
        return source[pid].name;
    }
    return "Unknown Player";
}

function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

function createBtn(parent, text, pid, mainBtn, dataAttr) {
     const btn = document.createElement("button");
     btn.innerText = text;
     btn.dataset.pid = pid;
     btn.addEventListener('click', (e) => {
         e.preventDefault();
         // NO SOUND HERE.
         
         // Deselect all siblings
         Array.from(parent.children).forEach(c => c.classList.remove("selected"));
         // Select this
         btn.classList.add("selected");
         // Enable main button
         mainBtn.disabled = false;
         // Set data on main button
         if(dataAttr === 'vote') mainBtn.dataset.vote = pid;
         if(dataAttr === 'target') mainBtn.dataset.target = pid;
     });
     parent.appendChild(btn);
}

function showReport(title, msg, callback) {
    reportTitle.innerText = title;
    reportText.innerText = msg;
    reportModal.classList.remove("hidden");
    reportModal.classList.add("flex-visible");
     
    reportBtn.onclick = () => {
        reportModal.classList.remove("flex-visible");
        reportModal.classList.add("hidden");
        if(callback) callback();
    };
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
const closeRoleBtn = document.getElementById("closeRoleBtn");
const roundCounter = document.getElementById("roundCounter");

const mafiaChat = document.getElementById("mafiaChat");
const mafiaLiveFeed = document.getElementById("mafiaLiveFeed");
const chatHistory = document.getElementById("chatHistory");
const chatInput = document.getElementById("chatInput");
const sendChatBtn = document.getElementById("sendChatBtn");

const submitActionBtn = document.getElementById("submitActionBtn");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const actionTargets = document.getElementById("actionTargets");
const voteTargets = document.getElementById("voteTargets");

let myCurrentRole = null;
let lastPhase = "Waiting";
let isTransitioning = false; 
let hasShuffledLocal = false;
let hasDealtLocal = false;
let isFirstLoad = true; 

// --- BUTTON LISTENERS ---

claimHostBtn.addEventListener('click', async () => {
    const myName = localStorage.getItem("name");
    const pid = localStorage.getItem("playerId");
    if(!myName || !pid) return alert("Please join with a name first.");
    
    if(confirm("Claim Host status? This controls the game flow.")) {
        // No sound here, just reload logic
        await set(ref(db, "room/host"), { name: myName, id: pid });
        localStorage.setItem("isHost", "true");
        location.reload(); 
    }
});

hardResetBtn.addEventListener('click', async () => {
    if (confirm("HARD RESET? This kicks everyone.")) {
        await remove(ref(db, "room"));
        localStorage.clear();
        location.reload();
    }
});

softResetBtn.addEventListener('click', async () => {
    if (confirm("RESTART ROUND?")) {
        await performSoftReset();
    }
});

nextRoundBtn.addEventListener('click', async () => {
    if (confirm("Start Next Round?")) {
        await performSoftReset();
    }
});

shuffleBtn.addEventListener('click', async () => {
    // Only host clicks this, sound triggers via DB for everyone
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
    if(playersArr.length === 0) return;
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
    // This DB change triggers the Deal sound in the main loop
    await set(ref(db, "room/deckDealt"), true);
    await set(ref(db, "room/gamePhase"), "Roles Assigned");
    await set(ref(db, "room/roundCount"), 0);
});

nightBtn.addEventListener('click', async () => {
    await set(ref(db, "room/gamePhase"), "night");
    await remove(ref(db, "room/night")); 
    await remove(ref(db, "room/pendingResults"));
    await remove(ref(db, "room/publicReport")); 
});

dayBtn.addEventListener('click', async () => {
    try {
        const nightSnap = await get(ref(db, "room/night"));
        const night = nightSnap.val() || {};
        const playersSnap = await get(ref(db, "room/players"));
        const players = playersSnap.val();
         
        if (!players) return alert("Error: No player data found!");

        const rSnap = await get(ref(db, "room/roundCount"));
        let r = rSnap.val() || 0;
        await set(ref(db, "room/roundCount"), r + 1);

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
         
        let finalNightDeathId = null;
        if (potentialVictims.length > 0) {
             finalNightDeathId = potentialVictims[Math.floor(Math.random() * potentialVictims.length)];
        }
        let nightDeathReason = "Killed by Mafia";

        if (grandmaVotes > 0) {
            if (grandmaVotes >= 2) {
                const badGuys = Object.entries(players).filter(([pid, p]) => (p.role === "mafia" || p.role === "godfather") && !p.statusTags);
                if (badGuys.length > 0) {
                    finalNightDeathId = badGuys[Math.floor(Math.random() * badGuys.length)][0];
                    nightDeathReason = "Grandma Ricochet";
                } else finalNightDeathId = null;
            } else if (grandmaVotes === 1 && grandmaAttacker) {
                finalNightDeathId = grandmaAttacker;
                nightDeathReason = "Grandma Revenge";
            }
        }

        let wasSaved = false;
        let savedName = "Unknown";
        if (finalNightDeathId && finalNightDeathId === night.doctorSave) {
            wasSaved = true;
            savedName = getName(finalNightDeathId, players);
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
        if (finalNightDeathId) reportMsg = `💀 Casualty: ${getName(finalNightDeathId, players)}\nReason: ${nightDeathReason}`;
        else if (wasSaved) reportMsg = `🛡️ Mafia targeted ${savedName}, but they were SAVED by the Doctor!`;
        else if (vestSaved) reportMsg = `🛡️ The Mafia attacked someone, but the bullet bounced off! (Vest Used)`;
        else reportMsg = `🛡️ No one died tonight.`;

        showReport("🌙 NIGHT RESULTS (HIDDEN)", reportMsg, async () => {
            const resetVests = {};
            Object.keys(players).forEach(pid => { resetVests[`room/players/${pid}/vestActive`] = false; });
            await update(ref(db), resetVests);
            await remove(ref(db, "room/night/chat"));
            await set(ref(db, "room/pendingResults"), { nightDeathId: finalNightDeathId || null, reason: nightDeathReason, savedName: savedName, wasSaved: wasSaved });
            await remove(ref(db, "room/votes")); 
            await set(ref(db, "room/gamePhase"), "day");
        });
    } catch (e) { alert("Day Logic Error: " + e.message); }
});

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
        joinStatus.innerText = "Error: " + e.message;
        firstJoinBtn.disabled = false;
    }
});

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
    
    // FIX: ATOMIC RESET OF HOST
    updates["room/host"] = null;
    updates["room/night"] = null;
    updates["room/votes"] = null;
    updates["room/pendingResults"] = null;
    updates["room/publicReport"] = null;
    updates["room/winMessage"] = null;
    updates["room/deckDealt"] = false;
    updates["room/isShuffling"] = false;
    updates["room/hasShuffled"] = false;
    updates["room/gamePhase"] = "Lobby";
    updates["room/roundCount"] = 0; 
    
    await update(ref(db), updates);
    // Explicitly reset local state
    localStorage.setItem("isHost", "false");
}

async function pushTag(pid, tag) {
    const pRef = ref(db, `room/players/${pid}/statusTags`);
    const snap = await get(pRef);
    let current = snap.val() || "";
    if(current) current += ", " + tag;
    else current = tag;
    await set(pRef, current);
}

async function checkWinCondition() {
     const pSnap = await get(ref(db, "room/players"));
     const players = pSnap.val() || {};
     let townCount = 0, mafiaCount = 0, aliveCount = 0;
     Object.values(players).forEach(p => {
         if(!p.statusTags) {
             aliveCount++;
             if(p.role === "mafia" || p.role === "godfather") mafiaCount++;
             else townCount++;
         }
     });
     const scoreSnap = await get(ref(db, "room/scoreboard"));
     let scores = scoreSnap.val() || { town: 0, mafia: 0, jester: 0 };
     if (mafiaCount >= townCount && mafiaCount > 0) {
         scores.mafia++;
         await update(ref(db, "room/scoreboard"), scores);
         await set(ref(db, "room/winMessage"), "🕵️ MAFIA WINS!");
         await set(ref(db, "room/gamePhase"), "GAME OVER");
     } else if (mafiaCount === 0 && aliveCount > 0) {
         scores.town++;
         await update(ref(db, "room/scoreboard"), scores);
         await set(ref(db, "room/winMessage"), "👷 TOWN WINS!");
         await set(ref(db, "room/gamePhase"), "GAME OVER");
     }
}

// --- MAIN LOOP ---
onValue(ref(db, "room"), (snap) => {
    const data = snap.val();
    const myId = localStorage.getItem("playerId");

    // --- FIX: Reset Logic & Host Claim ---
    // If no host exists in DB, force everyone's local logic to 'Lobby' mode
    if (!data || !data.host) {
        if (localStorage.getItem("isHost") === "true") {
             localStorage.setItem("isHost", "false");
        }
        
        if (myId) {
             screenJoin.classList.add("hidden"); 
             screenGame.classList.add("hidden"); 
             screenLobby.classList.remove("hidden"); // Host button is here
             gameOverModal.classList.add("hidden");
        }
        return;
    }

    if (myId) {
        screenJoin.classList.add("hidden");
        screenJoin.classList.remove("flex-visible");
    }

    const scores = data.scoreboard || { town: 0, mafia: 0, jester: 0 };
    scoreTown.innerText = scores.town;
    scoreMafia.innerText = scores.mafia;
    if(scoreJester) scoreJester.innerText = scores.jester || 0;
    scoreboard.classList.remove("hidden");

    // Dynamic Table Size
    const playerCount = Object.keys(data.players || {}).length;
    if (playerCount > 7) jesterContainer.classList.remove("hidden");
    else jesterContainer.classList.add("hidden");
    const tableSurface = document.querySelector('.tableSurface');
    if(tableSurface) {
        if(playerCount <= 5) tableSurface.setAttribute('data-size', 'small');
        else if(playerCount <= 10) tableSurface.setAttribute('data-size', 'medium');
        else tableSurface.setAttribute('data-size', 'large');
    }

    allPlayersCache = data.players || {};
    const isHost = localStorage.getItem("isHost") === "true";
    const phase = data.gamePhase || "Waiting";
     
    // --- SILENCE ON ENTRY ---
    if (isFirstLoad) {
        lastPhase = phase;
        // Check deck state to prevent immediate deal sound
        if(data.deckDealt) hasDealtLocal = true;
        if(data.hasShuffled) hasShuffledLocal = true;
        isFirstLoad = false;
    }

    // --- RESET UI FOR NEW PHASE ---
    if (phase !== lastPhase) {
        actionPanel.classList.add("hidden");
        votingPanel.classList.add("hidden");

        if (phase === "night") {
            playSound('night');
            if(roundCounter) roundCounter.innerText = `Night ${data.roundCount || 1}`;
        }
        if (phase === "day") {
            playSound('day');
            if(roundCounter) roundCounter.innerText = `Day ${data.roundCount || 1}`;
            const pending = data.pendingResults || {};
            
            // --- STRICT SHOTGUN LOGIC ---
            if (pending.nightDeathId) {
                 const me = allPlayersCache[myId];
                 const myRole = me ? me.role : "";
                 const amIMafia = (myRole === "mafia" || myRole === "godfather");
                 const amIVictim = (myId === pending.nightDeathId);
                 
                 // Check: Mafia Kill?
                 if (pending.reason && pending.reason.includes("Mafia")) {
                     if (amIMafia || amIVictim) playSound('shotgun');
                 } 
                 // If killed by Grandma revenge, maybe everyone hears it? Or same logic.
                 // For now, sticking to your request: Only Mafia/Victim hear successful mafia kill.
                 
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

    // Shuffle Sound (Everyone hears)
    if (data.isShuffling && !hasShuffledLocal) {
        playSound('shuffle');
        hasShuffledLocal = true;
    }
    if (!data.isShuffling) hasShuffledLocal = false;
    
    // Deal Sound (Everyone hears)
    if (data.deckDealt && !hasDealtLocal) {
        playSound('deal'); 
        hasDealtLocal = true;
    }
    if (!data.deckDealt) hasDealtLocal = false;

    if(data.host) {
        document.getElementById("hostName").innerText = data.host.name;
        document.getElementById("hostStatus").innerText = "Host Online";
        document.getElementById("hostStatus").style.color = "#28a745";
    }

    if(isHost) {
        const list = document.getElementById("liveVoteList");
        if(list) {
            list.innerHTML = "";
            let voteSource = (phase === "night") ? (data.night ? data.night.mafiaVotes : {}) : (data.votes || {});
            Object.entries(voteSource).forEach(([pid, target]) => {
                const li = document.createElement("li");
                li.innerHTML = `<b>${getName(pid)}</b> ➔ ${getName(target)}`;
                list.appendChild(li);
            });
        }
    }
     
    const me = data.players ? data.players[myId] : null;
    myCurrentRole = me ? me.role : null;
    const amIMafia = (myCurrentRole === "mafia" || myCurrentRole === "godfather");

    if(phase === "night" && amIMafia) {
        mafiaChat.classList.remove("hidden");
        const liveFeed = document.getElementById("mafiaLiveFeed");
        if (liveFeed) {
            const votes = (data.night && data.night.mafiaVotes) ? data.night.mafiaVotes : {};
            const voteList = Object.entries(votes).map(([pid, target]) => {
                return `🔫 <b>${getName(pid)}</b> targets <b>${getName(target)}</b>`;
            }).join("<br>");
            liveFeed.innerHTML = voteList || "No targets selected yet...";
        }
    } else {
        mafiaChat.classList.add("hidden");
    }

    document.getElementById("phaseText").innerText = phase;
    document.body.className = phase === "night" ? "night" : (phase === "day" ? "day" : "");

    // Phase Routing
    if (phase === "Lobby") {
        screenGame.classList.add("hidden");
        screenLobby.classList.remove("hidden");
        gameOverModal.classList.add("hidden");
    } else {
        screenLobby.classList.add("hidden");
        if (isHost || (myId && data.players && data.players[myId])) screenGame.classList.remove("hidden");
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
    } else gameOverModal.classList.add("hidden");

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
    actionTargets.innerHTML = "";
    voteTargets.innerHTML = "";

    if (data.players) {
        const amDead = me && me.statusTags && me.statusTags.length > 0;

        Object.entries(data.players).forEach(([pid, p]) => {
            if (data.host && p.name === data.host.name) return;

            const isMe = pid === myId;
            const canSeeRole = isHost || isMe || (amIMafia && (p.role === "mafia" || p.role === "godfather"));
            let cardHtml = `<div class="emptySlot">Wait</div>`;
            if (isDealt) {
                const img = canSeeRole ? p.role : "back";
                cardHtml = `<img src="images/${img}.png" onerror="this.src='https://via.placeholder.com/80?text=${img}'">`;
            }
            let statusHtml = p.statusTags ? `<div style="background:red; color:white; font-weight:bold; font-size:12px; margin-top:5px; border-radius:4px;">${p.statusTags}</div>` : "";

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

            // --- ROLE LOGIC (Hidden for Host) ---
            if (me && !amDead && me.role && !isHost) { 
                if (phase === "night") {
                    let showAction = false;
                    // Mafia Logic
                    if (amIMafia && (p.role !== "mafia" && p.role !== "godfather") && !isMe) showAction = true;
                    // Doctor Logic
                    if (myCurrentRole === "doctor") showAction = true;
                    // Detective Logic
                    if (myCurrentRole === "detective" && !isMe) showAction = true;
                     
                    if (showAction) {
                          actionPanel.classList.remove("hidden");
                          submitActionBtn.disabled = false;
                          createBtn(actionTargets, p.name, pid, submitActionBtn, "target");
                    }
                     
                    // Vest Logic
                    if (myCurrentRole === "civilian" && !me.vestUsed && isMe) {
                         if(!document.getElementById("vestBtn")) {
                                const vestBtn = document.createElement("button");
                                vestBtn.id = "vestBtn";
                                vestBtn.className = "vestBtn";
                                vestBtn.innerText = "🛡️ WEAR VEST (One Time)";
                                vestBtn.onclick = async () => {
                                    if(confirm("Use your ONE bulletproof vest tonight?")) {
                                        // NO SOUND
                                        await update(ref(db, `room/players/${myId}`), { vestUsed: true, vestActive: true });
                                    }
                                };
                                actionPanel.prepend(vestBtn);
                                actionPanel.classList.remove("hidden");
                         }
                    }
                }
                 
                if (phase === "day" && !isMe) {
                    votingPanel.classList.remove("hidden");
                    createBtn(voteTargets, p.name, pid, submitVoteBtn, "vote");
                     
                    const skipExists = Array.from(voteTargets.children).find(c => c.dataset.pid === "SKIP");
                    if(!skipExists) {
                        const skipBtn = document.createElement("button");
                        skipBtn.innerText = "😴 SKIP VOTE";
                        skipBtn.dataset.pid = "SKIP";
                        skipBtn.className = "skipBtn";
                        skipBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            // NO SOUND
                            Array.from(voteTargets.children).forEach(c => c.classList.remove("selected"));
                            skipBtn.classList.add("selected");
                            submitVoteBtn.disabled = false;
                            submitVoteBtn.dataset.vote = "SKIP";
                        });
                        voteTargets.prepend(skipBtn);
                    }
                }
            } else if (amDead) {
                actionPanel.classList.add("hidden");
                votingPanel.classList.add("hidden");
            }
        });
    }
     
    const currentVote = (phase === "day") ? (data.votes?.[myId]) : (data.night?.mafiaVotes?.[myId]);
    const panel = (phase === "day") ? voteTargets : actionTargets;
    if (panel && currentVote) {
        Array.from(panel.children).forEach(btn => {
            if(btn.dataset.pid === currentVote) btn.classList.add("selected");
            else btn.classList.remove("selected");
        });
        if(currentVote) {
            if(phase === "day") { submitVoteBtn.disabled = false; submitVoteBtn.dataset.vote = currentVote; }
            else { submitActionBtn.disabled = false; submitActionBtn.dataset.target = currentVote; }
        }
    }
});

playersList.addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('kickBtn')) {
        e.stopPropagation();
        if(confirm(`Kick ${target.dataset.name}?`)) remove(ref(db, `room/players/${target.dataset.pid}`));
    }
    if (target.classList.contains('lateDealBtn')) {
        e.stopPropagation();
        // NO SOUND
        update(ref(db, `room/players/${target.dataset.pid}`), { role: "civilian", statusTags: "" });
    }
    if (target.classList.contains('viewRoleBtn')) {
        e.stopPropagation();
        const role = target.dataset.role;
        document.getElementById("modalRole").src = `images/${role}.png`;
        document.getElementById("modalName").innerText = target.dataset.name;
        document.getElementById("modalRoleText").innerText = `Role: ${role.toUpperCase()}`;
        document.getElementById("roleModal").classList.remove("hidden");
        document.getElementById("roleModal").classList.add("flex-visible");
    }
});

closeRoleBtn.addEventListener('click', () => {
    roleModal.classList.remove("flex-visible");
    roleModal.classList.add("hidden");
});

window.onclick = function(event) {
    if (event.target == roleModal) {
        roleModal.classList.remove("flex-visible");
        roleModal.classList.add("hidden");
    }
    if (event.target == nightResultModal) nightResultModal.classList.add("hidden");
}

nrCloseBtn.addEventListener('click', () => {
    nightResultModal.classList.add("hidden");
});

endDayBtn.addEventListener('click', async () => {
    // NO SOUND
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
    if (pending.nightDeathId) report += `💀 Night Casualty: ${getName(pending.nightDeathId, players)}\n`;
    else report += `🛡️ Night: No casualties.\n`;

    if (elimId && elimId !== "SKIP") {
        await pushTag(elimId, "ELIMINATED");
        report += `⚖️ Voted Out: ${getName(elimId, players)}\n`;
    } else if (elimId === "SKIP") {
        report += `💤 Town voted to SKIP.\n`;
    } else {
        report += `⚖️ Day: No majority/votes.\n`;
    }
     
    await remove(ref(db, "room/votes"));
    await set(ref(db, "room/publicReport"), report);
    await checkWinCondition();
});

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
    // NO SOUND
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
    // NO SOUND
    const pid = localStorage.getItem("playerId");
    const target = submitVoteBtn.dataset.vote;
    if(!target) return alert("Select a player first!");
    await set(ref(db, `room/votes/${pid}`), target);
});

onValue(ref(db, "room/publicReport"), (snap) => {
    const msg = snap.val();
    if (msg) showReport("📢 DAILY NEWS", msg);
});
