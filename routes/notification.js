const express = require('express');

const router = express.Router();

const { abonner } = require('../controllers/notification');


// ======================================================
// ABONNEMENT D'UN APPAREIL (CONNECTÉ OU NON)
// ======================================================

router.post(
    '/abonnement',
    abonner
);


module.exports = router;
