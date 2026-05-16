import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_DOMAIN_NAME_LENGTH,
  MAX_MEMBER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_TEAM_NAME_LENGTH,
  normalizeDisplayText,
  validateDomainName,
  validateTeamSetup,
} from './inputValidation.js'
import { sanitizeConfiguredDomains } from './matchmaking.js'

test('validateTeamSetup normalizes team and member names before creation', () => {
  const result = validateTeamSetup({
    name: '  Alpha   Crew  ',
    memberNames: ['  Asha   Rao  ', 'Asha Rao', '  Dev  '],
    leader: ' Asha  Rao ',
    password: '  pass#123  ',
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.value, {
    name: 'Alpha Crew',
    memberNames: ['Asha Rao', 'Dev'],
    leader: 'Asha Rao',
    password: 'pass#123',
  })
})

test('validateTeamSetup rejects unsafe or oversized event text', () => {
  assert.equal(validateTeamSetup({
    name: '<script>',
    memberNames: ['Asha'],
    leader: 'Asha',
    password: 'pass#123',
  }).ok, false)

  assert.equal(validateTeamSetup({
    name: 'A'.repeat(MAX_TEAM_NAME_LENGTH + 1),
    memberNames: ['Asha'],
    leader: 'Asha',
    password: 'pass#123',
  }).ok, false)

  assert.equal(validateTeamSetup({
    name: 'Alpha',
    memberNames: ['B'.repeat(MAX_MEMBER_NAME_LENGTH + 1)],
    leader: 'Asha',
    password: 'pass#123',
  }).ok, false)
})

test('validateTeamSetup enforces roster and leader consistency', () => {
  assert.equal(validateTeamSetup({
    name: 'Alpha',
    memberNames: [],
    leader: '',
    password: 'pass#123',
  }).ok, false)

  assert.equal(validateTeamSetup({
    name: 'Alpha',
    memberNames: ['Asha', 'Dev', 'Mira', 'Ravi', 'Sam'],
    leader: 'Asha',
    password: 'pass#123',
  }).ok, false)

  assert.equal(validateTeamSetup({
    name: 'Alpha',
    memberNames: ['Asha', 'Dev'],
    leader: 'Mira',
    password: 'pass#123',
  }).ok, false)
})

test('validateTeamSetup enforces event-safe team password length', () => {
  const weak = validateTeamSetup({
    name: 'Alpha',
    memberNames: ['Asha'],
    leader: 'Asha',
    password: 'short7!',
  })
  assert.equal(weak.ok, false)
  assert.match(weak.error, new RegExp(`at least ${MIN_PASSWORD_LENGTH}`))

  assert.equal(validateTeamSetup({
    name: 'Alpha',
    memberNames: ['Asha'],
    leader: 'Asha',
    password: 'default-abcd',
  }).ok, true)
})

test('domain validation filters unsafe configured domains', () => {
  assert.equal(validateDomainName('Tech   Quiz').ok, true)
  assert.equal(validateDomainName('<img>').ok, false)
  assert.equal(validateDomainName('A'.repeat(MAX_DOMAIN_NAME_LENGTH + 1)).ok, false)
  assert.equal(normalizeDisplayText('  Tech\nQuiz  '), 'Tech Quiz')

  assert.deepEqual(
    sanitizeConfiguredDomains([' Tech   Quiz ', '<img>', 'AI+ML', 'tech quiz']),
    ['Tech Quiz', 'AI+ML']
  )
})
