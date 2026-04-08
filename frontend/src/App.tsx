import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import HeatMapPage from './pages/HeatMapPage'
import DashboardPage from './pages/DashboardPage'
import ComparePage from './pages/ComparePage'
import NewsPage from './pages/NewsPage'
import './styles/app.css'

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <div className="navbar-brand">🌍 GlobalAnalytics</div>
          <div className="navbar-links">
            <NavLink to="/" end>Тепловая карта</NavLink>
            <NavLink to="/dashboard">Дашборд</NavLink>
            <NavLink to="/compare">Сравнение</NavLink>
            <NavLink to="/news">Новости</NavLink>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HeatMapPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/news" element={<NewsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
