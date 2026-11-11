const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

// =====================================================
// CONFIGURATION CLOUDFLARE R2
// -----------------------------------------------------
// Les valeurs sont lues dans les variables d'environnement (.env).
// Les anciennes valeurs restent en secours pour que le serveur
// continue de fonctionner tant que le .env n'est pas renseigné.
// Une fois les clés R2 renouvelées dans Cloudflare, ne les mettez
// QUE dans le .env du serveur (jamais dans le code ni dans Angular).
// =====================================================

const VALEURS_PAR_DEFAUT = {
  R2_ACCOUNT_ID: '75fdb20f0e6a0ac6591025a64b863028',
  R2_ACCESS_KEY_ID: 'abc2b1bb3357d23bcf0bf9cf91187586',
  R2_SECRET_ACCESS_KEY: 'e7e236da479fc7788200f39f08013ae4716978cb904ec5f9289b4a7b477f0b38',
  R2_BUCKET: 'flechissons',
  R2_PUBLIC_URL: 'https://pub-d21c8c5e48fb4a35ace1050c88bc8b91.r2.dev'
};

const lire = (nom) => {
  const valeur = process.env[nom];

  if (typeof valeur === 'string' && valeur.trim()) {
    return valeur.trim();
  }

  if (nom === 'R2_ACCESS_KEY_ID' || nom === 'R2_SECRET_ACCESS_KEY') {
    console.warn(`⚠️ ${nom} absent du .env : utilisation de la valeur de secours.`);
  }

  return VALEURS_PAR_DEFAUT[nom];
};

const parametres = {
  accountId: lire('R2_ACCOUNT_ID'),
  bucket: lire('R2_BUCKET'),
  // Sans "/" final : on construit `${publicUrl}/${key}`
  publicUrl: lire('R2_PUBLIC_URL').replace(/\/+$/, '')
};

parametres.endpoint = `https://${parametres.accountId}.r2.cloudflarestorage.com`;

const r2 = new S3Client({
  region: 'auto',

  endpoint: parametres.endpoint,

  credentials: {
    accessKeyId: lire('R2_ACCESS_KEY_ID'),
    secretAccessKey: lire('R2_SECRET_ACCESS_KEY')
  }
});


// =====================================================
// TEST CONNEXION R2
// =====================================================

const testR2 = async () => {

  try {

    console.log("🔄 Test connexion R2...");

    const command = new HeadBucketCommand({
      Bucket: parametres.bucket
    });

    await r2.send(command);

    console.log("✅ R2 fonctionne !");

  } catch (error) {

    console.error("❌ ERREUR R2 :");
    console.error(error);

  }

};

testR2();

// Le client reste l'export principal (utilisé tel quel par les autres modules)
module.exports = r2;
module.exports.parametres = parametres;
