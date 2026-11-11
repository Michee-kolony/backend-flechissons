// controllers/televersement.js
// Téléversement multipart direct navigateur → Cloudflare R2.
// Le backend ne voit jamais le contenu du fichier : il crée le multipart,
// signe chaque partie, puis vérifie et finalise l'upload.

const crypto = require('crypto');
const mongoose = require('mongoose');

const {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  HeadObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const r2 = require('../config/r2');
const Televersement = require('../models/televersement');

const { bucket: R2_BUCKET, publicUrl: R2_PUBLIC_URL } = r2.parametres;


// =====================================================
// CONFIGURATION
// =====================================================

const MO = 1024 * 1024;

// Taille maximale d'un fichier (Mo), configurable dans le .env
const TAILLE_MAX_MO = Math.max(
  1,
  parseInt(process.env.UPLOAD_MAX_TAILLE_MO, 10) || 5120
);

const TAILLE_MAX = TAILLE_MAX_MO * MO;

// R2 : parties de 5 Mio minimum (sauf la dernière), 10 000 parties maximum,
// toutes de la même taille sauf la dernière
const TAILLE_PARTIE_MIN = 10 * MO;
const NOMBRE_PARTIES_MAX = 10000;

// Durée de validité d'une URL présignée (secondes)
const EXPIRATION_URL_SECONDES = 15 * 60;

// Nombre maximum d'URL signées par appel
const PARTIES_PAR_APPEL_MAX = 20;

// Uploads en cours simultanés par administrateur
const UPLOADS_ACTIFS_MAX = 5;

const PREFIXE = 'predications';

// Extension → nature, types MIME acceptés, Content-Type enregistré sur R2.
// Le Content-Type stocké vient de cette table (jamais du navigateur).
const FORMATS = {
  mp3: { nature: 'audio', contentType: 'audio/mpeg', mimes: ['audio/mpeg', 'audio/mp3', 'audio/mpeg3', 'audio/x-mpeg-3', 'audio/x-mp3'] },
  wav: { nature: 'audio', contentType: 'audio/wav', mimes: ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'] },
  m4a: { nature: 'audio', contentType: 'audio/mp4', mimes: ['audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac'] },
  aac: { nature: 'audio', contentType: 'audio/aac', mimes: ['audio/aac', 'audio/x-aac', 'audio/aacp', 'audio/x-hx-aac-adts'] },
  mp4: { nature: 'video', contentType: 'video/mp4', mimes: ['video/mp4', 'application/mp4'] },
  mov: { nature: 'video', contentType: 'video/quicktime', mimes: ['video/quicktime'] },
  webm: { nature: 'video', contentType: 'video/webm', mimes: ['video/webm', 'audio/webm'] }
};

// Certains navigateurs n'envoient pas de type MIME précis
const MIMES_GENERIQUES = ['', 'application/octet-stream'];


// =====================================================
// UTILITAIRES
// =====================================================

const erreur = (res, statut, message, extra = {}) =>
  res.status(statut).json({ success: false, message, ...extra });

const normaliserEtag = (etag) =>
  String(etag || '').trim().replace(/^W\//, '').replace(/"/g, '').toLowerCase();

const tailleAttendue = (session, numero) =>
  numero < session.nombreParties
    ? session.taillePartie
    : session.taille - session.taillePartie * (session.nombreParties - 1);

const urlPublique = (key) => `${R2_PUBLIC_URL}/${key}`;

const estUploadIntrouvable = (err) =>
  err && (err.name === 'NoSuchUpload' || err.Code === 'NoSuchUpload' || err.$metadata?.httpStatusCode === 404);

// Taille des parties : au moins 10 Mo, et assez grande pour rester sous 10 000 parties
const calculerTaillePartie = (taille) => {
  const minimum = Math.ceil(taille / NOMBRE_PARTIES_MAX);
  return Math.max(TAILLE_PARTIE_MIN, Math.ceil(minimum / MO) * MO);
};

// Liste toutes les parties réellement reçues par R2 (avec pagination)
const listerParties = async (session) => {
  const parties = [];
  let marqueur;

  do {
    const reponse = await r2.send(new ListPartsCommand({
      Bucket: R2_BUCKET,
      Key: session.key,
      UploadId: session.uploadId,
      PartNumberMarker: marqueur
    }));

    for (const p of reponse.Parts || []) {
      parties.push({
        numeroPartie: p.PartNumber,
        etag: p.ETag,
        taille: p.Size
      });
    }

    marqueur = reponse.IsTruncated ? reponse.NextPartNumberMarker : undefined;
  } while (marqueur);

  return parties;
};

// Session appartenant à l'admin connecté (404 sinon, sans révéler qu'elle existe)
const chargerSession = async (req, res) => {
  const { televersementId } = req.body || {};

  if (!televersementId || !mongoose.Types.ObjectId.isValid(televersementId)) {
    erreur(res, 400, 'Identifiant de téléversement invalide.');
    return null;
  }

  const session = await Televersement.findOne({
    _id: televersementId,
    adminId: req.adminId
  });

  if (!session) {
    erreur(res, 404, 'Téléversement introuvable.');
    return null;
  }

  return session;
};

const resumeSession = (session) => ({
  televersementId: session._id,
  key: session.key,
  nomOriginal: session.nomOriginal,
  nature: session.nature,
  taille: session.taille,
  taillePartie: session.taillePartie,
  nombreParties: session.nombreParties,
  statut: session.statut,
  url: session.statut === 'termine' || session.statut === 'utilise' ? session.url : null
});


// =====================================================
// CONFIGURATION (formats et taille max pour l'admin)
// GET /api/uploads/multipart/config
// =====================================================

const getConfiguration = (req, res) => {
  return res.status(200).json({
    success: true,
    tailleMax: TAILLE_MAX,
    tailleMaxMo: TAILLE_MAX_MO,
    extensions: Object.keys(FORMATS),
    mimes: [...new Set(Object.values(FORMATS).flatMap(f => f.mimes))]
  });
};


// =====================================================
// INITIER UN UPLOAD
// POST /api/uploads/multipart/initiate
// body : { nomFichier, taille, typeMime }
// =====================================================

const initier = async (req, res) => {

  try {

    const { nomFichier, taille, typeMime } = req.body || {};

    // -------- Nom et extension --------

    if (typeof nomFichier !== 'string' || !nomFichier.trim() || nomFichier.length > 255) {
      return erreur(res, 400, 'Nom de fichier invalide.');
    }

    const nom = nomFichier.trim();
    const point = nom.lastIndexOf('.');
    const extension = point > 0 ? nom.slice(point + 1).toLowerCase() : '';
    const format = FORMATS[extension];

    if (!format) {
      return erreur(res, 400, 'Format non autorisé. Utilisez MP3, WAV, M4A, AAC, MP4, MOV ou WebM.');
    }

    // -------- Type MIME (cohérent avec l'extension) --------

    const mime = typeof typeMime === 'string' ? typeMime.trim().toLowerCase() : '';

    if (!MIMES_GENERIQUES.includes(mime) && !format.mimes.includes(mime)) {
      return erreur(res, 400, `Le type du fichier (${mime}) ne correspond pas à l'extension .${extension}.`);
    }

    // -------- Taille --------

    const tailleOctets = Number(taille);

    if (!Number.isSafeInteger(tailleOctets) || tailleOctets <= 0) {
      return erreur(res, 400, 'Taille de fichier invalide.');
    }

    if (tailleOctets > TAILLE_MAX) {
      return erreur(res, 400, `Le fichier dépasse la taille maximale autorisée (${TAILLE_MAX_MO} Mo).`);
    }

    // -------- Limite d'uploads simultanés --------

    const actifs = await Televersement.countDocuments({
      adminId: req.adminId,
      statut: { $in: ['en_cours', 'finalisation'] }
    });

    if (actifs >= UPLOADS_ACTIFS_MAX) {
      return erreur(res, 429, 'Trop de téléversements en cours. Terminez ou annulez les précédents.');
    }

    // -------- Création du multipart sur R2 --------

    const taillePartie = calculerTaillePartie(tailleOctets);
    const nombreParties = Math.ceil(tailleOctets / taillePartie);

    // Nom unique : aucune collision possible, aucun nom fourni par l'utilisateur
    const key = `${PREFIXE}/${format.nature}s/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const multipart = await r2.send(new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: format.contentType,
      // Nom de fichier unique et jamais réécrit : cache long possible
      CacheControl: 'public, max-age=31536000, immutable'
    }));

    let session;

    try {
      session = await Televersement.create({
        adminId: req.adminId,
        uploadId: multipart.UploadId,
        key,
        nomOriginal: nom,
        extension,
        nature: format.nature,
        typeMime: format.contentType,
        taille: tailleOctets,
        taillePartie,
        nombreParties
      });
    } catch (errDb) {
      // Pas d'upload orphelin sur R2 si MongoDB échoue
      await r2.send(new AbortMultipartUploadCommand({
        Bucket: R2_BUCKET, Key: key, UploadId: multipart.UploadId
      })).catch(() => {});
      throw errDb;
    }

    console.log(`📤 Multipart initié : ${key} (${nombreParties} parties)`);

    return res.status(201).json({
      success: true,
      ...resumeSession(session)
    });

  } catch (error) {
    console.error('❌ ERREUR INITIATE MULTIPART :', error);
    return erreur(res, 500, "Impossible d'initialiser le téléversement.", { error: error.message });
  }
};


// =====================================================
// SIGNER UNE OU PLUSIEURS PARTIES
// POST /api/uploads/multipart/presign-part
// body : { televersementId, numeroPartie } ou { televersementId, numerosParties: [] }
// =====================================================

const signerPartie = async (req, res) => {

  try {

    const session = await chargerSession(req, res);
    if (!session) return;

    if (session.statut !== 'en_cours') {
      return erreur(res, 409, "Ce téléversement n'accepte plus de nouvelles parties.");
    }

    const { numeroPartie, numerosParties } = req.body;

    const numeros = Array.isArray(numerosParties) ? numerosParties : [numeroPartie];

    if (!numeros.length || numeros.length > PARTIES_PAR_APPEL_MAX) {
      return erreur(res, 400, `Entre 1 et ${PARTIES_PAR_APPEL_MAX} parties par demande.`);
    }

    const valides = numeros.every(n =>
      Number.isInteger(n) && n >= 1 && n <= session.nombreParties
    );

    if (!valides) {
      return erreur(res, 400, 'Numéro de partie invalide.');
    }

    // L'URL n'autorise qu'un PUT de cette partie précise, de cet upload précis
    const urls = await Promise.all(
      [...new Set(numeros)].map(async (n) => ({
        numeroPartie: n,
        url: await getSignedUrl(
          r2,
          new UploadPartCommand({
            Bucket: R2_BUCKET,
            Key: session.key,
            UploadId: session.uploadId,
            PartNumber: n
          }),
          { expiresIn: EXPIRATION_URL_SECONDES }
        )
      }))
    );

    return res.status(200).json({
      success: true,
      expireDans: EXPIRATION_URL_SECONDES,
      urls
    });

  } catch (error) {
    console.error('❌ ERREUR PRESIGN PART :', error);
    return erreur(res, 500, "Impossible de signer la partie.", { error: error.message });
  }
};


// =====================================================
// PARTIES DÉJÀ REÇUES (reprise d'un upload interrompu)
// POST /api/uploads/multipart/parts
// body : { televersementId }
// =====================================================

const partiesRecues = async (req, res) => {

  try {

    const session = await chargerSession(req, res);
    if (!session) return;

    if (session.statut !== 'en_cours') {
      return res.status(200).json({
        success: true,
        ...resumeSession(session),
        parties: []
      });
    }

    let parties;

    try {
      parties = await listerParties(session);
    } catch (err) {
      if (estUploadIntrouvable(err)) {
        session.statut = 'annule';
        session.erreur = 'Upload expiré ou supprimé sur R2.';
        await session.save();
        return erreur(res, 410, 'Ce téléversement a expiré. Recommencez.');
      }
      throw err;
    }

    // On ne renvoie que les parties complètes (taille attendue)
    const completes = parties.filter(p =>
      p.numeroPartie <= session.nombreParties &&
      p.taille === tailleAttendue(session, p.numeroPartie)
    );

    return res.status(200).json({
      success: true,
      ...resumeSession(session),
      parties: completes
    });

  } catch (error) {
    console.error('❌ ERREUR LIST PARTS :', error);
    return erreur(res, 500, 'Impossible de récupérer la progression.', { error: error.message });
  }
};


// =====================================================
// FINALISER
// POST /api/uploads/multipart/complete
// body : { televersementId, parties: [{ numeroPartie, etag }] }
// =====================================================

const finaliser = async (req, res) => {

  try {

    const { televersementId, parties } = req.body || {};

    if (!televersementId || !mongoose.Types.ObjectId.isValid(televersementId)) {
      return erreur(res, 400, 'Identifiant de téléversement invalide.');
    }

    // Déjà finalisé (ex. réponse perdue côté navigateur) : réponse idempotente
    const existante = await Televersement.findOne({ _id: televersementId, adminId: req.adminId });

    if (!existante) {
      return erreur(res, 404, 'Téléversement introuvable.');
    }

    if (existante.statut === 'termine' || existante.statut === 'utilise') {
      return res.status(200).json({ success: true, ...resumeSession(existante) });
    }

    if (!Array.isArray(parties) || !parties.length) {
      return erreur(res, 400, 'La liste des parties est obligatoire.');
    }

    // Verrou : une seule finalisation à la fois
    const session = await Televersement.findOneAndUpdate(
      { _id: televersementId, adminId: req.adminId, statut: 'en_cours' },
      { $set: { statut: 'finalisation' } },
      { new: true }
    );

    if (!session) {
      return erreur(res, 409, 'Ce téléversement est déjà en cours de finalisation ou a été annulé.');
    }

    const remettreEnCours = async (message) => {
      session.statut = 'en_cours';
      session.erreur = message;
      await session.save();
    };

    // -------- Parties réellement reçues par R2 --------

    let recues;

    try {
      recues = await listerParties(session);
    } catch (err) {
      if (estUploadIntrouvable(err)) {
        // Peut-être déjà finalisé lors d'une tentative précédente
        return verifierObjetEtTerminer(session, res);
      }
      await remettreEnCours(err.message);
      throw err;
    }

    const parNumero = new Map(recues.map(p => [p.numeroPartie, p]));
    const clientParNumero = new Map(
      parties
        .filter(p => p && Number.isInteger(p.numeroPartie))
        .map(p => [p.numeroPartie, normaliserEtag(p.etag)])
    );

    const manquantes = [];
    const invalides = [];

    for (let n = 1; n <= session.nombreParties; n++) {
      const recue = parNumero.get(n);

      if (!recue || recue.taille !== tailleAttendue(session, n)) {
        manquantes.push(n);
        continue;
      }

      // ETag fourni par le navigateur = ETag enregistré par R2
      if (clientParNumero.get(n) !== normaliserEtag(recue.etag)) {
        invalides.push(n);
      }
    }

    if (manquantes.length || invalides.length) {
      await remettreEnCours('Parties manquantes ou invalides.');
      return erreur(res, 422, 'Certaines parties sont manquantes ou invalides. Elles doivent être renvoyées.', {
        partiesManquantes: manquantes,
        partiesInvalides: invalides
      });
    }

    // -------- Finalisation R2 --------

    try {
      await r2.send(new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET,
        Key: session.key,
        UploadId: session.uploadId,
        MultipartUpload: {
          Parts: Array.from({ length: session.nombreParties }, (_, i) => ({
            PartNumber: i + 1,
            ETag: parNumero.get(i + 1).etag
          }))
        }
      }));
    } catch (err) {
      if (!estUploadIntrouvable(err)) {
        await remettreEnCours(err.message);
        throw err;
      }
    }

    return verifierObjetEtTerminer(session, res);

  } catch (error) {
    console.error('❌ ERREUR COMPLETE MULTIPART :', error);
    return erreur(res, 500, 'Impossible de finaliser le téléversement.', { error: error.message });
  }
};

// Ne jamais se fier à l'URL : on vérifie que l'objet existe avec la bonne taille
const verifierObjetEtTerminer = async (session, res) => {

  let objet;

  try {
    objet = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: session.key }));
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
      session.statut = 'echec';
      session.erreur = 'Fichier introuvable sur R2 après finalisation.';
      await session.save();
      return erreur(res, 422, 'Le fichier est introuvable sur R2. Recommencez le téléversement.');
    }

    // Erreur passagère : la finalisation pourra être relancée sans risque
    session.statut = 'en_cours';
    session.erreur = err.message;
    await session.save();
    return erreur(res, 503, 'Vérification du fichier impossible pour le moment. Réessayez.');
  }

  if (Number(objet.ContentLength) !== session.taille) {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: session.key })).catch(() => {});
    session.statut = 'echec';
    session.erreur = `Taille incorrecte (${objet.ContentLength} au lieu de ${session.taille}).`;
    await session.save();
    return erreur(res, 422, 'Le fichier reçu est incomplet. Recommencez le téléversement.');
  }

  session.statut = 'termine';
  session.url = urlPublique(session.key);
  session.erreur = null;
  session.termineLe = new Date();
  await session.save();

  console.log(`✅ Multipart finalisé : ${session.key}`);

  return res.status(200).json({
    success: true,
    message: 'Fichier enregistré sur R2.',
    ...resumeSession(session)
  });
};


// =====================================================
// ANNULER
// POST /api/uploads/multipart/abort
// body : { televersementId }
// =====================================================

const annuler = async (req, res) => {

  try {

    const session = await chargerSession(req, res);
    if (!session) return;

    if (session.statut === 'utilise') {
      return erreur(res, 409, 'Ce fichier est déjà utilisé par une publication.');
    }

    if (session.statut === 'annule') {
      return res.status(200).json({ success: true, message: 'Téléversement déjà annulé.' });
    }

    if (session.statut === 'termine' || session.statut === 'echec') {
      // Fichier finalisé mais jamais publié : on le supprime
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: session.key })).catch(() => {});
    }

    if (session.statut === 'en_cours' || session.statut === 'finalisation' || session.statut === 'echec') {
      try {
        await r2.send(new AbortMultipartUploadCommand({
          Bucket: R2_BUCKET,
          Key: session.key,
          UploadId: session.uploadId
        }));
      } catch (err) {
        if (!estUploadIntrouvable(err)) throw err;
      }
    }

    session.statut = 'annule';
    session.url = null;
    await session.save();

    console.log(`🛑 Téléversement annulé : ${session.key}`);

    return res.status(200).json({ success: true, message: 'Téléversement annulé.' });

  } catch (error) {
    console.error('❌ ERREUR ABORT MULTIPART :', error);
    return erreur(res, 500, "Impossible d'annuler le téléversement.", { error: error.message });
  }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getConfiguration,
  initier,
  signerPartie,
  partiesRecues,
  finaliser,
  annuler,
  PREFIXE
};
