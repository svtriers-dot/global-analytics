import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import HeatMapPage from './pages/HeatMapPage'
import DashboardPage from './pages/DashboardPage'
import ComparePage from './pages/ComparePage'
import NewsPage from './pages/NewsPage'
import StatusPage from './pages/StatusPage'
import './styles/app.css'

/** Живые часы в правой части навбара */
function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const date = now.toLocaleDateString('en', { month: '2-digit', day: '2-digit', year: '2-digit' })
  const time = now.toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <span className="navbar-clock">
      <span className="clock-live-dot" />
      {date} {time}
    </span>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          {/* Логотип */}
          <div className="navbar-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span>GLOBALANALYTICS</span>
          </div>

          {/* Навигационные ссылки */}
          <div className="navbar-links">
            <NavLink to="/" end>Карта</NavLink>
            <NavLink to="/dashboard">Дашборд</NavLink>
            <NavLink to="/compare">Сравнение</NavLink>
            <NavLink to="/news">Новости</NavLink>
            <NavLink to="/status" className="navbar-status-link">Статус</NavLink>
          </div>

          {/* Часы справа */}
          <LiveClock />
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HeatMapPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/status" element={<StatusPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
