const express = require('express');
const { sendDonation, getDonations, getoneDonation, deleteDonation } = require('../controllers/donation');
const { auth } = require('../middlewares/auth');
const router = express.Router();


router.post('/', sendDonation);
router.get('/', auth, getDonations);
router.get('/:id', auth, getoneDonation);
router.delete('/:id', auth, deleteDonation);


module.exports = router;
