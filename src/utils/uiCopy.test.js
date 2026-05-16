import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('visible event copy does not ship stale copyright years', () => {
  const loginScreen = readProjectFile('src/screens/LoginScreen.jsx')

  assert.doesNotMatch(loginScreen, /© 2024/)
  assert.match(loginScreen, /© 2026/)
})
