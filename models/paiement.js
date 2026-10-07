const mongoose = require('mongoose');


// =====================================================
// OPÉRATEURS MOBILE MONEY (RDC)
// Clé = valeur envoyée par l'application (page don)
// provider = code PawaPay
// =====================================================

const OPERATEURS = {
  mpesa: {
    nom: 'M-Pesa',
    provider: 'VODACOM_MPESA_COD'
  },
  orange: {
    nom: 'Orange Money',
    provider: 'ORANGE_COD'
  },
  airtel: {
    nom: 'Airtel Money',
    provider: 'AIRTEL_COD'
  }
};


// =====================================================
// TYPES DE CONTRIBUTION
// =====================================================

const TYPES = [
  'offrande',
  'dime',
  'don',
  'action_de_graces',
  'mission',
  'autre'
];


// =====================================================
// PAIEMENT (DEPOSIT PAWAPAY)
// Un document par tentative de paiement d'un fidèle
// =====================================================

const paiementSchema = new mongoose.Schema(

  {

    // =================================================
    // IDENTIFIANTS
    // =================================================

    // UUID généré par le backend et envoyé à PawaPay
    depositId: {
      type: String,
      required: true,
      unique: true
    },

    // Référence lisible affichée au fidèle (ex : DON-482913)
    reference: {
      type: String,
      required: true,
      unique: true
    },


    // =================================================
    // FIDÈLE
    // L'application est en libre accès : le compte est facultatif
    // =================================================

    utilisateurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },

    nom: {
      type: String,
      trim: true,
      default: 'Anonyme'
    },


    // =================================================
    // CONTRIBUTION (page don de l'application)
    // =================================================

    type: {
      type: String,
      enum: TYPES,
      default: 'don'
    },

    objet: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500
    },

    montant: {
      type: Number,
      required: true,
      min: 0.01
    },

    devise: {
      type: String,
      enum: ['USD', 'CDF'],
      required: true
    },


    // =================================================
    // MOBILE MONEY
    // =================================================

    operateur: {
      type: String,
      enum: Object.keys(OPERATEURS),
      required: true
    },

    // Code PawaPay (VODACOM_MPESA_COD, ORANGE_COD, AIRTEL_COD)
    provider: {
      type: String,
      enum: Object.values(OPERATEURS).map(o => o.provider),
      required: true
    },

    // Numéro complet au format international sans "+" (ex : 243812345678)
    telephone: {
      type: String,
      required: true,
      trim: true,
      match: /^243\d{9}$/
    },


    // =================================================
    // STATUT
    // =================================================

    // Statut simplifié pour l'application et l'admin
    statut: {
      type: String,
      enum: [
        'en_attente', // envoyé à PawaPay, le fidèle doit valider avec son code PIN
        'reussi',     // argent reçu (COMPLETED)
        'echoue'      // refusé, annulé ou expiré (REJECTED / FAILED)
      ],
      default: 'en_attente',
      index: true
    },

    // Statut exact renvoyé par PawaPay
    // ACCEPTED, REJECTED, DUPLICATE_IGNORED, PROCESSING,
    // IN_RECONCILIATION, COMPLETED, FAILED
    statutPawapay: {
      type: String,
      default: null
    },

    // Raison de l'échec (failureReason de PawaPay)
    echec: {
      code: {
        type: String,
        default: null
      },
      message: {
        type: String,
        default: null
      }
    },

    // Identifiant de la transaction chez l'opérateur (M-Pesa, Orange...)
    providerTransactionId: {
      type: String,
      default: null
    },

    // Date à laquelle le paiement est devenu définitif
    dateFinalisation: {
      type: Date,
      default: null
    },

    // Dernier callback reçu, conservé pour vérification
    callback: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }

  },


  // ===================================================
  // OPTIONS
  // ===================================================

  {
    timestamps: true
  }

);


// =====================================================
// INDEX
// =====================================================

paiementSchema.index({ createdAt: -1 });


// =====================================================
// EXPORT
// =====================================================

const Paiement =
  mongoose.models.Paiement ||
  mongoose.model('Paiement', paiementSchema);

Paiement.OPERATEURS = OPERATEURS;
Paiement.TYPES = TYPES;

module.exports = Paiement;
