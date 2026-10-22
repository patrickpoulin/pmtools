import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { legacyHashTarget } from './routes'
import './styles.css'

const base = import.meta.env.BASE_URL

// Send old hash links (#/method/rice) and bookmarks to their clean URLs before the router reads the location.
const legacy = legacyHashTarget(window.location.hash)
if (legacy !== null) window.history.replaceState(null, '', base + legacy)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Opt in to React Router v7 behaviour now: silences the upgrade warnings and eases the move to v7. */}
    <BrowserRouter
      basename={base.replace(/\/$/, '')}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </BrowserRouter>
  </StrictMode>,
)
