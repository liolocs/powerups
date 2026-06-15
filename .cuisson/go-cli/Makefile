.PHONY: build test clean install

BINARY_NAME=cuisson
BUILD_DIR=../../bin
GLOBAL_BIN=$(HOME)/.local/bin

build:
	@go build -o $(BUILD_DIR)/$(BINARY_NAME) .

install: build
	@mkdir -p $(GLOBAL_BIN)
	@cp $(BUILD_DIR)/$(BINARY_NAME) $(GLOBAL_BIN)/$(BINARY_NAME)
	@chmod +x $(GLOBAL_BIN)/$(BINARY_NAME)

	@SHELL_NAME=$$(basename $${SHELL:-/bin/bash}); \
	if [ "$$SHELL_NAME" = "zsh" ]; then \
		RC_FILE=$$(echo $${ZDOTDIR:-$$HOME}/.zshrc); \
	else \
		RC_FILE=$$(echo $$HOME/.bashrc); \
	fi; \
	if ! grep -q "$(GLOBAL_BIN)" "$$RC_FILE" 2>/dev/null; then \
		echo '' >> "$$RC_FILE"; \
		echo '# Cuisson CLI' >> "$$RC_FILE"; \
		echo 'export PATH="$(GLOBAL_BIN):$$PATH"' >> "$$RC_FILE"; \
		echo "[+] Added $(GLOBAL_BIN) to PATH in $$RC_FILE"; \
	else \
		echo "[+] $(GLOBAL_BIN) already in PATH"; \
	fi; \
	echo ""; \
	echo "========================================="; \
	echo "  Cuisson CLI installed successfully!"; \
	echo "========================================="; \
	echo ""; \
	echo "  You need to restart your terminal or run:"; \
	echo "    source $$RC_FILE"; \
	echo ""; \
	echo "  Usage examples:"; \
	echo "    cuisson launch new-component --var componentName=MyButton"; \
	echo "    cuisson launch new-store --var storeName=Counter"; \
	echo "    cuisson create my-service --var serviceName --var baseUrl"; \
	echo ""; \
	echo "  (Set CUISSON_TEMPLATES_DIR and CUISSON_OUTPUT_DIR env vars as needed)"; \
	echo ""

test:
	@go test ./... -v

clean:
	@rm -f $(BUILD_DIR)/$(BINARY_NAME)
