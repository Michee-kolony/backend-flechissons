const mongoose = require('mongoose');

// Un seul document : l'adresse et la position de l'église
const egliseSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      trim: true,
      default: 'Église Fléchissons'
    },

    adresse: {
      type: String,
      required: true,
      trim: true
    },

    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },

    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    },

    // Informations complémentaires (horaires, repères...)
    description: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Eglise', egliseSchema);
