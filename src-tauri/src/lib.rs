use chrono::Utc;
use rand::{Rng, SeedableRng};
use rand::rngs::StdRng;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions, SqlitePoolOptions};
use std::str::FromStr;
use tauri::{Manager, State};
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
struct CheckAnswerResponse {
    correct: bool,
    correct_answer: i32,
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

#[tauri::command]
async fn generate_quiz(
    username: String,
    difficulty: String,
    db: State<'_, SqlitePool>,
) -> Result<QuizResponse, String> {
    let mut rng = StdRng::from_entropy();
    let mut questions = Vec::new();
    let session_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    let username = if username.trim().is_empty() {
        "Anonymous".to_string()
    } else {
        username.trim().to_string()
    };
    let difficulty = if difficulty.trim().is_empty() {
        "medium".to_string()
    } else {
        difficulty.trim().to_lowercase()
    };

    // Create session
    if let Err(e) =
        sqlx::query("INSERT INTO quiz_sessions (id, username, difficulty, created_at) VALUES (?, ?, ?, ?)")
            .bind(&session_id)
            .bind(&username)
            .bind(&difficulty)
            .bind(&created_at)
            .execute(db.inner())
            .await
    {
        eprintln!("Error creating session: {}", e);
        return Err(format!("Failed to create session: {}", e));
    }

    // Define difficulty parameters
    let max_operand = match difficulty.as_str() {
        "easy" => 10,
        "hard" => 50,
        _ => 20,
    };

    for i in 0..5 {
        // Always use + or - operators
        let operators = vec!["+", "-"];
        let operator = operators[rng.gen_range(0..operators.len())];

        // Generate a result between 0 and 10
        let correct_answer = rng.gen_range(0..=10);

        // Generate operands that will produce this result
        let (n1, n2) = if operator == "+" {
            let num1 = rng.gen_range(0..=correct_answer);
            let num2 = correct_answer - num1;
            (num1, num2)
        } else {
            let num2 = rng.gen_range(0..=max_operand);
            let num1 = correct_answer + num2;
            (num1, num2)
        };

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
        .execute(db.inner())
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

    Ok(QuizResponse {
        session_id,
        questions,
    })
}

#[tauri::command]
async fn check_answer(
    session_id: String,
    question_id: usize,
    answer: i32,
    question: Question,
    db: State<'_, SqlitePool>,
) -> Result<CheckAnswerResponse, String> {
    let correct_answer = match question.operator.as_str() {
        "+" => question.num1 + question.num2,
        "-" => question.num1 - question.num2,
        "*" => question.num1 * question.num2,
        "/" => question.num1 / question.num2,
        _ => 0,
    };

    let is_correct = answer == correct_answer;
    let answered_at = Utc::now().to_rfc3339();

    // Save answer to database
    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO answers
        (session_id, question_id, user_answer, is_correct, answered_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&session_id)
    .bind(question_id as i32)
    .bind(answer)
    .bind(is_correct)
    .bind(&answered_at)
    .execute(db.inner())
    .await
    {
        eprintln!("Error saving answer: {}", e);
        return Err(format!("Failed to save answer: {}", e));
    }

    Ok(CheckAnswerResponse {
        correct: is_correct,
        correct_answer,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Get the app data directory
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data directory");

            // Create the directory if it doesn't exist
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

            // Set up database path
            let db_path = app_data_dir.join("math_hunter.db");
            let database_url = format!("sqlite://{}", db_path.display());

            println!("📊 Database location: {}", db_path.display());

            // Get handle before moving app
            let handle = app.handle().clone();

            // Initialize database connection
            let pool = tauri::async_runtime::block_on(async {
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

                pool
            });

            // Manage the pool in Tauri's state
            app.manage(pool);

            if cfg!(debug_assertions) {
                handle.plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![generate_quiz, check_answer])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
