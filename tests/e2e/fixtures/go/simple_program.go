// Simple program for basic E2E testing
package main

import (
	"fmt"
	"time"
)

// add is a simple function to test stepping
func add(a, b int) int {
	return a + b
}

func main() {
	fmt.Println("Program started")

	// Short delay to allow debugger to attach
	time.Sleep(100 * time.Millisecond)

	// Variables for inspection
	x := 10
	y := 20
	sum := add(x, y)
	fmt.Printf("Sum: %d\n", sum)

	// Keep program running to allow debugging
	time.Sleep(60 * time.Second)

	fmt.Println("Program finished")
}
