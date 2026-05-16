import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (relativePath) => fs.readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8'
)

test('route error boundary resets when the user navigates to a new route', () => {
  const app = readProjectFile('src/App.jsx')
  const errorBoundary = readProjectFile('src/components/ErrorBoundary.jsx')

  assert.match(errorBoundary, /componentDidUpdate\(previousProps\)/)
  assert.match(errorBoundary, /previousProps\.resetKey !== this\.props\.resetKey/)
  assert.match(errorBoundary, /this\.setState\(\{ hasError: false \}\)/)
  assert.match(app, /const location = useLocation\(\)/)
  assert.match(app, /<ErrorBoundary resetKey=\{location\.pathname\}>/)
})
