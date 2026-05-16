import assert from 'node:assert/strict'
import test from 'node:test'

import { rulebookFlow, rulebookSections } from '../data/rulebookData.js'

test('rulebook describes automatic queue enrollment, not manual joining', () => {
  const copy = [
    ...rulebookSections.map((section) => section.body),
    ...rulebookFlow,
  ].join('\n')

  assert.match(copy, /enrolled automatically|enters queue automatically/)
  assert.doesNotMatch(copy, /Teams join a queue/)
  assert.doesNotMatch(copy, /manually join/i)
})
