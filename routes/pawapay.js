const express = require('express');

const router = express.Router();

const { auth } = require('../middlewares/auth');

const {
    creerDepot,
    webhook,
    statutDepot,
    listerPaiements
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
// LISTE DES PAIEMENTS (ADMIN)
// ======================================================

router.get(
    '/admin/paiements',
    auth,
    listerPaiements
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
