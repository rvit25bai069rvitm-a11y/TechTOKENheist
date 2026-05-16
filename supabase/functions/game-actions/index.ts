import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// Passwords stored as plain text (no hashing)
import { supabaseAdmin } from "../_shared/supabaseClient.ts";
import {
    buildConstraintsFromHistory,
    calculateWagerOutcome,
    getValidDomains,
    runMatchmaking,
} from "../_shared/matchmaking.ts";

import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";
const JWT_SECRET = new TextEncoder().encode(Deno.env.get('JWT_SECRET') || 'tokenheist-super-secret-jwt-key-2024');

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-game-token',
};

const DEFAULT_TEAM_PASSWORD = 'rvitmkimkc';
const DEFAULT_TEAM_NAMES = Array.from({ length: 28 }, (_, index) => `Team ${String(index + 1).padStart(2, '0')}`);
const FINALE_TOTAL_ROUNDS = 5;
const DEFAULT_DOMAINS = ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];
const DEFAULT_SYSTEM_ROW = {
    key: 'game',
    is_game_active: false,
    is_paused: false,
    status: 'not_started',
    phase: 'phase1',
    game_started_at: null,
    paused_at: null,
    timeout_duration_override: null,
    domains: DEFAULT_DOMAINS,
    finale_state: null,
};


const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const ok = (data = {}) => json({ success: true, data });
const fail = (status, message) => json({ success: false, error: message }, status);

const querySingle = async (promise) => {
    const { data, error } = await promise;
    if (error) throw error;
    return data || null;
};

const queryList = async (promise) => {
    const { data, error } = await promise;
    if (error) throw error;
    return data || [];
};

const isLikePattern = (value) => typeof value === 'string' && /[%_]/.test(value);
const isBcryptHash = (value) => false;

const verifyPassword = async (password, stored) => {
    if (stored === undefined || stored === null) return false;
    return stored === (password ?? '');
};

const hashPassword = async (password) => {
    return password ?? DEFAULT_TEAM_PASSWORD;
};

const ensureGameSystem = async () => {
    const { data, error } = await supabaseAdmin
        .from('system')
        .select('*')
        .eq('key', 'game')
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const { data: inserted, error: insertError } = await supabaseAdmin
        .from('system')
        .insert([DEFAULT_SYSTEM_ROW])
        .select('*')
        .maybeSingle();

    if (insertError) {
        const { data: fallback } = await supabaseAdmin
            .from('system')
            .select('*')
            .eq('key', 'game')
            .limit(1)
            .maybeSingle();
        if (fallback) return fallback;
        throw insertError;
    }

    return inserted || DEFAULT_SYSTEM_ROW;
};

const getGameSystem = async () => ensureGameSystem();

const insertNotification = async (message) => {
    try {
        await supabaseAdmin.from('notifications').insert([
            { message, time: new Date().toISOString() },
        ]);
    } catch {
        // Best-effort notifications.
    }
};

const normalizeTeam = (team) => ({
    ...team,
    status: team?.status || 'idle',
    tokens: team?.tokens ?? 1,
    lastTokenUpdateTime: team?.last_token_update_time ?? team?.lastTokenUpdateTime ?? 0,
});

const toPublicTeamSnapshot = (team) => ({
    id: team?.id,
    name: team?.name,
    member_names: team?.member_names,
    leader: team?.leader,
    status: team?.status || 'idle',
    tokens: team?.tokens ?? 1,
    total_time: team?.total_time ?? team?.totalTime ?? 0,
    timeout_until: team?.timeout_until ?? team?.timeoutUntil ?? null,
    last_token_update_time: team?.last_token_update_time ?? team?.lastTokenUpdateTime ?? null,
});

const enforceWagerEliminations = async () => {
    const zeroTokenTeams = await queryList(
        supabaseAdmin
            .from('teams')
            .select('id, name, status, tokens')
            .lte('tokens', 0)
            .neq('status', 'eliminated')
    );

    if (!zeroTokenTeams.length) return [];

    const teamIds = zeroTokenTeams.map((team) => team.id);
    await supabaseAdmin
        .from('teams')
        .update({ status: 'eliminated', timeout_until: null, last_token_update_time: Date.now() })
        .in('id', teamIds);

    await supabaseAdmin.from('matchmaking_queue').delete().in('team_id', teamIds);

    try {
        await supabaseAdmin.from('notifications').insert(
            zeroTokenTeams.map((team) => ({
                message: `${team.name} eliminated in WAGER mode (0 tokens).`,
                time: new Date().toISOString(),
            }))
        );
    } catch {
        // Best-effort notifications.
    }

    return teamIds;
};

const enrollAllEligibleTeams = async () => {
    const [allTeams, queueRows, matchRows] = await Promise.all([
        queryList(supabaseAdmin.from('teams').select('*')),
        queryList(supabaseAdmin.from('matchmaking_queue').select('team_id')),
        queryList(supabaseAdmin.from('active_matches').select('team_a, team_b')),
    ]);

    const inQueue = new Set((queueRows || []).map((q) => q.team_id));
    const inMatch = new Set();
    (matchRows || []).forEach((m) => { inMatch.add(m.team_a); inMatch.add(m.team_b); });

    const toEnroll = (allTeams || []).filter((t) =>
        t.status !== 'eliminated' && t.status !== 'timeout' && t.status !== 'fighting' &&
        !inQueue.has(t.id) && !inMatch.has(t.id)
    );

    if (toEnroll.length) {
        await supabaseAdmin.from('matchmaking_queue').insert(
            toEnroll.map((t) => ({ team_id: t.id, team_name: t.name, team_tokens: t.tokens }))
        );
    }
};

const createDefaultTeams = async () => {
    const password = await hashPassword(DEFAULT_TEAM_PASSWORD);
    const createdOrUpdated = [];

    for (const name of DEFAULT_TEAM_NAMES) {
        const existing = await querySingle(
            supabaseAdmin.from('teams').select('id').ilike('name', name).limit(1).maybeSingle()
        );
        const payload = {
            name,
            member_names: [name],
            leader: name,
            password,
            tokens: 1,
            status: 'idle',
            timeout_until: null,
            last_token_update_time: null,
        };

        if (existing?.id) {
            await supabaseAdmin.from('teams').update(payload).eq('id', existing.id);
            createdOrUpdated.push(existing.id);
        } else {
            const inserted = await querySingle(
                supabaseAdmin.from('teams').insert([payload]).select('id').maybeSingle()
            );
            if (inserted?.id) createdOrUpdated.push(inserted.id);
        }
    }

    await insertNotification(`${DEFAULT_TEAM_NAMES.length} default teams prepared. Reset password: ${DEFAULT_TEAM_PASSWORD}.`);
    return createdOrUpdated;
};

const shiftRunningTimers = async (pauseDurationMs) => {
    if (!pauseDurationMs || pauseDurationMs <= 0) return;

    const activeMatches = await queryList(supabaseAdmin.from('active_matches').select('id, start_time'));
    await Promise.all(
        activeMatches
            .filter((match) => match?.id && match?.start_time)
            .map((match) => {
                const shiftedStart = Number(match.start_time) + pauseDurationMs;
                return supabaseAdmin.from('active_matches').update({ start_time: shiftedStart }).eq('id', match.id);
            })
    );
};

const resetMatchmakingForWagerMode = async () => {
    await supabaseAdmin.from('matchmaking_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('active_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const teams = await queryList(supabaseAdmin.from('teams').select('id, status, tokens'));
    const resetIds = teams
        .filter((team) => {
            if (!team?.id) return false;
            if (team.status === 'eliminated' || team.status === 'finalist' || team.status === 'spectating') return false;
            return (team.tokens ?? 0) > 0;
        })
        .map((team) => team.id);

    if (resetIds.length) {
        await supabaseAdmin
            .from('teams')
            .update({ status: 'idle', timeout_until: null })
            .in('id', resetIds);
    }
};

const autoMatchPairs = async () => {
    // 1. Automatically enroll any eligible teams that aren't in the queue yet
    await enrollAllEligibleTeams();

    const system = await getGameSystem();
    if (!system?.is_game_active || system?.is_paused) return [];
    if (system?.finale_state?.isFinaleActive) return [];

    const [teamsRows, queueRows, matchRows, historyRows] = await Promise.all([
        queryList(supabaseAdmin.from('teams').select('*')),
        queryList(supabaseAdmin.from('matchmaking_queue').select('*')),
        queryList(supabaseAdmin.from('active_matches').select('*')),
        queryList(supabaseAdmin.from('match_history').select('*')),
    ]);

    const teams = (teamsRows || []).map(normalizeTeam);
    const constraints = buildConstraintsFromHistory(historyRows || [], teams, system?.phase);

    const waitingQueueIds = (queueRows || [])
        .filter((q) => !(q.matched_with || q.matchedWith))
        .map((q) => q.team_id || q.teamId)
        .filter(Boolean);

    if (waitingQueueIds.length < 2) return [];

    const teamsInActiveMatches = new Set();
    (matchRows || []).forEach((m) => {
        const aId = m.team_a || m.teamA?.id;
        const bId = m.team_b || m.teamB?.id;
        if (aId) teamsInActiveMatches.add(aId);
        if (bId) teamsInActiveMatches.add(bId);
    });

    const eligibleIds = waitingQueueIds.filter((id) => !teamsInActiveMatches.has(id));
    if (eligibleIds.length < 2) return [];

    const waitingTeams = teams.filter((t) => eligibleIds.includes(t.id));
    const pairs = runMatchmaking({
        gameState: { phase: system?.phase || 'phase1' },
        teams: waitingTeams,
        matchConstraints: constraints,
        existingMatches: matchRows,
    });

    if (!pairs.length) return [];

    const isPhase2 = system?.phase === 'phase2';

    if (isPhase2) {
        // FULLY AUTOMATED FOR PHASE 2: Create active matches immediately
        const allDomains = system?.domains || DEFAULT_DOMAINS;
        const activeDomains = (matchRows || []).map(m => m.domain).filter(d => d && d !== 'TBD');

        const creationPromises = pairs.map(async (p) => {
            const teamA = teams.find((t) => t.id === p.teamAId);
            const teamB = teams.find((t) => t.id === p.teamBId);

            // Get valid domains for this pair
            const validDomains = getValidDomains({
                teamA,
                teamB,
                matchConstraints: constraints,
                allDomains,
                phase: 'phase2'
            });

            // Pick a domain with variety preference
            const uniqueValid = validDomains.filter(d => !activeDomains.includes(d));
            const choices = uniqueValid.length > 0 ? uniqueValid : validDomains;
            const domain = choices[Math.floor(Math.random() * choices.length)] || allDomains[0];

            // 1. Create the active match
            await supabaseAdmin.from('active_matches').insert([{
                team_a: p.teamAId,
                team_b: p.teamBId,
                domain,
                start_time: Date.now(),
                teamA: toPublicTeamSnapshot(teamA),
                teamB: toPublicTeamSnapshot(teamB)
            }]);

            // 2. Set team statuses to 'fighting'
            await supabaseAdmin.from('teams').update({ status: 'fighting' }).in('id', [p.teamAId, p.teamBId]);

            // 3. Remove from matchmaking queue
            await supabaseAdmin.from('matchmaking_queue').delete().in('team_id', [p.teamAId, p.teamBId]);
        });

        await Promise.all(creationPromises);
    } else {
        // PHASE 1: Just update the queue (Semi-automated, requires admin execution)
        const updatePromises = pairs.flatMap((p) => [
            supabaseAdmin.from('matchmaking_queue').update({ matched_with: p.teamBId }).eq('team_id', p.teamAId),
            supabaseAdmin.from('matchmaking_queue').update({ matched_with: p.teamAId }).eq('team_id', p.teamBId),
        ]);
        await Promise.all(updatePromises);
    }

    return pairs;
};


serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return fail(400, 'Invalid JSON');
    }

    const { action, payload } = body || {};
    if (!action) return fail(400, 'Missing action');

    let userRole = 'anon';
    let userTeamId = null;

    if (req.method !== 'OPTIONS') {
        const gameToken = req.headers.get('x-game-token');
        if (gameToken) {
            try {
                const { payload: jwtPayload } = await jose.jwtVerify(gameToken, JWT_SECRET);
                userRole = jwtPayload.role;
                userTeamId = jwtPayload.teamId;
            } catch (e) {
                console.error('JWT verify failed:', e);
                return fail(401, 'Invalid session token');
            }
        }
    }

    const adminActions = ['enrollAllEligible', 'startGame', 'stopGame', 'resetGame', 'togglePhase', 'createDefaultTeams', 'createTeam', 'editTeam', 'deleteTeam', 'updateTokens', 'recoverFromTimeout', 'createMatch', 'declareWinner', 'spinDomain', 'updateDomains', 'setTimeoutDuration', 'autoMatchPairs', 'endMatchAndStartFinale', 'setFinaleDomain', 'declareFinaleRoundWinner', 'endFinale', 'enforceWagerEliminations'];
    const playerActions = ['joinQueue', 'leaveQueue'];

    if (adminActions.includes(action) && userRole !== 'admin') {
        return fail(403, 'Admin privileges required');
    }

    if (playerActions.includes(action)) {
        if (userRole !== 'admin' && userRole !== 'player') {
            return fail(403, 'Player privileges required');
        }
        if (userRole === 'player' && payload?.teamId !== userTeamId) {
            return fail(403, 'You can only manage your own team');
        }
    }

    if (adminActions.includes(action)) {
        try {
            await ensureGameSystem();
        } catch (err) {
            console.error('Failed to initialize system row:', err);
            return fail(500, 'System row is missing and could not be created');
        }
    }

    // Basic health check for database connectivity
    if (action === 'healthCheck') {
        const { data, error: healthError } = await supabaseAdmin.from('system').select('status').eq('key', 'game').maybeSingle();
        if (healthError) return fail(500, `DB Health Check failed: ${healthError.message}`);
        return ok({ status: 'healthy', systemStatus: data?.status });
    }

    try {
        switch (action) {
            case 'login': {
                const username = payload?.username?.trim();
                const password = payload?.password ?? '';
                if (!username || !password) return fail(400, 'Missing credentials');
                if (isLikePattern(username)) return fail(400, 'Invalid username');

                console.log(`Login attempt for: [${username}]`);

                // Check Admin Credentials (case-insensitive for username)
                const { data: adminRecords } = await supabaseAdmin
                    .from('system')
                    .select('status')
                    .in('key', ['admin_credential', 'admin_credential_alt']);

                const providedAdminB64 = btoa(`${username.toLowerCase()}:${password}`);
                const isAdmin = adminRecords?.some(r => r.status === providedAdminB64);

                if (isAdmin) {
                    console.log('Admin login successful');
                    const token = await new jose.SignJWT({ role: 'admin' })
                        .setProtectedHeader({ alg: 'HS256' })
                        .setIssuedAt()
                        .setExpirationTime('24h')
                        .sign(JWT_SECRET);
                    return ok({ role: 'admin', token });
                }

                // Check Player Credentials
                const team = await querySingle(
                    supabaseAdmin.from('teams').select('*').ilike('name', username).limit(1).maybeSingle()
                );

                if (!team) {
                    console.log(`Login failed: Team [${username}] not found`);
                    return fail(401, 'Invalid username or password');
                }

                const issuePlayerToken = async () => {
                    console.log(`Player login successful for team: ${team.name}`);
                    const token = await new jose.SignJWT({ role: 'player', teamId: team.id })
                        .setProtectedHeader({ alg: 'HS256' })
                        .setIssuedAt()
                        .setExpirationTime('24h')
                        .sign(JWT_SECRET);
                    return ok({ role: 'player', teamId: team.id, teamName: team.name, token });
                };

                if (team.password === undefined || team.password === null || team.password === '') {
                    return await issuePlayerToken();
                }

                const passwordOk = await verifyPassword(password, team.password);
                if (!passwordOk) {
                    console.log(`Login failed: Password mismatch for team [${username}]`);
                    return fail(401, 'Invalid username or password');
                }

                return await issuePlayerToken();
            }

            case 'joinQueue': {
                const teamId = payload?.teamId;
                if (!teamId) return fail(400, 'Missing teamId');

                const team = await querySingle(
                    supabaseAdmin.from('teams').select('id, name, tokens, status').eq('id', teamId).maybeSingle()
                );
                if (!team) return ok();
                if (team.status !== 'idle' || team.tokens <= 0 || team.status === 'eliminated') return ok();

                const existing = await querySingle(
                    supabaseAdmin.from('matchmaking_queue').select('id').eq('team_id', team.id).maybeSingle()
                );
                if (existing) return ok();

                await supabaseAdmin
                    .from('matchmaking_queue')
                    .insert([{ team_id: team.id, team_name: team.name, team_tokens: team.tokens }]);
                return ok();
            }

            case 'leaveQueue': {
                const teamId = payload?.teamId;
                if (!teamId) return fail(400, 'Missing teamId');
                await supabaseAdmin.from('matchmaking_queue').delete().eq('team_id', teamId);
                return ok();
            }

            case 'enrollAllEligible': {
                await enrollAllEligibleTeams();
                return ok();
            }

            case 'startGame': {
                const sys = await getGameSystem();
                const isResume = sys?.is_paused;
                const now = Date.now();
                const pausedAt = Number(sys?.paused_at || now);
                const pauseDurationMs = isResume ? Math.max(0, now - pausedAt) : 0;
                const gameStartedAt = isResume && sys?.game_started_at
                    ? Number(sys.game_started_at) + pauseDurationMs
                    : now;
                const finaleState = sys?.finale_state?.roundStartedAt
                    ? {
                        ...sys.finale_state,
                        roundStartedAt: Number(sys.finale_state.roundStartedAt) + pauseDurationMs,
                    }
                    : sys?.finale_state || null;

                if (pauseDurationMs > 0) {
                    await shiftRunningTimers(pauseDurationMs);
                }

                const { error } = await supabaseAdmin.from('system').update({
                    is_game_active: true,
                    is_paused: false,
                    status: 'active',
                    game_started_at: gameStartedAt,
                    paused_at: null,
                    finale_state: finaleState,
                }).eq('key', 'game');

                if (error) return fail(500, error.message);

                await insertNotification('Game started by admin.');

                if (sys?.phase === 'phase2') {
                    await enforceWagerEliminations();
                }
                await enrollAllEligibleTeams();
                await autoMatchPairs();
                return ok();
            }

            case 'stopGame': {
                const sys = await getGameSystem();
                if (sys?.is_paused) return ok();

                await supabaseAdmin
                    .from('system')
                    .update({ is_game_active: false, is_paused: true, paused_at: Date.now(), status: 'paused' })
                    .eq('key', 'game');
                await insertNotification('Mission on HOLD by Command.');
                return ok();
            }

            case 'resetGame': {
                try {
                    console.log('--- STARTING VERBOSE RESET ---');

                    console.log('1. Deleting matchmaking_queue...');
                    const { error: err1 } = await supabaseAdmin.from('matchmaking_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err1) { console.error('Error in step 1:', err1); throw new Error(`Queue deletion failed: ${err1.message}`); }

                    console.log('2. Deleting active_matches...');
                    const { error: err2 } = await supabaseAdmin.from('active_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err2) { console.error('Error in step 2:', err2); throw new Error(`Active matches deletion failed: ${err2.message}`); }

                    console.log('3. Deleting match_history...');
                    const { error: err3 } = await supabaseAdmin.from('match_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err3) { console.error('Error in step 3:', err3); throw new Error(`Match history deletion failed: ${err3.message}`); }

                    console.log('4. Deleting notifications...');
                    const { error: err4 } = await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err4) { console.error('Error in step 4:', err4); throw new Error(`Notifications deletion failed: ${err4.message}`); }

                    console.log('5. Deleting token_history...');
                    const { error: err5 } = await supabaseAdmin.from('token_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err5) { console.error('Error in step 5:', err5); throw new Error(`Token history deletion failed: ${err5.message}`); }

                    console.log('6. Resetting teams...');
                    const resetPassword = await hashPassword(DEFAULT_TEAM_PASSWORD);
                    const { error: teamError } = await supabaseAdmin.from('teams').update({
                        tokens: 1,
                        status: 'idle',
                        timeout_until: null,
                        last_token_update_time: null,
                        password: resetPassword,
                    }).neq('id', '00000000-0000-0000-0000-000000000000');
                    if (teamError) { console.error('Error in step 6:', teamError); throw teamError; }

                    console.log('7. Resetting system...');
                    const { error: systemError } = await supabaseAdmin.from('system').update({
                        is_game_active: false,
                        is_paused: false,
                        status: 'not_started',
                        phase: 'phase1',
                        game_started_at: null,
                        paused_at: null,
                        timeout_duration_override: null,
                        domains: DEFAULT_DOMAINS,
                        finale_state: null
                    }).eq('key', 'game');
                    if (systemError) { console.error('Error in step 7:', systemError); throw systemError; }

                    console.log('--- RESET COMPLETED SUCCESSFULLY ---');
                    return ok();
                } catch (err) {
                    console.error('CRITICAL: Reset game failed:', err);
                    return fail(500, `Reset failed at step: ${err.message}`);
                }
            }

            case 'togglePhase': {
                const sys = await getGameSystem();
                const newPhase = sys?.phase === 'phase2' ? 'phase1' : 'phase2';

                await supabaseAdmin.from('system').update({ phase: newPhase }).eq('key', 'game');
                await insertNotification(`System override: INITIATING ${newPhase === 'phase2' ? 'WAGER MODE' : 'PHASE 01 (STANDARD)'}.`);

                if (newPhase === 'phase2') {
                    await insertNotification('Wager Mode begins. Resetting queue and active matches for immediate rematch.');
                    await resetMatchmakingForWagerMode();
                    await supabaseAdmin.from('match_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    await enforceWagerEliminations();
                    await enrollAllEligibleTeams();
                    await autoMatchPairs();
                }

                return ok();
            }

            case 'createDefaultTeams': {
                const teamIds = await createDefaultTeams();
                return ok({ count: teamIds.length, password: DEFAULT_TEAM_PASSWORD });
            }

            case 'createTeam': {
                const name = payload?.name?.trim();
                if (!name) return fail(400, 'Missing team name');
                if (isLikePattern(name)) return fail(400, 'Invalid team name');

                const passwordHash = await hashPassword(payload?.password || DEFAULT_TEAM_PASSWORD);

                const existing = await querySingle(
                    supabaseAdmin.from('teams').select('id, name').ilike('name', name).limit(1).maybeSingle()
                );

                const payloadData = {
                    name,
                    member_names: payload?.memberNames || [name],
                    leader: payload?.leader || (payload?.memberNames?.[0]) || name,
                    password: passwordHash,
                    tokens: payload?.tokens ?? 1,
                    status: payload?.status || 'idle',
                };

                let teamId = existing?.id || null;
                if (existing?.id) {
                    await supabaseAdmin.from('teams').update(payloadData).eq('id', existing.id);
                } else {
                    const inserted = await querySingle(
                        supabaseAdmin.from('teams').insert([payloadData]).select().maybeSingle()
                    );
                    teamId = inserted?.id || null;
                }

                const system = await getGameSystem();
                if (teamId && system?.is_game_active && !system?.is_paused) {
                    const alreadyQueued = await querySingle(
                        supabaseAdmin.from('matchmaking_queue').select('id').eq('team_id', teamId).maybeSingle()
                    );
                    if (!alreadyQueued) {
                        await supabaseAdmin.from('matchmaking_queue').insert([
                            {
                                team_id: teamId,
                                team_name: name,
                                team_tokens: payloadData.tokens ?? 1,
                                phase: system?.phase || 'phase1',
                            },
                        ]);
                    }
                }

                await insertNotification(`${name} has entered the arena.`);
                return ok({ teamId });
            }

            case 'editTeam': {
                const teamData = payload || {};
                if (!teamData?.id) return fail(400, 'Missing team id');

                const updates = {};
                const allowed = ['name', 'member_names', 'leader', 'status', 'tokens', 'timeout_until', 'last_token_update_time'];
                allowed.forEach((key) => {
                    if (teamData[key] !== undefined) updates[key] = teamData[key];
                });
                if (teamData.memberNames !== undefined) updates.member_names = teamData.memberNames;

                await supabaseAdmin.from('teams').update(updates).eq('id', teamData.id);
                return ok();
            }

            case 'deleteTeam': {
                const teamId = payload?.id;
                if (!teamId) return fail(400, 'Missing team id');
                await supabaseAdmin.from('teams').delete().eq('id', teamId);
                return ok();
            }

            case 'updateTokens': {
                const teamId = payload?.teamId;
                const amount = Number(payload?.amount ?? 0);
                const reason = payload?.reason || '';
                if (!teamId) return fail(400, 'Missing teamId');

                const team = await querySingle(
                    supabaseAdmin.from('teams').select('name, tokens, status').eq('id', teamId).limit(1).maybeSingle()
                );
                if (!team) return ok();

                const newTokens = (team.tokens ?? 0) + amount;
                const updates = { tokens: Math.max(0, newTokens), last_token_update_time: Date.now() };

                const system = await getGameSystem();
                const isPhase2 = system?.phase === 'phase2';

                if (newTokens > 0 && team.status === 'timeout') {
                    updates.status = 'idle';
                    updates.timeout_until = null;
                } else if (newTokens <= 0) {
                    if (isPhase2) {
                        updates.status = 'eliminated';
                        updates.timeout_until = null;
                    } else if (team.status !== 'timeout') {
                        updates.status = 'timeout';
                        let timeoutMs = 5 * 60 * 1000;
                        if (system?.timeout_duration_override) {
                            timeoutMs = system.timeout_duration_override;
                        } else if (system?.game_started_at) {
                            const elapsed = Date.now() - system.game_started_at;
                            timeoutMs = elapsed <= 30 * 60 * 1000 ? 5 * 60 * 1000 : 15 * 60 * 1000;
                        }
                        updates.timeout_until = Date.now() + timeoutMs;
                    }
                    await supabaseAdmin.from('matchmaking_queue').delete().eq('team_id', teamId);
                }

                await supabaseAdmin.from('teams').update(updates).eq('id', teamId);
                await insertNotification(`Admin adjusted tokens for ${team?.name || 'Unknown'}: ${amount > 0 ? '+' : ''}${amount} TKN${reason ? ` (${reason})` : ''}.`);
                return ok();
            }

            case 'recoverFromTimeout': {
                const teamId = payload?.teamId;
                const teamName = payload?.teamName || '';
                if (!teamId) return fail(400, 'Missing teamId');

                const team = await querySingle(
                    supabaseAdmin.from('teams').select('status').eq('id', teamId).limit(1).maybeSingle()
                );
                if (team?.status !== 'timeout') return ok();

                await supabaseAdmin
                    .from('teams')
                    .update({ tokens: 1, status: 'idle', timeout_until: null, last_token_update_time: Date.now() })
                    .eq('id', teamId);

                const inQueue = await querySingle(
                    supabaseAdmin.from('matchmaking_queue').select('id').eq('team_id', teamId).maybeSingle()
                );
                if (!inQueue) {
                    await supabaseAdmin
                        .from('matchmaking_queue')
                        .insert([{ team_id: teamId, team_name: teamName, team_tokens: 1 }]);
                }
                return ok();
            }

            case 'createMatch': {
                const teamAId = payload?.teamAId;
                const teamBId = payload?.teamBId;
                const domain = payload?.domain;
                if (!teamAId || !teamBId) return fail(400, 'Missing team ids');

                const [teamA, teamB] = await Promise.all([
                    querySingle(supabaseAdmin.from('teams').select('id, name, tokens, status').eq('id', teamAId).maybeSingle()),
                    querySingle(supabaseAdmin.from('teams').select('id, name, tokens, status').eq('id', teamBId).maybeSingle()),
                ]);

                if (!teamA || !teamB) return ok({ match: null });
                if (teamA.status === 'eliminated' || teamB.status === 'eliminated') return ok({ match: null });
                if ((teamA.tokens ?? 0) <= 0 || (teamB.tokens ?? 0) <= 0) return ok({ match: null });

                const [existingA, existingB] = await Promise.all([
                    querySingle(supabaseAdmin.from('active_matches').select('id').or(`team_a.eq.${teamAId},team_b.eq.${teamAId}`).limit(1).maybeSingle()),
                    querySingle(supabaseAdmin.from('active_matches').select('id').or(`team_a.eq.${teamBId},team_b.eq.${teamBId}`).limit(1).maybeSingle()),
                ]);

                if (existingA || existingB) return ok({ match: null });

                const match = await querySingle(
                    supabaseAdmin
                        .from('active_matches')
                        .insert([{
                            team_a: teamAId,
                            team_b: teamBId,
                            domain,
                            start_time: Date.now(),
                            teamA: toPublicTeamSnapshot(teamA),
                            teamB: toPublicTeamSnapshot(teamB),
                        }])
                        .select()
                        .maybeSingle()
                );

                await supabaseAdmin.from('matchmaking_queue').delete().or(`team_id.eq.${teamAId},team_id.eq.${teamBId}`);
                await supabaseAdmin.from('teams').update({ status: 'fighting' }).in('id', [teamAId, teamBId]);
                await insertNotification(`Match started: ${teamA?.name || teamAId} vs ${teamB?.name || teamBId}`);
                return ok({ match });
            }

            case 'declareWinner': {
                const matchId = payload?.matchId;
                const winnerId = payload?.winnerId;
                if (!matchId || !winnerId) return fail(400, 'Missing matchId or winnerId');

                const match = await querySingle(
                    supabaseAdmin.from('active_matches').select('*').eq('id', matchId).limit(1).maybeSingle()
                );
                if (!match) return ok();

                const system = await getGameSystem();
                const loserId = match.team_a === winnerId ? match.team_b : match.team_a;

                const [winnerTeam, loserTeam] = await Promise.all([
                    querySingle(supabaseAdmin.from('teams').select('*').eq('id', winnerId).limit(1).maybeSingle()),
                    querySingle(supabaseAdmin.from('teams').select('*').eq('id', loserId).limit(1).maybeSingle()),
                ]);

                if (!winnerTeam || !loserTeam) {
                    await supabaseAdmin.from('active_matches').delete().eq('id', matchId);
                    return ok();
                }

                const isWager = Boolean(match?.is_wager || match?.isWager || system?.phase === 'phase2');
                let winnerTokens;
                let loserTokens;
                let loserStatus;

                if (isWager) {
                    const outcome = calculateWagerOutcome(winnerTeam, loserTeam);
                    winnerTokens = outcome.winnerTokens;
                    loserTokens = outcome.loserTokens;
                    loserStatus = outcome.loserStatus;
                } else {
                    winnerTokens = (winnerTeam.tokens ?? 1) + 1;
                    loserTokens = Math.max(0, (loserTeam.tokens ?? 1) - 1);
                    loserStatus = loserTokens === 0 ? 'timeout' : 'idle';
                }

                let timeoutMs = null;
                if (loserStatus === 'timeout') {
                    const gameStartedAt = system?.game_started_at;
                    const override = system?.timeout_duration_override;
                    if (override) {
                        timeoutMs = override;
                    } else if (gameStartedAt) {
                        const elapsed = Date.now() - gameStartedAt;
                        timeoutMs = elapsed <= 30 * 60 * 1000 ? 5 * 60 * 1000 : 15 * 60 * 1000;
                    } else {
                        timeoutMs = 5 * 60 * 1000;
                    }
                }

                await supabaseAdmin.from('teams').update({
                    tokens: winnerTokens,
                    status: 'idle',
                    last_token_update_time: Date.now(),
                    timeout_until: null,
                }).eq('id', winnerId);

                await supabaseAdmin.from('teams').update({
                    tokens: loserTokens,
                    status: loserStatus,
                    last_token_update_time: Date.now(),
                    timeout_until: loserStatus === 'timeout' ? Date.now() + timeoutMs : null,
                }).eq('id', loserId);

                const winDelta = winnerTokens - (winnerTeam.tokens ?? 0);
                const loseDelta = loserTokens - (loserTeam.tokens ?? 0);

                try {
                    await supabaseAdmin.from('token_history').insert([
                        { team: winnerTeam.name, change: `+${winDelta}`, reason: isWager ? 'Wager win' : 'Match win', timestamp: new Date().toISOString() },
                        { team: loserTeam.name, change: `${loseDelta}`, reason: isWager ? 'Wager loss' : 'Match loss', timestamp: new Date().toISOString() },
                    ]);
                } catch {
                    // Best-effort history.
                }

                await insertNotification(
                    isWager && loserStatus === 'eliminated'
                        ? `${winnerTeam.name} eliminated ${loserTeam.name}.`
                        : `${winnerTeam.name} defeated ${loserTeam.name}.`
                );

                try {
                    await supabaseAdmin.from('match_history').insert([
                        {
                            id: `mh_${matchId}`,
                            winner: winnerTeam.name,
                            loser: loserTeam.name,
                            domain: match.domain,
                            timestamp: new Date().toISOString(),
                            is_wager: isWager,
                            phase: system?.phase || 'phase1'
                        },
                    ]);
                } catch {
                    await supabaseAdmin.from('match_history').insert([
                        {
                            id: `mh_${matchId}`,
                            winner: winnerTeam.name,
                            loser: loserTeam.name,
                            domain: match.domain,
                            timestamp: new Date().toISOString(),
                            phase: system?.phase || 'phase1'
                        },
                    ]);
                }


                await supabaseAdmin.from('active_matches').delete().eq('id', matchId);

                const sysCheck = await getGameSystem();
                if (sysCheck?.is_game_active && !sysCheck?.is_paused) {
                    const reEnqueue = async (teamId, teamName, status, tokens) => {
                        if (status === 'eliminated' || status === 'timeout' || tokens <= 0) return;
                        const alreadyInQueue = await querySingle(
                            supabaseAdmin.from('matchmaking_queue').select('id').eq('team_id', teamId).maybeSingle()
                        );
                        if (!alreadyInQueue) {
                            await supabaseAdmin
                                .from('matchmaking_queue')
                                .insert([{ team_id: teamId, team_name: teamName, team_tokens: tokens }]);
                        }
                    };
                    await reEnqueue(winnerId, winnerTeam.name, 'idle', winnerTokens);
                    await reEnqueue(loserId, loserTeam.name, loserStatus, loserTokens);
                }

                // Trigger auto-matchmaking to support Phase 2 automated flow
                await autoMatchPairs();

                return ok();
            }


            case 'spinDomain': {
                const matchId = payload?.matchId;
                const preferredDomain = payload?.preferredDomain;
                if (!matchId) return fail(400, 'Missing matchId');

                const match = await querySingle(
                    supabaseAdmin.from('active_matches').select('*').eq('id', matchId).limit(1).maybeSingle()
                );
                if (!match) return ok({ domain: preferredDomain || 'TBD', validDomains: [] });

                const [historyRows, teamsRows, activeMatches, system] = await Promise.all([
                    queryList(supabaseAdmin.from('match_history').select('*')),
                    queryList(supabaseAdmin.from('teams').select('*')),
                    queryList(supabaseAdmin.from('active_matches').select('domain')),
                    getGameSystem(),
                ]);

                const teams = (teamsRows || []).map(normalizeTeam);
                const constraints = buildConstraintsFromHistory(historyRows || [], teams, system?.phase);
                const allDomains = system?.domains || DEFAULT_DOMAINS;

                const teamA = teams.find((t) => t.id === match.team_a);
                const teamB = teams.find((t) => t.id === match.team_b);

                // Get valid domains considering team history and phase
                const validDomains = getValidDomains({
                    teamA,
                    teamB,
                    matchConstraints: constraints,
                    allDomains,
                    phase: system?.phase
                });

                let domain = preferredDomain;

                // Enforce system-side randomness and variety across active matches
                if (!domain || !validDomains.includes(domain)) {
                    if (validDomains.length > 0) {
                        // Track domains currently active in OTHER matches to promote variety
                        const activeDomains = (activeMatches || [])
                            .map(m => m.domain)
                            .filter(d => d && d !== 'TBD');

                        // Try to pick a domain that isn't currently active in another match
                        const uniqueValid = validDomains.filter(d => !activeDomains.includes(d));
                        const choices = uniqueValid.length > 0 ? uniqueValid : validDomains;

                        domain = choices[Math.floor(Math.random() * choices.length)];
                    } else {
                        // Fallback
                        domain = allDomains[Math.floor(Math.random() * allDomains.length)];
                    }
                }

                await supabaseAdmin.from('active_matches').update({ domain }).eq('id', matchId);
                return ok({ domain, validDomains });
            }



            case 'updateDomains': {
                const domains = payload?.domains;
                await supabaseAdmin.from('system').update({ domains }).eq('key', 'game');
                return ok();
            }

            case 'setTimeoutDuration': {
                const durationMs = payload?.durationMs;
                await supabaseAdmin.from('system').update({ timeout_duration_override: durationMs }).eq('key', 'game');
                return ok();
            }

            case 'endMatchAndStartFinale': {
                const teamsRows = await queryList(supabaseAdmin.from('teams').select('*'));
                const allTeams = (teamsRows || []).map(normalizeTeam);

                await supabaseAdmin.from('active_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                await supabaseAdmin.from('matchmaking_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');

                const teamIds = allTeams.map((t) => t.id).filter(Boolean);
                if (teamIds.length) {
                    await supabaseAdmin.from('teams').update({ status: 'spectating', timeout_until: null }).in('id', teamIds);
                }

                const sorted = [...allTeams].sort((a, b) => {
                    if (b.tokens !== a.tokens) return b.tokens - a.tokens;
                    return (a.lastTokenUpdateTime || 0) - (b.lastTokenUpdateTime || 0);
                });
                const topA = sorted[0];
                const topB = sorted[1];
                if (!topA || !topB) return ok();

                await supabaseAdmin.from('teams').update({ status: 'finalist', timeout_until: null }).in('id', [topA.id, topB.id]);

                const finaleState = {
                    isFinaleActive: true,
                    teamAId: topA.id,
                    teamBId: topB.id,
                    teamAName: topA.name,
                    teamBName: topB.name,
                    winsA: 0,
                    winsB: 0,
                    currentRound: 0,
                    currentDomain: null,
                    pendingDomain: null,
                    roundStartedAt: null,
                    finaleResults: [],
                    finaleDomains: [],
                    finaleWinner: null,
                };

                await supabaseAdmin.from('system').update({
                    finale_state: finaleState,
                    is_game_active: false,
                    is_paused: false,
                    status: 'finale',
                    paused_at: null,
                }).eq('key', 'game');

                await insertNotification(`Game ends with top 2 crews: ${topA.name} and ${topB.name}.`);
                return ok();
            }

            case 'setFinaleDomain': {
                const domain = payload?.domain;
                const sys = await querySingle(
                    supabaseAdmin.from('system').select('finale_state').eq('key', 'game').limit(1).maybeSingle()
                );
                const fs = { ...(sys?.finale_state || {}) };
                if (!fs.isFinaleActive || fs.currentDomain || fs.finaleWinner || (fs.currentRound || 0) >= FINALE_TOTAL_ROUNDS) return ok();
                if (!domain) return ok();

                const usedDomains = new Set([...(fs.finaleDomains || [])].filter(Boolean));
                if (usedDomains.has(domain)) {
                    await insertNotification(`Finale domain already used: ${domain}`);
                    return ok();
                }

                const updated = { ...fs, currentDomain: domain, pendingDomain: null, roundStartedAt: Date.now() };
                await supabaseAdmin.from('system').update({ finale_state: updated }).eq('key', 'game');
                await insertNotification(`Finale Round ${(updated.currentRound || 0) + 1} initiated in ${domain}`);
                return ok();
            }

            case 'clearFinalePendingDomain': {
                const sys = await querySingle(
                    supabaseAdmin.from('system').select('finale_state').eq('key', 'game').limit(1).maybeSingle()
                );
                const fs = { ...(sys?.finale_state || {}) };
                if (!fs.isFinaleActive || fs.currentDomain || !fs.pendingDomain) return ok();

                const updated = { ...fs, pendingDomain: null };
                await supabaseAdmin.from('system').update({ finale_state: updated }).eq('key', 'game');
                return ok();
            }

            case 'initiateFinaleRound': {
                const sys = await querySingle(
                    supabaseAdmin.from('system').select('finale_state').eq('key', 'game').limit(1).maybeSingle()
                );
                const fs = { ...(sys?.finale_state || {}) };
                if (!fs.isFinaleActive || fs.currentDomain || !fs.pendingDomain || fs.finaleWinner || (fs.currentRound || 0) >= FINALE_TOTAL_ROUNDS) return ok();

                const usedDomains = new Set([...(fs.finaleDomains || [])].filter(Boolean));
                if (usedDomains.has(fs.pendingDomain)) return ok();

                const updated = { ...fs, currentDomain: fs.pendingDomain, pendingDomain: null, roundStartedAt: Date.now() };
                await supabaseAdmin.from('system').update({ finale_state: updated }).eq('key', 'game');
                await insertNotification(`Finale Round ${(updated.currentRound || 0) + 1} initiated in ${updated.currentDomain}`);
                return ok();
            }

            case 'declareFinaleRoundWinner': {
                const winner = payload?.winner;
                const sys = await querySingle(
                    supabaseAdmin.from('system').select('finale_state').eq('key', 'game').limit(1).maybeSingle()
                );
                const fs = { ...(sys?.finale_state || {}) };
                if ((fs.currentRound || 0) >= FINALE_TOTAL_ROUNDS) return ok();
                if (!fs.currentDomain) return ok();

                const results = [...(fs.finaleResults || [])];
                const domains = [...(fs.finaleDomains || [])];
                const resolvedDomain = fs.currentDomain;
                results.push(winner);
                domains.push(resolvedDomain);
                fs.finaleResults = results;
                fs.finaleDomains = domains;
                fs.winsA = results.filter((r) => r === 'a').length;
                fs.winsB = results.filter((r) => r === 'b').length;
                fs.currentRound = results.length;
                fs.currentDomain = null;
                fs.pendingDomain = null;
                fs.roundStartedAt = null;

                const winnerName = winner === 'a' ? fs.teamAName : fs.teamBName;
                const loserName = winner === 'a' ? fs.teamBName : fs.teamAName;
                await insertNotification(`Finale Round ${results.length}: ${winnerName} defeats ${loserName} in ${resolvedDomain}`);

                if (results.length >= FINALE_TOTAL_ROUNDS) {
                    if (fs.winsA > fs.winsB) {
                        fs.finaleWinner = 'a';
                    } else if (fs.winsB > fs.winsA) {
                        fs.finaleWinner = 'b';
                    } else {
                        fs.finaleWinner = 'draw';
                    }
                    const champName = fs.finaleWinner === 'a' ? fs.teamAName : fs.teamBName;
                    await insertNotification(`THE CHAMPION IS ${champName}! Final Score: ${fs.winsA} - ${fs.winsB}`);
                }

                await supabaseAdmin.from('system').update({ finale_state: fs }).eq('key', 'game');
                return ok();
            }

            case 'endFinale': {
                await supabaseAdmin.from('system').update({ finale_state: null }).eq('key', 'game');
                await supabaseAdmin.from('teams').update({ status: 'idle' }).in('status', ['spectating', 'finalist']);
                return ok();
            }

            case 'autoMatchPairs': {
                const pairs = await autoMatchPairs();
                return ok({ pairs });
            }

            case 'enforceWagerEliminations': {
                const eliminated = await enforceWagerEliminations();
                return ok({ eliminated });
            }

            default:
                return fail(400, `Unknown action: ${action}`);
        }
    } catch (err) {
        console.error('TOP-LEVEL ERROR:', err);
        return fail(500, `${err.message || 'Server error'}${err.stack ? `\nStack: ${err.stack}` : ''}`);
    }
});
