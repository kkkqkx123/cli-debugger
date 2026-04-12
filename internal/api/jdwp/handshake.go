package jdwp

import (
	"bytes"
	"context"
	"fmt"
	"time"

	"cli-debugger/internal/api"
)

const (
	// jdwpHandshakeString: JDWP Handshake String
	jdwpHandshakeString = "JDWP-Handshake"
)

// performHandshake Performs the JDWP handshake protocol.
// JDWP handshake process:
// 1. JVM sends "JDWP-Handshake\x00" to the debugger.
// 2. The debugger verifies and writes back the same string
func (c *Client) performHandshake(ctx context.Context) error {
	// Setting the read timeout
	if err := c.conn.SetReadDeadline(getDeadline(c.timeout)); err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "Handshake failed: Unable to set the read timeout.",
			Cause:   err,
		}
	}

	// Read the handshake string sent by the JVM
	buf := make([]byte, len(jdwpHandshakeString))
	n, err := c.conn.Read(buf)
	if err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "Handshake failed: Unable to read the JVM response.",
			Cause:   err,
		}
	}

	// Verify handshake string (may or may not contain null terminator)
	received := bytes.TrimRight(buf[:n], "\x00")
	if string(received) != jdwpHandshakeString {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: fmt.Sprintf("Handshake failed: Invalid JVM response. The expected response was '%s', but '%s' was received.", jdwpHandshakeString, string(received)),
		}
	}

	// Clear read timeout
	if err := c.conn.SetReadDeadline(getDeadline(c.timeout)); err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "Handshake failed: Unable to set the read timeout.",
			Cause:   err,
		}
	}

	// Write-back handshake string (with null terminator)
	handshakeResponse := append([]byte(jdwpHandshakeString), 0x00)
	if _, err := c.conn.Write(handshakeResponse); err != nil {
		return &api.APIError{
			Type:    api.ProtocolError,
			Message: "Handshake failed: Unable to send a response.",
			Cause:   err,
		}
	}

	return nil
}

// getDeadline Get the timeout point
func getDeadline(timeout time.Duration) time.Time {
	return time.Now().Add(timeout)
}
