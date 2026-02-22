import { useState } from 'react'
import './App.css'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// --- API helpers -----------------------------------------------------------
async function generateQuiz(username, difficulty) {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke('generate_quiz', { username, difficulty })
  }
  const res = await fetch('/api/quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, difficulty }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function checkAnswer(sessionId, questionId, answer, question) {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke('check_answer', { sessionId, questionId, answer, question })
  }
  const res = await fetch('/api/check-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      answer,
      question,
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function getStats() {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke('get_stats')
  }
  const res = await fetch('/api/stats')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
// ---------------------------------------------------------------------------

const DEMON_ICONS = ['⚔️', '🗡️', '🛡️', '🔮', '⚡']

function App() {
  const [username, setUsername] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [questions, setQuestions] = useState([])
  const [currentAnswers, setCurrentAnswers] = useState({})
  const [questionResults, setQuestionResults] = useState({})
  const [loading, setLoading] = useState(false)
  const [quizSessionId, setQuizSessionId] = useState(null)
  const [showHelp, setShowHelp] = useState(false)
  const [helpOperator, setHelpOperator] = useState(null)
  const [activeTab, setActiveTab] = useState('play')
  const [stats, setStats] = useState([])
  const [statsLoading, setStatsLoading] = useState(false)

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
      const data = await generateQuiz(username, difficulty)
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
      const data = await checkAnswer(quizSessionId, questionId, answer, question)

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

  const getOperatorHelp = (operator) => {
    const helpText = {
      '+': {
        title: 'Addition Strategy',
        tips: [
          'Start from the ones place (rightmost digit) and work left',
          'Add the digits in each column',
          'If a column sum is 10 or more, carry the 1 to the next column',
          'For mental math, try breaking numbers into tens: 37 + 28 = (30 + 20) + (7 + 8)',
          'Check your answer by adding in reverse order'
        ]
      },
      '-': {
        title: 'Subtraction Strategy',
        tips: [
          'Start from the ones place (rightmost digit) and work left',
          'If the top digit is smaller, borrow 10 from the next column',
          'For mental math, count up from the smaller number: 54 - 27 = ? Think: 27 + ? = 54',
          'You can also add the same number to both: 54 - 27 = (54+3) - (27+3) = 57 - 30',
          'Check your answer by adding: answer + subtracted number = original number'
        ]
      },
      '*': {
        title: 'Multiplication Strategy',
        tips: [
          'Break larger numbers into parts: 8 × 7 = (8 × 5) + (8 × 2) = 40 + 16 = 56',
          'Use the times tables you know well as anchors',
          'For numbers ending in 5 or 0, use those patterns: 12 × 5 = (12 × 10) ÷ 2',
          'Doubling strategy: 8 × 6 = double of (4 × 6) = double of 24 = 48',
          'Remember: the order doesn\'t matter (7 × 9 = 9 × 7)'
        ]
      },
      '/': {
        title: 'Division Strategy',
        tips: [
          'Think: what number times the divisor equals the dividend?',
          'Use multiplication facts you know: 56 ÷ 8 = ? Think: 8 × ? = 56',
          'Break it into easier chunks: 84 ÷ 4 = (80 ÷ 4) + (4 ÷ 4) = 20 + 1',
          'Use halving for even numbers: 72 ÷ 8 = 36 ÷ 4 = 18 ÷ 2 = 9',
          'Check your answer by multiplying: answer × divisor = original number'
        ]
      }
    }
    return helpText[operator] || { title: 'Help', tips: [] }
  }

  const handleShowHelp = (operator) => {
    setHelpOperator(operator)
    setShowHelp(true)
  }

  const handleCloseHelp = () => {
    setShowHelp(false)
    setHelpOperator(null)
  }

  const handleTabChange = async (tab) => {
    setActiveTab(tab)
    if (tab === 'stats') {
      setStatsLoading(true)
      try {
        const data = await getStats()
        setStats(data)
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setStatsLoading(false)
      }
    }
  }

  const renderStats = () => (
    <div className="stats-container">
      <h2 className="stats-title">Hunter Records</h2>
      {statsLoading ? (
        <div className="stats-loading">
          <div className="demon-icon">👹</div>
          <p>Loading records...</p>
        </div>
      ) : stats.length === 0 ? (
        <div className="stats-empty">
          No records yet. Start playing to build your legend!
        </div>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Hunter</th>
              <th>Level</th>
              <th>Questions</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat, i) => (
              <tr key={i}>
                <td className="hunter-cell">{stat.username}</td>
                <td>
                  <span className={`difficulty-badge difficulty-${stat.difficulty}`}>
                    {stat.difficulty.charAt(0).toUpperCase() + stat.difficulty.slice(1)}
                  </span>
                </td>
                <td>{stat.total_questions}</td>
                <td className="correct-cell">{stat.correct_answers}</td>
                <td className="wrong-cell">{stat.total_questions - stat.correct_answers}</td>
                <td className="accuracy-cell">
                  {stat.total_questions > 0
                    ? Math.round(stat.correct_answers / stat.total_questions * 100)
                    : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  const renderPlay = () => {
    if (!isLoggedIn) {
      return (
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
              <div className="difficulty-selector">
                <label className="difficulty-label">Choose your difficulty:</label>
                <div className="difficulty-buttons">
                  <button
                    type="button"
                    className={`difficulty-btn ${difficulty === 'easy' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('easy')}
                  >
                    🌟 Easy
                    <span className="difficulty-desc">(+/- up to 20)</span>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-btn ${difficulty === 'medium' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('medium')}
                  >
                    ⚡ Medium
                    <span className="difficulty-desc">(+/- up to 100, times tables)</span>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-btn ${difficulty === 'hard' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('hard')}
                  >
                    🔥 Hard
                    <span className="difficulty-desc">(all ops up to 1000)</span>
                  </button>
                </div>
              </div>
              <button type="submit" className="login-btn">
                ⚔️ BEGIN HUNT ⚔️
              </button>
            </form>
          </div>
        </div>
      )
    }

    if (loading) {
      return (
        <div className="loading">
          <div className="demon-icon">👹</div>
          <h2>Summoning Math Demons...</h2>
        </div>
      )
    }

    return (
      <>
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
                  <div className="question-header">
                    <div className="question-number">Demon #{index + 1}</div>
                    <button
                      className="help-btn"
                      onClick={() => handleShowHelp(question.operator)}
                      title="Get help with this operation"
                    >
                      ❓ Help
                    </button>
                  </div>
                  <div className="question-text">{question.question} = ?</div>

                  {!isAnswered ? (
                    <div className="answer-section">
                      <input
                        type="number"
                        className="answer-input"
                        value={currentAnswers[question.id] ?? ''}
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

            <div className="restart-difficulty-section">
              <label className="restart-difficulty-label">Choose difficulty for next round:</label>
              <div className="restart-difficulty-buttons">
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'easy' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('easy')}
                >
                  🌟 Easy
                  <span className="difficulty-desc">(+/- up to 20)</span>
                </button>
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'medium' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('medium')}
                >
                  ⚡ Medium
                  <span className="difficulty-desc">(+/- up to 100, times tables)</span>
                </button>
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'hard' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('hard')}
                >
                  🔥 Hard
                  <span className="difficulty-desc">(all ops up to 1000)</span>
                </button>
              </div>
            </div>

            <button onClick={handleRestart} className="restart-btn">
              🔄 SUMMON NEW DEMONS 🔄
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="app">
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'play' ? 'active' : ''}`}
          onClick={() => handleTabChange('play')}
        >
          ⚔️ Play
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => handleTabChange('stats')}
        >
          📊 Stats
        </button>
      </div>

      {activeTab === 'stats' ? renderStats() : renderPlay()}

      {showHelp && helpOperator && (
        <div className="modal-overlay" onClick={handleCloseHelp}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{getOperatorHelp(helpOperator).title}</h2>
              <button className="modal-close-btn" onClick={handleCloseHelp}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-intro">Here are some strategies to help you solve this type of problem:</p>
              <ul className="strategy-list">
                {getOperatorHelp(helpOperator).tips.map((tip, index) => (
                  <li key={index} className="strategy-item">
                    <span className="strategy-number">{index + 1}.</span>
                    <span className="strategy-text">{tip}</span>
                  </li>
                ))}
              </ul>
              <div className="modal-footer">
                <p className="modal-hint">💡 Try applying one of these strategies to your current problem!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
