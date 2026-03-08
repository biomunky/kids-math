use axum::{routing::{get, post}, Json, Router};
use chrono::Utc;
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions, SqlitePoolOptions};
use std::net::SocketAddr;
use std::str::FromStr;
use tower_http::cors::{Any, CorsLayer};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Question {
    id: usize,
    num1: i32,
    num2: i32,
    operator: String,
    question: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct QuizRequest {
    username: String,
    difficulty: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct QuizResponse {
    session_id: String,
    questions: Vec<Question>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CheckAnswerRequest {
    session_id: String,
    question_id: usize,
    answer: i32,
    question: Question,
}

#[derive(Debug, Serialize, Deserialize)]
struct CheckAnswerResponse {
    correct: bool,
    correct_answer: i32,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct UserStat {
    username: String,
    difficulty: String,
    total_questions: i64,
    correct_answers: i64,
}

async fn init_database(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS quiz_sessions (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL DEFAULT 'Anonymous',
            difficulty TEXT NOT NULL DEFAULT 'medium',
            created_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Add username column if it doesn't exist (for existing databases)
    let _ = sqlx::query(
        r#"
        ALTER TABLE quiz_sessions ADD COLUMN username TEXT NOT NULL DEFAULT 'Anonymous'
        "#,
    )
    .execute(pool)
    .await;

    // Add difficulty column if it doesn't exist (for existing databases)
    let _ = sqlx::query(
        r#"
        ALTER TABLE quiz_sessions ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'medium'
        "#,
    )
    .execute(pool)
    .await;

    sqlx::query(
        r#"
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
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            question_id INTEGER NOT NULL,
            user_answer INTEGER NOT NULL,
            is_correct BOOLEAN NOT NULL,
            answered_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES quiz_sessions(id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

#[tokio::main]
async fn main() {
    // Initialize SQLite database
    let database_url = "sqlite:///Users/biomunky/scratch/ai/cc/math-hunter/backend/math_hunter.db";
    let connect_options = SqliteConnectOptions::from_str(&database_url)
        .expect("Failed to parse database URL")
        .create_if_missing(true);
    
    let pool = SqlitePoolOptions::new()
        .connect_with(connect_options)
        .await
        .expect("Failed to connect to database");

    // Initialize database schema
    init_database(&pool)
        .await
        .expect("Failed to initialize database");

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Clone pool for use in closures
    let pool_quiz = pool.clone();
    let pool_answer = pool.clone();
    let pool_stats = pool.clone();

    let app = Router::new()
        .route(
            "/api/quiz",
            post(move |Json(request): Json<QuizRequest>| async move {
                let mut rng = StdRng::from_entropy();
                let mut questions = Vec::new();
                let mut seen: std::collections::HashSet<(i32, i32, String)> = std::collections::HashSet::new();
                let session_id = Uuid::new_v4().to_string();
                let created_at = Utc::now().to_rfc3339();
                let username = if request.username.trim().is_empty() {
                    "Anonymous".to_string()
                } else {
                    request.username.trim().to_string()
                };
                let difficulty = if request.difficulty.trim().is_empty() {
                    "medium".to_string()
                } else {
                    request.difficulty.trim().to_lowercase()
                };

                // Create session
                if let Err(e) =
                    sqlx::query("INSERT INTO quiz_sessions (id, username, difficulty, created_at) VALUES (?, ?, ?, ?)")
                        .bind(&session_id)
                        .bind(&username)
                        .bind(&difficulty)
                        .bind(&created_at)
                        .execute(&pool_quiz)
                        .await
                {
                    eprintln!("Error creating session: {}", e);
                }

                // Define difficulty parameters
                let (operators, max_num) = match difficulty.as_str() {
                    "easy" => (vec!["+", "-"], 20),
                    "hard" => (vec!["+", "-", "*", "/"], 1000),
                    _ => (vec!["+", "-", "*"], 100),
                };

                let mut i = 0;
                while i < 10 {
                    let operator = operators[rng.gen_range(0..operators.len())];

                    let (n1, n2, correct_answer) = match operator {
                        "+" => {
                            if difficulty == "easy" {
                                let num1 = rng.gen_range(0..=max_num);
                                let remaining = max_num - num1;
                                let num2 = rng.gen_range(0..=remaining);
                                let result = num1 + num2;
                                (num1, num2, result)
                            } else {
                                let num1 = rng.gen_range(0..=max_num);
                                let remaining = max_num - num1;
                                let num2 = rng.gen_range(0..=remaining);
                                let result = num1 + num2;
                                (num1, num2, result)
                            }
                        }
                        "-" => {
                            if difficulty == "easy" {
                                let num1 = rng.gen_range(0..=max_num);
                                let num2 = rng.gen_range(0..=num1);
                                let result = num1 - num2;
                                (num1, num2, result)
                            } else {
                                let result = rng.gen_range(0..=max_num);
                                let num2 = rng.gen_range(0..=max_num);
                                let num1 = result + num2;
                                (num1, num2, result)
                            }
                        }
                        "*" => {
                            if difficulty == "medium" {
                                let tables = vec![2, 3, 4, 5, 10];
                                let multiplier = tables[rng.gen_range(0..tables.len())];
                                let other = rng.gen_range(1..=12);
                                let result = multiplier * other;
                                (multiplier, other, result)
                            } else {
                                let num1 = rng.gen_range(2..=31);
                                let num2 = rng.gen_range(2..=31);
                                let result = num1 * num2;
                                (num1, num2, result)
                            }
                        }
                        "/" => {
                            let divisor = rng.gen_range(2..=20);
                            let quotient = rng.gen_range(2..=50);
                            let dividend = divisor * quotient;
                            (dividend, divisor, quotient)
                        }
                        _ => (0, 0, 0),
                    };

                    let key = (n1, n2, operator.to_string());
                    if seen.contains(&key) {
                        continue;
                    }
                    seen.insert(key);

                    let question_text = format!("{} {} {}", n1, operator, n2);

                    // Save question to database
                    if let Err(e) = sqlx::query(
                        r#"
                        INSERT INTO questions
                        (session_id, question_id, num1, num2, operator, question_text, correct_answer)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        "#,
                    )
                    .bind(&session_id)
                    .bind(i as i32)
                    .bind(n1)
                    .bind(n2)
                    .bind(operator)
                    .bind(&question_text)
                    .bind(correct_answer)
                    .execute(&pool_quiz)
                    .await
                    {
                        eprintln!("Error saving question: {}", e);
                    }

                    questions.push(Question {
                        id: i,
                        num1: n1,
                        num2: n2,
                        operator: operator.to_string(),
                        question: question_text,
                    });
                    i += 1;
                }

                Json(QuizResponse {
                    session_id,
                    questions,
                })
            }),
        )
        .route(
            "/api/check-answer",
            post(move |Json(payload): Json<CheckAnswerRequest>| async move {
                let correct_answer = match payload.question.operator.as_str() {
                    "+" => payload.question.num1 + payload.question.num2,
                    "-" => payload.question.num1 - payload.question.num2,
                    "*" => payload.question.num1 * payload.question.num2,
                    "/" => payload.question.num1 / payload.question.num2,
                    _ => 0,
                };

                let is_correct = payload.answer == correct_answer;
                let answered_at = Utc::now().to_rfc3339();

                // Save answer to database
                if let Err(e) = sqlx::query(
                    r#"
                    INSERT INTO answers
                    (session_id, question_id, user_answer, is_correct, answered_at)
                    VALUES (?, ?, ?, ?, ?)
                    "#,
                )
                .bind(&payload.session_id)
                .bind(payload.question_id as i32)
                .bind(payload.answer)
                .bind(is_correct)
                .bind(&answered_at)
                .execute(&pool_answer)
                .await
                {
                    eprintln!("Error saving answer: {}", e);
                }

                Json(CheckAnswerResponse {
                    correct: is_correct,
                    correct_answer,
                })
            }),
        )
        .route(
            "/api/stats",
            get(move || async move {
                let stats = sqlx::query_as::<_, UserStat>(
                    r#"
                    SELECT
                        qs.username,
                        qs.difficulty,
                        COUNT(a.id) as total_questions,
                        COALESCE(SUM(a.is_correct), 0) as correct_answers
                    FROM answers a
                    JOIN quiz_sessions qs ON a.session_id = qs.id
                    GROUP BY qs.username, qs.difficulty
                    ORDER BY qs.username, qs.difficulty
                    "#,
                )
                .fetch_all(&pool_stats)
                .await
                .unwrap_or_else(|e| {
                    eprintln!("Error fetching stats: {}", e);
                    vec![]
                });
                Json(stats)
            }),
        )
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("🎮 Math Hunter Backend running on http://{}", addr);
    println!("📊 Database: math_hunter.db");

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
