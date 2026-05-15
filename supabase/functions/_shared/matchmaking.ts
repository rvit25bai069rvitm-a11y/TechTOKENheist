// Matchmaking helpers shared by edge functions.

export function buildConstraintsFromHistory(matchHistory, teams, currentPhase) {
    const constraints = {};
    const teamByName = new Map((teams || []).map((t) => [t.name, t.id]));

    teams.forEach((t) => {
        constraints[t.id] = { opponents: {}, domains: {}, combos: {}, lastOpponent: null, lastDomain: null };
    });

    // Only consider history from the current phase to provide a "fresh slate" for Wager mode
    const phaseHistory = currentPhase 
        ? (matchHistory || []).filter(m => (m.phase || 'phase1') === currentPhase)
        : (matchHistory || []);

    // Sort by created_at ascending to process in chronological order
    const sorted = [...phaseHistory].sort((a, b) => {
        const tA = a.created_at || a.timestamp || 0;
        const tB = b.created_at || b.timestamp || 0;
        return String(tA).localeCompare(String(tB));
    });

    for (const match of sorted) {
        const winnerId = teamByName.get(match.winner) || match.winner_id || match.winnerId || match.winner;
        const loserId = teamByName.get(match.loser) || match.loser_id || match.loserId || match.loser;
        const domain = match.domain;

        if (!winnerId || !loserId) continue;

        if (constraints[winnerId]) {
            constraints[winnerId].opponents[loserId] = (constraints[winnerId].opponents[loserId] || 0) + 1;
            constraints[winnerId].domains[domain] = (constraints[winnerId].domains[domain] || 0) + 1;
            constraints[winnerId].lastOpponent = loserId;
            constraints[winnerId].lastDomain = domain;
            
            const comboKey = `${loserId}::${domain}`;
            constraints[winnerId].combos[comboKey] = (constraints[winnerId].combos[comboKey] || 0) + 1;
        }
        if (constraints[loserId]) {
            constraints[loserId].opponents[winnerId] = (constraints[loserId].opponents[winnerId] || 0) + 1;
            constraints[loserId].domains[domain] = (constraints[loserId].domains[domain] || 0) + 1;
            constraints[loserId].lastOpponent = winnerId;
            constraints[loserId].lastDomain = domain;

            const comboKey = `${winnerId}::${domain}`;
            constraints[loserId].combos[comboKey] = (constraints[loserId].combos[comboKey] || 0) + 1;
        }
    }

    return constraints;
}




export function getQueueBlockReasons({ gameState, teamA, teamB, matchConstraints }) {
    if (!teamA || !teamB) return ['Team data unavailable'];

    const reasons = [];
    const c = matchConstraints || {};
    const cA = c[teamA.id] || {};
    const cB = c[teamB.id] || {};
    const tokenDiff = Math.abs((teamA.tokens || 0) - (teamB.tokens || 0));
    const isPhase2 = gameState?.phase === 'phase2';

    // Phase 1 specific: Token range +/- 3
    if (!isPhase2 && tokenDiff > 3) {
        reasons.push(`Token gap too high: ${teamA.tokens} vs ${teamB.tokens} (diff ${tokenDiff}, max 3)`);
    }

    // Phase 1 specific: Max 2 times per opponent total
    if (!isPhase2 && (cA.opponents?.[teamB.id] || 0) >= 2) {
        reasons.push('Already faced each other 2 times (max reached)');
    }

    // BOTH PHASES: No consecutive repeat opponent
    if (cA.lastOpponent === teamB.id || cB.lastOpponent === teamA.id) {
        reasons.push('Cannot face the same opponent in consecutive matches');
    }

    return reasons;
}


export function getValidDomains({ teamA, teamB, matchConstraints, allDomains, phase }) {
    const domains = allDomains || ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];
    const c = matchConstraints || {};
    const cA = c[teamA?.id] || {};
    const cB = c[teamB?.id] || {};
    const isPhase2 = phase === 'phase2';

    return domains.filter((domain) => {
        // Phase 1 specific constraints
        if (!isPhase2) {
            // Max 2 times per domain total per team
            if ((cA.domains?.[domain] || 0) >= 2) return false;
            if ((cB.domains?.[domain] || 0) >= 2) return false;

            // Same opponent + same domain -> only 1 time allowed
            const comboKeyA = `${teamB?.id}::${domain}`;
            const comboKeyB = `${teamA?.id}::${domain}`;
            if ((cA.combos?.[comboKeyA] || 0) >= 1) return false;
            if ((cB.combos?.[comboKeyB] || 0) >= 1) return false;
        }

        // Both phases: No consecutive repeat domain for either team
        if (cA.lastDomain === domain) return false;
        if (cB.lastDomain === domain) return false;

        return true;
    });
}

function scorePhase1(teamA, teamB) {
    // Priority: Same tokens (0) > diff 1 > diff 2 > diff 3
    return Math.abs((teamA.tokens || 0) - (teamB.tokens || 0));
}

function scorePhase2(teamA, teamB) {
    // Priority: Largest token difference first
    // same token team with least preference (highest score)
    return -Math.abs((teamA.tokens || 0) - (teamB.tokens || 0));
}

export function runMatchmaking({ gameState, teams, matchConstraints, existingMatches }) {
    const isPhase2 = gameState?.phase === 'phase2';

    const eligible = (teams || []).filter((t) => {
        if (t.status === 'eliminated' || t.status === 'fighting' || t.status === 'timeout') return false;
        const inMatch = (existingMatches || []).some((m) => {
            const aId = m.team_a || m.teamA?.id;
            const bId = m.team_b || m.teamB?.id;
            return aId === t.id || bId === t.id;
        });
        return !inMatch;
    });

    if (eligible.length < 2) return [];

    const pairs = [];
    for (let i = 0; i < eligible.length; i++) {
        for (let j = i + 1; j < eligible.length; j++) {
            const reasons = getQueueBlockReasons({
                gameState,
                teamA: eligible[i],
                teamB: eligible[j],
                matchConstraints,
            });
            if (reasons.length === 0) {
                // Add a small random jitter to ensure non-deterministic tie-breaking
                const baseScore = isPhase2
                    ? scorePhase2(eligible[i], eligible[j])
                    : scorePhase1(eligible[i], eligible[j]);
                const score = baseScore + (Math.random() * 0.01);
                pairs.push({ a: eligible[i], b: eligible[j], score });
            }
        }
    }

    // Sort ascending (lowest score = highest priority)
    pairs.sort((x, y) => x.score - y.score);

    const matched = new Set();
    const result = [];

    for (const pair of pairs) {
        if (matched.has(pair.a.id) || matched.has(pair.b.id)) continue;
        matched.add(pair.a.id);
        matched.add(pair.b.id);
        result.push({
            teamAId: pair.a.id,
            teamAName: pair.a.name,
            teamBId: pair.b.id,
            teamBName: pair.b.name,
        });
    }

    return result;
}


export function getTimeoutDuration({ gameState }) {
    if (gameState?.timeoutDurationOverride) {
        return gameState.timeoutDurationOverride;
    }

    const gameStartedAt = gameState?.gameStartedAt;
    if (!gameStartedAt) return 5 * 60 * 1000;

    const elapsed = Date.now() - gameStartedAt;
    const thirtyMinutes = 30 * 60 * 1000;

    if (elapsed <= thirtyMinutes) {
        return 5 * 60 * 1000;
    }
    return 15 * 60 * 1000;
}

export function calculateWagerOutcome(winnerTeam, loserTeam) {
    const wTokens = winnerTeam.tokens ?? 1;
    const lTokens = loserTeam.tokens ?? 1;

    if (wTokens >= lTokens) {
        return {
            winnerTokens: wTokens + lTokens,
            loserTokens: 0,
            loserStatus: 'eliminated',
        };
    }

    const mean = Math.floor((wTokens + lTokens) / 2);
    const winnerTokens = wTokens + mean;
    const loserTokens = lTokens - mean;
    return {
        winnerTokens,
        loserTokens: Math.max(0, loserTokens),
        loserStatus: loserTokens <= 0 ? 'eliminated' : 'idle',
    };
}
