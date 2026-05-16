import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (relativePath) => fs.readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8'
)

test('domain wheel cancels deferred spin mutations when unmounted', () => {
  const domainWheel = readProjectFile('src/components/DomainWheel.jsx')

  assert.match(domainWheel, /useEffect/)
  assert.match(domainWheel, /spinTimeoutRef/)
  assert.match(domainWheel, /mountedRef/)
  assert.match(domainWheel, /spinRunRef/)
  assert.match(domainWheel, /clearTimeout\(spinTimeoutRef\.current\)/)
  assert.match(domainWheel, /spinRunRef\.current \+= 1/)
  assert.match(domainWheel, /const spinRun = spinRunRef\.current \+ 1/)
  assert.match(domainWheel, /if \(!mountedRef\.current \|\| spinRunRef\.current !== spinRun\) return/)
  assert.match(domainWheel, /if \(mountedRef\.current && spinRunRef\.current === spinRun\)/)
})

test('domain wheel renders a full circle when only one valid domain remains', () => {
  const domainWheel = readProjectFile('src/components/DomainWheel.jsx')

  assert.match(domainWheel, /if \(safeDomains\.length === 1\)/)
  assert.match(domainWheel, /<circle[\s\S]*cx="110"[\s\S]*cy="110"[\s\S]*r="100"/)
})
