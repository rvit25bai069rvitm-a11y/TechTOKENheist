import fs from 'fs';

const filePath = 'e:/tokenheist/supabase/functions/game-actions/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Define the new login case with logging and robustness
const newLoginCase = `            case 'login': {
                const username = payload?.username?.trim();
                const password = payload?.password ?? '';
                if (!username || !password) return fail(400, 'Missing credentials');
                if (isLikePattern(username)) return fail(400, 'Invalid username');

                console.log(\`Login attempt for: [\${username}]\`);

                // Check Admin Credentials (case-insensitive for username)
                const { data: adminRecords } = await supabaseAdmin
                    .from('system')
                    .select('status')
                    .in('key', ['admin_credential', 'admin_credential_alt']);

                const providedAdminB64 = btoa(\`\${username.toLowerCase()}:\${password}\`);
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
                    console.log(\`Login failed: Team [\${username}] not found\`);
                    return fail(401, 'Invalid username or password');
                }

                const issuePlayerToken = async () => {
                    console.log(\`Player login successful for team: \${team.name}\`);
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
                    console.log(\`Login failed: Password mismatch for team [\${username}]\`);
                    return fail(401, 'Invalid username or password');
                }

                return await issuePlayerToken();
            }`;

// Replace the old login case
// This regex tries to match from 'case "login": {' to the end of the case (before the next case)
content = content.replace(/case 'login': \{[\s\S]*?return await issuePlayerToken\(\);\s*\}/, newLoginCase);

fs.writeFileSync(filePath, content);
console.log('Successfully updated login logic in index.ts');
