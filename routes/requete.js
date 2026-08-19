const express = require('express');
const { sendRequete, getRequete, getoneRequete, deleteRequete } = require('../controllers/requete');
const router = express.Router();


router.post('/', sendRequete);
router.get('/', getRequete);
router.get('/:id', getoneRequete);
router.delete('/:id', deleteRequete);


module.exports = router;