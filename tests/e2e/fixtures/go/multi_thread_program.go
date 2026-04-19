// Multi-thread program for E2E testing
package main

import (
	"fmt"
	"sync"
	"time"
)

// worker is a goroutine worker function
func worker(id int, wg *sync.WaitGroup, results chan<- int) {
	defer wg.Done()

	fmt.Printf("Worker %d starting\n", id)
	time.Sleep(100 * time.Millisecond)
	result := id * 10
	results <- result
	fmt.Printf("Worker %d finished\n", id)
}

func main() {
	fmt.Println("Multi-thread program started")

	// Short delay for debugger
	time.Sleep(100 * time.Millisecond)

	const numWorkers = 3
	var wg sync.WaitGroup
	results := make(chan int, numWorkers)

	// Start multiple goroutines
	for i := 1; i <= numWorkers; i++ {
		wg.Add(1)
		go worker(i, &wg, results)
	}

	// Wait for all workers in a separate goroutine
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	total := 0
	for result := range results {
		total += result
	}

	fmt.Printf("Total: %d\n", total)
	fmt.Println("Multi-thread program completed")

	// Keep running
	time.Sleep(60 * time.Second)
}
