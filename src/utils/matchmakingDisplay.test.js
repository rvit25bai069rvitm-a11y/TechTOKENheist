import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (relativePath) => fs.readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8'
)

test('battle screen renders queue pair locks from matched_with state', () => {
  const battleScreen = readProjectFile('src/screens/BattleScreen.jsx')

  assert.match(battleScreen, /myQueueEntry/)
  assert.match(battleScreen, /const myMatchedWith = myQueueEntry\?\.matchedWith \|\| myQueueEntry\?\.matched_with \|\| null/)
  assert.match(battleScreen, /if \(myMatchedWith\)/)
  assert.doesNotMatch(battleScreen, /status === 'matched'/)
})

test('player shell counts only valid ready queue pairs', () => {
  const app = readProjectFile('src/App.jsx')

  assert.match(app, /import \{ buildReadyQueuePairs \} from '\.\/utils\/matchmaking'/)
  assert.match(app, /const readyPairs = buildReadyQueuePairs\(\{/)
  assert.match(app, /matchConstraints/)
  assert.doesNotMatch(app, /buildQueuePairsFromEntries\(matchmakingQueue\)\.length/)
})
