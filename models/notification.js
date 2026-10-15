const mongoose = require('mongoose');

// Historique des notifications affichées dans l'application
// (page "Notifications"). Une notification envoyée à tous
// (nouvelle publication, audio, live) a un destinataire null ;
// une notification ciblée (like, commentaire, paiement) a un
// document par destinataire.

const TYPES = ['article', 'audio', 'live', 'like', 'commentaire', 'paiement', 'autre'];

// Durée de conservation de l'historique
const DUREE_CONSERVATION_JOURS = 60;

const notificationSchema = new mongoose.Schema(
  {
    destinataire: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    type: {
      type: String,
      enum: TYPES,
      default: 'autre'
    },

    titre: {
      type: String,
      required: true,
      trim: true
    },

    message: {
      type: String,
      trim: true,
      default: ''
    },

    // Page de l'application ouverte au clic
    route: {
      type: String,
      default: null
    },

    image: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

notificationSchema.index({ destinataire: 1, createdAt: -1 });

// Suppression automatique des anciennes notifications
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: DUREE_CONSERVATION_JOURS * 24 * 60 * 60 }
);

notificationSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
