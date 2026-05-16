import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import {
  getAuthenticatedHomePath,
  getRoleRedirectPath,
  isAdminUser,
  isPlayerUser,
} from './routeAccess.js'

const readProjectFile = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

test('route access helpers separate admin and player sessions', () => {
  const admin = { role: 'admin', adminSessionToken: 'session-token', adminSessionExpiresAt: Date.now() + 60_000 }
  const player = { role: 'player', teamId: 'alpha' }

  assert.equal(isAdminUser(admin), true)
  assert.equal(isAdminUser({ role: 'admin' }), false)
  assert.equal(isAdminUser({ role: 'admin', adminSessionToken: 'session-token', adminSessionExpiresAt: Date.now() - 1 }), false)
  assert.equal(isPlayerUser(admin), false)
  assert.equal(isPlayerUser(player), true)
  assert.equal(isPlayerUser({ role: 'player' }), false)
  assert.equal(isAdminUser(player), false)
  assert.equal(getAuthenticatedHomePath(admin), '/admin')
  assert.equal(getAuthenticatedHomePath(player), '/lobby')
  assert.equal(getAuthenticatedHomePath({ role: 'player' }), null)
  assert.equal(getAuthenticatedHomePath({ role: 'guest' }), null)
  assert.equal(getRoleRedirectPath(admin), '/admin')
  assert.equal(getRoleRedirectPath(player), '/lobby')
  assert.equal(getRoleRedirectPath(null), '/login')
})

test('app routes use role-specific guards instead of truthy user checks', () => {
  const app = readProjectFile('src/App.jsx')

  assert.match(app, /const PlayerRoute = \(\{ children \}\) =>/)
  assert.match(app, /const AdminRoute = \(\{ children \}\) =>/)
  assert.match(app, /isPlayerUser\(user\)/)
  assert.match(app, /isAdminUser\(user\)/)
  assert.doesNotMatch(app, /user \? <PlayerLayout>/)
  assert.doesNotMatch(app, /user && user\.role === 'admin' \?/)
})

test('legacy html entrypoint URLs redirect to canonical React routes', () => {
  const app = readProjectFile('src/App.jsx')

  assert.match(app, /LEGACY_HTML_ROUTE_REDIRECTS/)
  assert.match(app, /\['\/index\.html', '\/'\]/)
  assert.match(app, /\['\/login\.html', '\/login'\]/)
  assert.match(app, /\['\/admin\.html', '\/admin'\]/)
  assert.match(app, /\['\/rulebook\.html', '\/rulebook'\]/)
  assert.match(app, /LEGACY_HTML_ROUTE_REDIRECTS\.map\(\(\[legacyPath, canonicalPath\]\) => \(/)
  assert.match(app, /path=\{legacyPath\}/)
  assert.match(app, /<Navigate to=\{canonicalPath\} replace \/>/)
})
