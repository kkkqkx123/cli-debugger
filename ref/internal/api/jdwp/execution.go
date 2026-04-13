package jdwp

import (
	"context"
	"time"
)

// StepInto Single StepInto
func (c *Client) StepInto(ctx context.Context, threadID string) error {
	// Setting up single-step entry events
	requestID, err := c.SetStepRequest(ctx, threadID, StepInto, SuspendAll)
	if err != nil {
		return err
	}

	// Resume VM execution
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// Waiting for events
	_, err = c.WaitForEvent(ctx, 30*time.Second)

	// Clear event requests
	c.ClearBreakpointRequest(ctx, requestID)

	return err
}

// StepOver Single-step skip
func (c *Client) StepOver(ctx context.Context, threadID string) error {
	// Setting up single-step skip events
	requestID, err := c.SetStepRequest(ctx, threadID, StepOver, SuspendAll)
	if err != nil {
		return err
	}

	// Resume VM execution
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// Waiting for events
	_, err = c.WaitForEvent(ctx, 30*time.Second)

	// Clear event requests
	c.ClearBreakpointRequest(ctx, requestID)

	return err
}

// StepOut
func (c *Client) StepOut(ctx context.Context, threadID string) error {
	// Setting up a single-step jump event
	requestID, err := c.SetStepRequest(ctx, threadID, StepOut, SuspendAll)
	if err != nil {
		return err
	}

	// Resume VM execution
	if err := c.ResumeVM(ctx); err != nil {
		return err
	}

	// Waiting for events
	_, err = c.WaitForEvent(ctx, 30*time.Second)

	// Clear event requests
	c.ClearBreakpointRequest(ctx, requestID)

	return err
}
