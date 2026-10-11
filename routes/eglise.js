const express = require('express');

const router = express.Router();

const { auth } = require('../middlewares/auth');

const {
  getEglise,
  enregistrerEglise
} = require('../controllers/eglise');


// ADRESSE DE L'ÉGLISE (APPLICATION MOBILE + ADMIN)
router.get('/', getEglise);

// AJOUTER / MODIFIER L'ADRESSE (ADMIN)
router.put('/', auth, enregistrerEglise);


module.exports = router;
