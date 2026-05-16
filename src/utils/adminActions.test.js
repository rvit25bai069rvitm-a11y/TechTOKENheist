import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const readProjectFile = (relativePath) => fs.readFileSync(
  new URL(`../../${relativePath}`, import.meta.url),
  'utf8'
)

test('admin command buttons surface async mutation failures', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /adminActionError/)
  assert.match(adminScreen, /useRef/)
  assert.match(adminScreen, /adminActionPendingRef/)
  assert.match(adminScreen, /adminActionPending/)
  assert.match(adminScreen, /const setAdminActionBusy = \(pending\) => \{/)
  assert.match(adminScreen, /adminActionPendingRef\.current = pending/)
  assert.match(adminScreen, /if \(adminActionPendingRef\.current\) return false/)
  assert.match(adminScreen, /finally \{\s*setAdminActionBusy\(false\);?\s*\}/)
  assert.match(adminScreen, /runAdminAction = async \(action\)/)
  assert.match(adminScreen, /onClick=\{\(\) => runAdminAction\(stopGame\)\}/)
  assert.match(adminScreen, /onClick=\{\(\) => runAdminAction\(startGame\)\}/)
  assert.match(adminScreen, /RESET_CONFIRMATION_MESSAGE/)
  assert.match(adminScreen, /window\.confirm\(RESET_CONFIRMATION_MESSAGE\)[\s\S]{0,120}runAdminAction\(resetGame\)/)
  assert.doesNotMatch(adminScreen, /window\.confirm\('Reset\?'\)/)
  assert.match(adminScreen, /window\.confirm\('Confirm phase change\?'\)[\s\S]{0,120}runAdminAction\(togglePhase\)/)
  assert.match(adminScreen, /disabled=\{adminActionPending\}/)
  assert.match(adminScreen, /disabled=\{!canSubmitTeam \|\| adminActionPending\}/)
})

test('admin domain wheel mutations share the same pending guard', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /const runAdminWheelAction = async \(action\) =>/)
  assert.match(adminScreen, /if \(adminActionPendingRef\.current\) \{\s*throw new Error\('Another admin command is already running\.'\)/)
  assert.match(adminScreen, /console\.error\('Admin wheel command failed:', err\)/)
  assert.match(adminScreen, /setAdminActionError\(err\?\.message \|\| 'Wheel command failed\. Check Supabase connection and policies\.'\)/)
  assert.match(adminScreen, /handleSpinForMatch = async \(matchId, preferredDomain\) => \{\s*return runAdminWheelAction\(\(\) => spinDomain\(matchId, preferredDomain\)\)/)
  assert.match(adminScreen, /handleCreateReadyMatch = async \(pair, domain\) => \{\s*return runAdminWheelAction\(async \(\) => \{[\s\S]*const match = await createMatch\(pair\.teamAId, pair\.teamBId, domain\)/)
  assert.match(adminScreen, /<DomainWheel[\s\S]{0,160}disabled=\{adminActionPending\}[\s\S]{0,160}onSpin=\{\(domain\) => handleCreateReadyMatch\(pair, domain\)\}/)
  assert.match(adminScreen, /<DomainWheel[\s\S]{0,180}disabled=\{adminActionPending\}[\s\S]{0,180}resolveDomain=\{\(selectedDomain\) => handleSpinForMatch\(m\.id, selectedDomain\)\}/)
})

test('critical game mutations check Supabase errors before refreshing state', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /const requireSupabaseSuccess = \(result, message\) =>/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to start game/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to pause game/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to reset game system/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to update game phase/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to update domains/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to update timeout duration/)
})

test('live scoring and recovery mutations guard Supabase results', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to enforce wager eliminations/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to delete team/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to update team tokens/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to recover team from timeout/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to load team A for match creation/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to create match/)
  assert.match(useGameState, /await requireSupabaseSuccess\([\s\S]*Failed to load active match for domain spin/)
  assert.match(useGameState, /Timeout recovery failed/)
  assert.match(useGameState, /Wager elimination enforcement failed/)
})

test('active-match domain assignment refuses to bypass domain constraints', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /const validDomains = getValidDomains\(\{ teamA, teamB, matchConstraints: constraints, allDomains, phase: system\?\.phase \|\| 'phase1' \}\)/)
  assert.match(useGameState, /if \(validDomains\.length === 0\) \{\s*throw new Error\('No valid domains remain for this active match\.'\)/)
  assert.match(useGameState, /Pick from the validated domain set; never fall back past constraints\./)
  assert.doesNotMatch(useGameState, /Pick random from valid domains, or fallback to any domain/)
})

test('automatic matchmaking and re-enrollment surface Supabase failures', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(useGameState, /Failed to clear stale matchmaking locks/)
  assert.match(useGameState, /Failed to lock matchmaking pair/)
  assert.match(useGameState, /QUEUE_LOCK_ALREADY_CLAIMED_MESSAGE/)
  assert.match(useGameState, /const isQueueLockRaceError = \(error\) => error\?\.message === QUEUE_LOCK_ALREADY_CLAIMED_MESSAGE/)
  assert.match(useGameState, /const updateQueueMatchLock = async \(teamId, matchedWith\) =>/)
  assert.match(useGameState, /\.is\('matched_with', null\)[\s\S]*\.select\('team_id'\)[\s\S]*\.maybeSingle\(\)/)
  assert.match(useGameState, /queue row was already locked or missing/)
  assert.match(useGameState, /const clearQueuePairLock = async \(\{ teamAId, teamBId \}\) =>/)
  assert.match(useGameState, /Failed to roll back matchmaking pair lock/)
  assert.match(useGameState, /let autoMatchInFlight = null/)
  assert.match(useGameState, /if \(autoMatchInFlight\) return autoMatchInFlight/)
  assert.match(useGameState, /finally \{\s*autoMatchInFlight = null\s*\}/)
  assert.match(useGameState, /if \(!isQueueLockRaceError\(error\)\) throw error/)
  assert.match(useGameState, /lockRaceDetected = true/)
  assert.match(useGameState, /for \(const pair of pairs\) \{[\s\S]*await lockMatchmakingPair\(pair\)[\s\S]*\}/)
  assert.doesNotMatch(useGameState, /console\.error\('Failed to lock matchmaking pair:'[\s\S]*return/)
  assert.match(useGameState, /supabase\.rpc\('declare_match_winner'/)
  assert.match(useGameState, /const insertQueueRowsOnce = async \(rows, message\) =>/)
  assert.match(useGameState, /\.upsert\(queueRows, \{ onConflict: 'team_id', ignoreDuplicates: true \}\)/)
  assert.match(useGameState, /Automatic matchmaking failed/)
  assert.match(adminScreen, /Automatic matchmaking failed/)
  assert.match(adminScreen, /setAdminActionError\(err\?\.message \|\| 'Automatic matchmaking failed\. Check Supabase connection and queue policies\.'\)/)
})

test('manual queue helpers surface Supabase failures and clear reciprocal locks', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /joinQueue: async \(\) =>/)
  assert.match(useGameState, /Failed to check queue membership/)
  assert.match(useGameState, /Failed to join queue/)
  assert.match(useGameState, /leaveQueue: async \(\) =>/)
  assert.match(useGameState, /await clearMatchedQueueReferences\(myTeam\.id\)/)
  assert.match(useGameState, /Failed to leave queue/)
  assert.doesNotMatch(useGameState, /console\.error\('Failed to join queue:'/)
  assert.doesNotMatch(useGameState, /console\.error\('Failed to leave queue:'/)
})

test('admin console surfaces live automation dependency during the event', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /publicStateError/)
  assert.match(adminScreen, /automationError/)
  assert.match(adminScreen, /automationActive = gameState\.isGameActive && !gameState\.isPaused/)
  assert.match(adminScreen, /AUTOMATION ARMED/)
  assert.match(adminScreen, /AUTOMATION PAUSED/)
  assert.match(adminScreen, /AUTOMATION STANDBY/)
  assert.match(adminScreen, /SYNC DEGRADED/)
  assert.match(adminScreen, /PUBLIC STATE SYNC FAILED/)
  assert.match(adminScreen, /AUTOMATION DEGRADED/)
  assert.match(adminScreen, /LIVE AUTOMATION FAILED/)
  assert.match(adminScreen, /displayedAutomationLabel/)
  assert.match(adminScreen, /displayedAutomationDetail/)
  assert.match(adminScreen, /KEEP THIS ADMIN CONSOLE OPEN FOR TIMEOUT RECOVERY AND AUTOMATCH\./)
  assert.match(adminScreen, /AUTO-MATCH 3S \/ PUBLIC SYNC 5S \/ TIMEOUT WATCH 1S/)
})

test('background automation failures are promoted into shared operator state', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /automationError:\s*null/)
  assert.match(useGameState, /setAutomationError: \(automationError\) => set\(\{ automationError \}\)/)
  assert.match(useGameState, /useGameStateStore\.getState\(\)\.setAutomationError\(null\)/)
  assert.match(useGameState, /useGameStateStore\.getState\(\)\.setAutomationError\(`Timeout recovery failed: \$\{err\?\.message \|\| 'Unknown error'\}`\)/)
  assert.match(useGameState, /useGameStateStore\.getState\(\)\.setAutomationError\(`Automatic matchmaking failed: \$\{err\?\.message \|\| 'Unknown error'\}`\)/)
  assert.match(useGameState, /useGameStateStore\.getState\(\)\.setAutomationError\(`Wager elimination enforcement failed: \$\{err\?\.message \|\| 'Unknown error'\}`\)/)
})

test('successful admin commands clear stale automation warnings', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /const runAdminAction = async \(action\) => \{[\s\S]*setAutomationError\(null\);[\s\S]*return true;/)
  assert.match(adminScreen, /const runAdminWheelAction = async \(action\) => \{[\s\S]*setAutomationError\(null\);[\s\S]*return result;/)
})

test('match creation refreshes public state after the active match row is created', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /let matchCreated = false/)
  assert.match(useGameState, /matchCreated = true/)
  assert.match(useGameState, /finally \{\s*if \(matchCreated\) await get\(\)\.triggerFetchPublicState\?\.\(\)\s*\}/)
})

test('winner declaration refreshes public state after the active match row is claimed', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /let matchClaimed = false/)
  assert.match(useGameState, /p_match_id: matchId/)
  assert.match(useGameState, /p_winner_id: winnerId/)
  assert.match(useGameState, /Failed to declare match winner/)
  assert.match(useGameState, /matchClaimed = true/)
  assert.match(useGameState, /finally \{\s*if \(matchClaimed\) await get\(\)\.triggerFetchPublicState\?\.\(\)\s*\}/)
})

test('admin token edits are blocked while a team has an active match', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(useGameState, /team\.status === 'fighting'/)
  assert.match(useGameState, /Resolve the active match before adjusting team tokens/)
  assert.match(adminScreen, /const tokenControlsDisabled = adminActionPending \|\| t\.status === 'fighting' \|\| t\.status === 'eliminated'/)
  assert.match(adminScreen, /disabled=\{tokenControlsDisabled\}/)
})

test('admin token edits are blocked for permanently eliminated teams', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(useGameState, /team\.status === 'eliminated'/)
  assert.match(useGameState, /Eliminated teams cannot be adjusted/)
  assert.match(adminScreen, /Eliminated teams cannot be adjusted/)
  assert.match(adminScreen, /const tokenControlsTitle = t\.status === 'fighting'/)
})

test('active-match team deletion is blocked instead of tearing down live battles', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(useGameState, /Resolve the active match before deleting team/)
  assert.doesNotMatch(useGameState, /supabase\.from\('active_matches'\)\.delete\(\)\.or\(`team_a\.eq\.\$\{id\},team_b\.eq\.\$\{id\}`\)/)
  assert.match(adminScreen, /const deleteControlsDisabled = adminActionPending \|\| t\.status === 'fighting'/)
  assert.match(adminScreen, /disabled=\{deleteControlsDisabled\}/)
  assert.match(adminScreen, /Delete this team\? This removes credentials and queue state\./)
})

test('active-game team creation avoids duplicate queue rows and reports enrollment failures', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /Failed to check team enrollment state/)
  assert.match(useGameState, /Failed to auto-enroll new team/)
  assert.match(useGameState, /select\('id'\)[\s\S]*\.eq\('team_id', teamId\)[\s\S]*\.maybeSingle\(\)/)
  assert.match(useGameState, /if \(!existingQueueEntry && !existingActiveMatch\)/)
  assert.doesNotMatch(useGameState, /catch \(e\) \{[\s\S]{0,120}Failed to auto-enroll new team[\s\S]{0,120}\}/)
})

test('raw Supabase or filters are built only from UUID-validated team ids', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')
  const supabaseFilters = readProjectFile('src/utils/supabaseFilters.js')

  assert.match(useGameState, /import \{ buildActiveMatchTeamFilter \} from '..\/utils\/supabaseFilters'/)
  assert.match(supabaseFilters, /const UUID_PATTERN =/)
  assert.match(supabaseFilters, /export const assertSafeUuid = \(value, label\) =>/)
  assert.match(supabaseFilters, /export const buildActiveMatchTeamFilter = \(\.\.\.teamIds\) =>/)
  assert.match(supabaseFilters, /assertSafeUuid\(id, 'team id'\)/)
  assert.match(useGameState, /\.or\(buildActiveMatchTeamFilter\(teamId\)\)/)
  assert.match(useGameState, /\.or\(buildActiveMatchTeamFilter\(id\)\)/)
  assert.match(useGameState, /\.or\(buildActiveMatchTeamFilter\(teamAId, teamBId\)\)/)
  assert.match(useGameState, /\.delete\(\)\.in\('team_id', \[teamAId, teamBId\]\)/)
  assert.doesNotMatch(useGameState, /\.or\(`team_a\.eq\.\$\{/)
  assert.doesNotMatch(useGameState, /\.delete\(\)\.or\(`team_id\.eq\.\$\{/)
})

test('team upsert surfaces Supabase insert and update failures', () => {
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(useGameState, /Failed to check existing team/)
  assert.match(useGameState, /Failed to update team record/)
  assert.match(useGameState, /Failed to insert team record/)
  assert.doesNotMatch(useGameState, /Insert error:/)
  assert.doesNotMatch(useGameState, /Update error:/)
  assert.doesNotMatch(useGameState, /upsertTeamRecord fatal error/)
})

test('admin team form blocks custom names that already exist', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /customTeamNameAlreadyAssigned/)
  assert.match(adminScreen, /assignedProfileKeys/)
  assert.match(adminScreen, /customTeamNameValidation = validateTeamName\(customTeamName\)/)
  assert.match(adminScreen, /normalizedCustomTeamName = customTeamNameValidation\.ok \? customTeamNameValidation\.value : normalizeDisplayText\(customTeamName\)/)
  assert.match(adminScreen, /validateTeamSetup\(\{ name: teamName, memberNames, leader, password: teamPassword \}\)/)
  assert.match(adminScreen, /selectedProfileAlreadyAssigned = assignedProfileKeys\.has\(selectedProfile\.trim\(\)\.toLowerCase\(\)\)/)
  assert.match(adminScreen, /profileAlreadyAssigned = isCustom \? customTeamNameAlreadyAssigned : selectedProfileAlreadyAssigned/)
  assert.match(adminScreen, /disabled=\{!canSubmitTeam \|\| adminActionPending\}/)
})

test('admin form validates members and custom domains before mutation', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')
  const useGameState = readProjectFile('src/hooks/useGameState.jsx')

  assert.match(adminScreen, /validateMemberName\(memberInput\)/)
  assert.match(adminScreen, /memberNames\.some\(\(name\) => name\.toLowerCase\(\) === member\.value\.toLowerCase\(\)\)/)
  assert.match(adminScreen, /domainInputValidation = validateDomainName\(domainInput\)/)
  assert.match(adminScreen, /canAddDomain = domainInputValidation\.ok && !domainInputDuplicate/)
  assert.match(useGameState, /const validation = validateTeamSetup\(teamData\)/)
  assert.match(useGameState, /if \(!validation\.ok\) return \{ success: false, error: validation\.error \}/)
})

test('admin team password input is masked during team setup', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /value=\{teamPassword\}/)
  assert.match(adminScreen, /type="password"[\s\S]{0,240}value=\{teamPassword\}/)
  assert.match(adminScreen, /autoComplete="new-password"/)
})

test('winner declaration requires operator confirmation', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /Confirm winner declaration for/)
  assert.match(adminScreen, /window\.confirm\(`Confirm winner declaration for \$\{m\.teamA\.name\}\?`\)/)
  assert.match(adminScreen, /window\.confirm\(`Confirm winner declaration for \$\{m\.teamB\.name\}\?`\)/)
})

test('phase changes require operator confirmation', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /Confirm phase change\?/)
  assert.match(adminScreen, /runAdminAction\(togglePhase\)/)
})

test('admin team creation surfaces async createTeam failures', () => {
  const adminScreen = readProjectFile('src/screens/AdminScreen.jsx')

  assert.match(adminScreen, /try \{[\s\S]*const result = await createTeam\(validation\.value\)[\s\S]*\} catch \(err\) \{[\s\S]*setTeamFormError\(err\?\.message \|\| 'Team could not be created\. Check Supabase connection and policies\.'\)/)
})
