const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const r2 = require('../config/r2');

exports.register = (req, res) => {

    const { nom, email, password, role } = req.body;

    // Rôle inconnu ou absent : simple admin
    const roleFinal = Admin.ROLES.includes(role) ? role : 'admin';

    bcrypt.hash(password, 10)
        .then(passwordHash => {

            const admin = new Admin({
                nom: nom,
                email: email,
                password: passwordHash,
                role: roleFinal
            });

            return admin.save();

        })
        .then(admin => {

            res.status(201).json({
                message: "Administrateur créé avec succès",
                admin: {
                    id: admin._id,
                    nom: admin.nom,
                    email: admin.email,
                    role: admin.role
                }
            });

        })
        .catch(error => {

            console.error("Erreur création admin :", error);

            res.status(500).json({
                message: "Erreur serveur",
                error: error.message
            });

        });
};

exports.login = (req, res) => {

    const { email, password } = req.body;

    Admin.findOne({ email: email })
        .then(admin => {

            if (!admin) {
                return res.status(404).json({
                    message: "Email ou mot de passe incorrect"
                });
            }

            return bcrypt.compare(password, admin.password)
                .then(passwordCorrect => {

                    if (!passwordCorrect) {
                        return res.status(401).json({
                            message: "Email ou mot de passe incorrect"
                        });
                    }

                    const token = jwt.sign(
                        {
                            adminId: admin._id,
                            email: admin.email
                        },
                        'KINOVA_ADMIN_JWT_SECRET_2026',
                        {
                            expiresIn: '7d'
                        }
                    );

                    res.status(200).json({
                        message: "Connexion réussie",
                        token: token,
                        admin: admin.profilPublic()
                    });

                });

        })
        .catch(error => {

            console.error("Erreur login admin :", error);

            res.status(500).json({
                message: "Erreur serveur",
                error: error.message
            });

        });
};

exports.getalladmin = (req, res)=>{

    Admin.find().select('-password')
         .then(data=>res.status(200).json(data))
         .catch(error=>res.status(500).json(error))

}

exports.deleteAdmin = (req, res)=>{

    if (req.params.id === String(req.adminId)) {
        return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte" });
    }

    Admin.findByIdAndDelete(req.params.id)
         .then(admin=>{

            if (!admin) {
                return res.status(404).json({ message: "Administrateur introuvable" });
            }

            // Photo de profil supprimée du bucket R2 (un échec n'annule pas la suppression du compte)
            return supprimerFichierR2(clePhotoAdmin(admin)).then(() =>
                res.status(200).json({ message: "Administrateur supprimé avec succès" })
            );

         })
         .catch(error=>res.status(500).json({ message: "Erreur serveur", error: error.message }))

}


// =====================================================
// COMPTE CONNECTÉ
// GET /auth/moi
// Permet à l'interface de relire le rôle à jour
// (ex : un admin promu trésorier sans avoir à se reconnecter)
// =====================================================

exports.moi = (req, res) => {

    Admin.findById(req.adminId).select('-password')
         .then(admin => {

            if (!admin) {
                return res.status(404).json({ message: "Administrateur introuvable" });
            }

            res.status(200).json(admin.profilPublic());

         })
         .catch(error => res.status(500).json({ message: "Erreur serveur", error: error.message }));

}


// =====================================================
// MODIFIER SON PROPRE PROFIL
// PUT /auth/moi   (multipart : nom, email, telephone, titre, bio, photo?, supprimerPhoto?)
// Le rôle n'est jamais modifiable ici.
// =====================================================

const supprimerFichierR2 = async (key) => {
    if (!key) return;
    try {
        await r2.send(new DeleteObjectCommand({ Bucket: r2.parametres.bucket, Key: key }));
    } catch (error) {
        console.error(`❌ Suppression photo admin R2 (${key}) :`, error.message);
    }
};

// Clé R2 de la photo : `photoKey`, ou déduite de l'URL si elle est sur notre bucket
// (jamais une URL externe)
function clePhotoAdmin(admin) {
    if (admin.photoKey) return admin.photoKey;
    const prefixe = `${r2.parametres.publicUrl}/`;
    return admin.photo && admin.photo.startsWith(prefixe) ? admin.photo.slice(prefixe.length) : '';
}

const EMAIL_VALIDE =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.modifierProfil = async (req, res) => {

    // Nouvelle photo déjà envoyée sur R2 par multer : à supprimer si on refuse la requête
    const nouvelleKey = req.file ? req.file.key : '';

    const refuser = async (statut, message) => {
        await supprimerFichierR2(nouvelleKey);
        return res.status(statut).json({ message });
    };

    try {

        const admin = await Admin.findById(req.adminId);

        if (!admin) {
            return refuser(404, "Administrateur introuvable");
        }

        const { nom, email, telephone, titre, bio, supprimerPhoto } = req.body;

        if (nom !== undefined) {
            const valeur = String(nom).trim();
            if (valeur.length < 2 || valeur.length > 80) {
                return refuser(400, "Le nom doit contenir entre 2 et 80 caractères.");
            }
            admin.nom = valeur;
        }

        if (email !== undefined) {
            const valeur = String(email).trim().toLowerCase();
            if (!EMAIL_VALIDE.test(valeur)) {
                return refuser(400, "Adresse e-mail invalide.");
            }
            if (valeur !== String(admin.email).toLowerCase()) {
                const pris = await Admin.exists({ email: valeur, _id: { $ne: admin._id } });
                if (pris) {
                    return refuser(409, "Cette adresse e-mail est déjà utilisée par un autre administrateur.");
                }
            }
            admin.email = valeur;
        }

        const champsTexte = { telephone: 30, titre: 60, bio: 500 };
        const valeurs = { telephone, titre, bio };

        for (const [champ, max] of Object.entries(champsTexte)) {
            if (valeurs[champ] === undefined) continue;
            const valeur = String(valeurs[champ]).trim();
            if (valeur.length > max) {
                return refuser(400, `Le champ « ${champ} » ne doit pas dépasser ${max} caractères.`);
            }
            admin[champ] = valeur;
        }

        // Photo : remplacement ou suppression
        let ancienneKey = '';

        if (req.file) {
            ancienneKey = admin.photoKey;
            admin.photoKey = req.file.key;
            admin.photo = `${r2.parametres.publicUrl}/${req.file.key}`;
        } else if (supprimerPhoto === 'true' || supprimerPhoto === true) {
            ancienneKey = admin.photoKey;
            admin.photoKey = '';
            admin.photo = '';
        }

        await admin.save();

        await supprimerFichierR2(ancienneKey);

        return res.status(200).json({
            message: "Profil mis à jour.",
            admin: admin.profilPublic()
        });

    } catch (error) {
        console.error("Erreur modification profil admin :", error);
        await supprimerFichierR2(nouvelleKey);
        return res.status(500).json({ message: "Erreur serveur", error: error.message });
    }

};


// =====================================================
// CHANGER SON MOT DE PASSE
// PUT /auth/moi/mot-de-passe   { actuel, nouveau }
// =====================================================

exports.changerMotDePasse = async (req, res) => {

    try {

        const { actuel, nouveau } = req.body;

        if (!actuel || !nouveau) {
            return res.status(400).json({ message: "Renseignez le mot de passe actuel et le nouveau." });
        }

        if (String(nouveau).length < 8) {
            return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
        }

        const admin = await Admin.findById(req.adminId);

        if (!admin) {
            return res.status(404).json({ message: "Administrateur introuvable" });
        }

        const correct = await bcrypt.compare(String(actuel), admin.password);

        if (!correct) {
            return res.status(401).json({ message: "Mot de passe actuel incorrect." });
        }

        admin.password = await bcrypt.hash(String(nouveau), 10);
        await admin.save();

        return res.status(200).json({ message: "Mot de passe modifié." });

    } catch (error) {
        console.error("Erreur changement mot de passe admin :", error);
        return res.status(500).json({ message: "Erreur serveur", error: error.message });
    }

};


// =====================================================
// CHANGER LE RÔLE D'UN ADMINISTRATEUR (SUPERADMIN)
// PATCH /auth/:id/role   { role: 'admin' | 'tresorier' | 'superadmin' }
// =====================================================

exports.changerRole = (req, res) => {

    const { role } = req.body;

    if (!Admin.ROLES.includes(role)) {
        return res.status(400).json({ message: "Rôle invalide" });
    }

    // Un superadmin ne peut pas se retirer ses propres droits
    if (req.params.id === String(req.adminId)) {
        return res.status(400).json({ message: "Vous ne pouvez pas modifier votre propre rôle" });
    }

    Admin.findByIdAndUpdate(req.params.id, { role }, { returnDocument: 'after', runValidators: true })
         .select('-password')
         .then(admin => {

            if (!admin) {
                return res.status(404).json({ message: "Administrateur introuvable" });
            }

            res.status(200).json({ message: "Rôle mis à jour", admin });

         })
         .catch(error => res.status(500).json({ message: "Erreur serveur", error: error.message }));

}
