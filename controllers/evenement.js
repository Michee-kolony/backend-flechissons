const Evenement = require('../models/evenement');


// =====================================================
// UTILITAIRES
// =====================================================

// "2026-02-30" a le bon format mais n'existe pas : on vérifie le vrai calendrier
const dateValide = (valeur) => {

  if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) {
    return false;
  }

  const [annee, mois, jour] = valeur.split('-').map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour));

  return date.getUTCFullYear() === annee
    && date.getUTCMonth() === mois - 1
    && date.getUTCDate() === jour;
};

const heureValide = (valeur) =>
  /^([01]\d|2[0-3]):[0-5]\d$/.test(valeur);


// Valide les champs reçus. `partiel` = true pour une modification
// (seuls les champs envoyés sont vérifiés).
const validerDonnees = (body, partiel = false) => {

  const donnees = {};

  if (!partiel || body.titre !== undefined) {
    if (!body.titre || !String(body.titre).trim()) {
      return { erreur: "Le titre de l'évènement est obligatoire." };
    }
    donnees.titre = String(body.titre).trim();
  }

  if (!partiel || body.date !== undefined) {
    // Accepte aussi une date ISO complète ("2026-10-11T00:00:00.000Z")
    const date = String(body.date || '').slice(0, 10);
    if (!dateValide(date)) {
      return { erreur: 'Date invalide (format AAAA-MM-JJ).' };
    }
    donnees.date = date;
  }

  if (body.heure !== undefined) {
    const heure = String(body.heure || '').trim().slice(0, 5);
    if (heure && !heureValide(heure)) {
      return { erreur: 'Heure invalide (format HH:mm).' };
    }
    donnees.heure = heure;
  }

  if (body.description !== undefined) {
    donnees.description = String(body.description || '').trim();
  }

  return { donnees };
};


const ordreTri = { date: 1, heure: 1, createdAt: 1 };


// =====================================================
// GET ÉVÈNEMENTS
// Filtres facultatifs : ?debut=AAAA-MM-JJ&fin=AAAA-MM-JJ
// =====================================================

const getEvenements = async (req, res) => {

  try {

    const filtre = {};
    const { debut, fin } = req.query;

    if (debut || fin) {

      if ((debut && !dateValide(debut)) || (fin && !dateValide(fin))) {
        return res.status(400).json({
          success: false,
          message: 'Filtre de date invalide (format AAAA-MM-JJ).'
        });
      }

      filtre.date = {};
      if (debut) filtre.date.$gte = debut;
      if (fin) filtre.date.$lte = fin;
    }

    const evenements = await Evenement
      .find(filtre)
      .sort(ordreTri);

    return res.status(200).json({
      success: true,
      count: evenements.length,
      evenements
    });

  } catch (error) {

    console.error('❌ ERREUR GET ÉVÈNEMENTS :', error);

    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des évènements.',
      error: error.message
    });
  }
};


// =====================================================
// GET ÉVÈNEMENT PAR ID
// =====================================================

const getEvenementById = async (req, res) => {

  try {

    const evenement = await Evenement.findById(req.params.id);

    if (!evenement) {
      return res.status(404).json({
        success: false,
        message: 'Évènement introuvable.'
      });
    }

    return res.status(200).json({
      success: true,
      evenement
    });

  } catch (error) {

    console.error('❌ ERREUR GET ÉVÈNEMENT BY ID :', error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de l'évènement.",
      error: error.message
    });
  }
};


// =====================================================
// CREATE ÉVÈNEMENT
// =====================================================

const createEvenement = async (req, res) => {

  try {

    const { donnees, erreur } = validerDonnees(req.body);

    if (erreur) {
      return res.status(400).json({
        success: false,
        message: erreur
      });
    }

    const evenement = await Evenement.create(donnees);

    return res.status(201).json({
      success: true,
      message: 'Évènement ajouté avec succès.',
      evenement
    });

  } catch (error) {

    console.error('❌ ERREUR CREATE ÉVÈNEMENT :', error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'ajout de l'évènement.",
      error: error.message
    });
  }
};


// =====================================================
// MODIFIER ÉVÈNEMENT
// =====================================================

const updateEvenement = async (req, res) => {

  try {

    const { donnees, erreur } = validerDonnees(req.body, true);

    if (erreur) {
      return res.status(400).json({
        success: false,
        message: erreur
      });
    }

    const evenement = await Evenement.findByIdAndUpdate(
      req.params.id,
      donnees,
      { new: true, runValidators: true }
    );

    if (!evenement) {
      return res.status(404).json({
        success: false,
        message: 'Évènement introuvable.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Évènement modifié avec succès.',
      evenement
    });

  } catch (error) {

    console.error('❌ ERREUR UPDATE ÉVÈNEMENT :', error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la modification de l'évènement.",
      error: error.message
    });
  }
};


// =====================================================
// SUPPRIMER ÉVÈNEMENT
// =====================================================

const supprimerEvenement = async (req, res) => {

  try {

    const evenement = await Evenement.findByIdAndDelete(req.params.id);

    if (!evenement) {
      return res.status(404).json({
        success: false,
        message: 'Évènement introuvable.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Évènement supprimé avec succès.'
    });

  } catch (error) {

    console.error('❌ ERREUR SUPPRESSION ÉVÈNEMENT :', error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression de l'évènement.",
      error: error.message
    });
  }
};


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getEvenements,
  getEvenementById,
  createEvenement,
  updateEvenement,
  supprimerEvenement
};
