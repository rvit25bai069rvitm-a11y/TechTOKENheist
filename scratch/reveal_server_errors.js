import fs from 'fs';

const filePath = 'e:/tokenheist/src/hooks/useGameState.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldErrorBlock = /if\s*\(error\)\s*\{\s*console\.error\(`Error invoking \$\{action\}:`,\s*error\);\s*const status = error\.status \|\| \(error\.context && error\.context\.status\);\s*const detail = status \? ` \(HTTP \$\{status\}\)` : '';\s*alert\(`Error \[\$\{action\}\]: \$\{error\.message\}\$\{detail\}`\);\s*return\s*\{\s*success:\s*false,\s*error:\s*error\.message\s*\}\s*;\s*\}/;

const newErrorBlock = `          if (error) {
            console.error(\`Error invoking \${action}:\`, error);
            // Attempt to extract the real error message from the response body (data)
            // even if the Supabase client flagged it as an error.
            const serverErrorMessage = data?.error || error.message;
            const status = error.status || (error.context && error.context.status);
            const detail = status ? \` (HTTP \${status})\` : '';
            
            alert(\`Error [\${action}]: \${serverErrorMessage}\${detail}\`);
            return { success: false, error: serverErrorMessage };
          }`;

if (oldErrorBlock.test(content)) {
    content = content.replace(oldErrorBlock, newErrorBlock);
    fs.writeFileSync(filePath, content);
    console.log('Successfully updated error handling in useGameState.jsx to show server-side error messages');
} else {
    console.error('FAILED to find the error block for replacement.');
}
