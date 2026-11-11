const mongoose = require('mongoose');

// =====================================================
// TÉLÉVERSEMENT MULTIPART (session d'upload vers R2)
// -----------------------------------------------------
// en_cours      : multipart créé sur R2, parties en cours d'envoi
// finalisation  : CompleteMultipartUpload en cours (verrou anti-doublon)
// termine       : fichier vérifié sur R2, prêt à être publié
// utilise       : rattaché à une publication (ne peut plus resservir)
// annule        : annulé par l'admin ou nettoyé automatiquement
// echec         : finalisation refusée (taille incorrecte, etc.)
// =====================================================

const STATUTS = ['en_cours', 'finalisation', 'termine', 'utilise', 'annule', 'echec'];

const televersementSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },

    uploadId: {
      type: String,
      required: true,
      unique: true
    },

    key: {
      type: String,
      required: true,
      unique: true
    },

    nomOriginal: {
      type: String,
      required: true,
      trim: true
    },

    extension: {
      type: String,
      required: true
    },

    // audio | video
    nature: {
      type: String,
      enum: ['audio', 'video'],
      required: true
    },

    typeMime: {
      type: String,
      required: true
    },

    taille: {
      type: Number,
      required: true
    },

    taillePartie: {
      type: Number,
      required: true
    },

    nombreParties: {
      type: Number,
      required: true
    },

    statut: {
      type: String,
      enum: STATUTS,
      default: 'en_cours',
      index: true
    },

    // Renseignée uniquement après vérification du fichier sur R2
    url: {
      type: String,
      default: null
    },

    articleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Article',
      default: null
    },

    erreur: {
      type: String,
      default: null
    },

    termineLe: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

televersementSchema.index({ statut: 1, updatedAt: 1 });

televersementSchema.statics.STATUTS = STATUTS;

module.exports = mongoose.model('Televersement', televersementSchema);
