const express = require('express');

const router = express.Router();

const { abonner, lister } = require('../controllers/notification');


// ======================================================
// LISTE (CONNECTÉ OU NON)
// ======================================================

router.get(
    '/',
    lister
);


// ======================================================
// ABONNEMENT D'UN APPAREIL (CONNECTÉ OU NON)
// ======================================================

router.post(
    '/abonnement',
    abonner
);


module.exports = router;
