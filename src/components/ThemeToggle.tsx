import { useState } from 'react'

type Theme = 'light' | 'dark' | 'system'
const KEY = 'pmtools-theme'

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read)
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const label: Record<Theme, string> = { system: 'Auto', light: 'Light', dark: 'Dark' }

  const cycle = () => {
    const t = next[theme]
    setTheme(t)
    try {
      if (t === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, t)
    } catch {
      /* storage blocked: theme still applies for this visit */
    }
    if (t === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = t
  }

  return (
    <button className="btn ghost small" onClick={cycle} aria-label={`Theme: ${label[theme]}. Click to change.`}>
      {theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'} {label[theme]}
    </button>
  )
}
