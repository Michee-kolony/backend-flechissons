const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../models/User");


// =====================================================
// CONFIG JWT
// =====================================================

const JWT_SECRET =
    process.env.JWT_SECRET || "RANDOM_TOKEN_FLECHISSONS";


// =====================================================
// GÉNÉRER JWT
// =====================================================

const generateToken = (user) => {

    return jwt.sign(
        {
            id: user._id.toString(),
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "30d"
        }
    );

};


// =====================================================
// VÉRIFIER JWT
// Directement dans ce controller
// =====================================================

const verifyToken = (req) => {

    const authHeader = req.headers.authorization;


    // ==============================
    // TOKEN ABSENT
    // ==============================

    if (!authHeader) {

        const error = new Error("TOKEN_MISSING");

        throw error;

    }


    // ==============================
    // FORMAT BEARER
    // ==============================

    if (!authHeader.startsWith("Bearer ")) {

        const error = new Error("TOKEN_INVALID");

        throw error;

    }


    // ==============================
    // EXTRAIRE TOKEN
    // ==============================

    const token =
        authHeader.split(" ")[1];


    if (!token) {

        const error = new Error("TOKEN_MISSING");

        throw error;

    }


    // ==============================
    // VÉRIFICATION JWT
    // ==============================

    const decoded = jwt.verify(
        token,
        JWT_SECRET
    );


    return decoded;

};


// =====================================================
// RÉPONSE ERREUR JWT
// =====================================================

const handleJwtError = (error, res) => {

    if (
        error.message === "TOKEN_MISSING" ||
        error.message === "TOKEN_INVALID"
    ) {

        return res.status(401).json({
            success: false,
            message: "Authentification requise"
        });

    }


    if (error.name === "TokenExpiredError") {

        return res.status(401).json({
            success: false,
            message: "Votre session a expiré, veuillez vous reconnecter"
        });

    }


    if (error.name === "JsonWebTokenError") {

        return res.status(401).json({
            success: false,
            message: "Token invalide"
        });

    }


    return null;

};


// =====================================================
// FORMAT USER
// Évite de répéter le même objet partout
// =====================================================

const formatUser = (user) => {

    return {
        id: user._id,

        nom: user.nom,

        email: user.email,

        prenom: user.prenom,

        photo: user.photo,

        sexe: user.sexe,

        dateNaissance: user.dateNaissance,

        telephone: user.telephone,

        ville: user.ville,

        preferences: user.preferences,

        profilComplete: user.profilComplete,

        role: user.role,

        derniereConnexion: user.derniereConnexion,

        createdAt: user.createdAt,

        updatedAt: user.updatedAt
    };

};


// =====================================================
// REGISTER
// Seulement nom + email + password
// =====================================================

// =====================================================
// REGISTER
// Création d'un nouveau compte
// =====================================================

// =====================================================
// REGISTER
// Création d'un nouveau compte
// =====================================================

exports.register = async (req, res) => {

    try {

        console.log("");
        console.log("==============================================");
        console.log("📝 NOUVELLE INSCRIPTION");
        console.log("==============================================");


        // =================================================
        // BODY
        // =================================================

        console.log("📦 BODY REÇU :", {
            nom: req.body?.nom,
            email: req.body?.email,
            password: req.body?.password ? "OUI" : "NON"
        });


        const {
            nom,
            email,
            password
        } = req.body || {};


        // =================================================
        // VALIDATION
        // =================================================

        if (!nom || !email || !password) {

            return res.status(400).json({

                success: false,

                code: "MISSING_FIELDS",

                message:
                    "Le nom, l'email et le mot de passe sont obligatoires"

            });

        }


        // =================================================
        // VALIDATION TYPES
        // =================================================

        if (
            typeof nom !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {

            return res.status(400).json({

                success: false,

                code: "INVALID_DATA",

                message:
                    "Données invalides"

            });

        }


        // =================================================
        // NORMALISATION
        // =================================================

        const nomNormalise =
            nom.trim();

        const emailNormalise =
            email.trim().toLowerCase();


        // =================================================
        // VALIDATION NOM
        // =================================================

        if (!nomNormalise) {

            return res.status(400).json({

                success: false,

                code: "NAME_REQUIRED",

                message:
                    "Le nom est obligatoire"

            });

        }


        // =================================================
        // VALIDATION EMAIL
        // =================================================

        if (!emailNormalise) {

            return res.status(400).json({

                success: false,

                code: "EMAIL_REQUIRED",

                message:
                    "L'adresse email est obligatoire"

            });

        }


        // =================================================
        // VALIDATION PASSWORD
        // =================================================

        if (password.length < 6) {

            return res.status(400).json({

                success: false,

                code: "PASSWORD_TOO_SHORT",

                message:
                    "Le mot de passe doit contenir au moins 6 caractères"

            });

        }


        // =================================================
        // RECHERCHE EMAIL
        // =================================================

        console.log(
            "🔎 Recherche email :",
            emailNormalise
        );


        const existingUser =
            await User.findOne({
                email: emailNormalise
            });


        if (existingUser) {

            console.log(
                "❌ EMAIL DÉJÀ EXISTANT :",
                existingUser.email
            );


            return res.status(409).json({

                success: false,

                code: "EMAIL_ALREADY_EXISTS",

                message:
                    "Cette adresse email est déjà utilisée",

                field: "email"

            });

        }


        console.log(
            "✅ Email disponible"
        );


        // =================================================
        // HASH PASSWORD
        // =================================================

        console.log(
            "🔐 Hash du mot de passe..."
        );


        const hashedPassword =
            await bcrypt.hash(
                password,
                12
            );


        console.log(
            "✅ Mot de passe hashé"
        );


        // =================================================
        // CRÉATION UTILISATEUR
        // =================================================

        console.log(
            "💾 Création utilisateur MongoDB..."
        );


        const user =
            await User.create({

                nom: nomNormalise,

                email: emailNormalise,

                password: hashedPassword,

                profilComplete: false,

                role: "user"

            });


        console.log("");
        console.log(
            "=============================================="
        );

        console.log(
            "✅ UTILISATEUR CRÉÉ"
        );

        console.log(
            "🆔 ID :",
            user._id.toString()
        );

        console.log(
            "📧 Email :",
            user.email
        );

        console.log(
            "=============================================="
        );


        // =================================================
        // GÉNÉRER JWT
        // =================================================

        const token =
            generateToken(user);


        console.log(
            "🔐 JWT généré"
        );


        // =================================================
        // RÉPONSE
        // =================================================

        return res.status(201).json({

            success: true,

            message:
                "Compte créé avec succès",

            token,

            user:
                formatUser(user)

        });


    } catch (error) {

        console.error("");
        console.error(
            "=============================================="
        );

        console.error(
            "❌ REGISTER ERROR"
        );

        console.error(
            "=============================================="
        );

        console.error(
            "Message :",
            error.message
        );

        console.error(
            "Code :",
            error.code
        );

        console.error(
            "Key Pattern :",
            error.keyPattern
        );

        console.error(
            "Key Value :",
            error.keyValue
        );


        // =================================================
        // DUPLICATE KEY
        // =================================================

        if (error.code === 11000) {

            const duplicateField =
                error.keyPattern
                    ? Object.keys(error.keyPattern)[0]
                    : null;


            // ---------------------------------------------
            // EMAIL
            // ---------------------------------------------

            if (
                duplicateField === "email"
            ) {

                return res.status(409).json({

                    success: false,

                    code:
                        "EMAIL_ALREADY_EXISTS",

                    message:
                        "Cette adresse email est déjà utilisée",

                    field:
                        "email"

                });

            }


            // ---------------------------------------------
            // AUTRE DUPLICATION
            // ---------------------------------------------

            return res.status(409).json({

                success: false,

                code:
                    "DUPLICATE_KEY",

                message:
                    `Une valeur existe déjà pour le champ "${duplicateField || "inconnu"}"`,

                field:
                    duplicateField

            });

        }


        // =================================================
        // VALIDATION MONGOOSE
        // =================================================

        if (
            error.name === "ValidationError"
        ) {

            return res.status(400).json({

                success: false,

                code:
                    "VALIDATION_ERROR",

                message:
                    "Les données fournies sont invalides",

                errors:
                    Object.keys(
                        error.errors || {}
                    ).map(
                        field => ({

                            field,

                            message:
                                error.errors[field]?.message

                        })
                    )

            });

        }


        // =================================================
        // ERREUR GÉNÉRALE
        // =================================================

        return res.status(500).json({

            success: false,

            code:
                "REGISTER_ERROR",

            message:
                "Erreur lors de la création du compte"

        });

    }

};


// =====================================================
// LOGIN
// JWT SIGN DIRECTEMENT ICI
// =====================================================

exports.login = async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        // ==============================
        // VALIDATION
        // ==============================

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message:
                    "Email et mot de passe obligatoires"
            });

        }


        const emailNormalise =
            email.trim().toLowerCase();


        // ==============================
        // RECHERCHER USER
        // ==============================

        const user =
            await User.findOne({
                email: emailNormalise
            }).select("+password");


        if (!user) {

            return res.status(401).json({
                success: false,
                message:
                    "Email ou mot de passe incorrect"
            });

        }


        // ==============================
        // VÉRIFIER PASSWORD
        // ==============================

        const passwordCorrect =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordCorrect) {

            return res.status(401).json({
                success: false,
                message:
                    "Email ou mot de passe incorrect"
            });

        }


        // ==============================
        // DERNIÈRE CONNEXION
        // ==============================

        user.derniereConnexion =
            new Date();


        await user.save();


        // =================================================
        // SIGN JWT DIRECTEMENT DANS LOGIN
        // =================================================

        const token = jwt.sign(

            {
                id: user._id.toString(),
                role: user.role
            },

            JWT_SECRET,

            {
                expiresIn: "30d"
            }

        );


        // ==============================
        // RÉPONSE
        // ==============================

        return res.status(200).json({

            success: true,

            message:
                "Connexion réussie",

            token,

            user: formatUser(user)

        });


    } catch (error) {

        console.error(
            "❌ LOGIN ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la connexion"

        });

    }

};


// =====================================================
// GET PROFILE
// =====================================================

exports.getProfile = async (req, res) => {

    try {

        // ==============================
        // VÉRIFIER JWT
        // ==============================

        const decoded =
            verifyToken(req);


        const userId =
            decoded.id;


        // ==============================
        // USER
        // ==============================

        const user =
            await User.findById(userId);


        if (!user) {

            return res.status(404).json({
                success: false,
                message:
                    "Utilisateur introuvable"
            });

        }


        return res.status(200).json({

            success: true,

            user: formatUser(user)

        });


    } catch (error) {

        const jwtResponse =
            handleJwtError(
                error,
                res
            );


        if (jwtResponse) {
            return jwtResponse;
        }


        console.error(
            "❌ GET PROFILE ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la récupération du profil"

        });

    }

};


// =====================================================
// UPDATE PROFILE
// =====================================================

// =====================================================
// URL PUBLIQUE R2
// =====================================================

const R2_PUBLIC_URL =
    'https://pub-d21c8c5e48fb4a35ace1050c88bc8b91.r2.dev';


// =====================================================
// UPDATE PROFILE
// =====================================================

exports.updateProfile = async (req, res) => {

    try {

        console.log("");
        console.log("==============================================");
        console.log("📥 UPDATE PROFILE");
        console.log("==============================================");

        console.log("📦 BODY :", req.body);
        console.log("📸 FILE :", req.file);


        // =================================================
        // JWT
        // =================================================

        const decoded = verifyToken(req);

        console.log("🔐 JWT décodé :", decoded);


        const userId = decoded.id;

        console.log("👤 User ID :", userId);


        // =================================================
        // UTILISATEUR
        // =================================================

        const user =
            await User.findById(userId);


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Utilisateur introuvable"

            });

        }


        console.log(
            "👤 Utilisateur trouvé :",
            user.email
        );


        // =================================================
        // BODY
        // =================================================

        const {
            prenom,
            sexe,
            dateNaissance,
            telephone,
            ville,
            categories,
            notifications,
            langue
        } = req.body || {};


        // =================================================
        // PRÉNOM
        // =================================================

        if (prenom !== undefined) {

            user.prenom =
                typeof prenom === "string"
                    ? prenom.trim()
                    : prenom;

        }


        // =================================================
        // SEXE
        // =================================================

        if (sexe !== undefined) {

            user.sexe = sexe;

        }


        // =================================================
        // DATE DE NAISSANCE
        // =================================================

        if (dateNaissance !== undefined) {

            user.dateNaissance =
                dateNaissance;

        }


        // =================================================
        // TÉLÉPHONE
        // =================================================

        if (telephone !== undefined) {

            user.telephone =
                typeof telephone === "string"
                    ? telephone.trim()
                    : telephone;

        }


        // =================================================
        // VILLE
        // =================================================

        if (ville !== undefined) {

            user.ville =
                typeof ville === "string"
                    ? ville.trim()
                    : ville;

        }


        // =================================================
        // PRÉFÉRENCES
        // =================================================

        if (categories !== undefined) {

            user.preferences.categories =
                categories;

        }


        if (notifications !== undefined) {

            user.preferences.notifications =
                notifications;

        }


        if (langue !== undefined) {

            user.preferences.langue =
                langue;

        }


        // =================================================
        // PHOTO
        // =================================================

        if (req.file) {

            console.log(
                "📸 Photo reçue :",
                req.file.originalname
            );

            console.log(
                "📦 Key R2 :",
                req.file.key
            );

            console.log(
                "🔗 Location Multer :",
                req.file.location
            );


            // =============================================
            // IMPORTANT :
            // NE PAS utiliser req.file.location
            // =============================================

            user.photo =
                `${R2_PUBLIC_URL}/${req.file.key}`;


            console.log(
                "🌍 URL PUBLIQUE :",
                user.photo
            );

        } else {

            console.log(
                "⚠️ Aucune photo reçue par Multer"
            );

        }


        // =================================================
        // PROFIL COMPLET
        // =================================================

        const profilRempli =

            user.prenom &&
            user.sexe &&
            user.dateNaissance &&
            user.telephone &&
            user.ville;


        user.profilComplete =
            Boolean(profilRempli);


        console.log(
            "📋 Profil complet :",
            user.profilComplete
        );


        // =================================================
        // SAUVEGARDE
        // =================================================

        await user.save();


        console.log(
            "💾 Utilisateur sauvegardé dans MongoDB"
        );

        console.log(
            "📸 Photo finale :",
            user.photo
        );


        // =================================================
        // RÉPONSE
        // =================================================

        return res.status(200).json({

            success: true,

            message:
                "Profil mis à jour avec succès",

            user:
                formatUser(user)

        });


    } catch (error) {


        const jwtResponse =
            handleJwtError(
                error,
                res
            );


        if (jwtResponse) {

            return jwtResponse;

        }


        console.error(
            "❌ UPDATE PROFILE ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la mise à jour du profil"

        });

    }

};
// =====================================================
// UPLOAD PHOTO
// Multer + R2
// =====================================================

exports.uploadPhoto = async (req, res) => {

    try {

        // ==============================
        // VÉRIFIER JWT
        // ==============================

        const decoded =
            verifyToken(req);


        const userId =
            decoded.id;


        // ==============================
        // FICHIER
        // ==============================

        if (!req.file) {

            return res.status(400).json({

                success: false,

                message:
                    "Aucune photo reçue"

            });

        }


        // ==============================
        // USER
        // ==============================

        const user =
            await User.findById(userId);


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Utilisateur introuvable"

            });

        }


        // ==============================
        // URL R2
        // ==============================

        user.photo =
            req.file.location;


        await user.save();


        return res.status(200).json({

            success: true,

            message:
                "Photo de profil mise à jour avec succès",

            photo:
                user.photo,

            user:
                formatUser(user)

        });


    } catch (error) {

        const jwtResponse =
            handleJwtError(
                error,
                res
            );


        if (jwtResponse) {
            return jwtResponse;
        }


        console.error(
            "❌ UPLOAD PHOTO ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'upload de la photo"

        });

    }

};


// =====================================================
// FORGOT PASSWORD
// Aucun mail pour l'instant
// =====================================================

exports.forgotPassword = async (req, res) => {

    try {

        const {
            email
        } = req.body;


        // ==============================
        // VALIDATION
        // ==============================

        if (!email) {

            return res.status(400).json({

                success: false,

                message:
                    "Email obligatoire"

            });

        }


        const emailNormalise =
            email.trim().toLowerCase();


        // ==============================
        // USER
        // ==============================

        const user =
            await User.findOne({
                email: emailNormalise
            }).select(
                "+resetPasswordToken +resetPasswordExpires"
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Aucun compte associé à cet email"

            });

        }


        // ==============================
        // TOKEN RESET
        // ==============================

        const resetToken =
            crypto
                .randomBytes(32)
                .toString("hex");


        // ==============================
        // HASH TOKEN
        // ==============================

        const hashedToken =
            crypto
                .createHash("sha256")
                .update(resetToken)
                .digest("hex");


        user.resetPasswordToken =
            hashedToken;


        // ==============================
        // EXPIRATION
        // 15 MINUTES
        // ==============================

        user.resetPasswordExpires =
            Date.now() +
            15 * 60 * 1000;


        await user.save();


        // ==============================
        // TEMPORAIRE POUR TEST
        // À SUPPRIMER APRÈS INTÉGRATION
        // EMAIL
        // ==============================

        return res.status(200).json({

            success: true,

            message:
                "Token de réinitialisation généré",

            resetToken

        });


    } catch (error) {

        console.error(
            "❌ FORGOT PASSWORD ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la demande de réinitialisation"

        });

    }

};


// =====================================================
// RESET PASSWORD
// =====================================================

exports.resetPassword = async (req, res) => {

    try {

        const {
            token
        } = req.params;


        const {
            password
        } = req.body;


        // ==============================
        // VALIDATION TOKEN
        // ==============================

        if (!token) {

            return res.status(400).json({

                success: false,

                message:
                    "Token manquant"

            });

        }


        // ==============================
        // VALIDATION PASSWORD
        // ==============================

        if (!password) {

            return res.status(400).json({

                success: false,

                message:
                    "Nouveau mot de passe obligatoire"

            });

        }


        if (password.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "Le mot de passe doit contenir au moins 6 caractères"

            });

        }


        // ==============================
        // HASH TOKEN
        // ==============================

        const hashedToken =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");


        // ==============================
        // RECHERCHE TOKEN
        // ==============================

        const user =
            await User.findOne({

                resetPasswordToken:
                    hashedToken,

                resetPasswordExpires: {
                    $gt: Date.now()
                }

            }).select(
                "+resetPasswordToken +resetPasswordExpires"
            );


        if (!user) {

            return res.status(400).json({

                success: false,

                message:
                    "Token invalide ou expiré"

            });

        }


        // ==============================
        // HASH NOUVEAU PASSWORD
        // ==============================

        user.password =
            await bcrypt.hash(
                password,
                12
            );


        // ==============================
        // SUPPRIMER TOKEN RESET
        // ==============================

        user.resetPasswordToken =
            null;

        user.resetPasswordExpires =
            null;


        await user.save();


        return res.status(200).json({

            success: true,

            message:
                "Mot de passe réinitialisé avec succès"

        });


    } catch (error) {

        console.error(
            "❌ RESET PASSWORD ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la réinitialisation du mot de passe"

        });

    }

};


// =====================================================
// CHANGE PASSWORD
// =====================================================

exports.changePassword = async (req, res) => {

    try {

        // ==============================
        // VÉRIFIER JWT
        // ==============================

        const decoded =
            verifyToken(req);


        const userId =
            decoded.id;


        // ==============================
        // DATA
        // ==============================

        const {
            currentPassword,
            newPassword
        } = req.body;


        if (
            !currentPassword ||
            !newPassword
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Ancien et nouveau mot de passe obligatoires"

            });

        }


        if (newPassword.length < 6) {

            return res.status(400).json({

                success: false,

                message:
                    "Le nouveau mot de passe doit contenir au moins 6 caractères"

            });

        }


        // ==============================
        // USER
        // ==============================

        const user =
            await User.findById(userId)
                .select("+password");


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Utilisateur introuvable"

            });

        }


        // ==============================
        // ANCIEN PASSWORD
        // ==============================

        const passwordCorrect =
            await bcrypt.compare(
                currentPassword,
                user.password
            );


        if (!passwordCorrect) {

            return res.status(401).json({

                success: false,

                message:
                    "Ancien mot de passe incorrect"

            });

        }


        // ==============================
        // NOUVEAU PASSWORD
        // ==============================

        user.password =
            await bcrypt.hash(
                newPassword,
                12
            );


        await user.save();


        return res.status(200).json({

            success: true,

            message:
                "Mot de passe modifié avec succès"

        });


    } catch (error) {

        const jwtResponse =
            handleJwtError(
                error,
                res
            );


        if (jwtResponse) {
            return jwtResponse;
        }


        console.error(
            "❌ CHANGE PASSWORD ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors du changement du mot de passe"

        });

    }

};


// =====================================================
// DELETE ACCOUNT
// =====================================================

exports.deleteAccount = async (req, res) => {

    try {

        // ==============================
        // VÉRIFIER JWT
        // ==============================

        const decoded =
            verifyToken(req);


        const userId =
            decoded.id;


        // ==============================
        // USER
        // ==============================

        const user =
            await User.findById(userId);


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "Utilisateur introuvable"

            });

        }


        // ==============================
        // SUPPRESSION
        // ==============================

        await User.findByIdAndDelete(
            userId
        );


        return res.status(200).json({

            success: true,

            message:
                "Compte supprimé avec succès"

        });


    } catch (error) {

        const jwtResponse =
            handleJwtError(
                error,
                res
            );


        if (jwtResponse) {
            return jwtResponse;
        }


        console.error(
            "❌ DELETE ACCOUNT ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la suppression du compte"

        });

    }

};