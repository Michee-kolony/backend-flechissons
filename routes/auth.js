const express = require('express');

const router = express.Router();


// ======================================================
// MIDDLEWARE FIREBASE
// ======================================================

const firebaseAuthMiddleware =
  require('../middlewares/firebaseAuth');


// ======================================================
// CONTROLLER
// ======================================================

const {
  loginWithFirebase
} = require('../controllers/userController');


// ======================================================
// AUTHENTIFICATION FIREBASE
// ======================================================

router.post(
  '/firebase',
  firebaseAuthMiddleware,
  loginWithFirebase
);


module.exports = router;