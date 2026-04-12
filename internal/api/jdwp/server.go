package jdwp

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"cli-debugger/pkg/types"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// WebSocketServer handles WebSocket connections for event streaming
type WebSocketServer struct {
	port        int
	eventStream *EventStream
	clients     map[*websocket.Conn]bool
	mu          sync.Mutex
}

// NewWebSocketServer creates a new WebSocket server
func NewWebSocketServer(port int, eventStream *EventStream) *WebSocketServer {
	return &WebSocketServer{
		port:        port,
		eventStream: eventStream,
		clients:     make(map[*websocket.Conn]bool),
	}
}

// Start starts the WebSocket server
func (ws *WebSocketServer) Start() error {
	subID := "websocket-server"
	eventChan := ws.eventStream.Subscribe(subID)
	defer ws.eventStream.Unsubscribe(subID)

	go ws.broadcastEvents(eventChan)

	http.HandleFunc("/ws", ws.handleWebSocket)
	return http.ListenAndServe(fmt.Sprintf(":%d", ws.port), nil)
}

// handleWebSocket handles incoming WebSocket connections
func (ws *WebSocketServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	ws.mu.Lock()
	ws.clients[conn] = true
	ws.mu.Unlock()

	defer func() {
		ws.mu.Lock()
		delete(ws.clients, conn)
		ws.mu.Unlock()
	}()

	// Keep connection alive
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// broadcastEvents sends events to all connected WebSocket clients
func (ws *WebSocketServer) broadcastEvents(eventChan <-chan *types.DebugEvent) {
	for event := range eventChan {
		data, err := json.Marshal(event)
		if err != nil {
			continue
		}

		ws.mu.Lock()
		for conn := range ws.clients {
			err := conn.WriteMessage(websocket.TextMessage, data)
			if err != nil {
				delete(ws.clients, conn)
				conn.Close()
			}
		}
		ws.mu.Unlock()
	}
}
