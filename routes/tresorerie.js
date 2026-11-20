const express = require('express');

const router = express.Router();

const { auth, tresorier, lectureTresorerie } = require('../middlewares/auth');

const {
  getReferences,
  getOperations,
  getOperationById,
  createOperation,
  updateOperation,
  supprimerOperation,
  getResume,
  exporterCsv
} = require('../controllers/tresorerie');


// ======================================================
// TRÉSORERIE DE L'ÉGLISE
// Consultation : trésorier + superadmin (lecture seule)
// Modification : trésorier uniquement
// ======================================================

router.use(auth);

// CATÉGORIES, MODES DE PAIEMENT, DEVISES
router.get('/references', lectureTresorerie, getReferences);

// SOLDES ET TOTAUX
router.get('/resume', lectureTresorerie, getResume);

// EXPORT CSV
router.get('/export', lectureTresorerie, exporterCsv);

// OPÉRATIONS — CONSULTATION
router.get('/operations', lectureTresorerie, getOperations);
router.get('/operations/:id', lectureTresorerie, getOperationById);

// OPÉRATIONS — MODIFICATION (TRÉSORIER UNIQUEMENT)
router.post('/operations', tresorier, createOperation);
router.put('/operations/:id', tresorier, updateOperation);
router.delete('/operations/:id', tresorier, supprimerOperation);


module.exports = router;
