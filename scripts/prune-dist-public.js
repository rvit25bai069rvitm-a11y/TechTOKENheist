import { existsSync, rmSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('..', import.meta.url))
const distDir = resolve(rootDir, 'dist')

const unusedCopiedPublicFiles = [
  'icons/logo.png',
  'icons/openbank.png',
  'icons/bgmap.png',
  'icons/matchhistory.png',
  'icons/escape.png',
  'icons/rulebook.png',
  'icons/arena.png',
  'icons/tokencounter.png',
  'icons/team.png',
  'icons/leaderboard.png',
  'icons/cams.png',
  'icons.svg',
  'player1.png',
  'player2.png',
]

let removedBytes = 0
let removedCount = 0

for (const relativePath of unusedCopiedPublicFiles) {
  const target = resolve(distDir, relativePath)
  if (!existsSync(target)) continue

  removedBytes += statSync(target).size
  rmSync(target, { force: true })
  removedCount += 1
}

if (removedCount > 0) {
  const removedMb = (removedBytes / 1024 / 1024).toFixed(2)
  console.log(`Pruned ${removedCount} unused public build artifacts (${removedMb} MB).`)
}
