import fs from 'fs';

const filePath = 'e:/tokenheist/supabase/functions/game-actions/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

// The problematic block looks like this:
/*
293:                 return await issuePlayerToken();
294:             }
295: 
296:                 const passwordOk = await verifyPassword(password, team.password);
297:                 if (!passwordOk) return fail(401, 'Invalid username or password');
298: 
299:                 return await issuePlayerToken();
300:             }
*/

// We need to remove the redundant code after line 294.
// Let's find the 'joinQueue' case and see what's before it.

const brokenPart = /return await issuePlayerToken\(\);\s*\}\s*const passwordOk = await verifyPassword\(password, team\.password\);\s*if \(!passwordOk\) return fail\(401, 'Invalid username or password'\);\s*return await issuePlayerToken\(\);\s*\}/;

if (brokenPart.test(content)) {
    console.log('Found the broken syntax block. Fixing...');
    content = content.replace(brokenPart, 'return await issuePlayerToken();\n            }');
    fs.writeFileSync(filePath, content);
    console.log('Successfully fixed syntax in index.ts');
} else {
    console.log('Could not find exact broken block. Trying alternative approach...');
    // Fallback: look for the double return and closing braces
    const lines = content.split('\n');
    let startIndex = -1;
    let endIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('return await issuePlayerToken();') && lines[i+1]?.trim() === '}') {
            if (lines[i+2]?.includes('const passwordOk = await verifyPassword')) {
                startIndex = i + 1; // The first closing brace
                // Find where the next case starts
                for (let j = i + 2; j < lines.length; j++) {
                    if (lines[j].includes('case \'joinQueue\':')) {
                        endIndex = j;
                        break;
                    }
                }
                break;
            }
        }
    }
    
    if (startIndex !== -1 && endIndex !== -1) {
        console.log(`Fixing lines from ${startIndex + 1} to ${endIndex}`);
        lines.splice(startIndex + 1, endIndex - startIndex - 1);
        fs.writeFileSync(filePath, lines.join('\n'));
        console.log('Successfully fixed syntax via line manipulation');
    } else {
        console.error('FAILED to identify the broken block.');
    }
}
