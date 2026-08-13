const User = require('../models/user');


// ======================================================
// AUTHENTIFICATION FIREBASE
// ======================================================

const loginWithFirebase = async (req, res) => {

  try {

    // ==================================================
    // 1. UTILISATEUR FIREBASE
    // ==================================================

    const firebaseUser = req.firebaseUser;


    if (!firebaseUser || !firebaseUser.uid) {

      return res.status(401).json({
        success: false,
        message: 'Utilisateur Firebase invalide'
      });

    }


    // ==================================================
    // 2. INFORMATIONS FIREBASE
    // ==================================================

    const firebaseUid = firebaseUser.uid;

    const email = firebaseUser.email || '';

    const nomComplet =
      firebaseUser.name ||
      '';

    const photo =
      firebaseUser.picture ||
      '';


    // ==================================================
    // 3. SÉPARER NOM / PRÉNOM
    // ==================================================

    let prenom = '';
    let nom = '';

    if (nomComplet) {

      const parties =
        nomComplet.trim().split(/\s+/);

      if (parties.length === 1) {

        prenom = parties[0];

      } else {

        prenom =
          parties.slice(0, -1).join(' ');

        nom =
          parties[parties.length - 1];

      }

    }


    // ==================================================
    // 4. CHERCHER PAR FIREBASE UID
    // ==================================================

    let user =
      await User.findOne({
        firebaseUid: firebaseUid
      });


    // ==================================================
    // 5. SI PAS TROUVÉ → CHERCHER PAR EMAIL
    // ==================================================

    if (!user && email) {

      user =
        await User.findOne({
          email: email.toLowerCase()
        });

    }


    // ==================================================
    // 6. CRÉER OU METTRE À JOUR
    // ==================================================

    if (!user) {

      // ================================================
      // NOUVEL UTILISATEUR
      // ================================================

      user = await User.create({

        firebaseUid: firebaseUid,

        email: email.toLowerCase(),

        nom: nom,

        prenom: prenom,

        photo: photo,

        profilComplete: false,

        derniereConnexion: new Date()

      });


      console.log(
        '👤 Nouvel utilisateur MongoDB :',
        email
      );

    } else {

      // ================================================
      // UTILISATEUR EXISTANT
      // ================================================

      user.firebaseUid =
        firebaseUid;

      if (email) {

        user.email =
          email.toLowerCase();

      }

      if (photo) {

        user.photo =
          photo;

      }

      if (!user.nom && nom) {

        user.nom = nom;

      }

      if (!user.prenom && prenom) {

        user.prenom = prenom;

      }

      user.derniereConnexion =
        new Date();


      await user.save();


      console.log(
        '🔄 Utilisateur existant :',
        email
      );

    }


    // ==================================================
    // 7. RÉPONSE FRONTEND
    // ==================================================

    return res.status(200).json({

      success: true,

      message:
        'Authentification réussie',

      user: {

        id: user._id,

        firebaseUid:
          user.firebaseUid,

        email:
          user.email,

        nom:
          user.nom,

        prenom:
          user.prenom,

        photo:
          user.photo,

        profilComplete:
          user.profilComplete,

        derniereConnexion:
          user.derniereConnexion

      }

    });


  } catch (error) {

    console.error(
      '❌ Erreur loginWithFirebase :',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        'Erreur serveur lors de l’authentification'

    });

  }

};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  loginWithFirebase
};