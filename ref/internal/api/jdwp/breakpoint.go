package jdwp

import (
	"context"
	"fmt"

	"cli-debugger/internal/api"
	"cli-debugger/pkg/types"
)

// SetBreakpoint sets a breakpoint.
func (c *Client) SetBreakpoint(ctx context.Context, location string, condition string) (string, error) {
	className, methodName, lineNumber := parseLocation(location)

	classInfo, err := c.ClassByName(ctx, className)
	if err != nil {
		return "", err
	}

	methods, err := c.Methods(classInfo.RefID)
	if err != nil {
		return "", err
	}

	var methodID string
	for _, method := range methods {
		if method.Name == methodName {
			methodID = method.MethodID
			break
		}
	}

	if methodID == "" {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Method not found",
		}
	}

	lineTable, err := c.LineTable(classInfo.RefID, methodID)
	if err != nil {
		return "", err
	}

	var codeIndex int64 = -1
	for _, lineLocation := range lineTable {
		if lineLocation.LineNumber == lineNumber {
			codeIndex = lineLocation.LineCodeIndex
			break
		}
	}

	if codeIndex == -1 {
		return "", &api.APIError{
			Type:    api.CommandError,
			Message: "Line number not found in method",
		}
	}

	requestID, err := c.SetBreakpointRequest(ctx, classInfo.RefID, methodID, uint64(codeIndex), SuspendEventThread)
	if err != nil {
		return "", err
	}

	bpID := fmt.Sprintf("bp_%d", len(c.breakpoints)+1)
	c.breakpoints[bpID] = &BreakpointInfo{
		ID:        bpID,
		RequestID: requestID,
		Location:  location,
		Enabled:   true,
		HitCount:  0,
	}

	return bpID, nil
}

func parseLocation(location string) (string, string, int) {
	className := ""
	methodName := ""
	lineNumber := 0

	lastDot := -1
	lastColon := -1
	for i, ch := range location {
		if ch == '.' {
			lastDot = i
		} else if ch == ':' {
			lastColon = i
		}
	}

	if lastDot != -1 && lastColon != -1 && lastColon > lastDot {
		className = location[:lastDot]
		methodName = location[lastDot+1 : lastColon]
		lineStr := location[lastColon+1:]
		fmt.Sscanf(lineStr, "%d", &lineNumber)
	}

	return className, methodName, lineNumber
}

// RemoveBreakpoint Removes a breakpoint.
func (c *Client) RemoveBreakpoint(ctx context.Context, breakpointID string) error {
	delete(c.breakpoints, breakpointID)
	return nil
}

// ClearBreakpoints Clears all breakpoints.
func (c *Client) ClearBreakpoints(ctx context.Context) error {
	c.breakpoints = make(map[string]*BreakpointInfo)
	return nil
}

// GetBreakpoints Get all breakpoints.
func (c *Client) GetBreakpoints(ctx context.Context) ([]*types.BreakpointInfo, error) {
	result := make([]*types.BreakpointInfo, 0, len(c.breakpoints))
	for _, bp := range c.breakpoints{
		result = append(result, &types.BreakpointInfo{
			ID:       bp.ID,
			Location: bp.Location,
			Enabled:  bp.Enabled,
			HitCount: bp.HitCount,
		})
	}
	return result, nil
}
