import fs from 'fs';

const filePath = 'e:/tokenheist/supabase/functions/game-actions/index.ts';
const content = fs.readFileSync(filePath, 'utf8');

let openBraces = 0;
let closeBraces = 0;

for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') openBraces++;
    if (content[i] === '}') closeBraces++;
}

console.log(`Open braces: ${openBraces}, Close braces: ${closeBraces}`);

if (openBraces !== closeBraces) {
    console.error('MISMATCHED BRACES DETECTED!');
} else {
    console.log('Braces are balanced.');
}

// Check for duplicate variable declarations or other obvious errors
const lines = content.split('\n');
const caseLabels = [];
for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/case\s+'([^']+)'\s*:/);
    if (match) {
        const label = match[1];
        if (caseLabels.includes(label)) {
            console.error(`DUPLICATE CASE LABEL: ${label} at line ${i + 1}`);
        }
        caseLabels.push(label);
    }
}

console.log(`Found ${caseLabels.length} cases.`);
