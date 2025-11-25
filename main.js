import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  child,
  onValue,
  remove,
  push,
  update,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";

// ---------------------------------------------
// FIREBASE CONFIG (your existing config preserved)
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

// ---------------------------------------------
// ELEMENTS
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
const cleanBtn = document.getElementById("cleanBtn");

const actionPanel = document.getElementById("actionPanel");
const actionInstruction = document.getElementById("actionInstruction");
const actionTargets = document.getElementById("actionTargets");
const submitActionBtn = document.getElementById("submitActionBtn");
const actionStatus = document.getElementById("actionStatus");

const votingPanel = document.getElementById("votingPanel");
const voteTargets = document.getElementById("voteTargets");
const submitVoteBtn = document.getElementById("submitVoteBtn");
const voteStatus = document.getElementById("voteStatus");

const phaseText = document.getElementById("phaseText");
const gameLog = document.getElementById("gameLog");

const roleModal = document.getElementById("roleModal");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");
const modalRoleText = document.getElementById("modalRoleText");

const exitBtn = document.getElementById("exitBtn");

// ---------------------------------------------
// CLIENT STATE
let myId = null;
let myName = null;
let isHost = false;
let myRole = null;
let myAlive = true;
let selectedActionTarget = null;
let selectedVoteTarget = null;

// lastSeen heartbeat
let heartbeatInterval = null;

// ---------------------------------------------
// UTIL: Timestamp
function nowTs() {
  return Date.now();
}

// ---------------------------------------------
// AUTO RESTORE SESSION
window.onload = () => {
  const savedName = localStorage.getItem("name");
  const savedId = localStorage.getItem("playerId");
  if (savedName && savedId) {
    myId = savedId;
    myName = savedName;
    isHost = localStorage.getItem("isHost") === "true";
    screenJoin.classList.add("hidden");
    screenGame.classList.remove("hidden");
    startHeartbeat();
  }
};

// ---------------------------------------------
// JOIN HOST
joinHostBtn.onclick = async () => {
  const name = playerNameInput.value.trim();
  if (!name) return alert("Enter host name.");

  const snap = await get(ref(db, "room/host"));
  if (snap.exists()) return alert("Host already exists.");

  await set(ref(db, "room/host"), { name });
  // initialize room metadata if missing
  await update(ref(db, "room"), { gamePhase: "day", dayNumber: 0, log: "" });

  localStorage.setItem("playerId", "HOST");
  localStorage.setItem("name", name);
  localStorage.setItem("isHost", "true");

  myId = "HOST";
  myName = name;
  isHost = true;

  screenJoin.classList.add("hidden");
  screenGame.classList.remove("hidden");
  startHeartbeat();
};

// ---------------------------------------------
// JOIN PLAYER
joinPlayerBtn.onclick = async () => {
  const name = playerNameInput.value.trim();
  if (!name) return alert("Enter your name.");

  const playersRef = ref(db, "room/players");
  const newPlayer = push(playersRef);
  await set(newPlayer, { name, role: null, alive: true, lastSeen: nowTs() });

  localStorage.setItem("playerId", newPlayer.key);
  localStorage.setItem("name", name);
  localStorage.setItem("isHost", "false");

  myId = newPlayer.key;
  myName = name;
  isHost = false;

  screenJoin.classList.add("hidden");
  screenGame.classList.remove("hidden");
  startHeartbeat();
};

// ---------------------------------------------
// HEARTBEAT: update lastSeen every 20s
function startHeartbeat() {
  if (!myId || myId === "HOST") {
    // Host we don't store a player entry, but can set host.lastSeen
    if (myId === "HOST") {
      update(ref(db, "room/host"), { lastSeen: nowTs() }).catch(()=>{});
      heartbeatInterval = setInterval(() => {
        update(ref(db, "room/host"), { lastSeen: nowTs() }).catch(()=>{});
      }, 20000);
    }
    return;
  }
  // first set
  update(ref(db, `room/players/${myId}`), { lastSeen: nowTs() }).catch(()=>{});
  heartbeatInterval = setInterval(() => {
    update(ref(db, `room/players/${myId}`), { lastSeen: nowTs() }).catch(()=>{});
  }, 20000);
}

window.addEventListener("beforeunload", async () => {
  // update lastSeen to 0 to mark leaving
  try {
    if (myId && myId !== "HOST") await update(ref(db, `room/players/${myId}`), { lastSeen: 0 });
    if (myId === "HOST") await update(ref(db, "room/host"), { lastSeen: 0 });
  } catch (e) {}
});

// ---------------------------------------------
// RENDER GAME (sync)
onValue(ref(db, "room"), (snap) => {
  const data = snap.val();
  if (!data) return;

  const players = data.players || {};
  const host = data.host || null;
  const phase = data.gamePhase || "day";

  phaseText.innerText = phase.charAt(0).toUpperCase() + phase.slice(1);

  hostStatus.innerText = host ? ("Host: " + host.name) : "Waiting for host...";
  hostName.innerText = host ? host.name : "";

  // determine role & alive for this client
  if (myId && myId !== "HOST") {
    const me = players[myId];
    if (me) {
      myRole = me.role;
      myAlive = me.alive !== false;
    }
  } else if (myId === "HOST") {
    myRole = "host";
    myAlive = true;
  }

  // show/hide host controls
  hostControls.classList.toggle("hidden", !isHost);

  // Render players grid (respect role visibility)
  playersList.innerHTML = "";
  Object.entries(players).forEach(([pid, player]) => {
    const canSeeCard = isHost || pid === myId;
    const cardImage = canSeeCard && player.role ? player.role : "back";

    const div = document.createElement("div");
    div.classList.add("playerCard");
    div.dataset.pid = pid;

    const aliveText = player.alive === false ? "Dead" : "Alive";

    div.innerHTML = `
      <h3>${escapeHtml(player.name)}</h3>
      <img src="images/${cardImage}.png" alt="card">
      <p>${aliveText}</p>
    `;

    div.onclick = () => {
      // host can open any, players only own card, dead players can still view own card
      if (isHost || pid === myId) {
        modalName.innerText = player.name;
        modalRole.src = `images/${(isHost || pid === myId) && player.role ? player.role : "back"}.png`;
        modalRoleText.innerText = (isHost || pid === myId) && player.role ? `Role: ${player.role}` : "Role: Hidden";
        roleModal.style.display = "flex";
      }
    };

    playersList.appendChild(div);
  });

  // Game log (map simple string entries)
  const logObj = data.log || "";
  const logs = typeof logObj === "string" ? (logObj ? logObj.split("\n") : []) : (logObj.entries || []);
  gameLog.innerHTML = "";
  logs.slice(-20).forEach(l => {
    if (!l) return;
    const li = document.createElement("li");
    li.innerText = l;
    gameLog.appendChild(li);
  });

  // Phase-specific UI
  setupPhaseUI(phase, data);
});

// ---------------------------------------------
// Phase UI: show appropriate panels & instructions
async function setupPhaseUI(phase, roomData) {
  // reset selection state
  selectedActionTarget = null;
  selectedVoteTarget = null;
  submitActionBtn.disabled = true;
  submitVoteBtn.disabled = true;
  actionTargets.innerHTML = "";
  voteTargets.innerHTML = "";
  actionStatus.innerText = "";
  voteStatus.innerText = "";

  if (phase === "night") {
    // only show actionPanel for alive players who have a night role
    if (!myAlive) {
      actionPanel.classList.remove("hidden");
      actionInstruction.innerText = "You are dead — no night actions.";
      actionTargets.innerHTML = "";
      submitActionBtn.disabled = true;
    } else if (myRole === "mafia" || myRole === "godfather") {
      // mafia action: choose a target (alive non-mafia)
      actionPanel.classList.remove("hidden");
      actionInstruction.innerText = "Mafia: Choose a player to kill.";
      const players = roomData.players || {};
      // create target buttons (alive players excluding mafia members)
      createActionTargetButtons(players, (pid, name) => {
        // allow targeting alive non-mafia and not self
        return players[pid].alive !== false && !(players[pid].role && (players[pid].role === "mafia" || players[pid].role === "godfather"));
      });
      // check if player already submitted
      const maActionSnap = await get(ref(db, "room/nightActions/mafia"));
      if (maActionSnap.exists()) {
        const map = maActionSnap.val();
        if (map && map[myId]) {
          actionStatus.innerText = "Action submitted.";
          submitActionBtn.disabled = true;
        }
      }
    } else if (myRole === "doctor") {
      actionPanel.classList.remove("hidden");
      actionInstruction.innerText = "Doctor: Choose someone to save.";
      createActionTargetButtons(roomData.players || {}, () => true);
      const docSnap = await get(ref(db, `room/nightActions/doctor/${myId}`));
      if (docSnap.exists()) {
        actionStatus.innerText = "Action submitted.";
        submitActionBtn.disabled = true;
      }
    } else if (myRole === "detective") {
      actionPanel.classList.remove("hidden");
      actionInstruction.innerText = "Detective: Choose someone to investigate.";
      createActionTargetButtons(roomData.players || {}, (pid) => {
        // can investigate anyone except self ideally
        return pid !== myId;
      });
      const detSnap = await get(ref(db, `room/nightActions/detective/${myId}`));
      if (detSnap.exists()) {
        actionStatus.innerText = "Action submitted.";
        submitActionBtn.disabled = true;
      }
    } else {
      // civilians, host or roles without night action
      actionPanel.classList.add("hidden");
    }

    // voting panel hidden during night
    votingPanel.classList.add("hidden");

    // style
    document.body.classList.add("night");
    document.body.classList.remove("day");
  } else {
    // DAY phase
    actionPanel.classList.add("hidden");

    // Show voting panel for alive players
    if (myAlive) {
      votingPanel.classList.remove("hidden");
      voteInstructionSetup(roomData);
      // show existing vote status
      const myVoteSnap = await get(ref(db, `room/dayVotes/${myId}`));
      if (myVoteSnap.exists()) {
        voteStatus.innerText = "Vote submitted.";
        submitVoteBtn.disabled = true;
      }
    } else {
      votingPanel.classList.remove("hidden");
      voteTargets.innerHTML = "";
      voteInstructionSetup(roomData); // shows disabled info
      voteStatus.innerText = "You are dead — cannot vote.";
      submitVoteBtn.disabled = true;
    }

    document.body.classList.add("day");
    document.body.classList.remove("night");
  }
}

// ---------------------------------------------
// Create Action Target Buttons (reused by doctor/detective/mafia)
function createActionTargetButtons(playersObj, filterFn) {
  actionTargets.innerHTML = "";
  const entries = Object.entries(playersObj || {});
  entries.forEach(([pid, p]) => {
    if (!filterFn(pid, p.name)) return;
    const btn = document.createElement("button");
    btn.className = "targetBtn";
    btn.innerText = p.name + (p.alive === false ? " (dead)" : "");
    btn.disabled = p.alive === false;
    btn.onclick = () => {
      // select
      [...actionTargets.children].forEach(c => c.classList.remove("selected"));
      btn.classList.add("selected");
      selectedActionTarget = pid;
      submitActionBtn.disabled = false;
    };
    actionTargets.appendChild(btn);
  });
}

// ---------------------------------------------
// Setup vote targets
function voteInstructionSetup(roomData) {
  voteTargets.innerHTML = "";
  const players = roomData.players || {};
  Object.entries(players).forEach(([pid, p]) => {
    if (p.alive === false) return;
    const btn = document.createElement("button");
    btn.className = "targetBtn";
    btn.innerText = p.name;
    btn.onclick = () => {
      [...voteTargets.children].forEach(c => c.classList.remove("selected"));
      btn.classList.add("selected");
      selectedVoteTarget = pid;
      submitVoteBtn.disabled = false;
    };
    voteTargets.appendChild(btn);
  });
}

// ---------------------------------------------
// SUBMIT NIGHT ACTION (player side)
submitActionBtn.onclick = async () => {
  if (!selectedActionTarget) return;
  const phaseSnap = await get(ref(db, "room/gamePhase"));
  if (!phaseSnap.exists() || phaseSnap.val() !== "night") {
    actionStatus.innerText = "Night is not active.";
    return;
  }

  if (!myRole) return alert("No role assigned.");

  // store under room/nightActions/{role}/{playerId} = targetPid
  const roleKey = (myRole === "godfather") ? "mafia" : myRole; // godfather acts as mafia for target
  await set(ref(db, `room/nightActions/${roleKey}/${myId}`), selectedActionTarget);
  actionStatus.innerText = "Action submitted.";
  submitActionBtn.disabled = true;
};

// ---------------------------------------------
// SUBMIT DAY VOTE
submitVoteBtn.onclick = async () => {
  if (!selectedVoteTarget) return;
  const phaseSnap = await get(ref(db, "room/gamePhase"));
  if (!phaseSnap.exists() || phaseSnap.val() !== "day") {
    voteStatus.innerText = "Day is not active.";
    return;
  }
  // write vote
  await set(ref(db, `room/dayVotes/${myId}`), selectedVoteTarget);
  voteStatus.innerText = "Vote submitted.";
  submitVoteBtn.disabled = true;
};

// ---------------------------------------------
// HOST: Deal roles (improved: pad with civilians if more players)
dealBtn.onclick = async () => {
  if (!isHost) return alert("Only host can deal roles.");

  const snap = await get(ref(db, "room/players"));
  if (!snap.exists()) return alert("No players to deal.");

  const players = Object.entries(snap.val());
  const count = players.length;

  // base role template for classic mafia; adjust counts by player count heuristics
  // recommended: 7+ players: 2 mafia, 1 godfather, 1 doc, 1 detective, rest civilians
  let roles = [];
  if (count <= 6) {
    // small: 1 mafia, 1 doctor, 1 detective, rest civs
    roles = ["mafia", "doctor", "detective"];
  } else if (count <= 9) {
    roles = ["mafia","mafia","godfather","doctor","detective"];
  } else {
    // larger: 3 mafia (2 mafia + godfather) etc.
    roles = ["mafia","mafia","godfather","doctor","detective","mafia"];
  }
  // pad rest with civilians
  while (roles.length < count) roles.push("civilian");
  // shuffle
  roles.sort(() => Math.random() - 0.5);

  // assign
  for (let i = 0; i < players.length; i++) {
    const [pid] = players[i];
    await update(ref(db, `room/players/${pid}`), { role: roles[i], alive: true });
  }
  // clear any previous actions/votes/history
  await remove(ref(db, "room/nightActions"));
  await remove(ref(db, "room/dayVotes"));
  await update(ref(db, "room"), { gamePhase: "day", dayNumber: 0, log: "Game started\n" });
  alert("Roles dealt.");
};

// shuffle
shuffleBtn.onclick = dealBtn;

// ---------------------------------------------
// HOST: Reset
resetBtn.onclick = async () => {
  if (!confirm("Reset game and remove all data?")) return;
  await remove(ref(db, "room"));
  localStorage.clear();
  location.reload();
};

// ---------------------------------------------
// HOST: Start Night
nightBtn.onclick = async () => {
  if (!isHost) return alert("Only host can change phase.");
  // reset night actions container
  await remove(ref(db, "room/nightActions"));
  // increment dayNumber to track
  const daySnap = await get(ref(db, "room/dayNumber"));
  const currentDay = (await get(ref(db, "room/dayNumber"))).exists() ? (await get(ref(db, "room/dayNumber"))).val() : 0;
  await update(ref(db, "room"), { gamePhase: "night" });
};

// ---------------------------------------------
// HOST: Resolve Night and start Day
dayBtn.onclick = async () => {
  if (!isHost) return alert("Only host can change phase.");
  const phaseSnap = await get(ref(db, "room/gamePhase"));
  const currentPhase = phaseSnap.exists() ? phaseSnap.val() : "day";
  if (currentPhase === "night") {
    // resolve night actions
    await resolveNightActions();
  }
  // then set phase to day
  // increment dayNumber
  const dnSnap = await get(ref(db, "room/dayNumber"));
  const dn = dnSnap.exists() ? dnSnap.val() + 1 : 1;
  await update(ref(db, "room"), { gamePhase: "day", dayNumber: dn });
};

// ---------------------------------------------
// HOST: Resolve Night logic
async function resolveNightActions() {
  // Gather actions
  const nightSnap = await get(ref(db, "room/nightActions"));
  const playersSnap = await get(ref(db, "room/players"));
  const players = playersSnap.exists() ? playersSnap.val() : {};
  const nightActions = nightSnap.exists() ? nightSnap.val() : {};

  // mafia votes are map of pid->targetPid
  const mafiaMap = nightActions.mafia || {};
  const doctorMap = nightActions.doctor || {};
  const detectiveMap = nightActions.detective || {};

  // compute mafia chosen target by majority among mafia submissions
  const tgtCounts = {};
  Object.values(mafiaMap).forEach(t => {
    if (!t) return;
    tgtCounts[t] = (tgtCounts[t] || 0) + 1;
  });
  let mafiaTarget = null;
  let max = 0;
  Object.entries(tgtCounts).forEach(([k, v]) => { if (v > max) { max = v; mafiaTarget = k; }});

  // doctor: choose the doctor save target (if multiple doctors someday pick last or majority) - pick most common
  const docCounts = {};
  Object.values(doctorMap).forEach(t => { if (!t) return; docCounts[t] = (docCounts[t]||0) + 1; });
  let doctorSave = null;
  max = 0;
  Object.entries(docCounts).forEach(([k, v]) => { if (v > max) { max = v; doctorSave = k; }});

  // detective checks: for each detective submitter, set a result in room/nightResults/detective/{detectorPid} = {targetPid, role}
  const updates = {};
  if (detectiveMap) {
    Object.entries(detectiveMap).forEach(([detPid, targetPid]) => {
      if (!targetPid) return;
      const targetRole = players[targetPid] ? players[targetPid].role : null;
      updates[`room/nightResults/detective/${detPid}`] = { target: targetPid, role: targetRole || null };
    });
  }

  // Now determine if mafiaTarget dies (unless doctor saved)
  let killed = null;
  if (mafiaTarget) {
    if (doctorSave && doctorSave === mafiaTarget) {
      // saved
      killed = null;
    } else {
      // kill victim (if alive)
      if (players[mafiaTarget] && players[mafiaTarget].alive !== false) {
        updates[`room/players/${mafiaTarget}/alive`] = false;
        killed = mafiaTarget;
      }
    }
  }

  // append to game log
  let logAdd = "";
  if (killed) {
    logAdd += `${players[killed].name} was killed at night.\n`;
  } else if (mafiaTarget) {
    logAdd += `${players[mafiaTarget] ? players[mafiaTarget].name : mafiaTarget} was targeted but saved.\n`;
  } else {
    logAdd += `No mafia action tonight.\n`;
  }

  // write results and clear night actions
  if (Object.keys(updates).length) {
    await update(ref(db), updates);
  }
  // keep a combined log string under room.log (append)
  const roomSnap = await get(ref(db, "room/log"));
  const prevLog = roomSnap.exists() ? roomSnap.val() + "" : "";
  await set(ref(db, "room/log"), (prevLog || "") + logAdd);

  // clear night actions and doctor/detective results remain for detectives to read
  await remove(ref(db, "room/nightActions"));
}

// ---------------------------------------------
// HOST: Remove inactive players (idle > 120s)
cleanBtn.onclick = async () => {
  if (!isHost) return alert("Only host can remove inactive players.");
  const playersSnap = await get(ref(db, "room/players"));
  if (!playersSnap.exists()) return alert("No players found.");

  const players = playersSnap.val();
  const threshold = nowTs() - 120000; // 2 minutes
  let removed = 0;
  for (const [pid, p] of Object.entries(players)) {
    const last = p.lastSeen || 0;
    if (last === 0 || last < threshold) {
      await remove(ref(db, `room/players/${pid}`));
      removed++;
    }
  }
  alert(`Removed ${removed} inactive player(s).`);
};

// ---------------------------------------------
// VOTE RESOLUTION (host) - when host wants to resolve day voting manually
// We eliminate top voted player (tie => no elimination)
async function resolveDayVotes() {
  const votesSnap = await get(ref(db, "room/dayVotes"));
  const playersSnap = await get(ref(db, "room/players"));
  if (!votesSnap.exists() || !playersSnap.exists()) return;
  const votes = votesSnap.val() || {};
  const players = playersSnap.val() || {};

  const counts = {};
  Object.values(votes).forEach(v => { if (!v) return; counts[v] = (counts[v] || 0) + 1; });

  // find max
  let max = 0;
  let top = [];
  Object.entries(counts).forEach(([pid, c]) => {
    if (c > max) { max = c; top = [pid]; }
    else if (c === max) top.push(pid);
  });

  let eliminated = null;
  if (top.length === 1 && max > 0) {
    // eliminate top[0]
    const pid = top[0];
    if (players[pid] && players[pid].alive !== false) {
      await update(ref(db, `room/players/${pid}`), { alive: false });
      eliminated = pid;
    }
  }

  // append to log
  let logAdd = "";
  if (eliminated) logAdd += `${players[eliminated].name} was lynched by vote.\n`;
  else logAdd += `No lynch (tie or no votes).\n`;
  const roomSnap = await get(ref(db, "room/log"));
  const prevLog = roomSnap.exists() ? roomSnap.val() + "" : "";
  await set(ref(db, "room/log"), (prevLog || "") + logAdd);

  // clear votes
  await remove(ref(db, "room/dayVotes"));
}

// When host presses Day button we already call resolveNightActions then set gamePhase day
// Add watch for day phase set to run resolveDayVotes optionally? We keep host-driven.


// ---------------------------------------------
// WATCH: nightResults for detective messages & dayVotes to update UI
onValue(ref(db, "room/nightResults/detective"), (snap) => {
  if (!snap.exists()) return;
  const res = snap.val();
  // If this client is detective and got a result for them, show small notification
  if (myRole === "detective" && myId) {
    const myRes = res[myId];
    if (myRes) {
      const playersRef = ref(db, `room/players/${myRes.target}`);
      get(playersRef).then(s => {
        const name = s.exists() ? s.val().name : "Unknown";
        const role = myRes.role || "Unknown";
        // append to game log (private knowledge isn't saved publicly besides room/nightResults; but we also push a short log)
        appendLog(`Detective: ${name} is ${role}`);
        // remove the result so it doesn't spam
        remove(ref(db, `room/nightResults/detective/${myId}`)).catch(()=>{});
      });
    }
  }
});

// helper: append public log
async function appendLog(text) {
  const roomSnap = await get(ref(db, "room/log"));
  const prevLog = roomSnap.exists() ? roomSnap.val() + "" : "";
  await set(ref(db, "room/log"), (prevLog || "") + text + "\n");
}

// ---------------------------------------------
// MODAL
window.closeModal = function() {
  roleModal.style.display = "none";
};

// ---------------------------------------------
// EXIT
exitBtn.onclick = async () => {
  localStorage.clear();
  location.reload();
};

// ---------------------------------------------
// Safety helpers
function escapeHtml(unsafe) {
  return (unsafe + "").replace(/[&<"'>]/g, function (m) {
    return ({ '&': '&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[m];
  });
}
