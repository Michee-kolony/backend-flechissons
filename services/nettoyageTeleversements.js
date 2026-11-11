// services/nettoyageTeleversements.js
// Nettoyage des Multipart Uploads abandonnés sur Cloudflare R2.
//
// 1. Sessions MongoDB restées "en_cours" / "finalisation" / "echec" depuis
//    plus de DELAI_ABANDON_MS : AbortMultipartUpload puis statut "annule".
// 2. Multipart Uploads présents sur R2 (préfixe predications/) mais inconnus
//    de MongoDB, ou annulés, et plus vieux que DELAI_ABANDON_MS : AbortMultipartUpload.
//
// Seuls les uploads INCOMPLETS sont concernés : aucun fichier finalisé
// (et donc aucune prédication publiée) n'est jamais supprimé ici.

const {
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand
} = require('@aws-sdk/client-s3');

const r2 = require('../config/r2');
const Televersement = require('../models/televersement');
const { PREFIXE } = require('../controllers/televersement');

const { bucket: R2_BUCKET } = r2.parametres;

const INTERVALLE_MS = 60 * 60 * 1000;

const DELAI_ABANDON_MS =
  (parseInt(process.env.UPLOAD_DELAI_ABANDON_HEURES, 10) || 24) * 60 * 60 * 1000;

let enCours = false;

const abandonner = (key, uploadId) =>
  r2.send(new AbortMultipartUploadCommand({ Bucket: R2_BUCKET, Key: key, UploadId: uploadId }))
    .catch((err) => {
      if (err?.name !== 'NoSuchUpload' && err?.$metadata?.httpStatusCode !== 404) {
        throw err;
      }
    });

const nettoyerSessions = async (limite) => {

  const sessions = await Televersement.find({
    statut: { $in: ['en_cours', 'finalisation', 'echec'] },
    updatedAt: { $lt: limite }
  }).limit(200);

  for (const session of sessions) {
    try {
      await abandonner(session.key, session.uploadId);
      session.statut = 'annule';
      session.erreur = 'Nettoyage automatique (upload abandonné).';
      await session.save();
      console.log(`🧹 Upload abandonné nettoyé : ${session.key}`);
    } catch (err) {
      console.error(`❌ Nettoyage ${session.key} :`, err.message);
    }
  }
};

const nettoyerOrphelinsR2 = async (limite) => {

  let KeyMarker;
  let UploadIdMarker;

  do {
    const reponse = await r2.send(new ListMultipartUploadsCommand({
      Bucket: R2_BUCKET,
      Prefix: `${PREFIXE}/`,
      KeyMarker,
      UploadIdMarker
    }));

    for (const upload of reponse.Uploads || []) {
      if (!upload.Initiated || new Date(upload.Initiated) >= limite) continue;

      const session = await Televersement.findOne({ uploadId: upload.UploadId }).select('statut');

      // Une session encore active est gérée par nettoyerSessions
      if (session && ['en_cours', 'finalisation'].includes(session.statut)) continue;

      try {
        await abandonner(upload.Key, upload.UploadId);
        console.log(`🧹 Multipart orphelin R2 nettoyé : ${upload.Key}`);
      } catch (err) {
        console.error(`❌ Nettoyage orphelin ${upload.Key} :`, err.message);
      }
    }

    KeyMarker = reponse.IsTruncated ? reponse.NextKeyMarker : undefined;
    UploadIdMarker = reponse.IsTruncated ? reponse.NextUploadIdMarker : undefined;
  } while (KeyMarker);
};

const nettoyer = async () => {

  if (enCours) return;
  enCours = true;

  try {
    const limite = new Date(Date.now() - DELAI_ABANDON_MS);
    await nettoyerSessions(limite);
    await nettoyerOrphelinsR2(limite);
  } catch (err) {
    console.error('❌ Nettoyage des téléversements :', err.message);
  } finally {
    enCours = false;
  }
};

const demarrerNettoyageTeleversements = () => {
  nettoyer();
  setInterval(nettoyer, INTERVALLE_MS);
};

module.exports = { demarrerNettoyageTeleversements };
