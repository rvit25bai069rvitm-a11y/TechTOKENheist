
const supabaseUrl = 'https://cijggyxbdziimshdibwr.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamdneXhiZHppaW1zaGRpYndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTgyMjIsImV4cCI6MjA5MzQzNDIyMn0.yBTOAJg8rxn_JQz7MUBQtYlB4ZaDGqCVyihoqYtJ82o';

const username = 'proffesor';
const password = 'iamadmin';
const newStatus = Buffer.from(`${username}:${password}`).toString('base64');

console.log(`Updating admin_credential to ${username}:${password} (Base64: ${newStatus})...`);

async function updateAdmin() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/system?key=eq.admin_credential`, {
      method: 'PATCH',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ status: newStatus })
    });
    
    if (response.ok) {
      console.log('Successfully updated admin credentials in database.');
    } else {
      const errorText = await response.text();
      console.error('Failed to update admin credentials:', response.status, errorText);
    }
  } catch (err) {
    console.error('Fatal error updating admin credentials:', err);
  }
}

updateAdmin();
