# K-POP DEMON HUNTER - Math Learning App

A K-pop demon hunter themed educational application that teaches children addition and subtraction through an interactive quiz interface. Built with React and Rust.

## Features

- K-pop demon hunter themed UI with neon colors and animations
- 5 randomly generated math questions per quiz session
- Addition and subtraction problems with numbers ranging from 0-100
- Instant feedback on correct/incorrect answers
- Score tracking
- Responsive design for various screen sizes

## Tech Stack

### Frontend
- React (Vite)
- Modern CSS with animations and gradients
- Google Fonts (Press Start 2P, Orbitron)

### Backend
- Rust
- Axum web framework
- Tower HTTP for CORS
- Tokio async runtime

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Rust (latest stable version)
- Cargo (comes with Rust)

## Installation & Setup

### 1. Backend Setup

Navigate to the backend directory and run:

```bash
cd backend
cargo build --release
```

### 2. Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

## Running the Application

You'll need to run both the backend and frontend servers.

### Start the Backend Server

In the backend directory:

```bash
cd backend
cargo run
```

The backend will start on `http://localhost:3000`

### Start the Frontend Server

In a new terminal, navigate to the frontend directory:

```bash
cd frontend
npm run dev
```

The frontend will typically start on `http://localhost:5173` (Vite will show you the exact URL)

## How to Play

1. Open the frontend URL in your web browser
2. You'll see 5 math questions (addition and subtraction)
3. Enter your answers in the input fields
4. Click "BANISH THE DEMONS" to submit your answers
5. View your score and see which answers were correct
6. Click "SUMMON NEW DEMONS" to get a new set of questions

## API Endpoints

### GET /api/quiz
Generates 5 random math questions

**Response:**
```json
{
  "questions": [
    {
      "id": 0,
      "num1": 45,
      "num2": 23,
      "operator": "+",
      "question": "45 + 23"
    }
  ]
}
```

### POST /api/check
Validates user answers

**Request:**
```json
{
  "answers": [
    {"id": 0, "answer": 68}
  ],
  "questions": [...]
}
```

**Response:**
```json
{
  "results": [
    {
      "id": 0,
      "correct": true,
      "user_answer": 68,
      "correct_answer": 68
    }
  ],
  "score": 5
}
```

## Project Structure

```
math-hunter/
├── backend/
│   ├── src/
│   │   └── main.rs
│   └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
└── README.md
```

## Theme Elements

- **Colors**: Dark purple/black background with neon pink, cyan, and purple accents
- **Fonts**: Press Start 2P for headings, Orbitron for body text
- **Animations**: Gradient shifts, bouncing demons, glowing effects, shimmer effects
- **Styling**: Anime/K-pop inspired with demon hunter aesthetics

## Development

### Backend Development
The backend uses Axum for routing and handles:
- Random question generation
- Answer validation
- CORS configuration for frontend communication

### Frontend Development
The frontend is a single-page React application that:
- Fetches questions from the backend
- Manages quiz state
- Displays results with animations
- Provides an engaging user experience

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
