const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // ==============================
    // IDENTITÉ FIREBASE
    // ==============================

    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // ==============================
    // INFORMATIONS DE BASE
    // ==============================

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },

    nom: {
      type: String,
      trim: true,
      default: ''
    },

    prenom: {
      type: String,
      trim: true,
      default: ''
    },

    photo: {
      type: String,
      default: ''
    },

    // ==============================
    // INFORMATIONS PERSONNELLES
    // ==============================

    sexe: {
      type: String,
      enum: ['homme', 'femme', 'autre', 'non_precise'],
      default: 'non_precise'
    },

    dateNaissance: {
      type: Date,
      default: null
    },

    telephone: {
      type: String,
      trim: true,
      default: ''
    },

    ville: {
      type: String,
      trim: true,
      default: ''
    },

    // ==============================
    // PRÉFÉRENCES FLECHISSONS
    // ==============================

    preferences: {
      categories: {
        type: [String],
        default: []
      },

      notifications: {
        type: Boolean,
        default: true
      },

      langue: {
        type: String,
        enum: ['fr', 'ln'],
        default: 'fr'
      }
    },

    // ==============================
    // PROFIL
    // ==============================

    profilComplete: {
      type: Boolean,
      default: false
    },

    // ==============================
    // RÔLE
    // ==============================

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },

    // ==============================
    // DERNIÈRE CONNEXION
    // ==============================

    derniereConnexion: {
      type: Date,
      default: Date.now
    }
  },

  {
    timestamps: true
  }
);

module.exports = mongoose.model('User', userSchema);