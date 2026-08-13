const { firebaseAuth } = require('../config/firebase');


// ======================================================
// MIDDLEWARE FIREBASE AUTH
// ======================================================

const firebaseAuthMiddleware = async (req, res, next) => {

  try {

    // ==================================================
    // 1. RÉCUPÉRER AUTHORIZATION
    // ==================================================

    const authHeader = req.headers.authorization;

    if (!authHeader) {

      return res.status(401).json({
        success: false,
        message: 'Token Firebase manquant'
      });

    }


    // ==================================================
    // 2. VÉRIFIER FORMAT
    // ==================================================

    if (!authHeader.startsWith('Bearer ')) {

      return res.status(401).json({
        success: false,
        message: 'Format du token invalide'
      });

    }


    // ==================================================
    // 3. EXTRAIRE TOKEN
    // ==================================================

    const token = authHeader.substring(7).trim();

    if (!token) {

      return res.status(401).json({
        success: false,
        message: 'Token Firebase vide'
      });

    }


    // ==================================================
    // 4. VÉRIFIER TOKEN FIREBASE
    // ==================================================

    const decodedToken =
      await firebaseAuth.verifyIdToken(token);


    // ==================================================
    // 5. STOCKER UTILISATEUR FIREBASE
    // ==================================================

    req.firebaseUser = decodedToken;


    console.log(
      '🔥 Firebase authentifié :',
      decodedToken.uid
    );


    // ==================================================
    // 6. CONTINUER
    // ==================================================

    next();


  } catch (error) {

    console.error(
      '❌ Erreur Firebase Auth :',
      error.message
    );


    return res.status(401).json({
      success: false,
      message: 'Token Firebase invalide ou expiré'
    });

  }

};


module.exports = firebaseAuthMiddleware;