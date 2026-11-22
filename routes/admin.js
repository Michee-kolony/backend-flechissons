const express = require('express');
const {
    register,
    login,
    getalladmin,
    deleteAdmin,
    moi,
    changerRole,
    modifierProfil,
    changerMotDePasse
} = require('../controllers/admin');
const { auth, superAdmin } = require('../middlewares/auth');
const uploadProfil = require('../middlewares/uploadProfil');
const router = express.Router();

// Photo de profil (facultative) : erreurs multer renvoyées en JSON lisible
const photoAdmin = (req, res, next) => {
    uploadProfil.single('photo')(req, res, (err) => {
        if (!err) return next();
        const message = err.code === 'LIMIT_FILE_SIZE'
            ? `La photo ne doit pas dépasser ${uploadProfil.TAILLE_MAX_MO} Mo.`
            : err.message === 'FORMAT_IMAGE_INVALIDE'
                ? 'Format de photo non accepté (JPG, PNG, WEBP, HEIC…).'
                : "Erreur lors de l'envoi de la photo.";
        return res.status(400).json({ message });
    });
};

router.post('/register', auth, superAdmin, register);
router.post('/login', login);

// Profil de l'administrateur connecté (tous les rôles, sans changement de rôle)
router.get('/moi', auth, moi);
router.put('/moi', auth, photoAdmin, modifierProfil);
router.put('/moi/mot-de-passe', auth, changerMotDePasse);

router.get('/', auth, superAdmin, getalladmin);
router.patch('/:id/role', auth, superAdmin, changerRole);
router.delete('/:id', auth, superAdmin, deleteAdmin);

module.exports = router;
