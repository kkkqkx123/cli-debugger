// Variable test program for E2E testing
package main

import (
	"fmt"
	"time"
)

// Person is a struct for testing struct variable inspection
type Person struct {
	Name    string
	Age     int
	Address *Address
}

// Address is a nested struct
type Address struct {
	City    string
	Street  string
	ZipCode int
}

// processPerson processes a person for variable inspection
func processPerson(p *Person) {
	fmt.Printf("Processing: %s, age %d\n", p.Name, p.Age)

	// Local variables for inspection
	status := "active"
	score := 95.5
	numbers := []int{1, 2, 3, 4, 5}

	// Modify person
	p.Age++
	p.Address.City = "New City"

	fmt.Printf("Status: %s, Score: %.1f\n", status, score)
	fmt.Printf("Numbers: %v\n", numbers)
}

func main() {
	fmt.Println("Variable test program started")

	// Short delay for debugger
	time.Sleep(100 * time.Millisecond)

	// Create test data
	person := &Person{
		Name: "Alice",
		Age:  30,
		Address: &Address{
			City:    "Old City",
			Street:  "Main St",
			ZipCode: 12345,
		},
	}

	processPerson(person)

	fmt.Println("Variable test program completed")

	// Keep running
	time.Sleep(60 * time.Second)
}
