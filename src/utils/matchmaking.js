export function getQueueBlockReasons({ gameState, teamA, teamB, matchConstraints }) {
  if (!teamA || !teamB) return ['Team data unavailable'];

  const reasons = [];
  const c = matchConstraints || {};
  const cA = c[teamA.id] || {};
  const cB = c[teamB.id] || {};
  const tokenDiff = Math.abs((teamA.tokens || 0) - (teamB.tokens || 0));

  if (gameState?.phase !== 'phase2' && tokenDiff > 3) {
    reasons.push(`Token gap too high: ${teamA.tokens} vs ${teamB.tokens} (diff ${tokenDiff}, max 3)`);
  }

  if ((cA.opponents?.[teamB.id] || 0) >= 2) {
    reasons.push('Already faced each other 2 times (max reached)');
  }

  if (cA.lastOpponent === teamB.id || cB.lastOpponent === teamA.id) {
    reasons.push('Cannot face the same opponent in consecutive matches');
  }

  return reasons;
}

export function buildQueueDiagnostics({ gameState, teams, matchmakingQueue, matchConstraints }) {
  const waiting = (matchmakingQueue || []).filter((q) => !q.matchedWith);
  const byId = new Map((teams || []).map((t) => [t.id, t]));

  return waiting.map((entry) => {
    const self = byId.get(entry.teamId);
    const blockers = waiting
      .filter((other) => other.teamId !== entry.teamId)
      .map((other) => {
        const otherTeam = byId.get(other.teamId);
        const reasons = getQueueBlockReasons({ gameState, teamA: self, teamB: otherTeam, matchConstraints });
        return {
          teamId: other.teamId,
          teamName: other.teamName,
          reasons,
          canMatchNow: reasons.length === 0,
        };
      });

    return {
      teamId: entry.teamId,
      teamName: entry.teamName,
      tokens: entry.tokens,
      blockers,
      hasAnyPossibleMatch: blockers.some((b) => b.canMatchNow),
    };
  });
}
