let ws;
let enteredGame = false;
let currentWord;
let players = [];
let revealedLetters = [];
let intervalID;
let playerScores = new Map();
let playersWhoGuessRight;
let gotAnswerAlready = false;
let currentPlayersName;
let numRounds = 0;

function setupWebSocket(playerName) {
    let wsURL = "";
    if (window.location.hostname === 'localhost') {
        wsURL = "ws://localhost:8080/ws";
    } else {
        wsURL = `wss://${window.location.hostname}/ws`;
    }
    console.log("Connecting to WebSocket at:", wsURL);  // Debugging statement
    ws = new WebSocket(wsURL);

    ws.onopen = function() {
        const nameMessage = { name: playerName };
        ws.send(JSON.stringify({ type: 'newPlayer', name: playerName}));
        ws.send(JSON.stringify({ type: 'newPlayer', name: playerName}));
        console.log("WebSocket connection opened and name sent:", playerName);
    };

    ws.onmessage = function(event) {
        const message = JSON.parse(event.data);
        console.log("Received:", message);
        // Handle incoming messages
        
        //if message is newPlayer type:
        if (message.type == "newPlayer"){
            addNewPlayer(message.name);
        }

        //if message is startGame type:
        if(message.type == "startGame"){
            startGame();
        }

        //if message is currentWord
        if(message.type == "currentWord"){
            console.log("got current word");
            console.log(message)
            currentWord = message.Content
        }
        
        //if message is wordAnswer
        if(message.type == "wordAnswer"){
            //if the guess was wrong flash an X in the box above the player who guessed it
            //if the guess was right put a checkmark in the box above the player who guessed it
            //dont let them guess anymore and give them points
            console.log("received response to guess:", message);
            let playerWhoGuessed = message.name;
            let response = message.Content;
            let newScore = message.guess;
            console.log("in wordAnser:", playerWhoGuessed, response);
            console.log("proccessing a reponse for", playerWhoGuessed, "which was", response);
            let playerBoxes = document.querySelectorAll('.player-box');
            playerBoxes.forEach(playerBox => {
                let playerNameDiv = playerBox.querySelector('.name');
                if (playerNameDiv.textContent === playerWhoGuessed) {
                    let playerBoxDiv = playerBox.querySelector('.box');
                    console.log("found the player who guessed");
                    if (response == "0") {
                        // The guess was wrong, flash an X in the box
                        playerBoxDiv.textContent = '❌';
                        playerBoxDiv.classList.add('flash-wrong');
                        setTimeout(() => {
                            playerBoxDiv.classList.remove('flash-wrong');
                        }, 1000);
                    }
                    if (response == "1") {
                        // The guess was right, put a checkmark in the box
                        console.log("adding one to players who guessed right");
                        if(playerWhoGuessed != currentPlayersName){
                            playersWhoGuessRight++;
                        }
                       
                        
                        playerBoxDiv.textContent = '✅';
                        playerBoxDiv.classList.add('flash-right');
                        setTimeout(() => {
                            playerBoxDiv.classList.remove('flash-right');
                        }, 1000);

                        // Disable further guessing and give points
                        let inputBox = playerBox.querySelector('input');
                        inputBox.disabled = true;

                        if(gotAnswerAlready == false && playerWhoGuessed == currentPlayersName){ //add score to player who guessed correctly
                            gotAnswerAlready = true;
                            playersWhoGuessRight++;
                        }

                        playerScores.set(playerWhoGuessed, newScore)
                        //update the display of the players scores
                        updatePlayerScoreDisplay(playerNameDiv.textContent);
                       
                    }
                }
            });
        }
    };

    ws.onclose = function() {
        console.log("WebSocket connection closed");
    };

    ws.onerror = function(error) {
        console.log("WebSocket error:", error);
    };

}

function joinGame() {
    document.getElementById('nameModal').style.display = "flex";
}


function submitName() {
    const playerName = document.getElementById('playerName').value;
    currentPlayersName = playerName;
    if (playerName) {
        console.log("Player's name is:", playerName);
        document.getElementById('nameModal').style.display = "none";
        if(enteredGame == false){
            setupWebSocket(playerName);
            enteredGame = true;
        }else{
            alert("already joined game!")
        }
    } else {
        alert("Please enter your name");
    }
}

function addNewPlayer(playerName){
    console.log("addNewPlayer got: ", playerName);
    const playerBox = document.getElementById("playersList");
    const playerDiv = document.createElement('li');

    playerDiv.style.display = "flex";
    playerDiv.style.flexDirection = "row";
    playerDiv.style.justifyContent = "space-between";

    const playerNameDiv = document.createElement('div');
    const playerScore = document.createElement('div');

    playerScore.className = playerName + "-scoreDivPreGame";


    playerNameDiv.innerText = playerName;
    playerScore.innerText = "0";

    playerDiv.appendChild(playerNameDiv);
    playerDiv.appendChild(playerScore);

    playerBox.appendChild(playerDiv);
    players.push(playerName);
    playerScores.set(playerName, 0);

}

function startGameButtonPress(){
    ws.send(JSON.stringify({ type: 'startGame'}));
    
}


async function startGame(){
    console.log("starting game...");
    document.getElementById("preGameContainer").style.display = "none";
    document.querySelector(".nextGameButton").style.display = "none";
    //clear out revealedLetters to prepare for next game
    revealedLetters = [];
    //set playersWhoGuessedRight to 0 to prepare for next game
    playersWhoGuessRight = 0;
    gotAnswerAlready = false;
    const startGameModal = document.getElementById('startGameModal');
    startGameModal.style.display = "flex";

    const loadingBarProgress = startGameModal.querySelector('.loading-bar-progress');
    if (loadingBarProgress) {
        loadingBarProgress.style.width = '0'; // Ensure the width is reset to 0
        console.log("animating loading bar");
        // Use a small delay to trigger the transition
        setTimeout(() => {
            loadingBarProgress.style.width = '100%';
        }, 100);
    } else {
        console.log("loadingBarProgress not found");
    }
    setTimeout(() => {
        startGameModal.style.display = "none";
        // Proceed to show the game pieces or transition to the game state
        console.log("calling functions to start the game");
        showGamePieces();
        startLetterReveal();
    }, 2000);
}

function showGamePieces(){
    console.log("the current word is: ", currentWord);
    document.getElementById("inGameContainer").style.display = "flex";
    inGameContainer.innerHTML = ""; // Clear any existing content

    const underlinesContainer = document.createElement("div");
    underlinesContainer.classList.add("underlines");

    // Create five underlines
    for (let i = 0; i < 5; i++) {
        const underline = document.createElement("div");
        underline.classList.add("underline");
        underlinesContainer.appendChild(underline);
    }

    // Append the underlines container to the inGameContainer
    inGameContainer.appendChild(underlinesContainer);
    inGameContainer.style.color = "white";

    // Create the players container
    const playersContainer = document.createElement("div");
    playersContainer.classList.add("player-container");

    players.forEach(player => {
        const playerDiv = document.createElement("div");
        playerDiv.classList.add("player-box");

        const boxDiv = document.createElement("div");
        boxDiv.classList.add("box");

        const scoreDiv = document.createElement("div");
        scoreDiv.classList.add(player +"-scoreDivInGame");
        
        scoreDiv.innerText = playerScores.get(player);

        const nameDiv = document.createElement("div");
        nameDiv.classList.add("name");
        nameDiv.textContent = player;

        const inputDiv = document.createElement("div");
        inputDiv.classList.add("input-box");
        const input = document.createElement("input");
        input.setAttribute("type", "text");
        input.setAttribute("placeholder", "Guess");
        input.setAttribute("size", "5");

        // Add event listener for "Enter" key
        input.addEventListener("keydown", function(event) {
            if (event.key === "Enter") {
                handleGuess(player, input.value, revealedLetters.length);
                input.value = ""; // Clear the input box
            }
        });

        inputDiv.appendChild(input);
        playerDiv.appendChild(boxDiv);
        playerDiv.appendChild(scoreDiv);
        playerDiv.appendChild(nameDiv);
        playerDiv.appendChild(inputDiv);
        playersContainer.appendChild(playerDiv);
    });

    // Append the players container to the inGameContainer
    inGameContainer.appendChild(playersContainer);
}

function startLetterReveal() {
    console.log("startLetter reveal is running");
    if (intervalID) {
        clearInterval(intervalID);
    }
    intervalID = setInterval(() => {

        console.log("revealing a letter...");
        console.log("players who guess right:", playersWhoGuessRight)
        let index;
        do {
            index = Math.floor(Math.random() * 5);
        } while (revealedLetters.includes(index));

        revealedLetters.push(index);

        const underlines = document.querySelectorAll('.underline');
        if (underlines[index]) {
            underlines[index].textContent = currentWord[index];
            underlines[index].style.backgroundColor = "transparent";

        }

        if (revealedLetters.length === 5 || playersWhoGuessRight === players.length) {
            //the current game round is over
            clearInterval(intervalID);
            //populate the leader board so the next round loading screen shows placements
            populateLeaderBoard();

            setTimeout(() => {
             

                //hide the inGames stuff for next round screen
                document.getElementById("inGameContainer").style.display = "none";
                //show the next round game button
                document.querySelector(".nextGameButton").style.display = "flex";
                //show the leaderboard
                document.getElementById("leaderboard").style.display = "flex";
            }, 1000);

        }
    }, 8000);
}

function handleGuess(playerName, wordGuess, numOfRevealedLetters){
    ws.send(JSON.stringify({ type: 'wordGuess', guess: wordGuess, name: playerName, content: numOfRevealedLetters.toString()}));
}

function updatePlayerScoreDisplay(player){
    //finish this function
    const playerScoreDivInGame = document.querySelector("."+player+"-scoreDivInGame");
    const playerScoreDivPreGame = document.querySelector("."+player+"-scoreDivPreGame");

    console.log(`updated player ${player} who now has points ${playerScores.get(player)}`);
    playerScoreDivInGame.innerText = playerScores.get(player);
    playerScoreDivPreGame.innerText = playerScores.get(player);
}


function populateLeaderBoard(){
    const leaderBoard = document.getElementById("leaderboard");
    leaderBoard.innerHTML = "";


    const leaderBoardHeader = document.createElement('h4');
    leaderBoardHeader.innerText = "LEADERBOARD";

    const leaderBoardList = document.createElement('ul');
    leaderBoardList.id = "leaderboardList";

    const sortedPlayers = [...playerScores.entries()].sort((a, b) => {
        return parseInt(b[1]) - parseInt(a[1]);
    });

    let placement = 1;   

    
    sortedPlayers.forEach(([player, score]) => {
        const listItem = document.createElement('li');
        listItem.textContent = `${placement}. ${player}: ${score}`;
        placement++;
        leaderBoardList.appendChild(listItem);
    });

    leaderBoard.appendChild(leaderBoardHeader);
    leaderBoard.appendChild(leaderBoardList);
    
}

function startNextRound(){  
    //this starts the next gaming round
    console.log("start next round which is round:", numRounds);

    //max of 10 rounds
    if (numRounds < 10){
        //hide the leader board
        document.getElementById("leaderboard").style.display = "none";
        //hide to next round button
        document.querySelector(".nextGameButton").style.display = "none";

        startGameButtonPress();   
    }else{
        document.getElementById("leaderboard").style.display = "none";
        //make winning animation
    }
    numRounds++;
}