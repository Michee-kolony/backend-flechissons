const multer = require('multer');
const multerS3 = require('multer-s3');

const r2 = require('../config/r2');

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
      file.originalname.split('.').pop();

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

    if (file.mimetype.startsWith('image/')) {
      return cb(null, true);
    }

    return cb(
      new Error('La couverture doit être une image.')
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