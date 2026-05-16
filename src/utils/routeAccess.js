export const isAdminUser = (user) => (
  user?.role === 'admin' &&
  Boolean(user?.adminSessionToken) &&
  Number(user?.adminSessionExpiresAt) > Date.now()
)

export const isPlayerUser = (user) => user?.role === 'player' && Boolean(user?.teamId)

export function getAuthenticatedHomePath(user) {
  if (isAdminUser(user)) return '/admin'
  if (isPlayerUser(user)) return '/lobby'
  return null
}

export function getRoleRedirectPath(user) {
  return getAuthenticatedHomePath(user) || '/login'
}
