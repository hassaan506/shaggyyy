import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, remove } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyCflm17U7JTwkEMHjfyp4G5UU29KQzVs4",
  authDomain: "mafia-wars-online.firebaseapp.com",
  projectId: "mafia-wars-online",
  storageBucket: "mafia-wars-online.firebasestorage.app",
  messagingSenderId: "320339228878",
  appId: "1:320339228878:web:c6137210b403c19fc9389f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- Global vars ---
let playerName = '';
let isHost = false;
let mySeat = null;
let gameState = null;
const maxPlayers = 9;
let roles = ["Mafia","Detective","Doctor","Grandma","Civilian","Civilian","Civilian","Civilian","Civilian"];
let mafiaTarget = null;
let doctorSave = null;
let detectiveCheck = null;

// --- Join Game ---
document.getElementById('joinHost').onclick = async () => {
  playerName = document.getElementById('playerName').value.trim();
  if(!playerName) return alert("Enter name");
  const hostSnap = await get(ref(db, 'host'));
  if(hostSnap.exists()) return alert("Host already exists");
  isHost = true;
  await set(ref(db, 'host'), playerName);
  showGameScreen();
};

document.getElementById('joinPlayer').onclick = async () => {
  playerName = document.getElementById('playerName').value.trim();
  if(!playerName) return alert("Enter name");
  const playersSnap = await get(ref(db, 'players'));
  const playersData = playersSnap.val() || {};
  if(Object.keys(playersData).length >= maxPlayers) return alert("Max players reached");

  let assignedSeat = 1;
  const seatsTaken = Object.keys(playersData).map(Number);
  while(seatsTaken.includes(assignedSeat) && assignedSeat <= maxPlayers) assignedSeat++;
  if(assignedSeat > maxPlayers) return alert("No seat available");

  mySeat = assignedSeat;
  await set(ref(db, `players/${assignedSeat}`), {name: playerName, role: null, alive: true, vote: null});
  showGameScreen();
};

// --- Show Game Screen ---
function showGameScreen() {
  document.getElementById('join-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  if(isHost) document.getElementById('hostControls').classList.remove('hidden');
  listenGameState();
}

// --- Host Controls ---
document.getElementById('dealCards').onclick = async () => {
  shuffle(roles);
  const playersSnap = await get(ref(db, 'players'));
  const playersData = playersSnap.val();
  let i = 0;
  for(const seat in playersData){
    await set(ref(db, `players/${seat}/role`), roles[i++]);
  }
  await set(ref(db, 'game/state'), 'night');
};

document.getElementById('resetGame').onclick = async () => {
  await remove(ref(db, 'players'));
  await remove(ref(db, 'host'));
  await remove(ref(db, 'game'));
  location.reload();
};

document.getElementById('transferHost').onclick = async () => {
  const playersSnap = await get(ref(db, 'players'));
  const playersData = playersSnap.val();
  const firstSeat = Object.keys(playersData)[0];
  if(firstSeat){
    await set(ref(db, 'host'), playersData[firstSeat].name);
    alert(`Host transferred to ${playersData[firstSeat].name}`);
  }
};

document.getElementById('exitGame').onclick = () => location.reload();
document.getElementById('toggleMode').onclick = () => document.body.classList.toggle('light-mode');

// --- Shuffle ---
function shuffle(array){
  for(let i=array.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// --- Firebase Listeners ---
function listenGameState(){
  onValue(ref(db, 'players'), snapshot => renderPlayers(snapshot.val() || {}));
  onValue(ref(db, 'game/state'), snapshot => {
    gameState = snapshot.val();
    renderGameActions();
  });
}

// --- Render Players with cards ---
function renderPlayers(playersData){
  const container = document.getElementById('playersList');
  container.innerHTML = '';
  for(let i=1;i<=maxPlayers;i++){
    const player = playersData[i];
    const div = document.createElement('div');
    div.classList.add('player-seat');

    if(player){
      const img = document.createElement('img');
      if(isHost || mySeat===i) img.src = `images/${player.role.toLowerCase()}.png`;
      else img.src = 'images/back.png';

      const nameText = document.createElement('div');
      nameText.textContent = player.name + (player.alive?'':' ☠️');

      div.appendChild(img);
      div.appendChild(nameText);

      if(player.alive && !isHost && gameState==='day'){
        const voteBtn = document.createElement('button');
        voteBtn.classList.add('voteButton');
        voteBtn.textContent = 'Vote';
        voteBtn.onclick = () => castVote(i);
        div.appendChild(voteBtn);
      }

    } else div.textContent='Empty';

    container.appendChild(div);
  }
}

// --- Voting ---
function castVote(seat){
  if(mySeat) set(ref(db, `players/${mySeat}/vote`), seat);
}

// --- Game Actions ---
async function renderGameActions(){
  const container = document.getElementById('gameActions');
  container.innerHTML = `<p>Game state: ${gameState||'Waiting'}</p>`;
  if(gameState==='night' && isHost) handleNightPhase();
  else if(gameState==='day') container.innerHTML += `<p>Discuss and vote to eliminate players.</p>`;
}

// --- Night Phase Skeleton ---
async function handleNightPhase(){
  const container = document.getElementById('gameActions');
  container.innerHTML = `<p>Night phase: handle Mafia, Doctor, Detective actions here</p>`;
  // You can now implement Mafia vote → Doctor save → Detective check → Grandma → resolve kills
}
