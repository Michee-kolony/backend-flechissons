const express = require('express');

const router = express.Router();

const { auth } = require('../middlewares/auth');

const {
  getEvenements,
  getEvenementById,
  createEvenement,
  updateEvenement,
  supprimerEvenement
} = require('../controllers/evenement');


// TOUS LES ÉVÈNEMENTS (APPLICATION MOBILE + ADMIN)
router.get('/', getEvenements);

// UN ÉVÈNEMENT
router.get('/:id', getEvenementById);

// AJOUTER UN ÉVÈNEMENT
router.post('/', auth, createEvenement);

// MODIFIER UN ÉVÈNEMENT
router.put('/:id', auth, updateEvenement);

// SUPPRIMER UN ÉVÈNEMENT
router.delete('/:id', auth, supprimerEvenement);


module.exports = router;
