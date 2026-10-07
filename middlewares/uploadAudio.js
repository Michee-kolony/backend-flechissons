const multer = require('multer');
const multerS3 = require('multer-s3');

const r2 = require('../config/r2');


// =====================================================
// FORMATS AUTORISÉS (PHOTO DE COUVERTURE)
// Tous les formats image courants sauf GIF (animé)
// et SVG (peut contenir du code)
// =====================================================

const MIME_IMAGE_AUTORISES = [
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/x-png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'image/bmp',
  'image/x-ms-bmp',
  'image/tiff',
  'image/jxl'
];

const EXTENSIONS_IMAGE_AUTORISEES = [
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'png',
  'webp',
  'avif',
  'heic',
  'heif',
  'bmp',
  'tif',
  'tiff',
  'jxl'
];

const getExtension = (nomFichier) =>
  nomFichier.split('.').pop().toLowerCase();

const storage = multerS3({
  s3: r2,

  bucket: 'flechissons',

  contentType: multerS3.AUTO_CONTENT_TYPE,

  key: (req, file, cb) => {

    let folder;

    if (file.fieldname === 'photoCouverture') {
      folder = 'audios/covers';
    }

    else if (file.fieldname === 'fichierAudio') {
      folder = 'audios/files';
    }

    else {
      return cb(
        new Error('Champ de fichier invalide.')
      );
    }

    const extension =
      getExtension(file.originalname);

    const fileName =
      `${Date.now()}-${Math.round(Math.random() * 1E9)}.${extension}`;

    cb(
      null,
      `${folder}/${fileName}`
    );
  }
});


// =====================================================
// FILTRE
// =====================================================

const fileFilter = (req, file, cb) => {

  if (file.fieldname === 'photoCouverture') {

    const extension = getExtension(file.originalname);

    // Certains navigateurs envoient les AVIF / HEIC sans type MIME
    // précis : on accepte alors en se basant sur l'extension
    const mimeGenerique =
      !file.mimetype ||
      file.mimetype === 'application/octet-stream';

    const accepte =
      MIME_IMAGE_AUTORISES.includes(file.mimetype) ||
      (mimeGenerique && EXTENSIONS_IMAGE_AUTORISEES.includes(extension));

    if (accepte) {
      return cb(null, true);
    }

    return cb(
      new Error('Format de couverture non autorisé. Utilisez JPG, PNG, WEBP, AVIF, HEIC, BMP, TIFF ou JXL (GIF et SVG refusés).')
    );
  }

  if (file.fieldname === 'fichierAudio') {

    if (file.mimetype.startsWith('audio/')) {
      return cb(null, true);
    }

    return cb(
      new Error('Le fichier doit être un audio.')
    );
  }

  cb(
    new Error('Fichier non autorisé.')
  );
};


// =====================================================
// MULTER
// =====================================================

const uploadAudio = multer({
  storage,

  fileFilter,

  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

module.exports = uploadAudio;