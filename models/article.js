const mongoose = require("mongoose");

// =====================================================
// COMMENTAIRE - AVEC INFOS UTILISATEUR
// =====================================================

const commentaireSchema = new mongoose.Schema(
    {
        utilisateurId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Utilisateur",
            required: true
        },
        
        nom: {
            type: String,
            required: true,
            trim: true
        },
        
        prenom: {
            type: String,
            required: true,
            trim: true
        },
        
        photo: {
            type: String,
            default: null
        },
        
        contenu: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 500
        }
    },
    {
        timestamps: true
    }
);

// =====================================================
// ARTICLE
// =====================================================

const articleSchema = new mongoose.Schema(
    {
        titre: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        type: {
            type: String,
            enum: [
                "annonces",
                "predications",
                "exhortations"
            ],
            required: true
        },

        theme: {
            type: String,
            required: true,
            trim: true
        },

        youtube: {
            type: String,
            trim: true,
            default: null
        },

        images: {
            type: [String],
            default: [],
            validate: {
                validator: function (images) {
                    return images.length <= 4;
                },
                message: "Maximum 4 images par article."
            },
            required: true
        },

        lien: {
            type: String,
            trim: true,
            default: null
        },

        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Utilisateur"
            }
        ],

        commentaires: {
            type: [commentaireSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

// =====================================================
// INDEX
// =====================================================

articleSchema.index({ type: 1 });
articleSchema.index({ theme: 1 });
articleSchema.index({ createdAt: -1 });

// =====================================================
// MODEL
// =====================================================

module.exports = mongoose.model("Article", articleSchema);