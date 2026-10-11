const Eglise = require('../models/eglise');


// =====================================================
// UTILITAIRES
// =====================================================

// Accepte "4,3217" comme "4.3217"
const versNombre = (valeur) => {

  if (valeur === undefined || valeur === null || valeur === '') {
    return NaN;
  }

  return Number(String(valeur).replace(',', '.'));
};


const validerDonnees = (body) => {

  const adresse = String(body.adresse || '').trim();

  if (!adresse) {
    return { erreur: "L'adresse de l'église est obligatoire." };
  }

  const latitude = versNombre(body.latitude);
  const longitude = versNombre(body.longitude);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { erreur: 'Latitude invalide (entre -90 et 90).' };
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { erreur: 'Longitude invalide (entre -180 et 180).' };
  }

  const donnees = { adresse, latitude, longitude };

  if (body.nom !== undefined && String(body.nom).trim()) {
    donnees.nom = String(body.nom).trim();
  }

  if (body.description !== undefined) {
    donnees.description = String(body.description || '').trim();
  }

  return { donnees };
};


// =====================================================
// GET ÉGLISE (PUBLIC : APPLICATION MOBILE ET ADMIN)
// =====================================================

const getEglise = async (req, res) => {

  try {

    const eglise = await Eglise.findOne().sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      eglise
    });

  } catch (error) {

    console.error('❌ ERREUR GET ÉGLISE :', error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de l'adresse de l'église.",
      error: error.message
    });
  }
};


// =====================================================
// ENREGISTRER ÉGLISE (ADMIN : création ou mise à jour)
// =====================================================

const enregistrerEglise = async (req, res) => {

  try {

    const { donnees, erreur } = validerDonnees(req.body);

    if (erreur) {
      return res.status(400).json({
        success: false,
        message: erreur
      });
    }

    let eglise = await Eglise.findOne().sort({ updatedAt: -1 });

    if (eglise) {
      Object.assign(eglise, donnees);
      await eglise.save();
    } else {
      eglise = await Eglise.create(donnees);
    }

    return res.status(200).json({
      success: true,
      message: "Adresse de l'église enregistrée avec succès.",
      eglise
    });

  } catch (error) {

    console.error('❌ ERREUR ENREGISTREMENT ÉGLISE :', error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement de l'adresse de l'église.",
      error: error.message
    });
  }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getEglise,
  enregistrerEglise
};
