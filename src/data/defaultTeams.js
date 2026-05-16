export const DEFAULT_TEAM_PASSWORD = 'rvitmkimkc'

export const DEFAULT_TEAM_NAMES = Array.from({ length: 28 }, (_, index) => {
  return `Team ${String(index + 1).padStart(2, '0')}`
})
