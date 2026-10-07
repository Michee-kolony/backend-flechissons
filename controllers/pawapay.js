const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const Paiement = require('../models/paiement');
require('../models/user'); // pour populate('utilisateurId')
const {
    getLimitesOperateur,
    formaterMontant,
    initierDepot,
    getDepot
} = require('../services/pawapay');
const { envoyerAUtilisateurs } = require('../services/notification');


// =====================================================
// CONFIG
// =====================================================

const JWT_SECRET =
    process.env.JWT_SECRET || 'RANDOM_TOKEN_FLECHISSONS';

// Statut PawaPay → statut simplifié de l'application
const STATUTS = {
    COMPLETED: 'reussi',
    FAILED: 'echoue',
    REJECTED: 'echoue',
    ACCEPTED: 'en_attente',
    PROCESSING: 'en_attente',
    IN_RECONCILIATION: 'en_attente',
    DUPLICATE_IGNORED: 'en_attente'
};

// Raisons d'échec PawaPay → message pour le fidèle
const MESSAGES_ECHEC = {
    PAYMENT_NOT_APPROVED: 'Le paiement n\'a pas été validé sur votre téléphone (code PIN non saisi ou annulé).',
    INSUFFICIENT_BALANCE: 'Solde Mobile Money insuffisant.',
    PAYER_NOT_FOUND: 'Ce numéro n\'a pas de compte Mobile Money chez cet opérateur.',
    INVALID_PHONE_NUMBER: 'Numéro de téléphone invalide pour cet opérateur.',
    PAYER_LIMIT_REACHED: 'Votre limite de transactions Mobile Money est atteinte.',
    AMOUNT_OUT_OF_BOUNDS: 'Montant hors des limites autorisées par l\'opérateur.',
    INVALID_AMOUNT: 'Montant invalide.',
    INVALID_CURRENCY: 'Devise non acceptée par cet opérateur.',
    PROVIDER_TEMPORARILY_UNAVAILABLE: 'L\'opérateur est momentanément indisponible. Réessayez plus tard.'
};

const MESSAGE_ECHEC_DEFAUT =
    'Le paiement a échoué. Veuillez réessayer.';

// Statut redemandé à PawaPay si aucun callback n'est arrivé après ce délai
const DELAI_VERIFICATION_MS = 15 * 1000;


// =====================================================
// OUTILS
// =====================================================

// Compte facultatif : l'application est en libre accès
const getUtilisateurId = (req) => {

    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return null;
    }

    try {
        return jwt.verify(header.split(' ')[1], JWT_SECRET).id || null;
    } catch {
        return null;
    }

};

// "0812345678", "812345678", "+243 812 345 678" → "243812345678"
const normaliserTelephone = (valeur) => {

    let chiffres = String(valeur || '').replace(/\D/g, '');

    if (chiffres.startsWith('243')) {
        chiffres = chiffres.slice(3);
    }

    if (chiffres.startsWith('0')) {
        chiffres = chiffres.slice(1);
    }

    return /^\d{9}$/.test(chiffres) ? `243${chiffres}` : null;

};

const genererReference = () =>
    `DON-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

// Ce que l'application et l'admin peuvent voir d'un paiement
const formatPaiement = (paiement) => ({
    depositId: paiement.depositId,
    reference: paiement.reference,
    type: paiement.type,
    objet: paiement.objet,
    montant: paiement.montant,
    devise: paiement.devise,
    operateur: paiement.operateur,
    statut: paiement.statut,
    message:
        paiement.statut === 'echoue'
            ? (MESSAGES_ECHEC[paiement.echec?.code] || MESSAGE_ECHEC_DEFAUT)
            : null,
    createdAt: paiement.createdAt,
    dateFinalisation: paiement.dateFinalisation
});

// Remercie le fidèle connecté quand son paiement est confirmé
const notifierPaiementReussi = (paiement) => {

    if (!paiement.utilisateurId) {
        return;
    }

    envoyerAUtilisateurs([paiement.utilisateurId], {
        titre: '🙏 Merci pour votre générosité',
        message: `Votre contribution de ${paiement.montant} ${paiement.devise} (${paiement.objet}) a bien été reçue.`,
        route: '/checkout',
        data: { type: 'paiement', reference: paiement.reference }
    });

};

// =====================================================
// APPLIQUER LE STATUT OFFICIEL DE PAWAPAY
// donnees = data de GET /v2/deposits/{depositId}
// =====================================================

const appliquerStatut = (paiement, donnees) => {

    // Un paiement réussi ou échoué ne change plus
    if (paiement.statut !== 'en_attente') {
        return false;
    }

    let statut = STATUTS[donnees.status] || 'en_attente';

    // Sécurité : le montant confirmé doit être celui demandé
    if (
        statut === 'reussi' &&
        (Number(donnees.amount) !== paiement.montant || donnees.currency !== paiement.devise)
    ) {
        console.error(`❌ PawaPay : montant différent pour ${paiement.depositId}`, donnees.amount, donnees.currency);
        statut = 'en_attente';
        donnees = { ...donnees, status: 'IN_RECONCILIATION' };
    }

    paiement.statutPawapay = donnees.status;
    paiement.statut = statut;

    if (donnees.providerTransactionId) {
        paiement.providerTransactionId = donnees.providerTransactionId;
    }

    if (donnees.failureReason) {
        paiement.echec = {
            code: donnees.failureReason.failureCode || null,
            message: donnees.failureReason.failureMessage || null
        };
    }

    if (statut !== 'en_attente') {
        paiement.dateFinalisation = new Date();
    }

    return statut === 'reussi';

};


// =====================================================
// ENREGISTRER LE STATUT
// Le passage à "reussi" / "echoue" est atomique : si le
// callback et l'application vérifient en même temps, un
// seul des deux finalise (et notifie) le paiement.
// =====================================================

const enregistrerStatut = async (paiement, officiel, callback) => {

    const reussi = appliquerStatut(paiement, officiel);

    if (callback) {
        paiement.callback = callback;
    }

    if (!paiement.isModified()) {
        return;
    }

    if (paiement.statut === 'en_attente') {
        await paiement.save();
        return;
    }

    const resultat = await Paiement.updateOne(
        { _id: paiement._id, statut: 'en_attente' },
        {
            $set: {
                statut: paiement.statut,
                statutPawapay: paiement.statutPawapay,
                echec: paiement.echec,
                providerTransactionId: paiement.providerTransactionId,
                dateFinalisation: paiement.dateFinalisation,
                callback: paiement.callback
            }
        }
    );

    if (resultat.modifiedCount === 1) {
        console.log(`💳 Paiement ${paiement.reference} → ${paiement.statut} (${paiement.statutPawapay})`);
        if (reussi) {
            notifierPaiementReussi(paiement);
        }
    }

};


// =====================================================
// LANCER UN PAIEMENT
// =====================================================
// POST /api/pawapay/depot
// Body : { montant, devise, operateur, telephone, objet, description?, type?, nom? }
// Authorization facultatif (Bearer JWT du fidèle)
// =====================================================

exports.creerDepot = async (req, res) => {

    try {

        const {
            montant,
            devise,
            operateur,
            telephone,
            objet,
            description,
            type,
            nom
        } = req.body;


        // ==============================
        // VALIDATION
        // ==============================

        const infosOperateur = Paiement.OPERATEURS[operateur];

        if (!infosOperateur) {
            return res.status(400).json({
                success: false,
                message: 'Opérateur invalide (mpesa, orange ou airtel).'
            });
        }

        if (!['USD', 'CDF'].includes(devise)) {
            return res.status(400).json({
                success: false,
                message: 'Devise invalide (USD ou CDF).'
            });
        }

        const valeur = Number(montant);

        if (!Number.isFinite(valeur) || valeur <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Montant invalide.'
            });
        }

        const numero = normaliserTelephone(telephone);

        if (!numero) {
            return res.status(400).json({
                success: false,
                message: 'Numéro invalide : 9 chiffres sans l\'indicatif (ex : 812345678).'
            });
        }

        if (typeof objet !== 'string' || !objet.trim()) {
            return res.status(400).json({
                success: false,
                message: 'L\'objet du don est obligatoire.'
            });
        }


        // ==============================
        // LIMITES DE L'OPÉRATEUR
        // ==============================

        const limites = await getLimitesOperateur(infosOperateur.provider, devise);

        if (!limites || !limites.disponible) {
            return res.status(400).json({
                success: false,
                message: `${infosOperateur.nom} n'accepte pas les paiements en ${devise} pour le moment.`
            });
        }

        if (limites.decimales === 0 && !Number.isInteger(valeur)) {
            return res.status(400).json({
                success: false,
                message: `${infosOperateur.nom} n'accepte pas les centimes en ${devise}.`
            });
        }

        if (valeur < limites.min || valeur > limites.max) {
            return res.status(400).json({
                success: false,
                message: `Avec ${infosOperateur.nom}, le montant doit être entre ${limites.min} et ${limites.max} ${devise}.`
            });
        }

        const montantPawapay = formaterMontant(valeur, limites.decimales);


        // ==============================
        // ENREGISTRER LE PAIEMENT
        // ==============================

        const paiement = await Paiement.create({
            depositId: crypto.randomUUID(),
            reference: genererReference(),
            utilisateurId: getUtilisateurId(req),
            nom: typeof nom === 'string' && nom.trim() ? nom.trim() : 'Anonyme',
            type: Paiement.TYPES.includes(type) ? type : 'don',
            objet: objet.trim(),
            description: typeof description === 'string' ? description.trim() : '',
            montant: Number(montantPawapay),
            devise,
            operateur,
            provider: infosOperateur.provider,
            telephone: numero
        });


        // ==============================
        // DEMANDER LE PAIEMENT À PAWAPAY
        // ==============================

        let reponse;

        try {
            reponse = await initierDepot({
                depositId: paiement.depositId,
                montant: montantPawapay,
                devise,
                telephone: numero,
                provider: infosOperateur.provider,
                reference: paiement.reference
            });
        } catch (error) {
            // Réseau coupé ou délai dépassé : PawaPay a peut-être reçu
            // la demande, le statut sera vérifié plus tard
            console.error('❌ PawaPay injoignable :', error.message);

            return res.status(202).json({
                success: true,
                message: 'Paiement en cours de vérification.',
                paiement: formatPaiement(paiement)
            });
        }

        const statutPawapay = reponse.donnees?.status;

        if (statutPawapay === 'ACCEPTED' || statutPawapay === 'DUPLICATE_IGNORED') {

            paiement.statutPawapay = statutPawapay;
            await paiement.save();

            console.log(`💳 Dépôt PawaPay lancé : ${paiement.reference} (${montantPawapay} ${devise}, ${operateur})`);

            return res.status(201).json({
                success: true,
                message: `Validez le paiement sur votre téléphone ${infosOperateur.nom} avec votre code PIN.`,
                paiement: formatPaiement(paiement)
            });

        }

        // Refusé par PawaPay (ou erreur de requête)
        await enregistrerStatut(paiement, {
            status: 'REJECTED',
            failureReason: reponse.donnees?.failureReason || {
                failureCode: 'UNKNOWN_ERROR',
                failureMessage: `HTTP ${reponse.httpStatus}`
            }
        });

        console.error(`❌ Dépôt PawaPay refusé : ${paiement.reference}`, reponse.httpStatus, reponse.donnees);

        return res.status(400).json({
            success: false,
            message: formatPaiement(paiement).message,
            paiement: formatPaiement(paiement)
        });

    } catch (error) {

        console.error('❌ ERREUR CRÉATION DÉPÔT :', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur lors du lancement du paiement.'
        });

    }

};


// =====================================================
// CALLBACK PAWAPAY
// =====================================================
// POST /api/pawapay/webhook
// Appelé par PawaPay quand un paiement est terminé.
// Le contenu reçu n'est pas cru sur parole : le statut
// officiel est redemandé à PawaPay avec notre token.
// =====================================================

exports.webhook = async (req, res) => {

    try {

        const depositId = req.body?.depositId;

        // Payouts / refunds : pas utilisés pour le moment
        if (!depositId) {
            console.log('ℹ️ Callback PawaPay ignoré (pas un dépôt) :', req.body);
            return res.status(200).json({ received: true });
        }

        const paiement = await Paiement.findOne({ depositId });

        if (!paiement) {
            console.warn(`⚠️ Callback PawaPay pour un dépôt inconnu : ${depositId}`);
            return res.status(200).json({ received: true });
        }

        const officiel = await getDepot(depositId);

        if (!officiel) {
            console.warn(`⚠️ Dépôt introuvable chez PawaPay : ${depositId}`);
            return res.status(200).json({ received: true });
        }

        await enregistrerStatut(paiement, officiel, req.body);

        return res.status(200).json({ received: true });

    } catch (error) {

        console.error('❌ ERREUR CALLBACK PAWAPAY :', error);

        // 500 : PawaPay renverra le callback plus tard
        return res.status(500).json({ received: false });

    }

};


// =====================================================
// SUIVRE UN PAIEMENT
// =====================================================
// GET /api/pawapay/depot/:depositId
// L'application l'interroge pendant que le fidèle valide
// =====================================================

exports.statutDepot = async (req, res) => {

    try {

        const paiement = await Paiement.findOne({ depositId: req.params.depositId });

        if (!paiement) {
            return res.status(404).json({
                success: false,
                message: 'Paiement introuvable.'
            });
        }

        // Pas encore de callback : on redemande à PawaPay
        if (
            paiement.statut === 'en_attente' &&
            Date.now() - paiement.createdAt.getTime() > DELAI_VERIFICATION_MS
        ) {

            try {

                const officiel = await getDepot(paiement.depositId);

                if (officiel) {
                    await enregistrerStatut(paiement, officiel);
                }

            } catch (error) {
                console.error('❌ Vérification PawaPay :', error.message);
            }

        }

        return res.status(200).json({
            success: true,
            paiement: formatPaiement(paiement)
        });

    } catch (error) {

        console.error('❌ ERREUR STATUT DÉPÔT :', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération du paiement.'
        });

    }

};


// =====================================================
// LISTE DES PAIEMENTS (ADMIN)
// =====================================================
// GET /api/pawapay/admin/paiements
// Tous les paiements des fidèles, du plus récent au plus ancien
// =====================================================

exports.listerPaiements = async (req, res) => {

    try {

        const paiements = await Paiement.find()
            .select('-callback')
            .populate('utilisateurId', 'nom prenom email telephone')
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json(
            paiements.map(paiement => ({
                ...paiement,
                operateurNom: Paiement.OPERATEURS[paiement.operateur]?.nom || paiement.operateur,
                message:
                    paiement.statut === 'echoue'
                        ? (MESSAGES_ECHEC[paiement.echec?.code] || paiement.echec?.message || MESSAGE_ECHEC_DEFAUT)
                        : null
            }))
        );

    } catch (error) {

        console.error('❌ ERREUR LISTE PAIEMENTS :', error);

        return res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des paiements.'
        });

    }

};
