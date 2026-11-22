const crypto = require('crypto');
const multer = require('multer');
const multerS3 = require('multer-s3');

const r2 = require('../config/r2');


// =====================================================
// PHOTO D'UN MESSAGE (messagerie)
// Envoyée sur R2 sous messagerie/… ; effacée avec la conversation
// lors de la purge mensuelle (services/purgeMessagerie.js).
// Pas de GIF ni de SVG (le SVG peut contenir du code).
// =====================================================

const PREFIXE = 'messagerie/';
const TAILLE_MAX_MO = 10;

const MIME_AUTORISES = [
  'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png',
  'image/webp', 'image/avif', 'image/heic', 'image/heif'
];

const EXTENSIONS_AUTORISEES = ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'avif', 'heic', 'heif'];

const extension = (nom) => String(nom || '').split('.').pop().toLowerCase();

const upload = multer({

  storage: multerS3({
    s3: r2,
    bucket: r2.parametres.bucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ext = EXTENSIONS_AUTORISEES.includes(extension(file.originalname)) ? extension(file.originalname) : 'jpg';
      cb(null, `${PREFIXE}${Date.now()}-${crypto.randomUUID()}.${ext}`);
    }
  }),

  limits: { fileSize: TAILLE_MAX_MO * 1024 * 1024, files: 1 },

  fileFilter: (req, file, cb) => {
    // Certains téléphones envoient les HEIC sans type MIME précis
    const generique = !file.mimetype || file.mimetype === 'application/octet-stream';
    const accepte = MIME_AUTORISES.includes(file.mimetype)
      || (generique && EXTENSIONS_AUTORISEES.includes(extension(file.originalname)));
    cb(accepte ? null : new Error('FORMAT_IMAGE_INVALIDE'), accepte);
  }

});


// Champ « photo » facultatif. Une requête JSON (sans photo) passe telle quelle.
const photoMessage = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `La photo ne doit pas dépasser ${TAILLE_MAX_MO} Mo.`
      : err.message === 'FORMAT_IMAGE_INVALIDE'
        ? 'Format de photo non accepté (JPG, PNG, WEBP, HEIC).'
        : "Erreur lors de l'envoi de la photo.";
    return res.status(400).json({ success: false, message });
  });
};

photoMessage.PREFIXE = PREFIXE;

module.exports = photoMessage;
