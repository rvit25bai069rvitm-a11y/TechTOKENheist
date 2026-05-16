import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const audioSource = fs.readFileSync(new URL('./audio.js', import.meta.url), 'utf8')

test('countdown voice is guarded as best-effort browser audio', () => {
  assert.match(audioSource, /export const playCountdownVoice = \(number\) => \{/)
  assert.match(audioSource, /try \{[\s\S]*speechSynthesis[\s\S]*window\.speechSynthesis\.speak\(msg\);[\s\S]*\} catch \{/)
  assert.match(audioSource, /typeof window === 'undefined'/)
  assert.match(audioSource, /Countdown voice is best-effort/)
})
