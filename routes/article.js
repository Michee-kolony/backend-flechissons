// routes/article.js
const express = require("express");
const multer = require("multer");

const router = express.Router();

const upload = require("../middlewares/upload");

const {
    creerArticle,
    getArticles,
    getArticle,
    toggleLike,
    ajouterCommentaire,
    supprimerArticle
} = require("../controllers/articleController");

const { abonner } = require("../realtime/articleEvents");


// =====================================================
// MIDDLEWARE UPLOAD IMAGES
// =====================================================

const uploadImages = (req, res, next) => {

    upload.array("images", 4)(req, res, (err) => {

        // ---------------------------------------------
        // AUCUNE ERREUR
        // ---------------------------------------------

        if (!err) {
            return next();
        }

        console.error("❌ ERREUR UPLOAD :", err);

        // ---------------------------------------------
        // ERREURS MULTER
        // ---------------------------------------------

        if (err instanceof multer.MulterError) {

            const messages = {

                LIMIT_FILE_SIZE:
                    "Une image dépasse la taille maximale de 5 Mo.",

                LIMIT_FILE_COUNT:
                    "Vous ne pouvez envoyer que 4 images maximum.",

                LIMIT_UNEXPECTED_FILE:
                    'Le champ des images doit être "images".'

            };

            return res.status(400).json({

                success: false,

                code: err.code,

                message:
                    messages[err.code] ||
                    "Erreur lors de l'upload."

            });

        }

        // ---------------------------------------------
        // FORMAT IMAGE NON AUTORISÉ
        // ---------------------------------------------

        if (err.message === "FORMAT_IMAGE_INVALIDE") {

            return res.status(400).json({

                success: false,

                code: "INVALID_IMAGE_FORMAT",

                message:
                    "Format non autorisé. Utilisez JPG, PNG ou WEBP."

            });

        }

        // ---------------------------------------------
        // AUTRE ERREUR
        // ---------------------------------------------

        return res.status(500).json({

            success: false,

            code: "UPLOAD_ERROR",

            message:
                "Erreur lors de l'upload de l'image.",

            error: err.message

        });

    });

};


// =====================================================
// CRÉER UN ARTICLE
// POST /article
// =====================================================

router.post(
    "/",
    uploadImages,  // Le middleware gère l'upload
    creerArticle   // Le contrôleur reçoit req.files déjà rempli
);


// =====================================================
// RÉCUPÉRER TOUS LES ARTICLES
// GET /article
// =====================================================

router.get(
    "/",
    getArticles
);


// =====================================================
// FLUX TEMPS RÉEL (likes / commentaires)
// GET /article/events
// Doit rester avant "/:id"
// =====================================================

router.get(
    "/events",
    abonner
);


// =====================================================
// RÉCUPÉRER UN ARTICLE
// GET /article/:id
// =====================================================

router.get(
    "/:id",
    getArticle
);


// =====================================================
// LIKE / UNLIKE
// PUT /article/:id/like
// =====================================================

router.put(
    "/:id/like",
    toggleLike
);


// =====================================================
// AJOUTER UN COMMENTAIRE
// POST /article/:id/commentaire
// =====================================================

router.post(
    "/:id/commentaire",
    ajouterCommentaire
);


// =====================================================
// SUPPRIMER UN ARTICLE
// DELETE /article/:id
// =====================================================

router.delete(
    "/:id",
    supprimerArticle
);


// =====================================================
// EXPORT
// =====================================================

module.exports = router;