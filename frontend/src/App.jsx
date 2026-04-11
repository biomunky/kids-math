import { useState } from 'react'
import './App.css'

import ballPoke from './assets/pokemon/ball_poke.png'
import ballGreat from './assets/pokemon/ball_great.png'
import ballUltra from './assets/pokemon/ball_ultra.png'
import ballMaster from './assets/pokemon/ball_master.png'

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

const POKEMON_NAMES = {
  1: 'Bulbasaur', 3: 'Venusaur', 4: 'Charmander', 6: 'Charizard', 7: 'Squirtle',
  9: 'Blastoise', 12: 'Butterfree', 16: 'Pidgey', 19: 'Rattata', 25: 'Pikachu',
  26: 'Raichu', 27: 'Sandshrew', 35: 'Clefairy', 37: 'Vulpix', 39: 'Jigglypuff',
  50: 'Diglett', 52: 'Meowth', 54: 'Psyduck', 58: 'Growlithe', 60: 'Poliwag',
  63: 'Abra', 66: 'Machop', 70: 'Weepinbell', 74: 'Geodude', 77: 'Ponyta',
  79: 'Slowpoke', 81: 'Magnemite', 86: 'Seel', 87: 'Dewgong', 90: 'Shellder',
  92: 'Gastly', 94: 'Gengar', 95: 'Onix', 98: 'Krabby', 102: 'Exeggcute',
  104: 'Cubone', 108: 'Lickitung', 113: 'Chansey', 115: 'Kangaskhan', 120: 'Staryu',
  122: 'Mr. Mime', 125: 'Electabuzz', 129: 'Magikarp', 131: 'Lapras', 133: 'Eevee',
  135: 'Jolteon', 143: 'Snorlax', 147: 'Dratini', 150: 'Mewtwo', 151: 'Mew',
  152: 'Chikorita', 155: 'Cyndaquil', 158: 'Totodile', 161: 'Sentret', 163: 'Hoothoot',
  172: 'Pichu', 175: 'Togepi', 179: 'Mareep', 183: 'Marill', 190: 'Aipom',
  196: 'Espeon', 197: 'Umbreon', 200: 'Misdreavus', 201: 'Unown', 215: 'Sneasel',
  225: 'Delibird', 228: 'Houndour', 249: 'Lugia', 251: 'Celebi', 252: 'Treecko',
  255: 'Torchic', 258: 'Mudkip', 280: 'Ralts', 282: 'Gardevoir', 300: 'Skitty',
  302: 'Sableye', 359: 'Absol', 384: 'Rayquaza', 447: 'Riolu', 448: 'Lucario',
  470: 'Leafeon', 471: 'Glaceon', 493: 'Arceus', 494: 'Victini', 570: 'Zorua',
  571: 'Zoroark', 613: 'Cubchoo',
}

const spriteModules = import.meta.glob('./assets/pokemon/poke_*.gif', { eager: true, import: 'default' })
const POKEMON_SPRITES = Object.entries(spriteModules)
  .map(([path, src]) => {
    const id = parseInt(path.match(/poke_(\d+)\.gif/)[1], 10)
    return { name: POKEMON_NAMES[id] ?? `Pokémon #${id}`, src }
  })

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
  const [quizSprites, setQuizSprites] = useState([])

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
      const shuffled = shuffle(POKEMON_SPRITES)
      const needed = data.questions.length
      const picked = []
      for (let i = 0; i < needed; i++) picked.push(shuffled[i % shuffled.length])
      setQuizSprites(picked)
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
      <h2 className="stats-title">Trainer Pokédex</h2>
      {statsLoading ? (
        <div className="stats-loading">
          <img src={ballPoke} alt="pokeball" className="spin-ball" />
          <p>Loading records...</p>
        </div>
      ) : stats.length === 0 ? (
        <div className="stats-empty">
          No records yet. Catch 'em all to build your legend!
        </div>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Trainer</th>
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
              <img src={ballPoke} alt="pokeball" className="title-ball" />
              MATH TRAINER
              <img src={ballPoke} alt="pokeball" className="title-ball" />
            </h1>
            <p className="login-subtitle">Gotta solve 'em all!</p>
            <form onSubmit={handleLogin} className="login-form">
              <input
                type="text"
                className="username-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your trainer name"
                maxLength={20}
                required
                autoFocus
              />
              <div className="difficulty-selector">
                <label className="difficulty-label">Choose your badge:</label>
                <div className="difficulty-buttons">
                  <button
                    type="button"
                    className={`difficulty-btn ${difficulty === 'easy' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('easy')}
                  >
                    <img src={ballPoke} alt="" className="badge-ball" />
                    Poké Ball
                    <span className="difficulty-desc">(+/- up to 20)</span>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-btn ${difficulty === 'medium' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('medium')}
                  >
                    <img src={ballGreat} alt="" className="badge-ball" />
                    Great Ball
                    <span className="difficulty-desc">(+/- up to 100, ×)</span>
                  </button>
                  <button
                    type="button"
                    className={`difficulty-btn ${difficulty === 'hard' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('hard')}
                  >
                    <img src={ballUltra} alt="" className="badge-ball" />
                    Ultra Ball
                    <span className="difficulty-desc">(all ops up to 1000)</span>
                  </button>
                </div>
              </div>
              <button type="submit" className="login-btn">
                START JOURNEY
              </button>
            </form>
          </div>
        </div>
      )
    }

    if (loading) {
      return (
        <div className="loading">
          <img src={ballPoke} alt="pokeball" className="spin-ball-large" />
          <h2>A wild Pokémon appears...</h2>
        </div>
      )
    }

    return (
      <>
        <header className="header">
          <h1 className="title">
            <img src={ballPoke} alt="pokeball" className="title-ball" />
            MATH TRAINER
            <img src={ballPoke} alt="pokeball" className="title-ball" />
          </h1>
          <p className="subtitle">Battle Pokémon with your math powers!</p>
          <div className="username-display">Trainer: {username}</div>
          {questions.length > 0 && (
            <div className="score-tracker">
              Caught: {getTotalScore()} / {questions.length}
            </div>
          )}
        </header>

        <div className="questions-container">
          {questions.map((question, index) => {
            const result = questionResults[question.id]
            const isAnswered = !!result
            const sprite = quizSprites[index] ?? POKEMON_SPRITES[index % POKEMON_SPRITES.length]

            return (
              <div
                key={question.id}
                className={`question-card ${isAnswered ? (result.correct ? 'answered-correct' : 'answered-incorrect') : ''}`}
              >
                <div className="question-icon">
                  <img src={sprite.src} alt={sprite.name} className="pokemon-sprite" />
                </div>

                <div className="question-content">
                  <div className="question-header">
                    <div className="question-number">Wild {sprite.name}</div>
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
                        THROW BALL!
                      </button>
                    </div>
                  ) : (
                    <div className="result-section">
                      <div className="result-icon-large">
                        {result.correct
                          ? <img src={ballPoke} alt="caught" className="result-ball" />
                          : <img src={ballPoke} alt="miss" className="result-ball faded" />}
                      </div>
                      <div className="result-message">
                        {result.correct ? (
                          <span className="correct-msg">Gotcha! {sprite.name} was caught!</span>
                        ) : (
                          <span className="incorrect-msg">
                            Oh no! It broke free. Answer was {result.correct_answer}
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
                {getTotalScore()} / {questions.length} Pokémon Caught!
              </div>
              <div className="performance-message">
                {getTotalScore() === questions.length && "You're a Pokémon Master!"}
                {getTotalScore() >= questions.length * 0.6 && getTotalScore() < questions.length && "Great job, Trainer! Keep training!"}
                {getTotalScore() < questions.length * 0.6 && "Keep practicing at the Pokémon Center!"}
              </div>
            </div>

            <div className="restart-difficulty-section">
              <label className="restart-difficulty-label">Choose ball type for next battle:</label>
              <div className="restart-difficulty-buttons">
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'easy' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('easy')}
                >
                  <img src={ballPoke} alt="" className="badge-ball" />
                  Poké Ball
                  <span className="difficulty-desc">(+/- up to 20)</span>
                </button>
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'medium' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('medium')}
                >
                  <img src={ballGreat} alt="" className="badge-ball" />
                  Great Ball
                  <span className="difficulty-desc">(+/- up to 100, ×)</span>
                </button>
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'hard' ? 'selected' : ''}`}
                  onClick={() => setDifficulty('hard')}
                >
                  <img src={ballUltra} alt="" className="badge-ball" />
                  Ultra Ball
                  <span className="difficulty-desc">(all ops up to 1000)</span>
                </button>
              </div>
            </div>

            <button onClick={handleRestart} className="restart-btn">
              FIND NEW POKÉMON
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
          <img src={ballPoke} alt="" className="tab-ball" /> Play
        </button>
        <button
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => handleTabChange('stats')}
        >
          <img src={ballMaster} alt="" className="tab-ball" /> Pokédex
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
