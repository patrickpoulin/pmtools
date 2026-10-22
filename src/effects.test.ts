import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Regression guard: `useEffect(() => value, deps)` returns `value`, and React calls a returned value
 * as the effect's cleanup. Newer browsers return a Promise from window.scrollTo, so the scroll-to-top
 * effect crashed every navigation and blanked the app. Effect bodies must use braces.
 */
// An arrow without braces returns its value; an async arrow always returns a Promise, braces or not.
const IMPLICIT_RETURN = /useEffect\(\s*(?:async\b|\(\s*\)\s*=>(?!\s*\{))/g

function implicitReturns(source: string) {
  return [...source.matchAll(IMPLICIT_RETURN)].map((m) => source.slice(0, m.index).split('\n').length)
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('useEffect bodies', () => {
  it('detects the implicit-return shorthand', () => {
    expect(implicitReturns('useEffect(() => window.scrollTo(0, 0), [p])')).toEqual([1])
    expect(implicitReturns('a\nuseEffect(\n  () => setX(1),\n  [x])')).toEqual([2])
    expect(implicitReturns('useEffect(() => {\n  window.scrollTo(0, 0)\n}, [p])')).toEqual([])
    expect(implicitReturns('useEffect(async () => {\n  await load()\n}, [])')).toEqual([1])
  })

  it('always use braces, so nothing is returned as a cleanup by accident', () => {
    const root = join(__dirname, '..')
    const offenders = sourceFiles(join(root, 'src')).flatMap((file) =>
      implicitReturns(readFileSync(file, 'utf8')).map((line) => `${relative(root, file)}:${line}`),
    )
    expect(offenders, 'Wrap these useEffect bodies in braces: useEffect(() => { ... }, deps)').toEqual([])
  })
})
