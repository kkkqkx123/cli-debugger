package jdwp

import (
	"context"
	"fmt"
	"sync"
	"time"

	"cli-debugger/pkg/types"
)

// EventStream manages event streaming for JDWP protocol
type EventStream struct {
	client      *Client
	eventChan   chan *types.DebugEvent
	subscribers map[string]chan *types.DebugEvent
	mu          sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc
	active      bool
}

// NewEventStream creates a new event stream manager
func NewEventStream(client *Client) *EventStream {
	ctx, cancel := context.WithCancel(context.Background())
	return &EventStream{
		client:      client,
		eventChan:   make(chan *types.DebugEvent, 100),
		subscribers: make(map[string]chan *types.DebugEvent),
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start begins listening for JDWP events
func (es *EventStream) Start() error {
	es.mu.Lock()
	defer es.mu.Unlock()

	if es.active {
		return fmt.Errorf("event stream already active")
	}

	es.active = true
	go es.eventLoop()
	return nil
}

// Stop stops the event stream
func (es *EventStream) Stop() {
	es.mu.Lock()
	defer es.mu.Unlock()

	if !es.active {
		return
	}

	es.active = false
	es.cancel()
	close(es.eventChan)
}

// eventLoop runs the event listening loop
func (es *EventStream) eventLoop() {
	for {
		select {
		case <-es.ctx.Done():
			return
		default:
			event, err := es.client.WaitForEvent(es.ctx, 1*time.Second)
			if err != nil {
				continue
			}
			if event != nil {
				es.eventChan <- event
				es.notifySubscribers(event)
			}
		}
	}
}

// Subscribe returns a channel for receiving events
func (es *EventStream) Subscribe(id string) <-chan *types.DebugEvent {
	es.mu.Lock()
	defer es.mu.Unlock()

	ch := make(chan *types.DebugEvent, 10)
	es.subscribers[id] = ch
	return ch
}

// Unsubscribe removes a subscriber
func (es *EventStream) Unsubscribe(id string) {
	es.mu.Lock()
	defer es.mu.Unlock()

	if ch, ok := es.subscribers[id]; ok {
		close(ch)
		delete(es.subscribers, id)
	}
}

// notifySubscribers broadcasts an event to all subscribers
func (es *EventStream) notifySubscribers(event *types.DebugEvent) {
	es.mu.RLock()
	defer es.mu.RUnlock()

	for _, ch := range es.subscribers {
		select {
		case ch <- event:
		default:
			// Channel full, skip this subscriber
		}
	}
}
