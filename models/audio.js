const mongoose = require('mongoose');

const audioSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true
    },

    personne: {
      type: String,
      required: true,
      trim: true
    },

    photoCouverture: {
      type: String,
      required: true
    },

    // Key permettant de supprimer l'image dans R2
    photoCouvertureKey: {
      type: String,
      required: true
    },

    fichierAudio: {
      type: String,
      required: true
    },

    // Key permettant de supprimer l'audio dans R2
    fichierAudioKey: {
      type: String,
      required: true
    },

    categorie: {
      type: String,
      enum: ['priere', 'miracles', 'esperances', 'temoignages', 'autres'],
      required: true
    },

    datePublication: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Audio', audioSchema);