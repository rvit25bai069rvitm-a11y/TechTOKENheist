import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('external links do not ship placeholder blank-tab URLs', () => {
  const aboutScreen = readProjectFile('src/screens/AboutScreen.jsx')
  const devsScreen = readProjectFile('src/screens/DevsScreen.jsx')
  const combined = `${aboutScreen}\n${devsScreen}`

  assert.doesNotMatch(combined, /href=["']#["']/)
  assert.doesNotMatch(combined, /url:\s*["']#["']/)
  assert.doesNotMatch(combined, /target="_blank"[\s\S]{0,160}href=\{["']#["']\}/)
  assert.match(combined, /target="_blank"[\s\S]{0,120}rel="noopener noreferrer"/)
})
