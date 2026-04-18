import { useState, useEffect } from 'react'
import './App.css'

import ballPoke from './assets/pokemon/ball_poke.png'
import ballGreat from './assets/pokemon/ball_great.png'
import ballUltra from './assets/pokemon/ball_ultra.png'
import ballMaster from './assets/pokemon/ball_master.png'
import ballNet from './assets/pokemon/ball_net.png'
import ballSafari from './assets/pokemon/ball_safari.png'
import ballHeal from './assets/pokemon/ball_heal.png'
import ballPremier from './assets/pokemon/ball_premier.png'
import pokemonNamesData from './pokemonNames.json'

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

const POKEMON_NAMES = Object.fromEntries(
  Object.entries(pokemonNamesData).map(([k, v]) => [parseInt(k, 10), v])
)

const BALL_SPRITES = [ballPoke, ballGreat, ballUltra, ballMaster, ballNet, ballSafari, ballHeal, ballPremier]

const spriteModules = import.meta.glob('./assets/pokemon/poke_*.gif', { eager: true, import: 'default' })
const POKEMON_SPRITES = Object.entries(spriteModules)
  .map(([path, src]) => {
    const id = parseInt(path.match(/poke_(\d+)\.gif/)[1], 10)
    return { id, name: POKEMON_NAMES[id] ?? `Pokémon #${id}`, src }
  })
  .sort((a, b) => a.id - b.id)

const POKEMON_BY_ID = Object.fromEntries(POKEMON_SPRITES.map(p => [p.id, p]))

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard']
const DIFFICULTY_LABELS = { easy: 'Poké Ball', medium: 'Great Ball', hard: 'Ultra Ball' }

function computeCorrectAnswer(q) {
  switch (q.operator) {
    case '+': return q.num1 + q.num2
    case '-': return q.num1 - q.num2
    case '*': return q.num1 * q.num2
    case '/': return Math.trunc(q.num1 / q.num2)
    default: return 0
  }
}

function suggestNextDifficulty(current, correct, total) {
  if (total === 0) return { next: current, direction: 'same' }
  const accuracy = correct / total
  const idx = DIFFICULTY_ORDER.indexOf(current)
  if (accuracy >= 0.9 && idx < DIFFICULTY_ORDER.length - 1) {
    return { next: DIFFICULTY_ORDER[idx + 1], direction: 'up' }
  }
  if (accuracy <= 0.4 && idx > 0) {
    return { next: DIFFICULTY_ORDER[idx - 1], direction: 'down' }
  }
  return { next: current, direction: 'same' }
}

const DETAILS_KEY_PREFIX = 'math-hunter-details-v1-'

const TYPE_COLORS = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
}

const STAT_LABELS = {
  'hp': 'HP',
  'attack': 'Attack',
  'defense': 'Defense',
  'special-attack': 'Sp. Atk',
  'special-defense': 'Sp. Def',
  'speed': 'Speed',
}

function prettify(str) {
  return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

async function fetchPokemonDetails(id) {
  const cacheKey = DETAILS_KEY_PREFIX + id
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) return JSON.parse(cached)
  } catch { /* ignore */ }

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
  if (!res.ok) throw new Error(`PokeAPI HTTP ${res.status}`)
  const data = await res.json()

  const condensed = {
    id: data.id,
    name: data.name,
    height: data.height,
    weight: data.weight,
    types: data.types.map(t => t.type.name),
    abilities: data.abilities.map(a => ({ name: a.ability.name, hidden: a.is_hidden })),
    stats: data.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
    moves: data.moves.slice(0, 8).map(m => m.move.name),
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify(condensed))
  } catch { /* ignore */ }

  return condensed
}

const CATCHES_KEY_PREFIX = 'math-hunter-catches-v1-'

function loadCatches(username) {
  if (!username) return {}
  try {
    const raw = localStorage.getItem(CATCHES_KEY_PREFIX + username)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function saveCatches(username, catches) {
  if (!username) return
  try {
    localStorage.setItem(CATCHES_KEY_PREFIX + username, JSON.stringify(catches))
  } catch { /* ignore */ }
}

const SETTINGS_KEY = 'math-hunter-settings-v1'
const defaultSettings = { adaptive: true, dyslexiaFont: false, largeText: false }

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
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
  const [settings, setSettings] = useState(loadSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewIndex, setReviewIndex] = useState(0)
  const [reviewAnswer, setReviewAnswer] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState(null)
  const [adaptiveNotice, setAdaptiveNotice] = useState(null)
  const [catches, setCatches] = useState({})
  const [selectedPokemonId, setSelectedPokemonId] = useState(null)
  const [detailsCache, setDetailsCache] = useState({})
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* ignore */ }
  }, [settings])

  const handleLogin = (e) => {
    e.preventDefault()
    const trimmed = username.trim()
    if (trimmed) {
      setIsLoggedIn(true)
      setCatches(loadCatches(trimmed))
    }
  }

  const handleBackToMenu = () => {
    setQuestions([])
    setCurrentAnswers({})
    setQuestionResults({})
    setQuizSessionId(null)
    setQuizSprites([])
    setAdaptiveNotice(null)
    setActiveTab('play')
  }

  const fetchQuestions = async () => {
    const effectiveDifficulty = difficulty
    setLoading(true)
    try {
      const data = await generateQuiz(username, effectiveDifficulty)
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

      if (data.correct) {
        const idx = questions.findIndex(q => q.id === questionId)
        const sprite = idx >= 0 ? quizSprites[idx] : null
        if (sprite?.id != null) {
          setCatches(prev => {
            const next = { ...prev, [sprite.id]: (prev[sprite.id] ?? 0) + 1 }
            saveCatches(username.trim(), next)
            return next
          })
        }
      }
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
    setAdaptiveNotice(null)
    fetchQuestions()
  }

  const getMissedQuestions = () => {
    return questions.filter(q => {
      const r = questionResults[q.id]
      return r && !r.correct
    })
  }

  const handleStartReview = () => {
    setReviewMode(true)
    setReviewIndex(0)
    setReviewAnswer('')
    setReviewFeedback(null)
  }

  const handleCloseReview = () => {
    setReviewMode(false)
    setReviewFeedback(null)
    setReviewAnswer('')
  }

  const handleReviewSubmit = () => {
    const missed = getMissedQuestions()
    const q = missed[reviewIndex]
    if (!q || reviewAnswer === '') return
    const correct = computeCorrectAnswer(q)
    const userAns = parseInt(reviewAnswer, 10)
    setReviewFeedback({ correct: userAns === correct, correctAnswer: correct, userAnswer: userAns })
  }

  const handleReviewNext = () => {
    const missed = getMissedQuestions()
    if (reviewIndex + 1 >= missed.length) {
      handleCloseReview()
      return
    }
    setReviewIndex(reviewIndex + 1)
    setReviewAnswer('')
    setReviewFeedback(null)
  }

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleOpenPokemonCard = async (id) => {
    setSelectedPokemonId(id)
    setDetailsError(null)
    if (detailsCache[id]) return
    setDetailsLoading(true)
    try {
      const details = await fetchPokemonDetails(id)
      setDetailsCache(prev => ({ ...prev, [id]: details }))
    } catch (err) {
      setDetailsError(err.message ?? 'Failed to load Pokémon data')
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleClosePokemonCard = () => {
    setSelectedPokemonId(null)
    setDetailsError(null)
  }

  const handleSwitchUser = () => {
    setIsLoggedIn(false)
    setUsername('')
    setQuestions([])
    setCurrentAnswers({})
    setQuestionResults({})
    setQuizSessionId(null)
    setQuizSprites([])
    setActiveTab('play')
    setAdaptiveNotice(null)
    setReviewMode(false)
    setCatches({})
  }

  const getTotalScore = () => {
    return Object.values(questionResults).filter(r => r.correct).length
  }

  const allQuestionsAnswered = () => {
    return questions.length > 0 && Object.keys(questionResults).length === questions.length
  }

  useEffect(() => {
    if (!allQuestionsAnswered() || !settings.adaptive || adaptiveNotice) return
    const correct = Object.values(questionResults).filter(r => r.correct).length
    const suggestion = suggestNextDifficulty(difficulty, correct, questions.length)
    if (suggestion.direction !== 'same') {
      setAdaptiveNotice(suggestion)
      setDifficulty(suggestion.next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionResults])

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

  const renderStats = () => {
    if (!isLoggedIn) {
      return (
        <div className="stats-container">
          <h2 className="stats-title">Pokédex</h2>
          <div className="stats-empty">
            Log in as a trainer to see your Pokédex!
          </div>
        </div>
      )
    }

    const trimmedUser = username.trim()
    const userStats = stats.filter(s => s.username === trimmedUser)
    const byDifficulty = { easy: null, medium: null, hard: null }
    for (const s of userStats) {
      if (s.difficulty in byDifficulty) byDifficulty[s.difficulty] = s
    }
    const totalQuestions = userStats.reduce((sum, s) => sum + s.total_questions, 0)
    const totalCorrect = userStats.reduce((sum, s) => sum + s.correct_answers, 0)
    const totalWrong = totalQuestions - totalCorrect

    const caughtCount = Object.values(catches).filter(n => n > 0).length
    const totalPokemon = POKEMON_SPRITES.length

    return (
      <div className="stats-container pokedex-container">
        <div className="pokedex-header">
          <h2 className="stats-title">{trimmedUser}'s Pokédex</h2>
          <div className="pokedex-summary">
            <div className="summary-pill">
              <span className="summary-label">Total Questions</span>
              <span className="summary-value">{totalQuestions}</span>
            </div>
            <div className="summary-pill summary-correct">
              <span className="summary-label">Correct</span>
              <span className="summary-value">{totalCorrect}</span>
            </div>
            <div className="summary-pill summary-wrong">
              <span className="summary-label">Wrong</span>
              <span className="summary-value">{totalWrong}</span>
            </div>
            <div className="summary-pill summary-caught">
              <span className="summary-label">Caught</span>
              <span className="summary-value">{caughtCount} / {totalPokemon}</span>
            </div>
          </div>

          <div className="difficulty-stats-row">
            {DIFFICULTY_ORDER.map(diff => {
              const s = byDifficulty[diff]
              const total = s?.total_questions ?? 0
              const right = s?.correct_answers ?? 0
              const wrong = total - right
              const accuracy = total > 0 ? Math.round((right / total) * 100) : 0
              return (
                <div key={diff} className={`difficulty-card difficulty-${diff}`}>
                  <div className="difficulty-card-title">{DIFFICULTY_LABELS[diff]}</div>
                  <div className="difficulty-card-row">
                    <span>Questions</span><strong>{total}</strong>
                  </div>
                  <div className="difficulty-card-row">
                    <span>Right</span><strong className="correct-cell">{right}</strong>
                  </div>
                  <div className="difficulty-card-row">
                    <span>Wrong</span><strong className="wrong-cell">{wrong}</strong>
                  </div>
                  <div className="difficulty-card-row">
                    <span>Accuracy</span><strong>{accuracy}%</strong>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {statsLoading && (
          <div className="stats-loading">
            <img src={ballPoke} alt="pokeball" className="spin-ball" />
            <p>Loading records...</p>
          </div>
        )}

        <div className="pokedex-grid">
          {POKEMON_SPRITES.map(pokemon => {
            const count = catches[pokemon.id] ?? 0
            const caught = count > 0
            const placeholderBall = BALL_SPRITES[pokemon.id % BALL_SPRITES.length]
            return (
              <div
                key={pokemon.id}
                className={`dex-entry ${caught ? 'dex-caught dex-clickable' : 'dex-uncaught'}`}
                onClick={caught ? () => handleOpenPokemonCard(pokemon.id) : undefined}
                role={caught ? 'button' : undefined}
                tabIndex={caught ? 0 : undefined}
                onKeyDown={caught ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenPokemonCard(pokemon.id) } } : undefined}
              >
                <div className="dex-image-wrap">
                  {caught ? (
                    <img src={pokemon.src} alt={pokemon.name} className="dex-sprite" />
                  ) : (
                    <img src={placeholderBall} alt="unseen" className="dex-ball" />
                  )}
                  {caught && count > 0 && (
                    <span className="dex-count">×{count}</span>
                  )}
                </div>
                <div className="dex-number">#{String(pokemon.id).padStart(3, '0')}</div>
                <div className="dex-name">
                  {caught ? pokemon.name : '???'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

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
              <button type="submit" className="login-btn">
                LOG IN
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

    if (questions.length === 0) {
      const caughtCount = Object.values(catches).filter(n => n > 0).length
      return (
        <div className="menu-container">
          <header className="header">
            <h1 className="title">
              <img src={ballPoke} alt="pokeball" className="title-ball" />
              MATH TRAINER
              <img src={ballPoke} alt="pokeball" className="title-ball" />
            </h1>
            <p className="subtitle">Welcome back, Trainer {username}!</p>
            <div className="username-display">
              Trainer: {username}
              <button type="button" className="switch-user-btn" onClick={handleSwitchUser}>
                Switch Trainer
              </button>
            </div>
            <div className="menu-catch-summary">
              Caught so far: <strong>{caughtCount}</strong> / {POKEMON_SPRITES.length}
            </div>
          </header>

          <div className="menu-card">
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
            <button type="button" className="login-btn menu-start-btn" onClick={() => fetchQuestions()}>
              START BATTLE
            </button>
            <button
              type="button"
              className="menu-pokedex-btn"
              onClick={() => handleTabChange('stats')}
            >
              <img src={ballMaster} alt="" className="badge-ball" />
              View Pokédex
            </button>
          </div>
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
          <div className="username-display">
            Trainer: {username}
            <button type="button" className="switch-user-btn" onClick={handleBackToMenu}>
              ← Menu
            </button>
            <button type="button" className="switch-user-btn" onClick={handleSwitchUser}>
              Switch Trainer
            </button>
          </div>
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

            {adaptiveNotice && adaptiveNotice.direction !== 'same' && (
              <div className={`adaptive-banner adaptive-${adaptiveNotice.direction}`}>
                {adaptiveNotice.direction === 'up'
                  ? `⬆ Nice work! Leveling you up to ${DIFFICULTY_LABELS[adaptiveNotice.next]} for the next battle.`
                  : `⬇ Let's steady up with ${DIFFICULTY_LABELS[adaptiveNotice.next]} for the next battle.`}
              </div>
            )}

            {getMissedQuestions().length > 0 && (
              <button type="button" className="review-btn" onClick={handleStartReview}>
                🔁 Review Missed ({getMissedQuestions().length})
              </button>
            )}

            <div className="restart-difficulty-section">
              <label className="restart-difficulty-label">Choose ball type for next battle:</label>
              <div className="restart-difficulty-buttons">
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'easy' ? 'selected' : ''}`}
                  onClick={() => { setDifficulty('easy'); setAdaptiveNotice(null) }}
                >
                  <img src={ballPoke} alt="" className="badge-ball" />
                  Poké Ball
                  <span className="difficulty-desc">(+/- up to 20)</span>
                </button>
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'medium' ? 'selected' : ''}`}
                  onClick={() => { setDifficulty('medium'); setAdaptiveNotice(null) }}
                >
                  <img src={ballGreat} alt="" className="badge-ball" />
                  Great Ball
                  <span className="difficulty-desc">(+/- up to 100, ×)</span>
                </button>
                <button
                  type="button"
                  className={`restart-difficulty-btn ${difficulty === 'hard' ? 'selected' : ''}`}
                  onClick={() => { setDifficulty('hard'); setAdaptiveNotice(null) }}
                >
                  <img src={ballUltra} alt="" className="badge-ball" />
                  Ultra Ball
                  <span className="difficulty-desc">(all ops up to 1000)</span>
                </button>
              </div>
            </div>

            <div className="final-actions">
              <button onClick={handleRestart} className="restart-btn">
                FIND NEW POKÉMON
              </button>
              <button onClick={handleBackToMenu} className="restart-btn restart-btn-secondary">
                BACK TO MENU
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  const appClass = [
    'app',
    settings.dyslexiaFont ? 'a11y-dyslexia' : '',
    settings.largeText ? 'a11y-large' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={appClass}>
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
        <button
          className="tab-btn settings-tab"
          onClick={() => setShowSettings(true)}
          title="Settings"
          aria-label="Open settings"
        >
          ⚙ Settings
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

      {reviewMode && (() => {
        const missed = getMissedQuestions()
        const total = missed.length
        const q = missed[reviewIndex]
        if (!q) return null
        return (
          <div className="modal-overlay" onClick={handleCloseReview}>
            <div className="modal-content review-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Review Missed ({reviewIndex + 1} / {total})</h2>
                <button className="modal-close-btn" onClick={handleCloseReview}>✕</button>
              </div>
              <div className="modal-body">
                <div className="review-question">{q.question} = ?</div>
                {!reviewFeedback ? (
                  <div className="answer-section review-answer-section">
                    <input
                      type="number"
                      className="answer-input"
                      value={reviewAnswer}
                      onChange={(e) => setReviewAnswer(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleReviewSubmit() } }}
                      placeholder="Your answer"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="submit-answer-btn"
                      onClick={handleReviewSubmit}
                      disabled={reviewAnswer === ''}
                    >
                      CHECK
                    </button>
                  </div>
                ) : (
                  <div className="review-feedback">
                    {reviewFeedback.correct ? (
                      <span className="correct-msg">✅ Correct! You've got it now.</span>
                    ) : (
                      <span className="incorrect-msg">
                        Not quite — the answer is {reviewFeedback.correctAnswer}. You had {reviewFeedback.userAnswer}.
                      </span>
                    )}
                    <button type="button" className="submit-answer-btn review-next-btn" onClick={handleReviewNext}>
                      {reviewIndex + 1 >= total ? 'DONE' : 'NEXT'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Settings</h2>
              <button className="modal-close-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="settings-group">
                <label className="setting-row">
                  <span className="setting-label">
                    Adaptive difficulty
                    <span className="setting-desc">Auto-adjust the ball level based on your accuracy.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.adaptive}
                    onChange={() => toggleSetting('adaptive')}
                  />
                </label>
                <label className="setting-row">
                  <span className="setting-label">
                    Dyslexia-friendly font
                    <span className="setting-desc">Switches headings and body text to Lexend / Atkinson Hyperlegible.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.dyslexiaFont}
                    onChange={() => toggleSetting('dyslexiaFont')}
                  />
                </label>
                <label className="setting-row">
                  <span className="setting-label">
                    Large text
                    <span className="setting-desc">Bumps font sizes and spacing for easier reading.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.largeText}
                    onChange={() => toggleSetting('largeText')}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPokemonId != null && (() => {
        const sprite = POKEMON_BY_ID[selectedPokemonId]
        const details = detailsCache[selectedPokemonId]
        const count = catches[selectedPokemonId] ?? 0
        const primaryType = details?.types?.[0] ?? 'normal'
        const cardBg = TYPE_COLORS[primaryType] ?? '#A8A77A'
        return (
          <div className="modal-overlay" onClick={handleClosePokemonCard}>
            <div
              className="modal-content pokemon-card"
              onClick={(e) => e.stopPropagation()}
              style={{ '--card-type-color': cardBg }}
            >
              <div className="modal-header pokemon-card-header">
                <h2>
                  {sprite?.name ?? `#${selectedPokemonId}`}
                  <span className="card-dex-num">#{String(selectedPokemonId).padStart(3, '0')}</span>
                </h2>
                <button className="modal-close-btn" onClick={handleClosePokemonCard}>✕</button>
              </div>
              <div className="modal-body pokemon-card-body">
                <div className="card-hero">
                  <div className="card-hero-sprite">
                    {sprite && <img src={sprite.src} alt={sprite.name} />}
                  </div>
                  <div className="card-hero-meta">
                    <div className="card-caught-badge">Caught ×{count}</div>
                    {details?.types && (
                      <div className="card-types">
                        {details.types.map(t => (
                          <span key={t} className="type-badge" style={{ background: TYPE_COLORS[t] ?? '#888' }}>
                            {prettify(t)}
                          </span>
                        ))}
                      </div>
                    )}
                    {details && (
                      <div className="card-measurements">
                        <div><span>Height</span><strong>{(details.height / 10).toFixed(1)} m</strong></div>
                        <div><span>Weight</span><strong>{(details.weight / 10).toFixed(1)} kg</strong></div>
                      </div>
                    )}
                  </div>
                </div>

                {detailsLoading && !details && (
                  <div className="card-loading">
                    <img src={ballPoke} alt="" className="spin-ball" />
                    <p>Reading Pokédex entry...</p>
                  </div>
                )}
                {detailsError && !details && (
                  <div className="card-error">
                    Couldn't reach the Pokédex network. Check your connection and try again.
                  </div>
                )}

                {details && (
                  <>
                    <div className="card-section">
                      <div className="card-section-title">Base Stats</div>
                      <div className="card-stats">
                        {details.stats.map(stat => (
                          <div key={stat.name} className="card-stat-row">
                            <span className="card-stat-label">{STAT_LABELS[stat.name] ?? prettify(stat.name)}</span>
                            <div className="card-stat-bar-wrap">
                              <div
                                className="card-stat-bar"
                                style={{ width: `${Math.min(100, (stat.value / 200) * 100)}%` }}
                              />
                            </div>
                            <span className="card-stat-value">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {details.abilities?.length > 0 && (
                      <div className="card-section">
                        <div className="card-section-title">Abilities</div>
                        <div className="card-pills">
                          {details.abilities.map(a => (
                            <span key={a.name} className={`card-pill ${a.hidden ? 'hidden-ability' : ''}`}>
                              {prettify(a.name)}{a.hidden ? ' (hidden)' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {details.moves?.length > 0 && (
                      <div className="card-section">
                        <div className="card-section-title">Known Moves</div>
                        <div className="card-pills">
                          {details.moves.map(m => (
                            <span key={m} className="card-pill card-move">{prettify(m)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default App
