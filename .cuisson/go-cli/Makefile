.PHONY: build test clean

BINARY_NAME=cuisson
BUILD_DIR=../../bin

build:
	@go build -o $(BUILD_DIR)/$(BINARY_NAME) .

test:
	@go test ./... -v

clean:
	@rm -f $(BUILD_DIR)/$(BINARY_NAME)
