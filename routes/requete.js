const express = require('express');
const { sendRequete, getRequete, getoneRequete, deleteRequete } = require('../controllers/requete');
const { auth, superAdmin } = require('../middlewares/auth');
const router = express.Router();


router.post('/', sendRequete);
router.get('/', auth, superAdmin, getRequete);
router.get('/:id', auth, superAdmin, getoneRequete);
router.delete('/:id', auth, superAdmin, deleteRequete);


module.exports = router;