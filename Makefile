.PHONY: help install build-backend dev-backend dev-frontend dev stop clean

# Default target
help:
	@echo "Math Hunter - Available Commands:"
	@echo ""
	@echo "  make install        - Install all dependencies (backend + frontend)"
	@echo "  make build-backend  - Build the Rust backend"
	@echo "  make dev-backend    - Start the backend server"
	@echo "  make dev-frontend   - Start the frontend dev server"
	@echo "  make dev            - Start both backend and frontend"
	@echo "  make stop           - Stop all running servers"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make dashboard      - Start the dashboard"
	@echo ""

# Install dependencies
install:
	@echo "📦 Installing backend dependencies..."
	cd backend && cargo build
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ All dependencies installed!"

# Build backend
build-backend:
	@echo "🔨 Building backend..."
	cd backend && cargo build --release
	@echo "✅ Backend built!"

# Start backend server
dev-backend:
	@echo "🚀 Starting backend server..."
	cd backend && cargo run

# Start frontend dev server
dev-frontend:
	@echo "🚀 Starting frontend dev server..."
	cd frontend && npm run dev

# Start both backend and frontend
dev:
	@echo "🚀 Starting Math Hunter..."
	@echo "📊 Backend will run on http://localhost:3000"
	@echo "🎮 Frontend will run on http://localhost:5173"
	@echo ""
	@echo "💡 Press Ctrl+C to stop all servers"
	@echo ""
	@trap 'kill 0' EXIT; \
	(cd backend && cargo run) & \
	(cd frontend && npm run dev) & \
	wait

# Start dashboard
dashboard:
	@echo "📊 Starting dashboard..."
	python dashboard.py

# Stop all running servers
stop:
	@echo "🛑 Stopping all servers..."
	@pkill -f "cargo run" || true
	@pkill -f "vite" || true
	@pkill -f "streamlit" || true
	@echo "✅ All servers stopped!"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	cd backend && cargo clean
	cd frontend && rm -rf dist node_modules/.vite
	@echo "✅ Cleaned!"
