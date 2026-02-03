.PHONY: help installdeps build-backend dev-backend dev-frontend dev stop clean tauri-dev tauri-build tauri-clean

# Default target
help:
	@echo "Math Hunter - Available Commands:"
	@echo ""
	@echo "=== TAURI APP (NEW) ==="
	@echo "  make tauri-dev      - Run Tauri app in development mode"
	@echo "  make tauri-build    - Build Tauri app for production"
	@echo "  make tauri-clean    - Clean Tauri build artifacts"
	@echo ""
	@echo "=== LEGACY WEB APP ==="
	@echo "  make installdeps        - installdeps all dependencies (backend + frontend)"
	@echo "  make build-backend  - Build the Rust backend"
	@echo "  make dev-backend    - Start the backend server"
	@echo "  make dev-frontend   - Start the frontend dev server"
	@echo "  make dev            - Start both backend and frontend"
	@echo "  make stop           - Stop all running servers"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make dashboard      - Start the dashboard"
	@echo ""

# installdeps dependencies
installdeps:
	@echo "📦 installing backend dependencies..."
	cd backend && cargo build
	@echo "📦 installing frontend dependencies..."
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

# ==== TAURI COMMANDS ====

# Run Tauri app in development mode
tauri-dev:
	@echo "🚀 Starting Tauri app in development mode..."
	@echo "📊 Database will be created in app data directory"
	@echo "🎮 Application window will open automatically"
	@echo ""
	cargo tauri dev

# Build Tauri app for production
tauri-build:
	@echo "🔨 Building Tauri app for production..."
	cargo tauri build
	@echo "✅ Build complete! Check src-tauri/target/release/bundle/"

# Clean Tauri artifacts
tauri-clean:
	@echo "🧹 Cleaning Tauri build artifacts..."
	rm -rf src-tauri/target
	rm -rf frontend/dist
	@echo "✅ Tauri artifacts cleaned!"
