const express = require('express');

const router = express.Router();

const { auth } = require('../middlewares/auth');

const {
  getLives,
  getAllLivesAdmin,
  getLiveById,
  createLive,
  updateLive,
  supprimerLive
} = require('../controllers/live');


// LIVES ACTIFS (APPLICATION MOBILE)
router.get('/', getLives);

// TOUS LES LIVES, MÊME MASQUÉS (ADMIN)
router.get('/admin', auth, getAllLivesAdmin);

// UN LIVE
router.get('/:id', getLiveById);

// AJOUTER UN LIVE
router.post('/', auth, createLive);

// MODIFIER UN LIVE
router.put('/:id', auth, updateLive);

// SUPPRIMER UN LIVE
router.delete('/:id', auth, supprimerLive);


module.exports = router;
