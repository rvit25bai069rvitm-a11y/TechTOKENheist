import fs from 'fs';

const filePath = 'e:/tokenheist/supabase/functions/game-actions/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

const newResetGameCase = `            case 'resetGame': {
                try {
                    console.log('Initiating full game reset...');
                    
                    // Delete all transactional data in parallel
                    await Promise.all([
                        supabaseAdmin.from('matchmaking_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                        supabaseAdmin.from('active_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                        supabaseAdmin.from('match_history').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                        supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
                        supabaseAdmin.from('token_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')
                    ]);

                    // Bulk update teams for performance
                    const { error: teamError } = await supabaseAdmin.from('teams').update({
                        tokens: 1,
                        status: 'idle',
                        timeout_until: null,
                        last_token_update_time: null,
                    }).neq('id', '00000000-0000-0000-0000-000000000000');

                    if (teamError) throw teamError;

                    // Reset system state
                    const { error: systemError } = await supabaseAdmin.from('system').update({
                        is_game_active: false,
                        is_paused: false,
                        status: 'not_started',
                        phase: 'phase1',
                        game_started_at: null,
                        paused_at: null,
                        timeout_duration_override: null,
                        domains: DEFAULT_DOMAINS,
                    }).eq('key', 'game');

                    if (systemError) throw systemError;

                    console.log('Game reset successfully completed');
                    return ok();
                } catch (err) {
                    console.error('CRITICAL: Reset game failed:', err);
                    return fail(500, \`Reset failed: \${err.message}\`);
                }
            }`;

// Replace the resetGame case using regex
content = content.replace(/case 'resetGame': \{[\s\S]*?return ok\(\);\s*\}/, newResetGameCase);

fs.writeFileSync(filePath, content);
console.log('Successfully updated resetGame logic in index.ts');
