
GO_BIN ?= go
GOROOT := $(shell $(GO_BIN) env GOROOT)
WASM_RUNTIME_PATH := $(GOROOT)/lib/wasm/wasm_exec.js

.PHONY: help
help: ## Show this help
	@echo "Help"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-20s\033[93m %s\n", $$1, $$2}'

.PHONY: default
default: help

.PHONY: build
build: ## Builds the production artifacts.
	@echo "Building production artifacts..."
	@rm -rf ./out
	@mkdir -p ./out
	@GOOS=js GOARCH=wasm $(GO_BIN) build -o ./out/main.wasm main.go
	@cp $(WASM_RUNTIME_PATH) ./out/
	@cp ./ui/index.html ./out/
	@echo "Build completed. Artifacts are in the ./out directory."

.PHONY: run
run: build ## Runs server for local development.
	@echo "Running local server at http://localhost:8080 ..."
	@python3 -m http.server 8080 --directory ./out