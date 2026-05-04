const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to load service account file
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
let db = null;

try {
  if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('✅ Firebase Firestore connected via serviceAccountKey.json');
  } else {
    console.log('⚠️ serviceAccountKey.json not found. Falling back to local db.json');
  }
} catch (err) {
  console.error('❌ Failed to initialize Firebase:', err.message);
}

module.exports = { db, admin };
