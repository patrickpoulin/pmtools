import { useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { METHODS } from './methods/registry'
import { pageFor } from './routes'
import { ThemeToggle } from './components/ThemeToggle'
import { HomePage } from './pages/HomePage'
import { BacklogPage } from './pages/BacklogPage'
import { MethodPage } from './pages/MethodPage'
import { ComparePage } from './pages/ComparePage'
import { ImportPage } from './pages/ImportPage'

const REPO_URL = 'https://github.com/patrickpoulin/pmtools'

export function App() {
  const { pathname } = useLocation()
  // Braces matter: newer browsers return a Promise from scrollTo, and React would call it as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  useEffect(() => {
    document.title = pageFor(pathname).title
  }, [pathname])

  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} width={24} height={24} alt="" />
            PM Tools
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/backlog">Backlog</NavLink>
            {METHODS.map((m) => (
              <NavLink key={m.id} to={`/method/${m.id}`}>
                {m.name}
              </NavLink>
            ))}
            <NavLink to="/compare">Compare</NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/backlog" element={<BacklogPage />} />
          <Route path="/method/:id" element={<MethodPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container">
          {/* Author attribution: required by the AGPL additional terms in NOTICE; keep it visible. */}
          <p style={{ margin: 0 }}>
            PM Tools by <a href={REPO_URL}>Patrick Poulin</a> ·{' '}
            <a href={REPO_URL}>Source code</a> (<a href={`${REPO_URL}/blob/main/LICENSE`}>AGPL-3.0</a>) · Your data
            stays in your browser and is never uploaded.
          </p>
        </div>
      </footer>
    </>
  )
}
