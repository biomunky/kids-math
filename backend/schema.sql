-- Quiz Sessions Table
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL DEFAULT 'Anonymous',
    difficulty TEXT NOT NULL DEFAULT 'medium',
    created_at TEXT NOT NULL
);

-- Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    num1 INTEGER NOT NULL,
    num2 INTEGER NOT NULL,
    operator TEXT NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer INTEGER NOT NULL,
    FOREIGN KEY (session_id) REFERENCES quiz_sessions(id)
);

-- Answers Table
CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question_id INTEGER NOT NULL,
    user_answer INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    answered_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES quiz_sessions(id)
);
