// -------------------- FIREBASE --------------------
const firebaseConfig = {
    apiKey: "AIzaSyCflm17U7JTwkEMHjfyp4G5UU29KQzVs4I",
    authDomain: "mafia-wars-online.firebaseapp.com",
    projectId: "mafia-wars-online",
    storageBucket: "mafia-wars-online.firebasestorage.app",
    messagingSenderId: "320339228878",
    appId: "1:320339228878:web:c6137210b403c19fc9389f"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// -------------------- DOM --------------------
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

// Role Modal
const roleModal = document.getElementById("roleModal");
const modalName = document.getElementById("modalName");
const modalRole = document.getElementById("modalRole");

// -------------------- STATE --------------------
let myName = "";
let mySeat = null;
let isHost = false;

// -------------------- JOIN GAME --------------------
joinHostBtn.onclick = async () => {
    myName = playerNameInput.value.trim();
    if(!myName) return alert("Enter your name");

    const hostSnap = await db.ref("game/host").once("value");
    if(hostSnap.exists()) return alert("Host already exists");

    isHost = true;
    mySeat = 0;
    await db.ref("game/host").set({name: myName});
    joinGame();
};

joinPlayerBtn.onclick = async () => {
    myName = playerNameInput.value.trim();
    if(!myName) return alert("Enter your name");

    const hostSnap = await db.ref("game/host").once("value");
    if(!hostSnap.exists()) return alert("Host not yet present");

    let seatsSnap = await db.ref("game/players").once("value");
    let seats = seatsSnap.val() || {};
    for(let i=1;i<=9;i++){
        if(!seats[i]){
            mySeat = i;
            await db.ref("game/players/"+i).set({name: myName, role:"civilian", alive:true});
            joinGame();
            return;
        }
    }
    alert("No empty seats left");
};

// -------------------- JOIN SCREEN → GAME SCREEN --------------------
function joinGame(){
    screenJoin.style.display="none";
    screenGame.style.display="flex";

    if(isHost) hostControls.style.display="block";
    renderPlayers();
    listenPlayers();
}

// -------------------- EXIT GAME --------------------
exitBtn.onclick = async ()=>{
    if(isHost){
        await db.ref("game/host").remove();
        await db.ref("game/players").remove();
    } else if(mySeat){
        await db.ref(`game/players/${mySeat}`).remove();
    }
    location.reload();
};

// -------------------- RENDER PLAYERS --------------------
function renderPlayers(){
    db.ref("game/players").on("value", snap=>{
        const players = snap.val() || {};
        playersList.innerHTML = "";
        for(let i=1;i<=9;i++){
            const div = document.createElement("div");
            div.className="playerSeat";

            if(players[i]){
                const role = players[i].role.toLowerCase();
                const img = document.createElement("img");
                img.src = (isHost || i===mySeat) ? `images/${role}.png` : `images/back.png`;

                if(!players[i].alive){
                    div.classList.add("dead");
                    img.style.filter="grayscale(100%) brightness(50%)";
                }

                const nameDiv = document.createElement("div");
                nameDiv.className="playerName";
                nameDiv.textContent = players[i].name;

                div.appendChild(img);
                div.appendChild(nameDiv);

                div.onclick = ()=>{
                    if(isHost || i===mySeat){
                        openModal(players[i].name, players[i].role);
                    }
                };
            } else {
                div.textContent="Empty";
            }

            playersList.appendChild(div);
        }
    });
}

// -------------------- LISTEN TO PLAYERS --------------------
function listenPlayers(){
    db.ref("game/host").on("value", snap=>{
        const host = snap.val();
        hostStatus.textContent = host ? `Host: ${host.name}` : "Waiting for host...";
    });
}

// -------------------- ROLE MODAL --------------------
function openModal(name, role){
    modalName.textContent = name;
    modalRole.src = `images/${role.toLowerCase()}.png`;
    roleModal.style.display="flex";
}
function closeModal(){ roleModal.style.display="none"; }

// -------------------- HOST BUTTONS --------------------
dealBtn.onclick = async ()=>{
    if(!isHost) return;
    const rolesArray = ["mafia","mafia","godfather","doctor","detective","civilian","civilian","civilian","civilian"];
    
    for(let i=rolesArray.length-1;i>0;i--){
        const j = Math.floor(Math.random()*(i+1));
        [rolesArray[i], rolesArray[j]] = [rolesArray[j], rolesArray[i]];
    }

    const seatsSnap = await db.ref("game/players").once("value");
    const seats = seatsSnap.val() || {};
    let idx=0;
    for(let i=1;i<=9;i++){
        if(seats[i]){
            await db.ref(`game/players/${i}/role`).set(rolesArray[idx]);
            idx++;
        }
    }
    alert("Roles dealt!");
};
