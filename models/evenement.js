const mongoose = require('mongoose');

const evenementSchema = new mongoose.Schema(
  {
    titre: {
      type: String,
      required: true,
      trim: true
    },

    // Jour de l'évènement au format "AAAA-MM-JJ" : pas de décalage de fuseau horaire
    // entre l'admin, le serveur et le téléphone (le calendrier marque le bon jour)
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true
    },

    // Heure facultative "HH:mm"
    heure: {
      type: String,
      default: '',
      match: /^(\d{2}:\d{2})?$/
    },

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

module.exports = mongoose.model('Evenement', evenementSchema);
