import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

export interface NavMenuLink {
  to: string
  label: string
}

/**
 * A top-nav dropdown built as a disclosure (a button that shows a list of links), the pattern
 * recommended for site navigation. Opens on click, tap, Enter or Space; Escape closes it and returns
 * focus to the button; it also closes on navigation, an outside click, or when focus leaves it.
 */
export function NavMenu({ label, links }: { label: string; links: NavMenuLink[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const listId = useId()
  const { pathname } = useLocation()
  const current = links.some((l) => pathname === l.to || pathname.startsWith(`${l.to}/`))

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const focusLink = (index: number) => {
    const items = root.current?.querySelectorAll<HTMLAnchorElement>('.nav-menu-list a')
    if (!items?.length) return
    items[(index + items.length) % items.length].focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
      button.current?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = [...(root.current?.querySelectorAll<HTMLAnchorElement>('.nav-menu-list a') ?? [])]
    const at = items.indexOf(document.activeElement as HTMLAnchorElement)
    if (!open) {
      setOpen(true)
      // Wait for the list to render before moving focus into it.
      requestAnimationFrame(() => {
        focusLink(e.key === 'ArrowUp' ? -1 : 0)
      })
    } else focusLink(at < 0 ? (e.key === 'ArrowUp' ? -1 : 0) : at + (e.key === 'ArrowDown' ? 1 : -1))
  }

  return (
    <div
      className="nav-menu"
      ref={root}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button
        ref={button}
        type="button"
        className={`nav-menu-button${current ? ' active' : ''}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <ul className="nav-menu-list" id={listId} hidden={!open}>
        {links.map((l) => (
          <li key={l.to}>
            <NavLink to={l.to}>{l.label}</NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
