const mongoose = require('mongoose');


// =====================================================
// USER SCHEMA
// =====================================================

const userSchema = new mongoose.Schema(

  {

    // =================================================
    // INFORMATIONS DE CONNEXION
    // =================================================

    nom: {

      type: String,

      required: true,

      trim: true

    },


    email: {

      type: String,

      required: true,

      unique: true,

      lowercase: true,

      trim: true,

      index: true

    },


    password: {

      type: String,

      required: true,

      minlength: 6,

      select: false

    },


    // =================================================
    // RÉINITIALISATION DU MOT DE PASSE
    // =================================================

    resetPasswordToken: {

      type: String,

      default: null,

      select: false

    },


    resetPasswordExpires: {

      type: Date,

      default: null,

      select: false

    },


    // =================================================
    // INFORMATIONS DE BASE
    // =================================================

    prenom: {

      type: String,

      trim: true,

      default: ''

    },


    photo: {

      type: String,

      default: ''

    },


    // =================================================
    // INFORMATIONS PERSONNELLES
    // =================================================

    sexe: {

      type: String,

      enum: [
        'homme',
        'femme',
        'autre',
        'non_precise'
      ],

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


    // =================================================
    // PRÉFÉRENCES FLÉCHISSONS
    // =================================================

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

        enum: [
          'fr',
          'ln'
        ],

        default: 'fr'

      }

    },


    // =================================================
    // PROFIL
    // =================================================

    profilComplete: {

      type: Boolean,

      default: false

    },


    // =================================================
    // RÔLE
    // =================================================

    role: {

      type: String,

      enum: [
        'user',
        'admin'
      ],

      default: 'user'

    },


    // =================================================
    // DERNIÈRE CONNEXION
    // =================================================

    derniereConnexion: {

      type: Date,

      default: Date.now

    }

  },


  // ===================================================
  // OPTIONS
  // ===================================================

  {

    timestamps: true

  }

);


// =====================================================
// EXPORT
// =====================================================

module.exports =
  mongoose.models.User ||
  mongoose.model(
    'User',
    userSchema
  );