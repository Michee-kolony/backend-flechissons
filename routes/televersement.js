const express = require('express');

const router = express.Router();

const { auth } = require('../middlewares/auth');

const {
  getConfiguration,
  initier,
  signerPartie,
  partiesRecues,
  finaliser,
  annuler
} = require('../controllers/televersement');


// Toutes les routes exigent un administrateur connecté
router.use(auth);

// FORMATS ET TAILLE MAXIMALE
router.get('/config', getConfiguration);

// CRÉER LE MULTIPART UPLOAD SUR R2
router.post('/initiate', initier);

// URL PRÉSIGNÉE(S) POUR UNE OU PLUSIEURS PARTIES
router.post('/presign-part', signerPartie);

// PARTIES DÉJÀ REÇUES (REPRISE)
router.post('/parts', partiesRecues);

// FINALISER (VÉRIFICATION DES ETAGS ET DE LA TAILLE)
router.post('/complete', finaliser);

// ANNULER
router.post('/abort', annuler);


module.exports = router;
