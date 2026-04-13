package monitor

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

// StreamClient implements WebSocket-based streaming monitoring
type StreamClient struct {
	conn     *websocket.Conn
	interval time.Duration
	timeout  time.Duration
	command  func(ctx context.Context) error
	mu       sync.Mutex
	cancel   context.CancelFunc
	done     chan struct{}
	url      string
}

// NewStreamClient creates a new StreamClient
func NewStreamClient(url string) *StreamClient {
	return &StreamClient{
		url:      url,
		interval: 1 * time.Second,
		timeout:  60 * time.Second,
		done:     make(chan struct{}),
	}
}

// SetInterval sets the refresh interval
func (s *StreamClient) SetInterval(interval time.Duration) {
	if interval < 1*time.Second {
		interval = 1 * time.Second
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.interval = interval
}

// SetTimeout sets the total monitoring timeout
func (s *StreamClient) SetTimeout(timeout time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.timeout = timeout
}

// SetCommand sets the command function to execute on each tick
func (s *StreamClient) SetCommand(fn func(ctx context.Context) error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.command = fn
}

// Connect establishes the WebSocket connection
func (s *StreamClient) Connect(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	dialer := websocket.Dialer{
		HandshakeTimeout: 5 * time.Second,
	}

	conn, _, err := dialer.DialContext(ctx, s.url, nil)
	if err != nil {
		return fmt.Errorf("failed to connect to WebSocket: %w", err)
	}
	s.conn = conn
	return nil
}

// Start begins the monitoring loop using WebSocket
func (s *StreamClient) Start(ctx context.Context) error {
	s.mu.Lock()
	if s.command == nil {
		s.mu.Unlock()
		return fmt.Errorf("monitor command not set")
	}
	cmd := s.command
	interval := s.interval
	timeout := s.timeout
	s.mu.Unlock()

	// Create a context with timeout
	monitorCtx, cancel := context.WithTimeout(ctx, timeout)
	s.mu.Lock()
	s.cancel = cancel
	s.mu.Unlock()
	defer cancel()

	// Listen for interrupt signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(sigChan)

	// Start polling loop (fallback since WebSocket is for streaming debug events)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	fmt.Fprintln(os.Stderr, "\n[Stream Monitor] Press Ctrl+C to stop monitoring")

	for {
		select {
		case <-monitorCtx.Done():
			fmt.Fprintln(os.Stderr, "\n[Stream Monitor] Timeout reached, stopping monitor")
			close(s.done)
			return monitorCtx.Err()
		case <-sigChan:
			fmt.Fprintln(os.Stderr, "\n[Stream Monitor] Interrupted, stopping monitor")
			close(s.done)
			return nil
		case <-ticker.C:
			if err := cmd(monitorCtx); err != nil {
				fmt.Fprintf(os.Stderr, "\n[Stream Monitor] Command error: %v\n", err)
			}
		}
	}
}

// Stop stops the monitoring loop
func (s *StreamClient) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
	}
	if s.conn != nil {
		s.conn.Close()
	}
}

// Done returns a channel that is closed when monitoring stops
func (s *StreamClient) Done() <-chan struct{} {
	return s.done
}

// IsConnected checks if the WebSocket is connected
func (s *StreamClient) IsConnected() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn != nil
}
