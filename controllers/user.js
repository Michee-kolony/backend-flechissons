const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../models/user");
const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const r2 = require("../config/r2");
const transporter = require("../config/mail");
const { synchroniserAbonnementUtilisateur } = require("../services/notification");


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
// GET TOUS LES UTILISATEURS
// =====================================================

exports.getUsers = async (req, res) => {

    try {

        // ==============================================
        // RÉCUPÉRER TOUS LES UTILISATEURS
        // ==============================================

        const users = await User
            .find()
            .sort({ createdAt: -1 });


        // ==============================================
        // FORMATER LES UTILISATEURS
        // ==============================================

        const utilisateurs = users.map(user =>
            formatUser(user)
        );


        // ==============================================
        // RÉPONSE
        // ==============================================

        return res.status(200).json({

            success: true,

            message:
                "Utilisateurs récupérés avec succès",

            total:
                utilisateurs.length,

            utilisateurs

        });

    } catch (error) {

        console.error(
            "❌ GET USERS ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la récupération des utilisateurs"

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
// SUPPRIMER UNE PHOTO DU BUCKET R2
// Ne touche qu'aux fichiers hébergés sur notre bucket
// (ignore les URLs externes, ex: avatar Google)
// =====================================================

const supprimerPhotoR2 = async (photoUrl) => {

    if (!photoUrl || !photoUrl.startsWith(`${R2_PUBLIC_URL}/`)) {
        return;
    }

    const key = photoUrl.replace(`${R2_PUBLIC_URL}/`, "");

    try {

        await r2.send(
            new DeleteObjectCommand({
                Bucket: "flechissons",
                Key: key
            })
        );

        console.log(`🗑️ Photo R2 supprimée : ${key}`);

    } catch (error) {

        // On ne bloque pas la mise à jour du profil si la suppression échoue
        console.error(
            `❌ Erreur suppression photo R2 (${key}) :`,
            error.message
        );

    }

};


// =====================================================
// UPDATE PROFILE
// =====================================================

exports.updateProfile = async (req, res) => {

    let anciennePhoto = null;

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
            nom,
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
        // NOM
        // =================================================

        if (nom !== undefined) {

            const nomNettoye =
                typeof nom === "string"
                    ? nom.trim()
                    : "";

            if (!nomNettoye) {

                if (req.file && req.file.key) {
                    await supprimerPhotoR2(
                        `${R2_PUBLIC_URL}/${req.file.key}`
                    );
                }

                return res.status(400).json({

                    success: false,

                    message:
                        "Le nom ne peut pas être vide"

                });

            }

            if (nomNettoye.length > 50) {

                if (req.file && req.file.key) {
                    await supprimerPhotoR2(
                        `${R2_PUBLIC_URL}/${req.file.key}`
                    );
                }

                return res.status(400).json({

                    success: false,

                    message:
                        "Le nom ne peut pas dépasser 50 caractères"

                });

            }

            user.nom = nomNettoye;

        }


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

            // Mémoriser l'ancienne photo pour la supprimer
            // une fois le profil sauvegardé
            anciennePhoto = user.photo;

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


        // Préférence notifications modifiée : abonner ou
        // désabonner ses appareils des notifications générales
        if (notifications !== undefined) {

            synchroniserAbonnementUtilisateur(user._id);

        }


        // =================================================
        // SUPPRIMER L'ANCIENNE PHOTO DU BUCKET
        // =================================================

        if (anciennePhoto && anciennePhoto !== user.photo) {

            await supprimerPhotoR2(anciennePhoto);

        }

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


        // =================================================
        // ÉCHEC : SUPPRIMER LA NOUVELLE PHOTO DÉJÀ UPLOADÉE
        // (évite les fichiers orphelins dans le bucket)
        // =================================================

        if (req.file && req.file.key) {

            await supprimerPhotoR2(
                `${R2_PUBLIC_URL}/${req.file.key}`
            );

        }


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
// MOT DE PASSE OUBLIÉ — CODE PAR E-MAIL
//
// 1. POST /user/forgot-password      { email }
//    → envoie un code à 6 chiffres (valable 10 min)
// 2. POST /user/verify-reset-code    { email, code }
//    → vérifie le code (étape intermédiaire de l'app)
// 3. POST /user/reset-password       { email, code, password }
//    → enregistre le nouveau mot de passe
// =====================================================

const RESET_CODE_DUREE_MS = 10 * 60 * 1000;
const RESET_CODE_DELAI_RENVOI_MS = 60 * 1000;
const RESET_CODE_ESSAIS_MAX = 5;

const RESET_FIELDS =
    "+resetPasswordToken +resetPasswordExpires +resetPasswordAttempts +resetPasswordSentAt";


const hashResetCode = (code) =>
    crypto
        .createHash("sha256")
        .update(String(code))
        .digest("hex");


const effacerResetCode = (user) => {

    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.resetPasswordAttempts = 0;
    user.resetPasswordSentAt = null;

};


// =====================================================
// E-MAIL DU CODE
// =====================================================

const envoyerEmailResetCode = (user, code) => {

    const prenom =
        user.prenom || user.nom || "";

    return transporter.sendMail({

        from: transporter.from,

        to: user.email,

        subject: "Votre code de réinitialisation — Fléchissons",

        text:
            `Bonjour ${prenom},\n\n` +
            `Votre code de réinitialisation est : ${code}\n\n` +
            `Ce code expire dans 10 minutes.\n` +
            `Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,

        html: `
        <div style="margin:0;padding:32px 16px;background:#46515e;font-family:Arial,Helvetica,sans-serif">
          <div style="max-width:440px;margin:0 auto;background:#343c47;border-radius:16px;padding:32px 28px;color:#ffffff">
            <h2 style="margin:0 0 20px;font-size:22px;color:#ffffff">Fléchissons</h2>
            <p style="margin:0 0 8px;color:#c3cbd4;font-size:15px">Bonjour ${prenom},</p>
            <p style="margin:0 0 24px;color:#c3cbd4;font-size:15px">Voici votre code pour réinitialiser votre mot de passe :</p>
            <div style="margin:0 0 24px;padding:18px 0;text-align:center;background:#46515e;border-radius:12px;font-size:38px;font-weight:700;letter-spacing:10px;color:#f8893d">${code}</div>
            <p style="margin:0 0 8px;color:#c3cbd4;font-size:13px">Ce code expire dans 10 minutes.</p>
            <p style="margin:0;color:#c3cbd4;font-size:13px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>
          </div>
        </div>
        `

    });

};


// =====================================================
// CONTRÔLE DU CODE (partagé verify / reset)
// Renvoie { user } ou { status, body } en cas d'erreur
// =====================================================

const controlerResetCode = async (email, code) => {

    if (!email || !code) {

        return {
            status: 400,
            body: {
                success: false,
                code: "FIELDS_REQUIRED",
                message: "E-mail et code obligatoires"
            }
        };

    }


    const user =
        await User.findOne({
            email: String(email).trim().toLowerCase()
        }).select(RESET_FIELDS);


    if (
        !user ||
        !user.resetPasswordToken ||
        !user.resetPasswordExpires
    ) {

        return {
            status: 400,
            body: {
                success: false,
                code: "CODE_INVALID",
                message: "Code invalide. Demandez un nouveau code."
            }
        };

    }


    // ==============================
    // EXPIRÉ
    // ==============================

    if (new Date(user.resetPasswordExpires).getTime() < Date.now()) {

        effacerResetCode(user);
        await user.save();

        return {
            status: 400,
            body: {
                success: false,
                code: "CODE_EXPIRED",
                message: "Ce code a expiré. Demandez un nouveau code."
            }
        };

    }


    // ==============================
    // TROP D'ESSAIS
    // ==============================

    if (user.resetPasswordAttempts >= RESET_CODE_ESSAIS_MAX) {

        effacerResetCode(user);
        await user.save();

        return {
            status: 429,
            body: {
                success: false,
                code: "TOO_MANY_ATTEMPTS",
                message: "Trop d'essais. Demandez un nouveau code."
            }
        };

    }


    // ==============================
    // COMPARAISON
    // ==============================

    const codeCorrect =
        crypto.timingSafeEqual(
            Buffer.from(hashResetCode(String(code).trim())),
            Buffer.from(user.resetPasswordToken)
        );


    if (!codeCorrect) {

        user.resetPasswordAttempts += 1;
        await user.save();

        const restants =
            RESET_CODE_ESSAIS_MAX - user.resetPasswordAttempts;

        return {
            status: 400,
            body: {
                success: false,
                code: "CODE_INCORRECT",
                message: restants > 0
                    ? `Code incorrect. ${restants} essai${restants > 1 ? "s" : ""} restant${restants > 1 ? "s" : ""}.`
                    : "Code incorrect. Demandez un nouveau code.",
                attemptsLeft: restants
            }
        };

    }


    return { user };

};


// =====================================================
// FORGOT PASSWORD
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

                code: "EMAIL_REQUIRED",

                message:
                    "Email obligatoire"

            });

        }


        const emailNormalise =
            String(email).trim().toLowerCase();


        // ==============================
        // USER
        // ==============================

        const user =
            await User.findOne({
                email: emailNormalise
            }).select(RESET_FIELDS);


        if (!user) {

            return res.status(404).json({

                success: false,

                code: "USER_NOT_FOUND",

                message:
                    "Aucun compte associé à cet email"

            });

        }


        // ==============================
        // ANTI-SPAM : 1 ENVOI / MINUTE
        // ==============================

        const depuisDernierEnvoi =
            user.resetPasswordSentAt
                ? Date.now() - new Date(user.resetPasswordSentAt).getTime()
                : Infinity;


        if (depuisDernierEnvoi < RESET_CODE_DELAI_RENVOI_MS) {

            const attente =
                Math.ceil(
                    (RESET_CODE_DELAI_RENVOI_MS - depuisDernierEnvoi) / 1000
                );

            return res.status(429).json({

                success: false,

                code: "TOO_SOON",

                message:
                    `Veuillez patienter ${attente} s avant de demander un nouveau code.`,

                retryAfter: attente

            });

        }


        // ==============================
        // CODE 6 CHIFFRES
        // ==============================

        const code =
            crypto
                .randomInt(0, 1000000)
                .toString()
                .padStart(6, "0");


        user.resetPasswordToken =
            hashResetCode(code);

        user.resetPasswordExpires =
            Date.now() + RESET_CODE_DUREE_MS;

        user.resetPasswordAttempts = 0;

        user.resetPasswordSentAt =
            new Date();


        await user.save();


        // ==============================
        // ENVOI E-MAIL
        // ==============================

        try {

            await envoyerEmailResetCode(user, code);

        } catch (mailError) {

            console.error(
                "❌ FORGOT PASSWORD MAIL ERROR :",
                mailError
            );

            effacerResetCode(user);
            await user.save();

            return res.status(502).json({

                success: false,

                code: "MAIL_ERROR",

                message:
                    "Impossible d'envoyer l'e-mail. Veuillez réessayer."

            });

        }


        return res.status(200).json({

            success: true,

            message:
                "Un code de réinitialisation a été envoyé par e-mail",

            expiresIn: RESET_CODE_DUREE_MS / 1000,

            retryAfter: RESET_CODE_DELAI_RENVOI_MS / 1000

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
// VERIFY RESET CODE
// =====================================================

exports.verifyResetCode = async (req, res) => {

    try {

        const {
            email,
            code
        } = req.body;


        const resultat =
            await controlerResetCode(email, code);


        if (!resultat.user) {

            return res
                .status(resultat.status)
                .json(resultat.body);

        }


        return res.status(200).json({

            success: true,

            message:
                "Code valide"

        });


    } catch (error) {

        console.error(
            "❌ VERIFY RESET CODE ERROR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de la vérification du code"

        });

    }

};


// =====================================================
// RESET PASSWORD
// =====================================================

exports.resetPassword = async (req, res) => {

    try {

        const {
            email,
            code,
            password
        } = req.body;


        // ==============================
        // VALIDATION PASSWORD
        // ==============================

        if (!password) {

            return res.status(400).json({

                success: false,

                code: "PASSWORD_REQUIRED",

                message:
                    "Nouveau mot de passe obligatoire"

            });

        }


        if (password.length < 6) {

            return res.status(400).json({

                success: false,

                code: "PASSWORD_TOO_SHORT",

                message:
                    "Le mot de passe doit contenir au moins 6 caractères"

            });

        }


        // ==============================
        // VÉRIFIER LE CODE
        // ==============================

        const resultat =
            await controlerResetCode(email, code);


        if (!resultat.user) {

            return res
                .status(resultat.status)
                .json(resultat.body);

        }


        const user = resultat.user;


        // ==============================
        // HASH NOUVEAU PASSWORD
        // ==============================

        user.password =
            await bcrypt.hash(
                password,
                12
            );


        // ==============================
        // SUPPRIMER CODE RESET
        // ==============================

        effacerResetCode(user);


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

// =====================================================
// ENREGISTRER LE TOKEN FCM DE L'APPAREIL
// =====================================================
// POST /user/fcm-token
// Body : { token }
// Appelé par l'application après la connexion
// =====================================================

exports.registerFcmToken = async (req, res) => {

    try {

        // ==============================
        // VÉRIFIER JWT
        // ==============================

        const decoded =
            verifyToken(req);

        const userId =
            decoded.id;


        // ==============================
        // VALIDATION
        // ==============================

        const token =
            typeof req.body.token === "string"
                ? req.body.token.trim()
                : "";

        if (!token) {

            return res.status(400).json({
                success: false,
                message:
                    "Le token FCM est obligatoire"
            });

        }


        // ==============================
        // UN APPAREIL = UN SEUL COMPTE
        // Si un autre compte s'est connecté
        // sur ce téléphone avant, on lui retire
        // ==============================

        await User.updateMany(
            {
                _id: { $ne: userId },
                fcmTokens: token
            },
            {
                $pull: { fcmTokens: token }
            }
        );


        // ==============================
        // AJOUTER LE TOKEN (SANS DOUBLON)
        // ==============================

        const user =
            await User.findByIdAndUpdate(
                userId,
                {
                    $addToSet: { fcmTokens: token }
                },
                { new: true }
            );

        if (!user) {

            return res.status(404).json({
                success: false,
                message:
                    "Utilisateur introuvable"
            });

        }


        // Notifications générales selon la préférence du compte
        await synchroniserAbonnementUtilisateur(userId);


        return res.status(200).json({
            success: true,
            message:
                "Token FCM enregistré"
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
            "❌ REGISTER FCM TOKEN ERROR :",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Erreur lors de l'enregistrement du token FCM"
        });

    }

};


// =====================================================
// SUPPRIMER LE TOKEN FCM DE L'APPAREIL
// =====================================================
// DELETE /user/fcm-token
// Body : { token }
// Appelé par l'application à la déconnexion
// =====================================================

exports.removeFcmToken = async (req, res) => {

    try {

        // ==============================
        // VÉRIFIER JWT
        // ==============================

        const decoded =
            verifyToken(req);

        const userId =
            decoded.id;


        // ==============================
        // VALIDATION
        // ==============================

        const token =
            typeof req.body.token === "string"
                ? req.body.token.trim()
                : "";

        if (!token) {

            return res.status(400).json({
                success: false,
                message:
                    "Le token FCM est obligatoire"
            });

        }


        // ==============================
        // RETIRER LE TOKEN
        // ==============================

        await User.updateOne(
            { _id: userId },
            {
                $pull: { fcmTokens: token }
            }
        );


        return res.status(200).json({
            success: true,
            message:
                "Token FCM supprimé"
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
            "❌ REMOVE FCM TOKEN ERROR :",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Erreur lors de la suppression du token FCM"
        });

    }

};
