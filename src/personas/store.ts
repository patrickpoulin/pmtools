import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newId } from '../core/store'
import {
  PERSONA_LIMITS, emptyIcp, emptyPersona, examplePersonaMap, movePersona, normalizePersonaMap,
  type Icp, type Persona, type PersonaMap,
} from './persona'

interface PersonasState extends PersonaMap {
  updateIcp: (patch: Partial<Icp>) => void
  addPersona: () => string | null
  updatePersona: (id: string, patch: Partial<Omit<Persona, 'id'>>) => void
  removePersona: (id: string) => void
  /** Moves a persona's column one place left (-1) or right (+1). */
  movePersona: (id: string, by: -1 | 1) => void
  clearMap: () => void
  loadExample: () => void
}

/** Saved data on load, cleaned. A first visit (nothing saved) starts with the example. */
export function loadPersonaMap(persisted: unknown): PersonaMap {
  const p = persisted as Partial<PersonaMap> | undefined
  return p && typeof p === 'object' && ('icp' in p || 'personas' in p) ? normalizePersonaMap(p, newId) : examplePersonaMap()
}

export const usePersonas = create<PersonasState>()(
  persist(
    (set, get) => ({
      ...examplePersonaMap(),
      updateIcp: (patch) => set((s) => ({ icp: { ...s.icp, ...patch } })),
      addPersona: () => {
        if (get().personas.length >= PERSONA_LIMITS.personas) return null
        const id = newId()
        set((s) => ({ personas: [...s.personas, emptyPersona(id, s.personas)] }))
        return id
      },
      updatePersona: (id, patch) =>
        set((s) => ({ personas: s.personas.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePersona: (id) => set((s) => ({ personas: s.personas.filter((p) => p.id !== id) })),
      movePersona: (id, by) =>
        set((s) => ({ personas: movePersona(s.personas, s.personas.findIndex((p) => p.id === id), by) })),
      clearMap: () => set({ icp: emptyIcp(), personas: [] }),
      loadExample: () => set(examplePersonaMap()),
    }),
    {
      name: 'pmtools-personas',
      version: 1,
      partialize: (s) => ({ icp: s.icp, personas: s.personas }),
      merge: (persisted, current) => ({ ...current, ...loadPersonaMap(persisted) }),
    },
  ),
)
