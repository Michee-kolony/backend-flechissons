const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Notification = require('../models/notification');
const { abonnerAppareil } = require('../services/notification');

const JWT_SECRET =
    process.env.JWT_SECRET || 'RANDOM_TOKEN_FLECHISSONS';

const TAILLE_PAGE = 30;

// Identifiant du compte connecté, ou null pour un visiteur
// (token absent ou invalide : la liste reste accessible)
const utilisateurConnecte = (req) => {

    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return null;
    }

    try {
        const id = jwt.verify(header.split(' ')[1], JWT_SECRET).id;
        return mongoose.Types.ObjectId.isValid(id) ? id : null;
    } catch {
        return null;
    }

};


// =====================================================
// ABONNER UN APPAREIL AUX NOTIFICATIONS GÉNÉRALES
// =====================================================
// POST /notification/abonnement
// Body : { token }
// Route publique : l'application est en libre accès,
// un visiteur non connecté reçoit aussi les nouvelles
// publications et les nouveaux audios.
// =====================================================

exports.abonner = async (req, res) => {

    const token =
        typeof req.body.token === 'string'
            ? req.body.token.trim()
            : '';

    if (!token || token.length > 4096) {

        return res.status(400).json({
            success: false,
            message: 'Le token FCM est obligatoire'
        });

    }

    const ok = await abonnerAppareil(token);

    if (!ok) {

        return res.status(400).json({
            success: false,
            message: 'Impossible d\'abonner cet appareil'
        });

    }

    return res.status(200).json({
        success: true,
        message: 'Appareil abonné aux notifications'
    });

};


// =====================================================
// LISTE DES NOTIFICATIONS
// =====================================================
// GET /notification?avant=<date ISO>
// Visiteur : nouveautés (publications, audios, lives).
// Connecté : nouveautés + ses likes, commentaires, paiements.
// Pagination : "avant" = createdAt de la dernière reçue.
// =====================================================

exports.lister = async (req, res) => {

    try {

        const userId = utilisateurConnecte(req);

        const filtre = {
            destinataire: userId ? { $in: [null, userId] } : null
        };

        const avant = req.query.avant ? new Date(req.query.avant) : null;

        if (avant && !isNaN(avant.getTime())) {
            filtre.createdAt = { $lt: avant };
        }

        const notifications = await Notification.find(filtre)
            .sort({ createdAt: -1 })
            .limit(TAILLE_PAGE)
            .select('type titre message route image createdAt')
            .lean();

        return res.status(200).json({
            success: true,
            notifications,
            fin: notifications.length < TAILLE_PAGE
        });

    } catch (error) {

        console.error('❌ Erreur liste notifications :', error.message);

        return res.status(500).json({
            success: false,
            message: 'Impossible de charger les notifications'
        });

    }

};
