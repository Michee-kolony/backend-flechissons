const mongoose = require('mongoose');

const DonationSchema = new mongoose.Schema({
    nom: { type: String, default: 'Anonyme' },
    email: { type: String },
    telephone: { type: String },
    montant: { type: Number, required: true },
    devise: { type: String, enum: ['USD', 'CDF'], required: true },
    methode: { type: String, default: 'Non précisé' },
    message: { type: String },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Donation', DonationSchema);
