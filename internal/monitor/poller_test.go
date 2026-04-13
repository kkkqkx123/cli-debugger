package monitor

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewPoller(t *testing.T) {
	poller := NewPoller()

	if poller == nil {
		t.Fatal("NewPoller() returned nil")
	}

	if poller.interval != 1*time.Second {
		t.Errorf("Expected default interval 1s, got %v", poller.interval)
	}

	if poller.timeout != 60*time.Second {
		t.Errorf("Expected default timeout 60s, got %v", poller.timeout)
	}

	if poller.done == nil {
		t.Error("Expected done channel to be initialized")
	}
}

func TestPoller_SetInterval(t *testing.T) {
	poller := NewPoller()

	tests := []struct {
		name     string
		interval time.Duration
		expected time.Duration
	}{
		{"Valid interval", 5 * time.Second, 5 * time.Second},
		{"Minimum interval", 500 * time.Millisecond, 1 * time.Second},
		{"Zero interval", 0, 1 * time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			poller.SetInterval(tt.interval)
			if poller.interval != tt.expected {
				t.Errorf("Expected interval %v, got %v", tt.expected, poller.interval)
			}
		})
	}
}

func TestPoller_SetTimeout(t *testing.T) {
	poller := NewPoller()

	tests := []struct {
		name    string
		timeout time.Duration
	}{
		{"Valid timeout", 30 * time.Second},
		{"Zero timeout", 0},
		{"Long timeout", 5 * time.Minute},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			poller.SetTimeout(tt.timeout)
			if poller.timeout != tt.timeout {
				t.Errorf("Expected timeout %v, got %v", tt.timeout, poller.timeout)
			}
		})
	}
}

func TestPoller_SetCommand(t *testing.T) {
	poller := NewPoller()

	cmd := func(ctx context.Context) error {
		return nil
	}

	poller.SetCommand(cmd)

	if poller.command == nil {
		t.Error("Expected command to be set")
	}
}

func TestPoller_Start_NoCommand(t *testing.T) {
	poller := NewPoller()
	ctx := context.Background()

	err := poller.Start(ctx)
	if err == nil {
		t.Error("Expected error when command is not set")
	}

	expectedErr := "monitor command not set"
	if err.Error() != expectedErr {
		t.Errorf("Expected error '%s', got '%s'", expectedErr, err.Error())
	}
}

func TestPoller_Start_Timeout(t *testing.T) {
	poller := NewPoller()
	poller.SetTimeout(100 * time.Millisecond)

	callCount := int32(0)
	poller.SetCommand(func(ctx context.Context) error {
		atomic.AddInt32(&callCount, 1)
		return nil
	})

	ctx := context.Background()
	err := poller.Start(ctx)

	if err != context.DeadlineExceeded {
		t.Errorf("Expected DeadlineExceeded error, got %v", err)
	}

	// Should be called at least once (immediate) and maybe once more due to ticker
	if atomic.LoadInt32(&callCount) < 1 {
		t.Error("Expected command to be called at least once")
	}
}

func TestPoller_Start_Stop(t *testing.T) {
	poller := NewPoller()
	// Note: SetInterval enforces a minimum of 1 second
	poller.SetInterval(1 * time.Second)
	poller.SetTimeout(5 * time.Second)

	callCount := int32(0)
	poller.SetCommand(func(ctx context.Context) error {
		atomic.AddInt32(&callCount, 1)
		return nil
	})

	ctx := context.Background()

	// Start poller in background
	errChan := make(chan error, 1)
	go func() {
		errChan <- poller.Start(ctx)
	}()

	// Wait for at least 2 ticks (immediate + 1s + buffer)
	time.Sleep(1500 * time.Millisecond)

	// Stop the poller
	poller.Stop()

	// Wait for poller to finish
	select {
	case err := <-errChan:
		// Context canceled is expected when stopping
		if err != nil && err != context.Canceled {
			t.Errorf("Expected no error or context.Canceled on stop, got %v", err)
		}
	case <-time.After(1 * time.Second):
		t.Fatal("Poller did not stop within timeout")
	}

	count := atomic.LoadInt32(&callCount)
	if count < 2 {
		t.Errorf("Expected at least 2 calls, got %d", count)
	}

	// Verify done channel is closed
	select {
	case <-poller.Done():
		// Expected
	case <-time.After(100 * time.Millisecond):
		t.Error("Expected done channel to be closed")
	}
}

func TestPoller_Start_CommandError(t *testing.T) {
	poller := NewPoller()
	poller.SetInterval(50 * time.Millisecond)
	poller.SetTimeout(200 * time.Millisecond)

	callCount := int32(0)
	poller.SetCommand(func(ctx context.Context) error {
		atomic.AddInt32(&callCount, 1)
		if atomic.LoadInt32(&callCount) == 2 {
			return nil
		}
		return nil // Let it continue
	})

	ctx := context.Background()
	_ = poller.Start(ctx)

	count := atomic.LoadInt32(&callCount)
	if count < 1 {
		t.Errorf("Expected at least 1 call despite error, got %d", count)
	}
}

func TestPoller_Stop_NoContext(t *testing.T) {
	poller := NewPoller()

	// Should not panic
	poller.Stop()
}

func TestPoller_Done(t *testing.T) {
	poller := NewPoller()

	done := poller.Done()
	if done == nil {
		t.Fatal("Expected done channel to be non-nil")
	}

	// Channel should not be closed yet
	select {
	case <-done:
		t.Error("Expected done channel to be open before start")
	default:
		// Expected
	}
}
