# Mihomo CLI - Project Context Documentation

## Language

Always use English in code, comments, logging, error info or other string literal. Use Chinese in docs (except code block)
**Never use any Chinese in any code files.**

## Project Overview

Mihomo CLI is a non-interactive management tool for the Mihomo proxy core. This tool provides comprehensive management capabilities over the Mihomo RESTful API via a command-line interface (CLI), delivering a stateless and scriptable proxy management solution.

### Project Goals

- Provide a pure command-line interface for Mihomo management without requiring a GUI.
- Support automated scripting and batch operations.
- Decouple from the Mihomo core process to enhance stability.

### Core Features

- **Stateless Design**: The CLI does not persist runtime state; all state queries are performed in real-time against the API.
- **Configuration Persistence**: API address and Secret are saved to a local configuration file to avoid repeated input.
- **Query vs. Mutation Separation**: Distinct operations for querying (`get`, `list`, `show`) and modifying (`set`, `switch`, `update`).
- **Controllable Output Format**: Supports both Table and JSON output formats for human readability and script parsing.

---

## Technology Stack

### Programming Language

- **Go 1.26.1**: Primary development language.

### Core Dependencies

- **github.com/spf13/cobra v1.10.2**: CLI framework for building the command structure.
- **github.com/spf13/viper v1.21.0**: Configuration management supporting config files and environment variables.
- **github.com/fatih/color v1.18.0**: Colored terminal output.
- **github.com/olekukonko/tablewriter v0.0.5**: Table formatting output.

### Project Architecture

- Modular design following standard Go project structures.
- Command tree architecture based on Cobra.
- Layered design: `cmd` (Command Layer) → `internal` (Business Logic Layer) → `pkg` (Common Types Layer).

---
