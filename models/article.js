const mongoose = require("mongoose");


// =====================================================
// COMMENTAIRE
// =====================================================

const commentaireSchema = new mongoose.Schema(

    {

        utilisateurId: {

            type: mongoose.Schema.Types.ObjectId,

            ref: "Utilisateur",

            required: true

        },

        contenu: {

            type: String,

            required: true,

            trim: true

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


        // =============================================
        // YOUTUBE
        // =============================================

        youtube: {

            type: String,

            trim: true,

            default: null

        },


        // =============================================
        // IMAGES R2
        // =============================================

        images: {

            type: [String],

            default: [],

            validate: {

                validator: function (images) {

                    return images.length <= 4;

                },

                message:
                    "Maximum 4 images par article."

            },
            required:true
            

        },


        // =============================================
        // LIEN EXTERNE
        // =============================================

        lien: {

            type: String,

            trim: true,

            default: null

        },


        // =============================================
        // LIKES
        // =============================================

        likes: [

            {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "Utilisateur"

            }

        ],


        // =============================================
        // COMMENTAIRES
        // =============================================

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

module.exports =
    mongoose.model("Article", articleSchema);