const mongoose = require('mongoose');


// =====================================================
// CATÉGORIES
// Chaque catégorie appartient à un sens (entrée ou sortie)
// =====================================================

// Entrées : les types de contribution définis par le pasteur
const CATEGORIES = {

  entree: [
    'offrande_adoration',
    'offrande_prophete',
    'dime_action_graces',
    'dime_des_dimes',
    'loyer_ouvriers',
    'loyer_partenaires',
    'contribution',
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

// Anciennes catégories d'entrée : plus proposées pour une nouvelle saisie,
// mais toujours valides pour les opérations déjà enregistrées avec.
const CATEGORIES_ANCIENNES = {
  entree: ['offrande', 'dime', 'don', 'action_de_graces', 'mission', 'cotisation', 'vente'],
  sortie: []
};

// Libellés lisibles (export CSV, journaux)
const LIBELLES_CATEGORIES = {
  entree: {
    offrande_adoration: "Offrande d'adoration",
    offrande_prophete: 'Offrande du prophète',
    dime_action_graces: 'Dîme et action de grâces',
    dime_des_dimes: 'Dîme des dîmes',
    loyer_ouvriers: 'Loyer des ouvriers',
    loyer_partenaires: 'Loyer des partenaires',
    contribution: 'Contribution',
    autre_entree: 'Autre entrée',
    offrande: 'Offrande (ancienne catégorie)',
    dime: 'Dîme (ancienne catégorie)',
    don: 'Don (ancienne catégorie)',
    action_de_graces: 'Action de grâces (ancienne catégorie)',
    mission: 'Mission (ancienne catégorie)',
    cotisation: 'Cotisation (ancienne catégorie)',
    vente: 'Vente (ancienne catégorie)'
  },
  sortie: {
    loyer: 'Loyer',
    salaires: 'Salaires / honoraires',
    factures: 'Factures (eau, électricité, internet)',
    entretien: 'Entretien / réparations',
    materiel: 'Matériel / équipement',
    social: 'Aide sociale',
    mission: 'Mission / évangélisation',
    evenement: 'Évènement',
    transport: 'Transport',
    autre_sortie: 'Autre dépense'
  }
};

const categorieConnue = (type, categorie) =>
  (CATEGORIES[type] || []).includes(categorie)
  || (CATEGORIES_ANCIENNES[type] || []).includes(categorie);

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
          return categorieConnue(this.type, valeur);
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
OperationTresorerie.CATEGORIES_ANCIENNES = CATEGORIES_ANCIENNES;
OperationTresorerie.LIBELLES_CATEGORIES = LIBELLES_CATEGORIES;
OperationTresorerie.MODES_PAIEMENT = MODES_PAIEMENT;
OperationTresorerie.DEVISES = DEVISES;

module.exports = OperationTresorerie;
