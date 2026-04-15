package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"google.golang.org/api/option"
)

// Idea Model
type Idea struct {
	ID          string `json:"id" firestore:"id"`
	Title       string `json:"title" firestore:"title"`
	Description string `json:"description" firestore:"description"`
	Timestamp   int64  `json:"timestamp" firestore:"timestamp"`
}

var (
	firestoreClient *firestore.Client
	upgrader        = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	clients   = make(map[*websocket.Conn]bool)
	broadcast = make(chan Idea)
)

func initFirebase() {
	ctx := context.Background()
	var opt option.ClientOption

	// Check for environment variable first (for cloud deployment)
	serviceAccountJSON := os.Getenv("FIREBASE_SERVICE_ACCOUNT")
	if serviceAccountJSON != "" {
		opt = option.WithCredentialsJSON([]byte(serviceAccountJSON))
		fmt.Println("🔑 Using Firebase Credentials from Environment Variable")
	} else {
		// Fallback to local file
		opt = option.WithCredentialsFile("serviceAccountKey.json")
		fmt.Println("📄 Using Firebase Credentials from Local File")
	}

	app, err := firebase.NewApp(ctx, nil, opt)
	if err != nil {
		log.Fatalf("❌ FATAL: Could not initialize Firebase. \n"+
			"If you are on Render, ensure you have set the 'FIREBASE_SERVICE_ACCOUNT' environment variable with your serviceAccountKey.json content. \n"+
			"Error details: %v", err)
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("error getting Firestore client: %v", err)
	}
	firestoreClient = client
	fmt.Println("🔥 Firebase Init Successful")
}

func handleMessages() {
	for {
		msg := <-broadcast
		// Broadcast to all connected clients
		for client := range clients {
			err := client.WriteJSON(msg)
			if err != nil {
				log.Printf("error: %v", err)
				client.Close()
				delete(clients, client)
			}
		}
	}
}

func main() {
	initFirebase()
	defer firestoreClient.Close()

	r := gin.Default()

	// CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// API Routes
	r.GET("/api/ideas", func(c *gin.Context) {
		ctx := context.Background()
		iter := firestoreClient.Collection("ideas").OrderBy("timestamp", firestore.Asc).Documents(ctx)
		docs, err := iter.GetAll()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		ideas := make([]Idea, 0)
		for _, doc := range docs {
			var idea Idea
			doc.DataTo(&idea)
			ideas = append(ideas, idea)
		}
		c.JSON(http.StatusOK, ideas)
	})

	// WebSocket Route
	r.GET("/ws", func(c *gin.Context) {
		ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Print("upgrade:", err)
			return
		}
		defer ws.Close()
		clients[ws] = true

		for {
			var idea Idea
			err := ws.ReadJSON(&idea)
			if err != nil {
				log.Printf("error: %v", err)
				delete(clients, ws)
				break
			}

			// Add ID and Timestamp if missing
			if idea.ID == "" {
				idea.ID = uuid.New().String()
				idea.Timestamp = time.Now().UnixMilli()
			}

			// Save to Firestore
			ctx := context.Background()
			_, err = firestoreClient.Collection("ideas").Doc(idea.ID).Set(ctx, idea)
			if err != nil {
				log.Printf("firestore error: %v", err)
				continue
			}

			// Broadcast
			broadcast <- idea
		}
	})

	go handleMessages()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8085"
	}
	fmt.Printf("🚀 Server running on http://localhost:%s\n", port)
	r.Run(":" + port)
}
