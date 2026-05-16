import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const landingScreen = fs.readFileSync(
  new URL('../screens/LandingScreen.jsx', import.meta.url),
  'utf8'
)

test('landing page clears deferred audio and observer timers on teardown', () => {
  assert.match(landingScreen, /const fadeAudioRef = useRef\(null\)/)
  assert.match(landingScreen, /const fadeOutRef = useRef\(null\)/)
  assert.match(landingScreen, /if \(fadeAudioRef\.current\) clearInterval\(fadeAudioRef\.current\)/)
  assert.match(landingScreen, /if \(fadeOutRef\.current\) clearInterval\(fadeOutRef\.current\)/)
  assert.match(landingScreen, /const activeAudio = audioRef\.current \|\| audio/)
  assert.doesNotMatch(landingScreen, /audioRef\.current\.pause\(\)/)
  assert.match(landingScreen, /const observeTimer = setTimeout/)
  assert.match(landingScreen, /clearTimeout\(observeTimer\)/)
  assert.match(landingScreen, /observer\.disconnect\(\)/)
})
