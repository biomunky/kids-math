import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(null)

  useEffect(() => {
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/quiz')
      const data = await response.json()
      setQuestions(data.questions)
      setAnswers({})
      setResults(null)
      setScore(null)
    } catch (error) {
      console.error('Error fetching questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = (id, value) => {
    setAnswers(prev => ({
      ...prev,
      [id]: value === '' ? '' : parseInt(value) || 0
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const formattedAnswers = Object.entries(answers).map(([id, answer]) => ({
      id: parseInt(id),
      answer: answer === '' ? 0 : answer
    }))

    try {
      const response = await fetch('http://localhost:3000/api/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: formattedAnswers,
          questions: questions
        })
      })
      const data = await response.json()
      setResults(data.results)
      setScore(data.score)
    } catch (error) {
      console.error('Error checking answers:', error)
    }
  }

  const handleRestart = () => {
    fetchQuestions()
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
      </header>

      {!results ? (
        <form onSubmit={handleSubmit} className="quiz-form">
          <div className="questions-container">
            {questions.map((question, index) => (
              <div key={question.id} className="question-card">
                <div className="question-number">Demon #{index + 1}</div>
                <div className="question-text">{question.question} = ?</div>
                <input
                  type="number"
                  className="answer-input"
                  value={answers[question.id] || ''}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  placeholder="Your answer"
                  required
                />
              </div>
            ))}
          </div>
          <button type="submit" className="submit-btn">
            ⚔️ BANISH THE DEMONS ⚔️
          </button>
        </form>
      ) : (
        <div className="results-container">
          <div className="score-display">
            <h2>Battle Results</h2>
            <div className="score">
              {score} / {questions.length} Demons Defeated!
            </div>
          </div>

          <div className="results-list">
            {results.map((result, index) => (
              <div
                key={result.id}
                className={`result-card ${result.correct ? 'correct' : 'incorrect'}`}
              >
                <div className="result-icon">
                  {result.correct ? '✨' : '💀'}
                </div>
                <div className="result-details">
                  <div className="question-info">
                    Demon #{index + 1}: {questions[result.id].question}
                  </div>
                  <div className="answer-info">
                    Your answer: {result.user_answer}
                    {!result.correct && (
                      <span className="correct-answer">
                        {' '}(Correct: {result.correct_answer})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
