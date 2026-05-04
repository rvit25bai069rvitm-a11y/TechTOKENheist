export const MOCK_TEAMS = [
  { id: 't1', name: 'Cyber Ninjas', leader: 'Zero', tokens: 12, status: 'idle', totalMatchTime: 12400, members: 4 },
  { id: 't2', name: 'Neon Syndicate', leader: 'Viper', tokens: 10, status: 'in-match', totalMatchTime: 14500, members: 5 },
  { id: 't3', name: 'Glitch Mob', leader: 'Byte', tokens: 10, status: 'in-match', totalMatchTime: 13200, members: 3 },
  { id: 't4', name: 'Syntax Error', leader: 'Crash', tokens: 8, status: 'idle', totalMatchTime: 9800, members: 4 },
  { id: 't5', name: 'Quantum Leap', leader: 'Qubit', tokens: 8, status: 'idle', totalMatchTime: 10100, members: 5 },
  { id: 't6', name: 'Logic Bomb', leader: 'Root', tokens: 5, status: 'idle', totalMatchTime: 5400, members: 3 },
  { id: 't7', name: 'Packet Loss', leader: 'Ping', tokens: 2, status: 'idle', totalMatchTime: 2100, members: 4 },
  { id: 't8', name: 'My Team', leader: 'You', tokens: 7, status: 'idle', totalMatchTime: 8900, members: 4 } // The active player's team
];

export const MOCK_ACTIVE_MATCHES = [
  { 
    id: 'm1', 
    teamA: { id: 't2', name: 'Neon Syndicate', tokens: 10 }, 
    teamB: { id: 't3', name: 'Glitch Mob', tokens: 10 }, 
    domain: 'Cryptography', 
    stakes: 1, 
    status: 'In Progress',
    timeElapsed: '12:45'
  }
];

export const MOCK_MATCH_HISTORY = [
  { id: 'h1', opponent: 'Logic Bomb', result: 'win', tokenChange: 1, domain: 'Algorithms', timestamp: '10 mins ago' },
  { id: 'h2', opponent: 'Cyber Ninjas', result: 'loss', tokenChange: -1, domain: 'Web Exploitation', timestamp: '1 hour ago' },
  { id: 'h3', opponent: 'Packet Loss', result: 'win', tokenChange: 1, domain: 'Reverse Engineering', timestamp: '2 hours ago' },
];

export const MOCK_NOTIFICATIONS = [
  { id: 'n1', type: 'match_start', message: 'Neon Syndicate vs Glitch Mob match started!', time: '2 mins ago' },
  { id: 'n2', type: 'match_end', message: 'Cyber Ninjas defeated Syntax Error.', time: '15 mins ago' },
  { id: 'n3', type: 'vault', message: 'Vault distributed 2 tokens to top performers.', time: '1 hour ago' },
];

export const MOCK_INCOMING_CHALLENGES = [
  { id: 'c1', opponent: { id: 't5', name: 'Quantum Leap', tokens: 8 }, domain: 'Web Exploitation', expires: '02:30' }
];

export const MOCK_VAULT = {
  totalTokens: 45,
  history: [
    { id: 'vh1', to: 'Cyber Ninjas', amount: 2, reason: 'Weekly Top Rank', date: '2023-10-25' },
    { id: 'vh2', to: 'Neon Syndicate', amount: 1, reason: 'Bounty Completion', date: '2023-10-24' }
  ]
};
