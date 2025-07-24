# Makefile for agent-cli project

.PHONY: build dev start clean install lint typecheck test help

# Default target
all: build

# Build the project (TypeScript compilation)
build:
	npm run build

# Development mode with hot reload
dev:
	npm run dev

# Start the built application
start: build
	npm run start

# Install dependencies
install:
	npm install

# Clean build artifacts
clean:
	rm -rf dist/
	rm -rf node_modules/.cache/

# Run linter
lint:
	npm run lint

# Type checking without compilation
typecheck:
	npm run typecheck

# Run tests (if test script exists)
test:
	@if npm run | grep -q "test"; then npm run test; else echo "No test script found in package.json"; fi

# Install and build everything
setup: install build

# Help target
help:
	@echo "Available targets:"
	@echo "  build      - Compile TypeScript to JavaScript"
	@echo "  dev        - Run in development mode with hot reload"
	@echo "  start      - Build and start the application"
	@echo "  install    - Install npm dependencies"
	@echo "  clean      - Remove build artifacts"
	@echo "  lint       - Run ESLint"
	@echo "  typecheck  - Run TypeScript type checking"
	@echo "  test       - Run tests (if available)"
	@echo "  setup      - Install dependencies and build"
	@echo "  help       - Show this help message"
