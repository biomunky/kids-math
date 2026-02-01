use axum::{
    extract::Json,
    routing::{get, post},
    Router,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

#[derive(Debug, Serialize, Deserialize)]
struct Question {
    id: usize,
    num1: i32,
    num2: i32,
    operator: String,
    question: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct QuizResponse {
    questions: Vec<Question>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Answer {
    id: usize,
    answer: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct CheckAnswersRequest {
    answers: Vec<Answer>,
    questions: Vec<Question>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnswerResult {
    id: usize,
    correct: bool,
    user_answer: i32,
    correct_answer: i32,
}

#[derive(Debug, Serialize, Deserialize)]
struct CheckAnswersResponse {
    results: Vec<AnswerResult>,
    score: usize,
}

async fn generate_quiz() -> Json<QuizResponse> {
    let mut rng = rand::thread_rng();
    let mut questions = Vec::new();

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

        questions.push(Question {
            id: i,
            num1: n1,
            num2: n2,
            operator: operator.to_string(),
            question: question_text,
        });
    }

    Json(QuizResponse { questions })
}

async fn check_answers(Json(payload): Json<CheckAnswersRequest>) -> Json<CheckAnswersResponse> {
    let mut results = Vec::new();
    let mut score = 0;

    for answer in payload.answers {
        if let Some(question) = payload.questions.iter().find(|q| q.id == answer.id) {
            let correct_answer = match question.operator.as_str() {
                "+" => question.num1 + question.num2,
                "-" => question.num1 - question.num2,
                _ => 0,
            };

            let is_correct = answer.answer == correct_answer;
            if is_correct {
                score += 1;
            }

            results.push(AnswerResult {
                id: answer.id,
                correct: is_correct,
                user_answer: answer.answer,
                correct_answer,
            });
        }
    }

    Json(CheckAnswersResponse { results, score })
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/quiz", get(generate_quiz))
        .route("/api/check", post(check_answers))
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("🎮 Math Hunter Backend running on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
