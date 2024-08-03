package main

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var words = []string{
	"Apple", "Bread", "Crane", "Dance", "Eagle", "Frame", "Great", "House", "Index", "Jelly",
	"Knife", "Lemon", "Mango", "Night", "Ocean", "Peach", "Quilt", "Radio", "Storm", "Tiger",
	"Union", "Value", "Water", "Yield", "Zebra", "Angel", "Berry", "Clock", "Drama",
	"Earth", "Fruit", "Glory", "Heart", "Ivory", "Joint", "Knack", "Ledge", "Magic", "Novel",
	"Olive", "Power", "Queen", "Round", "Spice", "Trust", "Urban", "Verse", "Wheat", "Xylog",
	"Youth", "Zesty", "Alley", "Bloom", "Crisp", "Dream", "Elite", "Feast", "Grove", "Happy",
	"Igloo", "Jewel", "Kiosk", "Llama", "Mirth", "Nudge", "Orbit", "Pilot", "Quiet", "Roost",
	"Shine", "Track", "Usher", "Vogue", "Whirl", "Xerox", "Yummy", "Zonal", "Abode", "Blade",
	"Charm", "Devil", "Eager", "Fable", "Gloom", "Hardy", "Inlet", "Judge", "Kinky", "Lodge",
	"Money", "Niece", "Opera", "Panic", "Quest", "River", "Shape", "Thorn", "Utter", "Vivid",
	"Worry", "Yodel", "Zebra", "Alloy", "Brace", "Chose", "Daisy", "Enact", "Flock", "Grace",
	"Honey", "Irony", "Jolly", "Kneel", "Latch", "Mirth", "Nasty", "Overt", "Plume", "Quiet",
	"Rally", "Sassy", "Twine", "Usher", "Vital", "Whisk", "Xerox", "Yield", "Zippy", "Ample",
	"Brisk", "Climb", "Drove", "Erect", "Fluke", "Ghost", "Hardy", "Inset", "Jumpy", "Knack",
	"Lodge", "Motto", "Niche", "Outer", "Prawn", "Quirk", "Relic", "Shiny", "Trust", "Unity",
	"Viral", "Woven", "Xeric", "Young", "Zephyr", "Arrow", "Brave", "Clown", "Dodge", "Exult",
	"Flame", "Gloat", "Hasty", "Impel", "Jumpy", "Knead", "Lapse", "Mirth", "Nifty", "Onset",
	"Pluck", "Quota", "Raise", "Shelf", "Torch", "Usurp", "Vigor", "Woven", "Yield",
	"Zesty", "Apple", "Blaze", "Craft", "Dread", "Elate", "Flare", "Gloom", "Handy", "Ideal",
	"Jolly", "Knelt", "Latch", "Model", "Nurse", "Oasis", "Plant",
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

var clients = make(map[string]*Player)
var nameToPlayer = make(map[string]*Player)
var broadcast = make(chan Message)
var mutex = &sync.Mutex{}
var currentWord string

type Player struct {
	Conn  *websocket.Conn
	ID    string
	Name  string
	Score int
}

type Message struct {
	Type    string `json:"type"`
	Guess   string `json:"guess"`
	Name    string `json:"name"`
	Content string `jsons:"content"`
}

type Response struct {
	Variable string `json:"currentPlayer"`
}

func handleConnections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println(err)
		return
	}
	defer conn.Close()

	clientID := r.Header.Get("Sec-WebSocket-Key")
	player := &Player{Conn: conn, ID: clientID, Score: 0}
	mutex.Lock()
	clients[clientID] = player
	mutex.Unlock()

	var nameMsg Message

	err = conn.ReadJSON(&nameMsg)
	fmt.Println("got client's name:", nameMsg.Name)
	if err != nil {
		fmt.Println("Server error reading name: ", err)
		return
	}
	player.Name = nameMsg.Name
	mutex.Lock()
	//if there are already players connected we want to tell newly connected players their names
	//so they can add them to the current players list and see them
	for existingPlayer := range nameToPlayer {
		var message Message = Message{Type: "newPlayer", Name: existingPlayer}
		player.Conn.WriteJSON(message)
	}
	nameToPlayer[player.Name] = player
	mutex.Unlock()

	for {
		var msg Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			fmt.Println("Error reading JSON:", err)
			mutex.Lock()
			delete(clients, clientID)
			delete(nameToPlayer, player.Name)
			mutex.Unlock()
			break
		}
		//if the recieved message was a word guess we just want to deal with the guess server side, no need to broadcast
		if msg.Type != "wordGuess" {
			broadcast <- msg
			if msg.Type == "startGame" {
				fmt.Println("picking current word")
				randomNum := rand.Intn(len(words))
				currentWord = strings.ToLower(words[randomNum])
				fmt.Println("current word is: ", currentWord)
				var wordMsg Message = Message{Type: "currentWord", Content: currentWord}
				broadcast <- wordMsg
			}
		} else {
			fmt.Println(msg.Name, " guessed ", msg.Guess, "with ", msg.Content, "revealed letters")
			player := nameToPlayer[msg.Name]
			revealedLetters := msg.Content
			// we want to broadcast the result of every guess to every client
			//so that we can see when anyone makes a wrong or right guess
			var message Message
			if strings.ToLower(msg.Guess) == currentWord {
				var numPoints int
				if revealedLetters == "0" {
					numPoints = 100
				}
				if revealedLetters == "1" {
					numPoints = 80
				}
				if revealedLetters == "2" {
					numPoints = 60
				}
				if revealedLetters == "3" {
					numPoints = 40
				}
				if revealedLetters == "4" {
					numPoints = 20
				}
				if revealedLetters == "5" {
					numPoints = 0
				}

				player.Score = player.Score + numPoints
				//if the guess was correct inclue the players new score in the "Guess" field of the message
				message = Message{Type: "wordAnswer", Name: msg.Name, Guess: strconv.Itoa(player.Score), Content: "1"}
				fmt.Println("sent answer: correct")
				err := player.Conn.WriteJSON(message)
				if err != nil {
					fmt.Println("Error sending message to", msg.Name, ":", err)
					mutex.Lock()
					player.Conn.Close()
					delete(clients, player.ID)
					delete(nameToPlayer, player.Name)
					mutex.Unlock()
				}
			} else {
				message = Message{Type: "wordAnswer", Name: msg.Name, Content: "0"}
				err := player.Conn.WriteJSON(message)
				fmt.Println("sent answer: wrong")
				if err != nil {
					fmt.Println("Error sending message to", msg.Name, ":", err)
					mutex.Lock()
					player.Conn.Close()
					delete(clients, player.ID)
					delete(nameToPlayer, player.Name)
					mutex.Unlock()
				}
			}
			//broadcast the answer to the guess to every client
			broadcast <- message

		}

	}
}

func handleMessages() {
	for {
		msg := <-broadcast
		mutex.Lock()
		for clientID, player := range clients {
			err := player.Conn.WriteJSON(msg)
			if err != nil {
				fmt.Println("Error writing JSON:", err)
				player.Conn.Close()
				delete(clients, clientID)
			}
		}
		mutex.Unlock()
	}
}

func main() {
	r := mux.NewRouter()

	// WebSocket endpoint
	r.HandleFunc("/ws", handleConnections)

	// Serve static files from the "public" directory
	r.PathPrefix("/").Handler(http.StripPrefix("/", http.FileServer(http.Dir("./public/"))))

	go handleMessages()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("Server started on port ", port)

	err := http.ListenAndServe(":"+port, r)
	if err != nil {
		fmt.Println("ListenAndServe:", err)
	}
}
