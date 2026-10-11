const mongoose = require('mongoose');

// Réseaux sur lesquels un live peut être diffusé
const PLATEFORMES = ['youtube', 'facebook', 'tiktok', 'instagram', 'autre'];

const liveSchema = new mongoose.Schema(
  {
    titre: {
      type: String,
      required: true,
      trim: true
    },

    plateforme: {
      type: String,
      enum: PLATEFORMES,
      required: true
    },

    // Lien vers le live (ou la chaîne / page) sur le réseau
    lien: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      trim: true,
      default: ''
    },

    // true : le badge "LIVE" s'affiche dans l'application
    enDirect: {
      type: Boolean,
      default: false
    },

    // false : le lien est masqué dans l'application mobile
    actif: {
      type: Boolean,
      default: true
    },

    // Ordre d'affichage (le plus petit en premier)
    ordre: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

liveSchema.statics.PLATEFORMES = PLATEFORMES;

module.exports = mongoose.model('Live', liveSchema);
