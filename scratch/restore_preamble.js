import fs from 'fs';

const filePath = 'e:/tokenheist/supabase/functions/game-actions/index.ts';
const currentContent = fs.readFileSync(filePath, 'utf8');

const preamble = `import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3?target=deno";
const { compare, hash } = bcrypt;
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

const DEFAULT_TEAM_PASSWORD = 'abcd';
const FINALE_TOTAL_ROUNDS = 5;
const DEFAULT_DOMAINS = ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];


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
const isBcryptHash = (value) => typeof value === 'string' && value.startsWith('$2');

const verifyPassword = async (password, stored) => {
    if (!stored) return false;
    if (isBcryptHash(stored)) return await compare(password, stored);
    return stored === password;
};

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await hash(password, salt);
};

const getGameSystem = async () => querySingle(
    supabaseAdmin.from('system').select('*').eq('key', 'game').limit(1).maybeSingle()
);

const insertNotification = async (message) => {
    try {
        await supabaseAdmin.from('notifications').insert([
            { message, time: new Date().toLocaleTimeString() },
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
                message: \`\${team.name} eliminated in WAGER mode (0 tokens).\`,
                time: new Date().toLocaleTimeString(),
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

const autoMatchPairs = async () => {
    const system = await getGameSystem();
    if (!system?.is_game_active || system?.is_paused) return [];
    if (system?.finale_state?.isFinaleActive) return [];

    const [teamsRows, queueRows, matchRows, historyRows] = await Promise.all([
        queryList(supabaseAdmin.from('teams').select('*')),
        queryList(supabaseAdmin.from('matchmaking_queue').select('*')),
        queryList(supabaseAdmin.from('active_matches').select('*')),
        queryList(supabaseAdmin.from('match_history').select('*')),
    ]);

    const teams = teamsRows.map(normalizeTeam);
    const constraints = buildConstraintsFromHistory(historyRows || [], teams);

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

    const updatePromises = pairs.flatMap((p) => [
        supabaseAdmin.from('matchmaking_queue').update({ matched_with: p.teamBId }).eq('team_id', p.teamAId),
        supabaseAdmin.from('matchmaking_queue').update({ matched_with: p.teamAId }).eq('team_id', p.teamBId),
    ]);
    await Promise.all(updatePromises);

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

    const adminActions = ['enrollAllEligible', 'startGame', 'stopGame', 'resetGame', 'togglePhase', 'createTeam', 'editTeam', 'deleteTeam', 'updateTokens', 'recoverFromTimeout', 'createMatch', 'declareWinner', 'spinDomain', 'updateDomains', 'setTimeoutDuration', 'autoMatchPairs', 'endMatchAndStartFinale', 'declareFinaleWinner', 'endFinale', 'enforceWagerEliminations'];
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

    // Basic health check for database connectivity
    if (action === 'healthCheck') {
        const { data, error: healthError } = await supabaseAdmin.from('system').select('status').eq('key', 'game').maybeSingle();
        if (healthError) return fail(500, \`DB Health Check failed: \${healthError.message}\`);
        return ok({ status: 'healthy', systemStatus: data?.status });
    }

    try {
        switch (action) {
            case 'login': {
                const username = payload?.username?.trim();
                const password = payload?.password ?? '';
                if (!username || !password) return fail(400, 'Missing credentials');
                if (isLikePattern(username)) return fail(400, 'Invalid username');
`;

fs.writeFileSync(filePath, preamble + currentContent);
console.log('Successfully restored preamble to index.ts');
