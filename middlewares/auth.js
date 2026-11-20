const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

exports.auth = (req, res, next) => {

    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Authentification requise" });
    }

    try {
        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, 'KINOVA_ADMIN_JWT_SECRET_2026');
        req.adminId = decoded.adminId;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token invalide ou expiré" });
    }
};

exports.superAdmin = (req, res, next) => {

    Admin.findById(req.adminId)
        .then(admin => {

            if (!admin || admin.role !== 'superadmin') {
                return res.status(403).json({ message: "Accès réservé au superadmin" });
            }

            next();

        })
        .catch(error => res.status(500).json({ message: "Erreur serveur", error: error.message }));
};

// Trésorerie de l'église :
// - le trésorier consulte et gère les opérations (ajout, modification, suppression)
// - le superadmin ajoute les trésoriers et consulte la trésorerie en lecture seule
// L'administrateur connecté est joint à la requête (req.admin) pour tracer qui saisit quoi.
const exigerRoles = (roles, message) => (req, res, next) => {

    Admin.findById(req.adminId)
        .select('-password')
        .then(admin => {

            if (!admin || !roles.includes(admin.role)) {
                return res.status(403).json({ message });
            }

            req.admin = admin;
            next();

        })
        .catch(error => res.status(500).json({ message: "Erreur serveur", error: error.message }));
};

// Consultation (soldes, liste, export) : trésorier ou superadmin
exports.lectureTresorerie = exigerRoles(
    ['tresorier', 'superadmin'],
    "Accès réservé au trésorier et au superadmin"
);

// Écriture (ajout, modification, suppression) : trésorier uniquement
exports.tresorier = exigerRoles(
    ['tresorier'],
    "Seul le trésorier peut modifier la trésorerie"
);
