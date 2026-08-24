const express = require('express');
const multer = require('multer');

const router = express.Router();


// ======================================================
// MULTER / R2
// ======================================================

const upload =
    require('../middlewares/upload');


// ======================================================
// CONTROLLER
// ======================================================
const {
    register,
    login,
    getProfile,
    getUsers,
    updateProfile,
    forgotPassword,
    resetPassword,
    changePassword,
    deleteAccount
} = require('../controllers/user');


// ======================================================
// INSCRIPTION
// ======================================================

router.post(
    '/register',
    register
);


// ======================================================
// RÉCUPÉRER TOUS LES UTILISATEURS
// ======================================================

router.get(
    '/',
    getUsers
);


// ======================================================
// CONNEXION
// ======================================================

router.post(
    '/login',
    login
);


// ======================================================
// PROFIL
// ======================================================

router.get(
    '/profile',
    getProfile
);


// ======================================================
// MIDDLEWARE UPLOAD PHOTO PROFIL
// ======================================================

const uploadProfile = (req, res, next) => {

    upload.single('photo')(
        req,
        res,
        (err) => {

            // ==========================================
            // AUCUNE ERREUR
            // ==========================================

            if (!err) {

                console.log('');
                console.log('==============================================');
                console.log('📤 UPLOAD PROFIL');
                console.log('==============================================');

                console.log('📦 BODY après Multer :', req.body);
                console.log('📸 FILE après Multer :', req.file);

                return next();
            }


            // ==========================================
            // ERREUR MULTER
            // ==========================================

            console.error(
                '❌ ERREUR MULTER PROFIL :',
                err
            );


            // ==========================================
            // ERREUR MULTER CLASSIQUE
            // ==========================================

            if (err instanceof multer.MulterError) {

                const messages = {

                    LIMIT_FILE_SIZE:
                        'La photo dépasse la taille maximale de 5 Mo.',

                    LIMIT_FILE_COUNT:
                        'Une seule photo est autorisée.',

                    LIMIT_UNEXPECTED_FILE:
                        'Le champ de la photo doit être "photo".'

                };


                return res.status(400).json({

                    success: false,

                    code: err.code,

                    message:
                        messages[err.code] ||
                        'Erreur lors de l\'upload de la photo.'

                });

            }


            // ==========================================
            // FORMAT IMAGE INVALIDE
            // ==========================================

            if (
                err.message ===
                'FORMAT_IMAGE_INVALIDE'
            ) {

                return res.status(400).json({

                    success: false,

                    code:
                        'INVALID_IMAGE_FORMAT',

                    message:
                        'Format non autorisé. Utilisez JPG, PNG ou WEBP.'

                });

            }


            // ==========================================
            // AUTRE ERREUR
            // ==========================================

            return res.status(500).json({

                success: false,

                code:
                    'UPLOAD_ERROR',

                message:
                    'Erreur lors de l\'upload de la photo.',

                error:
                    err.message

            });

        }
    );

};


// ======================================================
// MODIFIER / COMPLÉTER LE PROFIL
// ======================================================
// PUT /user/profile
//
// Peut recevoir :
// - prenom
// - sexe
// - dateNaissance
// - telephone
// - ville
// - categories
// - notifications
// - langue
// - photo
//
// Content-Type : multipart/form-data
// ======================================================

router.put(
    '/profile',
    uploadProfile,
    updateProfile
);


// ======================================================
// MOT DE PASSE OUBLIÉ
// ======================================================

router.post(
    '/forgot-password',
    forgotPassword
);


// ======================================================
// RESET PASSWORD
// ======================================================

router.post(
    '/reset-password/:token',
    resetPassword
);


// ======================================================
// CHANGER PASSWORD
// ======================================================

router.put(
    '/change-password',
    changePassword
);


// ======================================================
// SUPPRIMER COMPTE
// ======================================================

router.delete(
    '/account',
    deleteAccount
);


// ======================================================
// EXPORT
// ======================================================

module.exports = router;