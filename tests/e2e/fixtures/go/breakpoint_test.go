// Breakpoint test program for E2E testing
package main

import (
	"fmt"
	"time"
)

// BreakpointTest is a struct for testing method breakpoints
type BreakpointTest struct {
	counter int
}

// MethodA is a method to set breakpoint on
func (b *BreakpointTest) MethodA() {
	b.counter++ // Breakpoint location 1
	fmt.Printf("MethodA: counter = %d\n", b.counter)
}

// MethodB is another method to set breakpoint on
func (b *BreakpointTest) MethodB() {
	b.counter += 2 // Breakpoint location 2
	fmt.Printf("MethodB: counter = %d\n", b.counter)
}

func main() {
	test := &BreakpointTest{counter: 0}

	fmt.Println("Starting breakpoint test")

	// Short delay for debugger
	time.Sleep(100 * time.Millisecond)

	test.MethodA() // Breakpoint location 3
	test.MethodB() // Breakpoint location 4

	fmt.Println("Breakpoint test completed")

	// Keep running
	time.Sleep(60 * time.Second)
}
