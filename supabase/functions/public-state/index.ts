import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabaseClient.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const results = await Promise.all([
            supabaseAdmin.from('system').select('*'),
            supabaseAdmin.from('teams').select('*').order('name', { ascending: true }),
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
            matchRows: matchesRes.data || [],
            historyRows: historyRes.data || [],
            notificationRows: notifRes.data || [],
            tokenHistory: tokenRes.data || [],
        });
    } catch (err) {
        console.error('Critical server error:', err);
        return json({ error: err?.message || 'Server error' }, 500);
    }
});
