package main

import (
	"fmt"
	"os"

	"cli-debugger/cmd"
	_ "cli-debugger/internal/api/jdwp"
)

func main() {
	if err := cmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}