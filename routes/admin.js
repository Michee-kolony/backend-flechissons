const express = require('express');
const { register, login, getalladmin } = require('../controllers/admin');
const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/', getalladmin);

module.exports = router;