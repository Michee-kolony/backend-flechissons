const { abonnerAppareil } = require('../services/notification');


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
