import fetch from 'node-fetch';

async function checkAdmin() {
  const url = 'https://cijggyxbdziimshdibwr.supabase.co/rest/v1/system?key=eq.admin_credential&select=*';
  const options = {
    method: 'GET',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamdneXhiZHppaW1zaGRpYndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTgyMjIsImV4cCI6MjA5MzQzNDIyMn0.yBTOAJg8rxn_JQz7MUBQtYlB4ZaDGqCVyihoqYtJ82o',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpamdneXhiZHppaW1zaGRpYndyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTgyMjIsImV4cCI6MjA5MzQzNDIyMn0.yBTOAJg8rxn_JQz7MUBQtYlB4ZaDGqCVyihoqYtJ82o'
    }
  };

  try {
    const res = await fetch(url, options);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

checkAdmin();
