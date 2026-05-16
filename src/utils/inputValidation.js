export const MAX_TEAM_NAME_LENGTH = 32
export const MAX_MEMBER_NAME_LENGTH = 40
export const MAX_DOMAIN_NAME_LENGTH = 32
export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72
export const MAX_TEAM_MEMBERS = 4

const SAFE_DISPLAY_TEXT = /^[A-Za-z0-9][A-Za-z0-9 _.'+&-]*$/
const NON_PRINTABLE_ASCII = /[^\x20-\x7E]+/g

export function normalizeDisplayText(value) {
  return String(value ?? '')
    .replace(NON_PRINTABLE_ASCII, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const validateDisplayText = (value, { label, maxLength }) => {
  const normalized = normalizeDisplayText(value)

  if (!normalized) {
    return { ok: false, error: `${label} is required.` }
  }

  if (normalized.length > maxLength) {
    return { ok: false, error: `${label} must be ${maxLength} characters or less.` }
  }

  if (!SAFE_DISPLAY_TEXT.test(normalized)) {
    return { ok: false, error: `${label} can use only letters, numbers, spaces, and simple punctuation.` }
  }

  return { ok: true, value: normalized }
}

const normalizePassword = (value) => String(value ?? '').replace(NON_PRINTABLE_ASCII, '').trim()

export const validateTeamName = (value) => validateDisplayText(value, {
  label: 'Team name',
  maxLength: MAX_TEAM_NAME_LENGTH,
})

export const validateMemberName = (value) => validateDisplayText(value, {
  label: 'Member name',
  maxLength: MAX_MEMBER_NAME_LENGTH,
})

export const validateDomainName = (value) => validateDisplayText(value, {
  label: 'Domain name',
  maxLength: MAX_DOMAIN_NAME_LENGTH,
})

export function validateTeamSetup(teamData) {
  const teamName = validateTeamName(teamData?.name)
  if (!teamName.ok) return teamName

  const password = normalizePassword(teamData?.password)
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be ${MAX_PASSWORD_LENGTH} characters or less.` }
  }

  const seenMembers = new Set()
  const memberNames = []
  for (const rawMember of teamData?.memberNames || []) {
    const member = validateMemberName(rawMember)
    if (!member.ok) return member

    const key = member.value.toLowerCase()
    if (seenMembers.has(key)) continue
    seenMembers.add(key)
    memberNames.push(member.value)
  }

  if (memberNames.length < 1) {
    return { ok: false, error: 'At least one member is required.' }
  }
  if (memberNames.length > MAX_TEAM_MEMBERS) {
    return { ok: false, error: `Teams can have at most ${MAX_TEAM_MEMBERS} members.` }
  }

  const leader = validateMemberName(teamData?.leader)
  if (!leader.ok) return { ok: false, error: 'Choose a valid team leader.' }

  const canonicalLeader = memberNames.find((member) => member.toLowerCase() === leader.value.toLowerCase())
  if (!canonicalLeader) {
    return { ok: false, error: 'Team leader must be one of the listed members.' }
  }

  return {
    ok: true,
    value: {
      name: teamName.value,
      memberNames,
      leader: canonicalLeader,
      password,
    },
  }
}
