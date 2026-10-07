const express = require('express');

const router = express.Router();

const multer = require('multer');

const uploadAudio = require('../middlewares/uploadAudio');

const {
  createAudio,
  getAudio,
  getAudioById,
  supprimerAudio
} = require('../controllers/audio');


// GET TOUS LES AUDIOS
router.get( '/', getAudio);

// GET UN AUDIO
router.get('/:id', getAudioById);

// UPLOAD : renvoie un message clair si un fichier est refusé
const uploadFichiersAudio = (req, res, next) => {

  uploadAudio.fields([
    {
      name: 'photoCouverture',
      maxCount: 1
    },
    {
      name: 'fichierAudio',
      maxCount: 1
    }
  ])(req, res, (err) => {

    if (!err) {
      return next();
    }

    console.error('❌ ERREUR UPLOAD AUDIO :', err.message);

    if (err instanceof multer.MulterError) {

      const messages = {
        LIMIT_FILE_SIZE: 'Le fichier dépasse la taille maximale de 100 Mo.',
        LIMIT_FILE_COUNT: 'Un seul fichier par champ est autorisé.',
        LIMIT_UNEXPECTED_FILE: 'Champ de fichier invalide.'
      };

      return res.status(400).json({
        success: false,
        code: err.code,
        message: messages[err.code] || "Erreur lors de l'upload du fichier."
      });

    }

    return res.status(400).json({
      success: false,
      message: err.message
    });

  });

};

// PUBLIER UN AUDIO
router.post('/', uploadFichiersAudio, createAudio);


// SUPPRIMER UN AUDIO
router.delete(
  '/:id',
  supprimerAudio
);


module.exports = router;