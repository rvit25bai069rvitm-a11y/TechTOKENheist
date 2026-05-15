import fs from 'fs';

const filePath = 'e:/tokenheist/src/hooks/useGameState.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// I will replace the _invoke function with a version that uses raw fetch for better debugging.
// This allows us to see the exact response body even on 500 errors.

const newInvokeFunction = `      _invoke: async (action, payload = {}) => {
        try {
          const token = get().user?.token;
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          // Construct the Edge Function URL
          const functionUrl = \`\${supabaseUrl}/functions/v1/game-actions\`;
          
          const headers = {
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${import.meta.env.VITE_SUPABASE_ANON_KEY}\`,
            'x-game-token': token || ''
          };

          const response = await fetch(functionUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ action, payload })
          });

          const responseText = await response.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch (e) {
            responseData = { error: responseText };
          }

          if (!response.ok) {
            console.error(\`Edge Function Error [\${action}]:\`, response.status, responseData);
            const errorMessage = responseData?.error || responseData?.message || responseText || 'Unknown server error';
            alert(\`Error [\${action}] (HTTP \${response.status}): \${errorMessage}\`);
            return { success: false, error: errorMessage };
          }

          if (responseData && !responseData.success) {
            console.error(\`\${action} failed:\`, responseData.error);
            alert(\`Failed [\${action}]: \${responseData.error}\`);
            return { success: false, error: responseData.error };
          }

          return { success: true, data: responseData?.data };
        } catch (error) {
          console.error(\`Error invoking \${action}:\`, error);
          alert(\`Network Error [\${action}]: \${error.message}\`);
          return { success: false, error: error.message };
        }
      },`;

// Find the _invoke function. It's inside useGameStateStore.
const invokeRegex = /_invoke: async \(action, payload = \{\}\) => \{[\s\S]*?\},\s*resetGame/;

if (invokeRegex.test(content)) {
    // Note: I need to preserve 'resetGame' at the end or include it in the replacement.
    // I'll just replace up to the comma before resetGame.
    content = content.replace(invokeRegex, newInvokeFunction + '\n      resetGame');
    fs.writeFileSync(filePath, content);
    console.log('Successfully updated _invoke to use raw fetch for better error transparency');
} else {
    console.error('FAILED to find the _invoke function for replacement.');
}
