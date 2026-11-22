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
    date: {type: Date, default: Date.now},

    // Profil (modifiable par l'administrateur lui-même, jamais le rôle)
    photo: {type: String, default: ''},
    photoKey: {type: String, default: ''},
    telephone: {type: String, trim: true, default: '', maxlength: 30},
    // Titre affiché aux utilisateurs de l'app (ex : « Pasteur », « Diacre »)
    titre: {type: String, trim: true, default: '', maxlength: 60},
    bio: {type: String, trim: true, default: '', maxlength: 500}
});

// Rôles qui peuvent échanger avec les utilisateurs de l'application mobile
const ROLES_MESSAGERIE = ['admin', 'superadmin'];

// Ce que les autres voient d'un administrateur (sans mot de passe ni clé)
AdminSchema.methods.profilPublic = function () {
    return {
        id: this._id,
        nom: this.nom,
        email: this.email,
        role: this.role,
        photo: this.photo || '',
        telephone: this.telephone || '',
        titre: this.titre || '',
        bio: this.bio || ''
    };
};

const Admin = mongoose.model('Admin', AdminSchema);

Admin.ROLES = ROLES;
Admin.ROLES_MESSAGERIE = ROLES_MESSAGERIE;

module.exports = Admin;
