const express = require('express');
const { register, login, getalladmin, deleteAdmin } = require('../controllers/admin');
const { auth, superAdmin } = require('../middlewares/auth');
const router = express.Router();

router.post('/register', auth, superAdmin, register);
router.post('/login', login);
router.get('/', auth, superAdmin, getalladmin);
router.delete('/:id', auth, superAdmin, deleteAdmin);

module.exports = router;