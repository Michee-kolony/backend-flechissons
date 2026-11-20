const mongoose = require('mongoose');


// =====================================================
// CATÉGORIES
// Chaque catégorie appartient à un sens (entrée ou sortie)
// =====================================================

const CATEGORIES = {

  entree: [
    'offrande',
    'dime',
    'don',
    'action_de_graces',
    'mission',
    'cotisation',
    'vente',
    'autre_entree'
  ],

  sortie: [
    'loyer',
    'salaires',
    'factures',
    'entretien',
    'materiel',
    'social',
    'mission',
    'evenement',
    'transport',
    'autre_sortie'
  ]

};

const MODES_PAIEMENT = [
  'especes',
  'mobile_money',
  'banque',
  'autre'
];

const DEVISES = ['USD', 'CDF'];


// =====================================================
// OPÉRATION DE TRÉSORERIE
// Un document par mouvement de caisse (entrée ou sortie d'argent).
// Les soldes USD et CDF sont tenus séparément (pas de conversion).
// =====================================================

const operationTresorerieSchema = new mongoose.Schema(

  {

    type: {
      type: String,
      enum: ['entree', 'sortie'],
      required: true,
      index: true
    },

    categorie: {
      type: String,
      required: true,
      validate: {
        validator: function (valeur) {
          return (CATEGORIES[this.type] || []).includes(valeur);
        },
        message: 'Catégorie invalide pour ce type d\'opération.'
      }
    },

    libelle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 1000
    },

    montant: {
      type: Number,
      required: true,
      min: 0.01
    },

    devise: {
      type: String,
      enum: DEVISES,
      required: true
    },

    // Jour de l'opération au format "AAAA-MM-JJ" (même convention que les évènements)
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true
    },

    modePaiement: {
      type: String,
      enum: MODES_PAIEMENT,
      default: 'especes'
    },

    // N° de reçu, de facture ou de pièce justificative
    reference: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100
    },


    // =================================================
    // TRAÇABILITÉ
    // Le nom est recopié : il reste lisible si le compte est supprimé
    // =================================================

    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },

    creeParNom: {
      type: String,
      default: ''
    },

    modifiePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },

    modifieParNom: {
      type: String,
      default: ''
    }

  },

  {
    timestamps: true
  }

);


operationTresorerieSchema.index({ date: -1, createdAt: -1 });


const OperationTresorerie =
  mongoose.models.OperationTresorerie ||
  mongoose.model('OperationTresorerie', operationTresorerieSchema);

OperationTresorerie.CATEGORIES = CATEGORIES;
OperationTresorerie.MODES_PAIEMENT = MODES_PAIEMENT;
OperationTresorerie.DEVISES = DEVISES;

module.exports = OperationTresorerie;
