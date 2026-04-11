# Math Trainer - Pokémon Edition

A Pokémon-themed educational application that teaches children addition and subtraction (and more!) through an interactive quiz interface. Built with React and Rust.

## Features

- **Pokémon themed UI** with bright colors, bouncy Poké Balls, and friendly Pokémon sprites (Pikachu, Charmander, Squirtle, Bulbasaur, and friends)
- **Immediate feedback** - Get instant results after answering each question
- **5 randomly generated math questions** per quiz session
- **Addition and subtraction** problems with numbers ranging from 0-100
- **Real-time score tracking** displayed at the top
- **SQLite database** - All questions, answers, and results are persisted
- **Visual feedback** - Question cards change color based on correct/incorrect answers
- **Responsive design** for various screen sizes
- **Animated UI elements** - Floating icons, glowing effects, and smooth transitions

## Tech Stack

### Frontend
- React (Vite)
- Modern CSS with animations and gradients
- Google Fonts (Press Start 2P, Orbitron)
- Immediate answer validation

### Backend
- Rust
- Axum web framework
- SQLx for SQLite database operations
- Tower HTTP for CORS
- Tokio async runtime
- UUID for session tracking
- Chrono for timestamps

### Database
- SQLite
- Tables: quiz_sessions, questions, answers
- Persistent storage of all quiz data

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

The backend will start on `http://localhost:3000` and create a `math_hunter.db` SQLite database file.

### Start the Frontend Server

In a new terminal, navigate to the frontend directory:

```bash
cd frontend
npm run dev
```

The frontend will typically start on `http://localhost:5173` (Vite will show you the exact URL)

## How to Play

1. Open the frontend URL in your web browser
2. You'll see math questions, each featuring a wild Pokémon
3. Answer each question by typing your answer and clicking "THROW BALL!"
4. Get **immediate feedback** - the question card will turn green (caught!) or red (broke free)
5. See your running catch count at the top of the page
6. After answering all questions, view your final score and performance message
7. Click "FIND NEW POKÉMON" to start a new quiz session

## API Endpoints

### GET /api/quiz
Generates a new quiz session with 5 random math questions and saves them to the database.

**Response:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "questions": [
    {
      "id": 0,
      "num1": 45,
      "num2": 23,
      "operator": "+",
      "question": "45 + 23"
    },
    ...
  ]
}
```

### POST /api/check-answer
Validates a single answer and saves it to the database.

**Request:**
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "question_id": 0,
  "answer": 68,
  "question": {
    "id": 0,
    "num1": 45,
    "num2": 23,
    "operator": "+",
    "question": "45 + 23"
  }
}
```

**Response:**
```json
{
  "correct": true,
  "correct_answer": 68
}
```

## Database Schema

### quiz_sessions
- `id` (TEXT, PRIMARY KEY) - UUID for the quiz session
- `created_at` (TEXT) - ISO 8601 timestamp

### questions
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `session_id` (TEXT, FOREIGN KEY) - References quiz_sessions(id)
- `question_id` (INTEGER) - Question number (0-4)
- `num1` (INTEGER) - First number
- `num2` (INTEGER) - Second number
- `operator` (TEXT) - "+" or "-"
- `question_text` (TEXT) - Full question string
- `correct_answer` (INTEGER) - The correct answer

### answers
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `session_id` (TEXT, FOREIGN KEY) - References quiz_sessions(id)
- `question_id` (INTEGER) - Question number (0-4)
- `user_answer` (INTEGER) - User's submitted answer
- `is_correct` (BOOLEAN) - Whether the answer was correct
- `answered_at` (TEXT) - ISO 8601 timestamp

## Project Structure

```
math-hunter/
├── backend/
│   ├── src/
│   │   └── main.rs
│   ├── Cargo.toml
│   ├── schema.sql
│   └── math_hunter.db (created on first run)
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

- **Colors**: Bright Pokémon palette — red, yellow, blue, and cream with bold black outlines
- **Fonts**: Press Start 2P for headings/buttons, Fredoka for body text
- **Sprites**: Pokémon face icons (Pikachu, Charmander, Squirtle, Bulbasaur, Rattata, Jigglypuff, Eevee, Meowth) and Poké Balls (Poké / Great / Ultra / Master)
- **Animations**:
  - Bouncing Poké Balls on the title
  - Floating Pokémon sprites on question cards
  - Spinning Poké Ball loader
  - Chunky "press-down" button animations
  - Scale-in animations for results
- **Styling**: Chunky cartoon look inspired by classic Pokémon UIs
- **Feedback**: Green card for caught, red card for missed

## Development

### Backend Development
The backend uses Axum for routing and SQLx for database operations:
- Random question generation with non-negative results for subtraction
- Individual answer validation with immediate feedback
- Session-based tracking with UUID
- Persistent storage in SQLite
- CORS configuration for frontend communication

### Frontend Development
The frontend is a single-page React application that:
- Fetches questions from the backend and receives a session ID
- Submits each answer individually for immediate validation
- Displays real-time feedback with color-coded question cards
- Shows running score during the quiz
- Provides performance messages at the end
- Uses modern CSS animations and effects

## Data Persistence

All quiz data is stored in the SQLite database (`math_hunter.db`):
- Every quiz session is tracked with a unique UUID
- All questions generated for each session are saved
- Every answer submitted by users is recorded with timestamp
- You can query the database to view historical quiz performance

Example query:
```sql
-- View all quiz sessions
SELECT * FROM quiz_sessions;

-- View questions for a specific session
SELECT * FROM questions WHERE session_id = 'your-session-id';

-- View answers with correctness
SELECT * FROM answers WHERE session_id = 'your-session-id';
```

## License

MIT

## Contributing

Feel free to submit issues and enhancement requests!
