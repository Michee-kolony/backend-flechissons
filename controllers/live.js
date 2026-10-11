const Live = require('../models/live');

const {
  envoyerATous,
  routes
} = require('../services/notification');


const NOMS_PLATEFORMES = {
  youtube: 'YouTube',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  autre: 'nos réseaux'
};


// =====================================================
// UTILITAIRES
// =====================================================

// Accepte "youtube.com/..." en ajoutant https:// ; refuse tout ce qui n'est pas http(s)
const normaliserLien = (lien) => {

  if (typeof lien !== 'string' || !lien.trim()) {
    return null;
  }

  let valeur = lien.trim();

  if (!/^[a-z][a-z0-9+.-]*:/i.test(valeur)) {
    valeur = `https://${valeur}`;
  }

  try {
    const url = new URL(valeur);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const versBooleen = (valeur) =>
  valeur === true || valeur === 'true' || valeur === 1 || valeur === '1';


// Valide les champs reçus. `partiel` = true pour une modification
// (seuls les champs envoyés sont vérifiés).
const validerDonnees = (body, partiel = false) => {

  const donnees = {};

  if (!partiel || body.titre !== undefined) {
    if (!body.titre || !String(body.titre).trim()) {
      return { erreur: 'Le titre du live est obligatoire.' };
    }
    donnees.titre = String(body.titre).trim();
  }

  if (!partiel || body.plateforme !== undefined) {
    if (!Live.PLATEFORMES.includes(body.plateforme)) {
      return {
        erreur: `Plateforme invalide. Utilisez : ${Live.PLATEFORMES.join(', ')}.`
      };
    }
    donnees.plateforme = body.plateforme;
  }

  if (!partiel || body.lien !== undefined) {
    const lien = normaliserLien(body.lien);
    if (!lien) {
      return { erreur: 'Le lien du live est invalide (http ou https uniquement).' };
    }
    donnees.lien = lien;
  }

  if (body.description !== undefined) {
    donnees.description = String(body.description || '').trim();
  }

  if (body.enDirect !== undefined) {
    donnees.enDirect = versBooleen(body.enDirect);
  }

  if (body.actif !== undefined) {
    donnees.actif = versBooleen(body.actif);
  }

  if (body.ordre !== undefined) {
    const ordre = Number(body.ordre);
    donnees.ordre = Number.isFinite(ordre) ? ordre : 0;
  }

  return { donnees };
};


// Prévient tous les utilisateurs qu'un live vient de commencer
const notifierDebutLive = (live) => {

  if (!live.actif || !live.enDirect) {
    return;
  }

  envoyerATous({
    titre: '🔴 En direct maintenant',
    message: `${live.titre} — sur ${NOMS_PLATEFORMES[live.plateforme]}`,
    route: routes.live(),
    data: { type: 'live', liveId: live._id }
  });
};


const ordreTri = { enDirect: -1, ordre: 1, createdAt: -1 };


// =====================================================
// GET LIVES (APPLICATION MOBILE : uniquement les actifs)
// =====================================================

const getLives = async (req, res) => {

  try {

    const lives = await Live
      .find({ actif: true })
      .sort(ordreTri);

    return res.status(200).json({
      success: true,
      count: lives.length,
      lives
    });

  } catch (error) {

    console.error('❌ ERREUR GET LIVES :', error);

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des lives.',
      error: error.message
    });
  }
};


// =====================================================
// GET TOUS LES LIVES (ADMIN : actifs et masqués)
// =====================================================

const getAllLivesAdmin = async (req, res) => {

  try {

    const lives = await Live
      .find()
      .sort(ordreTri);

    return res.status(200).json({
      success: true,
      count: lives.length,
      lives
    });

  } catch (error) {

    console.error('❌ ERREUR GET LIVES ADMIN :', error);

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des lives.',
      error: error.message
    });
  }
};


// =====================================================
// GET LIVE PAR ID
// =====================================================

const getLiveById = async (req, res) => {

  try {

    const live = await Live.findById(req.params.id);

    if (!live) {
      return res.status(404).json({
        success: false,
        message: 'Live introuvable.'
      });
    }

    return res.status(200).json({
      success: true,
      live
    });

  } catch (error) {

    console.error('❌ ERREUR GET LIVE BY ID :', error);

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du live.',
      error: error.message
    });
  }
};


// =====================================================
// CREATE LIVE
// =====================================================

const createLive = async (req, res) => {

  try {

    const { donnees, erreur } = validerDonnees(req.body);

    if (erreur) {
      return res.status(400).json({
        success: false,
        message: erreur
      });
    }

    const live = await Live.create(donnees);

    notifierDebutLive(live);

    return res.status(201).json({
      success: true,
      message: 'Live ajouté avec succès.',
      live
    });

  } catch (error) {

    console.error('❌ ERREUR CREATE LIVE :', error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'ajout du live.",
      error: error.message
    });
  }
};


// =====================================================
// MODIFIER LIVE
// =====================================================

const updateLive = async (req, res) => {

  try {

    const { donnees, erreur } = validerDonnees(req.body, true);

    if (erreur) {
      return res.status(400).json({
        success: false,
        message: erreur
      });
    }

    const live = await Live.findById(req.params.id);

    if (!live) {
      return res.status(404).json({
        success: false,
        message: 'Live introuvable.'
      });
    }

    const etaitEnDirect = live.enDirect && live.actif;

    Object.assign(live, donnees);
    await live.save();

    // Notification seulement quand le live passe "en direct"
    if (!etaitEnDirect) {
      notifierDebutLive(live);
    }

    return res.status(200).json({
      success: true,
      message: 'Live modifié avec succès.',
      live
    });

  } catch (error) {

    console.error('❌ ERREUR UPDATE LIVE :', error);

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du live.',
      error: error.message
    });
  }
};


// =====================================================
// SUPPRIMER LIVE
// =====================================================

const supprimerLive = async (req, res) => {

  try {

    const live = await Live.findByIdAndDelete(req.params.id);

    if (!live) {
      return res.status(404).json({
        success: false,
        message: 'Live introuvable.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Live supprimé avec succès.'
    });

  } catch (error) {

    console.error('❌ ERREUR SUPPRESSION LIVE :', error);

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du live.',
      error: error.message
    });
  }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getLives,
  getAllLivesAdmin,
  getLiveById,
  createLive,
  updateLive,
  supprimerLive
};
