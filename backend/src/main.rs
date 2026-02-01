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

async fn init_database(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS quiz_sessions (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

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

    let app = Router::new()
        .route(
            "/api/quiz",
            get(move || async move {
                let mut rng = StdRng::from_entropy();
                let mut questions = Vec::new();
                let session_id = Uuid::new_v4().to_string();
                let created_at = Utc::now().to_rfc3339();

                // Create session
                if let Err(e) =
                    sqlx::query("INSERT INTO quiz_sessions (id, created_at) VALUES (?, ?)")
                        .bind(&session_id)
                        .bind(&created_at)
                        .execute(&pool_quiz)
                        .await
                {
                    eprintln!("Error creating session: {}", e);
                }

                for i in 0..5 {
                    let num1 = rng.gen_range(0..=100);
                    let num2 = rng.gen_range(0..=100);
                    let operator = if rng.gen_bool(0.5) { "+" } else { "-" };

                    let (n1, n2) = if operator == "-" && num2 > num1 {
                        (num2, num1)
                    } else {
                        (num1, num2)
                    };

                    let question_text = format!("{} {} {}", n1, operator, n2);
                    let correct_answer = match operator {
                        "+" => n1 + n2,
                        "-" => n1 - n2,
                        _ => 0,
                    };

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
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("🎮 Math Hunter Backend running on http://{}", addr);
    println!("📊 Database: math_hunter.db");

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
