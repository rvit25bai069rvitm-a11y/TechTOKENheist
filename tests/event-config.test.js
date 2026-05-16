import test from 'node:test'
import assert from 'node:assert/strict'

import { DEFAULT_TEAM_NAMES, DEFAULT_TEAM_PASSWORD } from '../src/data/defaultTeams.js'
import { PROFILE_AVATARS, isProfileName } from '../src/data/profileAvatars.js'

test('default event roster creates exactly 28 uniquely named teams', () => {
  assert.equal(DEFAULT_TEAM_NAMES.length, 28)
  assert.equal(new Set(DEFAULT_TEAM_NAMES).size, 28)
  assert.equal(DEFAULT_TEAM_NAMES[0], 'Team 01')
  assert.equal(DEFAULT_TEAM_NAMES.at(-1), 'Team 28')
})

test('reset and generated teams use the event default password', () => {
  assert.equal(DEFAULT_TEAM_PASSWORD, 'rvitmkimkc')
})

test('predefined profile set excludes Professor personas', () => {
  const profileNames = PROFILE_AVATARS.map((profile) => profile.name)

  assert.equal(profileNames.some((name) => name.toLowerCase().includes('professor')), false)
  assert.equal(isProfileName('professor'), false)
  assert.equal(isProfileName('el_professor'), false)
})
