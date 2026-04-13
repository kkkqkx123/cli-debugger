package monitor

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

// Monitor defines the interface for monitoring debug state
type Monitor interface {
	// Start begins the monitoring loop
	Start(ctx context.Context) error
	// Stop stops the monitoring loop
	Stop()
	// SetInterval sets the refresh interval
	SetInterval(interval time.Duration)
	// SetTimeout sets the total monitoring timeout
	SetTimeout(timeout time.Duration)
	// SetCommand sets the command function to execute on each tick
	SetCommand(fn func(ctx context.Context) error)
}

// Poller implements polling-based monitoring
type Poller struct {
	interval  time.Duration
	timeout   time.Duration
	command   func(ctx context.Context) error
	mu        sync.Mutex
	cancel    context.CancelFunc
	done      chan struct{}
}

// NewPoller creates a new Poller with default settings
func NewPoller() *Poller {
	return &Poller{
		interval: 1 * time.Second,
		timeout:  60 * time.Second,
		done:     make(chan struct{}),
	}
}

// SetInterval sets the refresh interval
func (p *Poller) SetInterval(interval time.Duration) {
	if interval < 1*time.Second {
		interval = 1 * time.Second
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.interval = interval
}

// SetTimeout sets the total monitoring timeout
func (p *Poller) SetTimeout(timeout time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.timeout = timeout
}

// SetCommand sets the command function to execute on each tick
func (p *Poller) SetCommand(fn func(ctx context.Context) error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.command = fn
}

// Start begins the polling loop
func (p *Poller) Start(ctx context.Context) error {
	p.mu.Lock()
	if p.command == nil {
		p.mu.Unlock()
		return fmt.Errorf("monitor command not set")
	}
	cmd := p.command
	interval := p.interval
	timeout := p.timeout
	p.mu.Unlock()

	// Create a context with timeout
	monitorCtx, cancel := context.WithTimeout(ctx, timeout)
	p.mu.Lock()
	p.cancel = cancel
	p.mu.Unlock()
	defer cancel()

	// Listen for interrupt signals
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	defer signal.Stop(sigChan)

	// Run the first command immediately
	if err := cmd(monitorCtx); err != nil {
		return fmt.Errorf("monitor command failed: %w", err)
	}

	// Start polling loop
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	fmt.Fprintln(os.Stderr, "\n[Monitor Mode] Press Ctrl+C to stop monitoring")

	for {
		select {
		case <-monitorCtx.Done():
			fmt.Fprintln(os.Stderr, "\n[Monitor Mode] Timeout reached, stopping monitor")
			close(p.done)
			return monitorCtx.Err()
		case <-sigChan:
			fmt.Fprintln(os.Stderr, "\n[Monitor Mode] Interrupted, stopping monitor")
			close(p.done)
			return nil
		case <-ticker.C:
			if err := cmd(monitorCtx); err != nil {
				fmt.Fprintf(os.Stderr, "\n[Monitor Mode] Command error: %v\n", err)
				// Continue monitoring despite errors
			}
		}
	}
}

// Stop stops the monitoring loop
func (p *Poller) Stop() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.cancel != nil {
		p.cancel()
	}
}

// Done returns a channel that is closed when monitoring stops
func (p *Poller) Done() <-chan struct{} {
	return p.done
}
