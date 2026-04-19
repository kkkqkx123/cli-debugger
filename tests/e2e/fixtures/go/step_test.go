// Step test program for E2E testing
package main

import (
	"fmt"
	"time"
)

// innerFunction is a function to step into
func innerFunction(x int) int {
	result := x * 2
	return result + 1
}

// outerFunction calls innerFunction for step testing
func outerFunction(x int) int {
	y := x + 10
	z := innerFunction(y) // Step into here
	return z + 5
}

func main() {
	fmt.Println("Step test program started")

	// Short delay for debugger
	time.Sleep(100 * time.Millisecond)

	value := 5
	result := outerFunction(value)
	fmt.Printf("Result: %d\n", result)

	fmt.Println("Step test program completed")

	// Keep running
	time.Sleep(60 * time.Second)
}
