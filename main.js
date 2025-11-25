import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyCflm17U7JTwkEMHjfyp4G5UU29KQzVs4I",
    authDomain: "mafia-wars-online.firebaseapp.com",
    databaseURL: "https://mafia-wars-online-default-rtdb.firebaseio.com",
    projectId: "mafia-wars-online",
    storageBucket: "mafia-wars-online.appspot.com",
    messagingSenderId: "320339228878",
    appId: "1:320339228878:web:c6137210b403c19fc9389f"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM
const screenJoin = document.getElementById("screenJoin");
const screenGame = document.getElementById("screenGame");
const joinHostBtn = document.getElementById("joinHostBtn");
const joinPlayerBtn = document.getElementById("joinPlayerBtn");
const playerNameInput = document.getElementById("playerName");
const playersList = document.getElementById("playersList");
const hostControls = document.getElementById("hostControls");
const hostStatus = document.getElementById("hostStatus");
const exitBtn = document.getElementById("exitBtn");
const dealBtn = document.getElementById("dealBtn");
const resetBtn = document.getElementById("resetBtn");
const roleModal = document.getElementById("roleModal");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");

// State
let myName = "";
let mySeat = null;
let isHost = false;

// ---------- LocalStorage Restore ----------
window.onload = async () => {
    const storedName = localStorage.getItem("myName");
    const storedSeat = localStorage.getItem("mySeat");
    const storedHost = localStorage.getItem("isHost") === "true";

    if(storedName && storedSeat !== null){
        myName = storedName;
        mySeat = parseInt(storedSeat);
        isHost = storedHost;
        joinGame();
    }
};

// ---------- Join as Host ----------
joinHostBtn.onclick = async () => {
    myName = playerNameInput.value.trim();
    if(!myName) return alert("Enter your name");

    const hostSnap = await get(ref(db,"game/host"));
    if(hostSnap.exists()) return alert("Host already exists");

    isHost = true;
    mySeat = 0;
    localStorage.setItem("myName", myName);
    localStorage.setItem("mySeat", mySeat);
    localStorage.setItem("isHost", true);

    await set(ref(db,"game/host"), {name: myName});
    await set(ref(db,"game/players/0"), {name: myName, role:"host", alive:true});

    joinGame();
};

// ---------- Join as Player ----------
joinPlayerBtn.onclick = async () => {
    myName = playerNameInput.value.trim();
    if(!myName) return alert("Enter your name");

    const hostSnap = await get(ref(db,"game/host"));
    if(!hostSnap.exists()) return alert("Host not yet present");

    const seatsSnap = await get(ref(db,"game/players"));
    const seats = seatsSnap.val() || {};

    for(let i=1;i<=9;i++){
        if(!seats[i]){
            mySeat=i;
            localStorage.setItem("myName", myName);
            localStorage.setItem("mySeat", mySeat);
            localStorage.setItem("isHost", false);
            await set(ref(db,`game/players/${i}`), {name: myName, role:"civilian", alive:true});
            joinGame();
            return;
        }
    }
    alert("No empty seats left");
};

// ---------- Join Screen → Game Screen ----------
function joinGame(){
    screenJoin.style.display="none";
    screenGame.style.display="flex";
    if(isHost) hostControls.classList.remove("hidden");
    renderPlayers();
    listenPlayers();
}

// ---------- Render Players ----------
function renderPlayers(){
    onValue(ref(db, "game/players"), snap => {
        const players = snap.val() || {};
        playersList.innerHTML = "";

        // Host seat 0
        if(players[0]){
            const div = document.createElement("div");
            div.className="playerSeat";
            const img = document.createElement("img");
            img.src="images/back.png";
            const nameDiv = document.createElement("div");
            nameDiv.className="playerName";
            nameDiv.textContent = players[0].name + " (Host)";
            div.appendChild(img); div.appendChild(nameDiv);
            playersList.appendChild(div);
        }

        for(let i=1;i<=9;i++){
            const div = document.createElement("div");
            div.className="playerSeat";
            if(players[i]){
                const role = players[i].role.toLowerCase();
                const img = document.createElement("img");
                img.src = (isHost || i===mySeat) ? `images/${role}.png` : "images/back.png";
                if(!players[i].alive){div.classList.add("dead"); img.style.filter="grayscale(100%) brightness(50%)";}
                const nameDiv = document.createElement("div");
                nameDiv.className="playerName";
                nameDiv.textContent=players[i].name;
                div.appendChild(img); div.appendChild(nameDiv);
                div.onclick=()=>{if(isHost || i===mySeat){openModal(players[i].name, players[i].role);}};
            }else{
                const img = document.createElement("img"); img.src="images/back.png";
                const nameDiv = document.createElement("div"); nameDiv.className="playerName"; nameDiv.textContent="Empty";
                div.appendChild(img); div.appendChild(nameDiv);
            }
            playersList.appendChild(div);
        }
    });
}

// ---------- Listen Host ----------
function listenPlayers(){
    onValue(ref(db,"game/host"), snap=>{
        const host = snap.val();
        hostStatus.textContent = host ? `Host: ${host.name}` : "Waiting for host...";
    });
}

// ---------- Role Modal ----------
function openModal(name,role){
    modalName.textContent=name;
    modalRole.src=`images/${role.toLowerCase()}.png`;
    roleModal.style.display="flex";
}
function closeModal(){ roleModal.style.display="none"; }

// ---------- Host Buttons ----------
dealBtn.onclick=async ()=>{
    if(!isHost) return;
    const rolesArray=["mafia","mafia","godfather","doctor","detective","civilian","civilian","civilian","civilian"];
    for(let i=rolesArray.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [rolesArray[i],rolesArray[j]]=[rolesArray[j],rolesArray[i]];
    }

    const seatsSnap = await get(ref(db,"game/players"));
    const seats = seatsSnap.val() || {};
    let idx=0;
    for(let i=1;i<=9;i++){
        if(seats[i]){
            await set(ref(db,`game/players/${i}/role`), rolesArray[idx]);
            idx++;
        }
    }
    alert("Roles dealt!");
};

// ---------- Reset & Exit ----------
resetBtn.onclick=async ()=>{
    if(!isHost) return;
    await remove(ref(db,"game/host"));
    await remove(ref(db,"game/players"));
    localStorage.clear();
    location.reload();
};

exitBtn.onclick=async ()=>{
    localStorage.clear();
    if(isHost){
        await remove(ref(db,"game/host"));
        await remove(ref(db,"game/players"));
    }else if(mySeat!==null){
        await remove(ref(db,`game/players/${mySeat}`));
    }
    location.reload();
};
