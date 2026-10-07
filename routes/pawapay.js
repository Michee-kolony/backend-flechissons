const express = require('express');

const router = express.Router();

const {
    creerDepot,
    webhook,
    statutDepot
} = require('../controllers/pawapay');


// ======================================================
// LANCER UN PAIEMENT (APPLICATION)
// ======================================================

router.post(
    '/depot',
    creerDepot
);


// ======================================================
// SUIVRE UN PAIEMENT (APPLICATION)
// ======================================================

router.get(
    '/depot/:depositId',
    statutDepot
);


// ======================================================
// CALLBACK PAWAPAY
// URL configurée dans le tableau de bord PawaPay :
// https://flechissons.com/api/pawapay/webhook
// ======================================================

router.post(
    '/webhook',
    webhook
);


module.exports = router;
