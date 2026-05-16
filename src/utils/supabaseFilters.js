const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const assertSafeUuid = (value, label) => {
  const normalized = String(value || '').trim()
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`Invalid ${label}`)
  }
  return normalized
}

export const buildActiveMatchTeamFilter = (...teamIds) => {
  const ids = [...new Set(teamIds.map((id) => assertSafeUuid(id, 'team id')))]
  return ids.flatMap((id) => [`team_a.eq.${id}`, `team_b.eq.${id}`]).join(',')
}
