import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabaseClient.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SAFE_TEAM_COLUMNS = 'id, name, member_names, leader, tokens, status, total_time, timeout_until, last_token_update_time, created_at';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const stripPrivateTeamSnapshot = (team) => {
    if (!team || typeof team !== 'object') return team;
    const { password, password_hash, passwordHash, credential, credentials, secret, authToken, jwt, session, ...safe } = team;
    return safe;
};

const sanitizeMatchRow = (match) => {
    if (!match || typeof match !== 'object') return match;
    return {
        ...match,
        teamA: stripPrivateTeamSnapshot(match.teamA),
        teamB: stripPrivateTeamSnapshot(match.teamB),
    };
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const results = await Promise.all([
            supabaseAdmin.from('system').select('*').eq('key', 'game'),
            supabaseAdmin.from('teams').select(SAFE_TEAM_COLUMNS).order('name', { ascending: true }),
            supabaseAdmin.from('matchmaking_queue').select('*'),
            supabaseAdmin.from('active_matches').select('*'),
            supabaseAdmin.from('match_history').select('*'),
            supabaseAdmin.from('notifications').select('*'),
            supabaseAdmin.from('token_history').select('*'),
        ]);

        const tableNames = ['system', 'teams', 'matchmaking_queue', 'active_matches', 'match_history', 'notifications', 'token_history'];
        const failed = results
            .map((res, i) => res.error ? { table: tableNames[i], error: res.error.message } : null)
            .filter(Boolean);

        if (failed.length > 0) {
            console.error('Database queries failed:', failed);
            return json({ 
                error: 'Database query failed', 
                details: failed 
            }, 500);
        }

        const [systemRes, teamsRes, queueRes, matchesRes, historyRes, notifRes, tokenRes] = results;

        return json({
            systemRows: systemRes.data || [],
            teamsRows: teamsRes.data || [],
            queueRows: queueRes.data || [],
            matchRows: (matchesRes.data || []).map(sanitizeMatchRow),
            historyRows: historyRes.data || [],
            notificationRows: notifRes.data || [],
            tokenHistory: tokenRes.data || [],
        });
    } catch (err) {
        console.error('Critical server error:', err);
        return json({ error: err?.message || 'Server error' }, 500);
    }
});
