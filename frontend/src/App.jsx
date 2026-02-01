import { useState, useEffect } from 'react'
import './App.css'

const DEMON_ICONS = ['⚔️', '🗡️', '🛡️', '🔮', '⚡']

function App() {
  const [username, setUsername] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [questions, setQuestions] = useState([])
  const [currentAnswers, setCurrentAnswers] = useState({})
  const [questionResults, setQuestionResults] = useState({})
  const [loading, setLoading] = useState(false)
  const [quizSessionId, setQuizSessionId] = useState(null)

  const handleLogin = (e) => {
    e.preventDefault()
    if (username.trim()) {
      setIsLoggedIn(true)
      fetchQuestions()
    }
  }

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username
        })
      })
      const data = await response.json()
      setQuestions(data.questions)
      setQuizSessionId(data.session_id)
      setCurrentAnswers({})
      setQuestionResults({})
    } catch (error) {
      console.error('Error fetching questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (id, value) => {
    if (questionResults[id]) return

    setCurrentAnswers(prev => ({
      ...prev,
      [id]: value === '' ? '' : parseInt(value) || 0
    }))
  }

  const handleSubmitAnswer = async (questionId) => {
    const answer = currentAnswers[questionId]
    if (answer === '' || answer === undefined) return

    const question = questions.find(q => q.id === questionId)

    try {
      const response = await fetch('http://localhost:3000/api/check-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: quizSessionId,
          question_id: questionId,
          answer: answer,
          question: question
        })
      })
      const data = await response.json()

      setQuestionResults(prev => ({
        ...prev,
        [questionId]: {
          correct: data.correct,
          user_answer: answer,
          correct_answer: data.correct_answer
        }
      }))
    } catch (error) {
      console.error('Error checking answer:', error)
    }
  }

  const handleKeyPress = (e, questionId) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmitAnswer(questionId)
    }
  }

  const handleRestart = () => {
    fetchQuestions()
  }

  const getTotalScore = () => {
    return Object.values(questionResults).filter(r => r.correct).length
  }

  const allQuestionsAnswered = () => {
    return questions.length > 0 && Object.keys(questionResults).length === questions.length
  }

  if (!isLoggedIn) {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-card">
            <h1 className="login-title">
              <span className="demon-emoji">👹</span>
              K-POP DEMON HUNTER
              <span className="demon-emoji">👹</span>
            </h1>
            <p className="login-subtitle">Enter the arena, brave hunter!</p>
            <form onSubmit={handleLogin} className="login-form">
              <input
                type="text"
                className="username-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your hunter name"
                maxLength={20}
                required
                autoFocus
              />
              <button type="submit" className="login-btn">
                ⚔️ BEGIN HUNT ⚔️
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="demon-icon">👹</div>
          <h2>Summoning Math Demons...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">
          <span className="demon-emoji">👹</span>
          K-POP DEMON HUNTER
          <span className="demon-emoji">👹</span>
        </h1>
        <p className="subtitle">Defeat the demons with your math powers!</p>
        <div className="username-display">Hunter: {username}</div>
        {questions.length > 0 && (
          <div className="score-tracker">
            Score: {getTotalScore()} / {questions.length}
          </div>
        )}
      </header>

      <div className="questions-container">
        {questions.map((question, index) => {
          const result = questionResults[question.id]
          const isAnswered = !!result

          return (
            <div
              key={question.id}
              className={`question-card ${isAnswered ? (result.correct ? 'answered-correct' : 'answered-incorrect') : ''}`}
            >
              <div className="question-icon">{DEMON_ICONS[index % DEMON_ICONS.length]}</div>

              <div className="question-content">
                <div className="question-number">Demon #{index + 1}</div>
                <div className="question-text">{question.question} = ?</div>

                {!isAnswered ? (
                  <div className="answer-section">
                    <input
                      type="number"
                      className="answer-input"
                      value={currentAnswers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, question.id)}
                      placeholder="Your answer"
                    />
                    <button
                      type="button"
                      className="submit-answer-btn"
                      onClick={() => handleSubmitAnswer(question.id)}
                      disabled={!currentAnswers[question.id] && currentAnswers[question.id] !== 0}
                    >
                      ATTACK!
                    </button>
                  </div>
                ) : (
                  <div className="result-section">
                    <div className="result-icon-large">
                      {result.correct ? '✨' : '💀'}
                    </div>
                    <div className="result-message">
                      {result.correct ? (
                        <span className="correct-msg">DEMON DEFEATED!</span>
                      ) : (
                        <span className="incorrect-msg">
                          Wrong! The answer was {result.correct_answer}
                        </span>
                      )}
                    </div>
                    <div className="your-answer">Your answer: {result.user_answer}</div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {allQuestionsAnswered() && (
        <div className="final-results">
          <div className="final-score-display">
            <h2>Battle Complete!</h2>
            <div className="final-score">
              {getTotalScore()} / {questions.length} Demons Defeated!
            </div>
            <div className="performance-message">
              {getTotalScore() === questions.length && "Perfect! You're a legendary demon hunter!"}
              {getTotalScore() >= questions.length * 0.6 && getTotalScore() < questions.length && "Great job! Keep training!"}
              {getTotalScore() < questions.length * 0.6 && "Keep practicing! You'll get stronger!"}
            </div>
          </div>

          <button onClick={handleRestart} className="restart-btn">
            🔄 SUMMON NEW DEMONS 🔄
          </button>
        </div>
      )}
    </div>
  )
}

export default App
