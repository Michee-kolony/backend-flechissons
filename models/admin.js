const mongoose = require('mongoose');

// Rôles des comptes d'administration :
// - admin      : gère le contenu (publications, audios, lives, évènements…)
// - tresorier  : comme un admin, plus la gestion de la trésorerie de l'église
// - superadmin : gère les administrateurs (dont les trésoriers) et les requêtes de prière
const ROLES = ['admin', 'tresorier', 'superadmin'];

const AdminSchema = new mongoose.Schema({
    nom: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    role: {type: String, enum: ROLES, default: 'admin'},
    date: {type: Date, default: Date.now}
});

const Admin = mongoose.model('Admin', AdminSchema);

Admin.ROLES = ROLES;

module.exports = Admin;
