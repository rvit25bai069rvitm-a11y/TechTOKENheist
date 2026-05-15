import fs from 'fs';

const filePath = 'e:/tokenheist/src/hooks/useGameState.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldErrorBlock = `          if (error) {
            console.error(\`Error invoking \${action}:\`, error)
              alert(\`Error [\${action}]: \${error.message}\`)
            return { success: false, error: error.message }
          }`;

const newErrorBlock = `          if (error) {
            console.error(\`Error invoking \${action}:\`, error);
            const status = error.status || (error.context && error.context.status);
            const detail = status ? \` (HTTP \${status})\` : '';
            alert(\`Error [\${action}]: \${error.message}\${detail}\`);
            return { success: false, error: error.message };
          }`;

// Check if oldErrorBlock exists exactly
if (content.includes(oldErrorBlock)) {
    content = content.replace(oldErrorBlock, newErrorBlock);
    fs.writeFileSync(filePath, content);
    console.log('Successfully updated error handling in useGameState.jsx');
} else {
    console.log('Could not find exact error block. Attempting fuzzy match...');
    // Try to find it with potential whitespace variations
    const regex = /if\s*\(error\)\s*\{\s*console\.error\(`Error invoking \$\{action\}:`,\s*error\)\s*alert\(`Error \[\$\{action\}\]: \$\{error\.message\}`\)\s*return\s*\{\s*success:\s*false,\s*error:\s*error\.message\s*\}\s*\}/;
    if (regex.test(content)) {
        content = content.replace(regex, newErrorBlock);
        fs.writeFileSync(filePath, content);
        console.log('Successfully updated error handling via regex');
    } else {
         console.error('FAILED to find the error block even with regex.');
    }
}
