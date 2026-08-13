const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const requiredFirebaseEnv = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

const missingFirebaseEnv = requiredFirebaseEnv.filter((envKey) => {
  const value = process.env[envKey];
  return !value || value.trim() === '';
});

if (missingFirebaseEnv.length > 0) {
  const message = `❌ Variables Firebase Admin manquantes dans l'environnement. ${missingFirebaseEnv.join(', ')}`;
  console.error(message);
  throw new Error(message);
}

const rawPrivateKey = String(process.env.FIREBASE_PRIVATE_KEY).trim();
const privateKey = rawPrivateKey
  .replace(/^['"]|['"]$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\r/g, '');

if (
  !privateKey.includes('BEGIN PRIVATE KEY') ||
  !privateKey.includes('END PRIVATE KEY') ||
  privateKey.includes('...') ||
  privateKey.includes('PASTE_YOUR_PRIVATE_KEY_HERE') ||
  privateKey.includes('REPLACE_WITH_YOUR_PRIVATE_KEY')
) {
  const message = '❌ FIREBASE_PRIVATE_KEY invalide. Ajoutez la vraie clé privée du compte de service Firebase, avec des \\n échappés, sans placeholders.';
  console.error(message);
  throw new Error(message);
}

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey
};

let firebaseApp;

try {
  firebaseApp = initializeApp({
    credential: cert(serviceAccount)
  });
} catch (error) {
  console.error('❌ Firebase Admin n\'a pas pu se connecter. Vérifiez FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL et FIREBASE_PRIVATE_KEY.');
  throw error;
}

const firebaseAuth = getAuth(firebaseApp);

module.exports = {
  firebaseApp,
  firebaseAuth
};