export const rulebookSections = [
  {
    key: 'overview',
    title: 'Overview',
    body: 'Tech Token Heist is a real-time competitive event where teams compete in head-to-head matches across multiple tech domains. Tokens determine ranking and match eligibility.'
  },
  {
    key: 'team-structure',
    title: 'Team Structure',
    body: 'Each team consists of 2 to 4 members and one designated leader. Teams receive login credentials created by the admin.'
  },
  {
    key: 'token-system',
    title: 'Token System',
    body: 'All teams start with 1 token. Winning a Phase 1 match grants +1 token; losing costs -1. Tokens determine ranking and challenge eligibility.'
  },
  {
    key: 'matchmaking',
    title: 'Matchmaking (Phase 1)',
    body: 'Teams join a queue and are auto-matched within ±3 token range. Priority: same tokens → ±1 → ±2 → ±3. Max 1 active match per team.'
  },
  {
    key: 'timeout-system',
    title: 'Timeout System',
    body: 'Hitting 0 tokens triggers a timeout. After the timeout period (configured by admin), you reset to 1 token automatically.'
  }
];

export const rulebookDomains = [
  'Tech Pitch',
  'Tech Quiz',
  'Guess Output',
  'Frontend Dev',
  'Feature Addition'
];

export const rulebookFlow = [
  'Team enters queue automatically when eligible',
  'System auto-pairs based on token proximity',
  'Admin confirms match and spins domain wheel',
  'Domain is assigned to the match',
  'Teams compete in the assigned domain',
  'Judge/Admin submits result',
  'Tokens updated automatically',
  'Teams return to queue'
];

export const rulebookConstraints = [
  'Same opponent max 2 times total',
  'No consecutive matches against same opponent',
  'Same domain max 2 times per team',
  'Same opponent + same domain → only once',
  'No consecutive repeat of same domain'
];

export const rulebookAdminMoments = [
  'After being auto-matched (confirm match)',
  'Admin spins domain wheel for your match',
  'After completing a match — result is submitted'
];

export const rulebookAdminDuties = [
  'Create teams and assign login credentials',
  'Start/pause/reset the game',
  'Confirm matched pairs and spin domain wheel',
  'Declare match winners',
  'Toggle Phase 1 <-> Wager Mode'
];

export const rulebookImportantNotes = [
  'New rules can be introduced depending on the situation',
  'Volunteers or heads have the final say on all matters',
  'Wager Mode has drastically different token rules'
];

export const rulebookPhase2 = [
  {
    key: 'wager-overview',
    title: 'Wager Mode Overview',
    body: 'No matchmaking limits. Auto matchmaking. Cannot repeat domain consecutively. 0 tokens = permanent elimination.'
  },
  {
    key: 'higher-wins',
    title: 'Higher Token Team Wins',
    body: 'The winner takes ALL of the loser\'s tokens. The loser drops to 0 and is permanently eliminated.'
  },
  {
    key: 'lower-wins',
    title: 'Lower Token Team Wins',
    body: 'The winner receives ⌊(A+B)/2⌋ tokens total. The loser keeps the remainder.'
  },
  {
    key: 'equal-wins',
    title: 'Equal Tokens',
    body: 'Winner takes all tokens from both pools. Loser drops to 0 and is permanently eliminated.'
  }
];

export const rulebookGameplayNotes = [
  {
    key: 'start-stop',
    title: 'Game Start & Stop',
    body: 'The game begins only when the admin starts it. The admin can pause or reset anytime.'
  },
  {
    key: 'timeout',
    title: 'Timeout Rules',
    body: '0 tokens in Phase 1 → timeout. After the timeout period you auto-reset to 1 token and rejoin.'
  },
  {
    key: 'elimination',
    title: 'Elimination',
    body: 'In Wager Mode, reaching 0 tokens means permanent elimination. No timeout, no reset.'
  },
  {
    key: 'fair-play',
    title: 'Fair Play',
    body: 'All results must be verified by admin or judges. No team can self-declare victory.'
  },
  {
    key: 'grand-finale',
    title: 'Grand Finale',
    body: 'Top 2 teams compete in all 5 domains to determine the ultimate champion.'
  }
];
