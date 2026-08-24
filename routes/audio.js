const express = require('express');

const router = express.Router();

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

// PUBLIER UN AUDIO
router.post('/', uploadAudio.fields([
    {
      name: 'photoCouverture',
      maxCount: 1
    },
    {
      name: 'fichierAudio',
      maxCount: 1
    }
  ]),
  createAudio
);


// SUPPRIMER UN AUDIO
router.delete(
  '/:id',
  supprimerAudio
);


module.exports = router;