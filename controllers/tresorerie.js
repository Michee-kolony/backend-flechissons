const mongoose = require('mongoose');
const Operation = require('../models/operationTresorerie');
const Paiement = require('../models/paiement');

const { CATEGORIES, CATEGORIES_ANCIENNES, LIBELLES_CATEGORIES, MODES_PAIEMENT, DEVISES } = Operation;

const libelleCategorie = (type, categorie) =>
  LIBELLES_CATEGORIES[type]?.[categorie] || categorie;


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

const echapperRegex = (texte) =>
  String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Arrondi au centime (évite 0.1 + 0.2 = 0.30000000000000004 dans les totaux)
const arrondir = (n) => Math.round((n || 0) * 100) / 100;


// Valide les champs reçus. `existante` = opération en cours de modification
// (seuls les champs envoyés sont vérifiés, les autres sont repris).
const validerDonnees = (body, existante = null) => {

  const donnees = {};
  const partiel = !!existante;

  // TYPE
  if (!partiel || body.type !== undefined) {
    if (!['entree', 'sortie'].includes(body.type)) {
      return { erreur: "Le type doit être « entree » ou « sortie »." };
    }
    donnees.type = body.type;
  }

  // CATÉGORIE (vérifiée par rapport au type final)
  const typeFinal = donnees.type || existante?.type;

  if (!partiel || body.categorie !== undefined || body.type !== undefined) {
    const categorie = body.categorie !== undefined ? body.categorie : existante?.categorie;
    // Une ancienne catégorie reste acceptée uniquement si l'opération existante l'avait déjà
    const ancienneConservee = partiel
      && typeFinal === existante.type
      && categorie === existante.categorie
      && (CATEGORIES_ANCIENNES[typeFinal] || []).includes(categorie);
    if (!(CATEGORIES[typeFinal] || []).includes(categorie) && !ancienneConservee) {
      return { erreur: 'Catégorie invalide pour ce type d\'opération.' };
    }
    donnees.categorie = categorie;
  }

  // LIBELLÉ
  if (!partiel || body.libelle !== undefined) {
    const libelle = String(body.libelle || '').trim();
    if (!libelle) {
      return { erreur: 'Le libellé est obligatoire.' };
    }
    if (libelle.length > 150) {
      return { erreur: 'Le libellé ne doit pas dépasser 150 caractères.' };
    }
    donnees.libelle = libelle;
  }

  // MONTANT
  if (!partiel || body.montant !== undefined) {
    const montant = Number(body.montant);
    if (!Number.isFinite(montant) || montant < 0.01) {
      return { erreur: 'Le montant doit être supérieur à 0.' };
    }
    donnees.montant = arrondir(montant);
  }

  // DEVISE
  if (!partiel || body.devise !== undefined) {
    if (!DEVISES.includes(body.devise)) {
      return { erreur: 'Devise invalide (USD ou CDF).' };
    }
    donnees.devise = body.devise;
  }

  // DATE (accepte aussi une date ISO complète)
  if (!partiel || body.date !== undefined) {
    const date = String(body.date || '').slice(0, 10);
    if (!dateValide(date)) {
      return { erreur: 'Date invalide (format AAAA-MM-JJ).' };
    }
    donnees.date = date;
  }

  // MODE DE PAIEMENT
  if (body.modePaiement !== undefined) {
    if (!MODES_PAIEMENT.includes(body.modePaiement)) {
      return { erreur: 'Mode de paiement invalide.' };
    }
    donnees.modePaiement = body.modePaiement;
  }

  // DESCRIPTION
  if (body.description !== undefined) {
    const description = String(body.description || '').trim();
    if (description.length > 1000) {
      return { erreur: 'La description ne doit pas dépasser 1000 caractères.' };
    }
    donnees.description = description;
  }

  // RÉFÉRENCE / PIÈCE JUSTIFICATIVE
  if (body.reference !== undefined) {
    const reference = String(body.reference || '').trim();
    if (reference.length > 100) {
      return { erreur: 'La référence ne doit pas dépasser 100 caractères.' };
    }
    donnees.reference = reference;
  }

  return { donnees };
};


// Filtre Mongo à partir de la query :
// ?debut=AAAA-MM-JJ&fin=AAAA-MM-JJ&type=entree|sortie&categorie=...&devise=USD|CDF&recherche=...
const construireFiltre = (query) => {

  const filtre = {};
  const { debut, fin, type, categorie, devise, recherche } = query;

  if ((debut && !dateValide(debut)) || (fin && !dateValide(fin))) {
    return { erreur: 'Période invalide (format AAAA-MM-JJ).' };
  }

  if (debut || fin) {
    filtre.date = {};
    if (debut) filtre.date.$gte = debut;
    if (fin) filtre.date.$lte = fin;
  }

  if (type) {
    if (!['entree', 'sortie'].includes(type)) {
      return { erreur: 'Type invalide.' };
    }
    filtre.type = type;
  }

  if (categorie) {
    filtre.categorie = String(categorie);
  }

  if (devise) {
    if (!DEVISES.includes(devise)) {
      return { erreur: 'Devise invalide.' };
    }
    filtre.devise = devise;
  }

  if (recherche && String(recherche).trim()) {
    const regex = new RegExp(echapperRegex(String(recherche).trim()), 'i');
    filtre.$or = [
      { libelle: regex },
      { description: regex },
      { reference: regex }
    ];
  }

  return { filtre };
};


const ordreTri = { date: -1, createdAt: -1 };

const erreurServeur = (res, contexte, error) => {
  console.error(`❌ TRÉSORERIE — ${contexte} :`, error);
  return res.status(500).json({
    success: false,
    message: 'Erreur serveur, réessayez plus tard.'
  });
};


// =====================================================
// RÉFÉRENTIELS
// GET /tresorerie/references
// =====================================================

const getReferences = (req, res) => {
  res.status(200).json({
    success: true,
    categories: CATEGORIES,
    categoriesAnciennes: CATEGORIES_ANCIENNES,
    libellesCategories: LIBELLES_CATEGORIES,
    modesPaiement: MODES_PAIEMENT,
    devises: DEVISES
  });
};


// =====================================================
// LISTE DES OPÉRATIONS
// GET /tresorerie/operations?page=1&limite=50 (+ filtres)
// =====================================================

const getOperations = async (req, res) => {

  try {

    const { filtre, erreur } = construireFiltre(req.query);

    if (erreur) {
      return res.status(400).json({ success: false, message: erreur });
    }

    const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [operations, total] = await Promise.all([
      Operation.find(filtre)
        .sort(ordreTri)
        .skip((page - 1) * limite)
        .limit(limite)
        .lean(),
      Operation.countDocuments(filtre)
    ]);

    return res.status(200).json({
      success: true,
      operations,
      total,
      page,
      pages: Math.max(Math.ceil(total / limite), 1)
    });

  } catch (error) {
    return erreurServeur(res, 'LISTE', error);
  }

};


// =====================================================
// UNE OPÉRATION
// GET /tresorerie/operations/:id
// =====================================================

const getOperationById = async (req, res) => {

  try {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Opération introuvable.' });
    }

    const operation = await Operation.findById(req.params.id).lean();

    if (!operation) {
      return res.status(404).json({ success: false, message: 'Opération introuvable.' });
    }

    return res.status(200).json({ success: true, operation });

  } catch (error) {
    return erreurServeur(res, 'DÉTAILS', error);
  }

};


// =====================================================
// AJOUTER
// POST /tresorerie/operations
// =====================================================

const createOperation = async (req, res) => {

  try {

    const { donnees, erreur } = validerDonnees(req.body);

    if (erreur) {
      return res.status(400).json({ success: false, message: erreur });
    }

    const operation = await Operation.create({
      ...donnees,
      creePar: req.admin._id,
      creeParNom: req.admin.nom
    });

    return res.status(201).json({
      success: true,
      message: 'Opération enregistrée.',
      operation
    });

  } catch (error) {
    return erreurServeur(res, 'AJOUT', error);
  }

};


// =====================================================
// MODIFIER
// PUT /tresorerie/operations/:id
// =====================================================

const updateOperation = async (req, res) => {

  try {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Opération introuvable.' });
    }

    const operation = await Operation.findById(req.params.id);

    if (!operation) {
      return res.status(404).json({ success: false, message: 'Opération introuvable.' });
    }

    const { donnees, erreur } = validerDonnees(req.body, operation);

    if (erreur) {
      return res.status(400).json({ success: false, message: erreur });
    }

    operation.set({
      ...donnees,
      modifiePar: req.admin._id,
      modifieParNom: req.admin.nom
    });

    await operation.save();

    return res.status(200).json({
      success: true,
      message: 'Opération modifiée.',
      operation
    });

  } catch (error) {
    return erreurServeur(res, 'MODIFICATION', error);
  }

};


// =====================================================
// SUPPRIMER
// DELETE /tresorerie/operations/:id
// =====================================================

const supprimerOperation = async (req, res) => {

  try {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Opération introuvable.' });
    }

    const operation = await Operation.findByIdAndDelete(req.params.id);

    if (!operation) {
      return res.status(404).json({ success: false, message: 'Opération introuvable.' });
    }

    console.log(
      `🗑️ TRÉSORERIE — opération supprimée par ${req.admin.nom} (${req.admin._id}) :`,
      JSON.stringify(operation.toObject())
    );

    return res.status(200).json({
      success: true,
      message: 'Opération supprimée.'
    });

  } catch (error) {
    return erreurServeur(res, 'SUPPRESSION', error);
  }

};


// =====================================================
// RÉSUMÉ
// GET /tresorerie/resume?debut=AAAA-MM-JJ&fin=AAAA-MM-JJ
//
// Pour chaque devise :
//  - solde        : solde de caisse global (toutes dates jusqu'à `fin`)
//  - entrees / sorties / resultat : sur la période
// + répartition par catégorie et par mois sur la période
// + dons en ligne PawaPay réussis sur la période (à titre indicatif,
//   ils ne sont pas comptés dans la caisse tant qu'ils n'ont pas été saisis)
// =====================================================

const getResume = async (req, res) => {

  try {

    const { debut, fin } = req.query;

    if ((debut && !dateValide(debut)) || (fin && !dateValide(fin))) {
      return res.status(400).json({ success: false, message: 'Période invalide (format AAAA-MM-JJ).' });
    }

    const filtrePeriode = {};
    if (debut || fin) {
      filtrePeriode.date = {};
      if (debut) filtrePeriode.date.$gte = debut;
      if (fin) filtrePeriode.date.$lte = fin;
    }

    const filtreSolde = fin ? { date: { $lte: fin } } : {};

    // Dons en ligne : dates réelles, bornées à l'heure de Kinshasa (UTC+1)
    const filtreDons = { statut: 'reussi' };
    if (debut || fin) {
      filtreDons.dateFinalisation = {};
      if (debut) filtreDons.dateFinalisation.$gte = new Date(`${debut}T00:00:00+01:00`);
      if (fin) filtreDons.dateFinalisation.$lte = new Date(`${fin}T23:59:59.999+01:00`);
    }

    const [soldes, periode, parCategorie, parMois, dons] = await Promise.all([

      Operation.aggregate([
        { $match: filtreSolde },
        { $group: { _id: { devise: '$devise', type: '$type' }, total: { $sum: '$montant' } } }
      ]),

      Operation.aggregate([
        { $match: filtrePeriode },
        {
          $group: {
            _id: { devise: '$devise', type: '$type' },
            total: { $sum: '$montant' },
            nombre: { $sum: 1 }
          }
        }
      ]),

      Operation.aggregate([
        { $match: filtrePeriode },
        {
          $group: {
            _id: { devise: '$devise', type: '$type', categorie: '$categorie' },
            total: { $sum: '$montant' },
            nombre: { $sum: 1 }
          }
        },
        { $sort: { total: -1 } }
      ]),

      Operation.aggregate([
        { $match: filtrePeriode },
        {
          $group: {
            _id: { devise: '$devise', type: '$type', mois: { $substrBytes: ['$date', 0, 7] } },
            total: { $sum: '$montant' }
          }
        }
      ]),

      Paiement.aggregate([
        { $match: filtreDons },
        { $group: { _id: '$devise', total: { $sum: '$montant' }, nombre: { $sum: 1 } } }
      ])

    ]);

    const devises = {};

    for (const devise of DEVISES) {

      const total = (liste, type) =>
        arrondir(liste.find(l => l._id.devise === devise && l._id.type === type)?.total);

      const nombre = (type) =>
        periode.find(l => l._id.devise === devise && l._id.type === type)?.nombre || 0;

      const entrees = total(periode, 'entree');
      const sorties = total(periode, 'sortie');

      // Mois de la période, du plus récent au plus ancien
      const mois = {};
      for (const ligne of parMois.filter(l => l._id.devise === devise)) {
        const cle = ligne._id.mois;
        mois[cle] = mois[cle] || { mois: cle, entrees: 0, sorties: 0 };
        mois[cle][ligne._id.type === 'entree' ? 'entrees' : 'sorties'] = arrondir(ligne.total);
      }

      const don = dons.find(d => d._id === devise);

      devises[devise] = {
        solde: arrondir(total(soldes, 'entree') - total(soldes, 'sortie')),
        entrees,
        sorties,
        resultat: arrondir(entrees - sorties),
        nombreEntrees: nombre('entree'),
        nombreSorties: nombre('sortie'),
        parCategorie: parCategorie
          .filter(l => l._id.devise === devise)
          .map(l => ({
            type: l._id.type,
            categorie: l._id.categorie,
            total: arrondir(l.total),
            nombre: l.nombre
          })),
        parMois: Object.values(mois)
          .map(m => ({ ...m, resultat: arrondir(m.entrees - m.sorties) }))
          .sort((a, b) => b.mois.localeCompare(a.mois)),
        donsEnLigne: {
          total: arrondir(don?.total),
          nombre: don?.nombre || 0
        }
      };
    }

    return res.status(200).json({
      success: true,
      periode: { debut: debut || null, fin: fin || null },
      devises
    });

  } catch (error) {
    return erreurServeur(res, 'RÉSUMÉ', error);
  }

};


// =====================================================
// EXPORT CSV (ouvrable dans Excel)
// GET /tresorerie/export (mêmes filtres que la liste)
// =====================================================

const exporterCsv = async (req, res) => {

  try {

    const { filtre, erreur } = construireFiltre(req.query);

    if (erreur) {
      return res.status(400).json({ success: false, message: erreur });
    }

    const operations = await Operation.find(filtre).sort({ date: 1, createdAt: 1 }).lean();

    // Séparateur « ; » : c'est celui qu'Excel attend en français
    const cellule = (valeur) => {
      const texte = String(valeur ?? '');
      return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
    };

    const montant = (n) => String(arrondir(n)).replace('.', ',');

    const lignes = [
      ['Date', 'Type', 'Catégorie', 'Libellé', 'Montant', 'Devise', 'Mode de paiement', 'Référence', 'Description', 'Saisi par', 'Modifié par']
    ];

    for (const op of operations) {
      lignes.push([
        op.date,
        op.type === 'entree' ? 'Entrée' : 'Sortie',
        libelleCategorie(op.type, op.categorie),
        op.libelle,
        (op.type === 'sortie' ? '-' : '') + montant(op.montant),
        op.devise,
        op.modePaiement,
        op.reference,
        op.description,
        op.creeParNom,
        op.modifieParNom
      ]);
    }

    const csv = '﻿' + lignes.map(l => l.map(cellule).join(';')).join('\r\n');

    const nomFichier = `tresorerie_${req.query.debut || 'debut'}_${req.query.fin || 'fin'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomFichier}"`);

    return res.status(200).send(csv);

  } catch (error) {
    return erreurServeur(res, 'EXPORT', error);
  }

};


module.exports = {
  getReferences,
  getOperations,
  getOperationById,
  createOperation,
  updateOperation,
  supprimerOperation,
  getResume,
  exporterCsv
};
