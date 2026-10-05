const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.register = (req, res) => {

    const { nom, email, password } = req.body;

    bcrypt.hash(password, 10)
        .then(passwordHash => {

            const admin = new Admin({
                nom: nom,
                email: email,
                password: passwordHash
            });

            return admin.save();

        })
        .then(admin => {

            res.status(201).json({
                message: "Administrateur créé avec succès",
                admin: {
                    id: admin._id,
                    nom: admin.nom,
                    email: admin.email
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
                        admin: {
                            id: admin._id,
                            nom: admin.nom,
                            email: admin.email,
                            role: admin.role
                        }
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

    Admin.find()
         .then(data=>res.status(200).json(data))
         .catch(error=>res.status(500).json(error))

}