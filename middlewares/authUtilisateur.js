const jwt = require('jsonwebtoken');
const User = require('../models/user');

// Même secret que controllers/user.js (jetons de l'application mobile)
const JWT_SECRET = process.env.JWT_SECRET || 'RANDOM_TOKEN_FLECHISSONS';


// =====================================================
// UTILISATEUR DE L'APPLICATION MOBILE CONNECTÉ
// Ajoute req.utilisateur (nom, prénom, photo) à la requête.
// =====================================================

module.exports = async (req, res, next) => {

  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentification requise' });
  }

  try {

    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);

    const utilisateur = await User.findById(decoded.id).select('nom prenom photo');

    if (!utilisateur) {
      return res.status(401).json({ success: false, message: 'Compte introuvable' });
    }

    req.utilisateur = utilisateur;
    next();

  } catch (error) {

    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Session expirée, reconnectez-vous.' });
    }

    console.error('❌ AUTH UTILISATEUR :', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }

};
