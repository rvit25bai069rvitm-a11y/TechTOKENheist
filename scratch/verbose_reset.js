import fs from 'fs';

const filePath = 'e:/tokenheist/supabase/functions/game-actions/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

const verboseResetGame = `            case 'resetGame': {
                try {
                    console.log('--- STARTING VERBOSE RESET ---');
                    
                    console.log('1. Deleting matchmaking_queue...');
                    const { error: err1 } = await supabaseAdmin.from('matchmaking_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err1) { console.error('Error in step 1:', err1); throw new Error(\`Queue deletion failed: \${err1.message}\`); }

                    console.log('2. Deleting active_matches...');
                    const { error: err2 } = await supabaseAdmin.from('active_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err2) { console.error('Error in step 2:', err2); throw new Error(\`Active matches deletion failed: \${err2.message}\`); }

                    console.log('3. Deleting match_history...');
                    const { error: err3 } = await supabaseAdmin.from('match_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err3) { console.error('Error in step 3:', err3); throw new Error(\`Match history deletion failed: \${err3.message}\`); }

                    console.log('4. Deleting notifications...');
                    const { error: err4 } = await supabaseAdmin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err4) { console.error('Error in step 4:', err4); throw new Error(\`Notifications deletion failed: \${err4.message}\`); }

                    console.log('5. Deleting token_history...');
                    const { error: err5 } = await supabaseAdmin.from('token_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    if (err5) { console.error('Error in step 5:', err5); throw new Error(\`Token history deletion failed: \${err5.message}\`); }

                    console.log('6. Resetting teams...');
                    const { error: teamError } = await supabaseAdmin.from('teams').update({
                        tokens: 1,
                        status: 'idle',
                        timeout_until: null,
                        last_token_update_time: null,
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
                    return fail(500, \`Reset failed at step: \${err.message}\`);
                }
            }`;

// Replace the resetGame case using regex
content = content.replace(/case 'resetGame': \{[\s\S]*?return ok\(\);\s*\}\s*catch \(err\) \{[\s\S]*?\}\s*\}/, verboseResetGame);

fs.writeFileSync(filePath, content);
console.log('Successfully updated resetGame logic in index.ts to be sequential and verbose');
