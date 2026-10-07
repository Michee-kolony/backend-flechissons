// services/notification.js
// Envoi des notifications push (Firebase Cloud Messaging) vers l'application.
//
// - Nouvelle publication / nouvel audio : topic "tous" (tous les appareils,
//   connectés ou non, sauf ceux dont le compte a coupé les notifications)
// - Like / commentaire : envoi ciblé aux tokens des clients concernés
//
// Chaque notification transporte une "route" : la page exacte que
// l'application ouvre quand l'utilisateur tape dessus.
//
// Aucune fonction de ce fichier ne lève d'erreur : une notification
// qui échoue ne doit jamais faire échouer la requête de l'API.

const User = require('../models/user');

const TOPIC_TOUS = 'tous';

// FCM accepte au maximum 500 tokens par envoi / abonnement
const TAILLE_LOT = 500;

// Erreurs FCM indiquant que le token n'existe plus (app désinstallée, etc.)
const ERREURS_TOKEN_MORT = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token'
];

// =====================================================
// FIREBASE MESSAGING (chargé au premier usage)
// =====================================================

let messaging = null;

const getMessagingFirebase = () => {

  if (messaging) {
    return messaging;
  }

  try {
    const { firebaseApp } = require('../config/firebase');
    const { getMessaging } = require('firebase-admin/messaging');
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch (error) {
    console.error('❌ Notifications désactivées : Firebase indisponible.', error.message);
    return null;
  }

};

// =====================================================
// OUTILS
// =====================================================

const decouper = (liste, taille) => {
  const lots = [];
  for (let i = 0; i < liste.length; i += taille) {
    lots.push(liste.slice(i, i + taille));
  }
  return lots;
};

const tronquer = (texte, max) => {
  const propre = String(texte || '').trim();
  return propre.length > max ? `${propre.slice(0, max - 1)}…` : propre;
};

// FCM n'accepte que des chaînes dans "data"
const versData = (data) => {
  const resultat = {};
  Object.entries(data || {}).forEach(([cle, valeur]) => {
    if (valeur !== undefined && valeur !== null) {
      resultat[cle] = String(valeur);
    }
  });
  return resultat;
};

// Image affichée en grand dans la notification (HTTPS uniquement)
const imageValide = (image) =>
  typeof image === 'string' && image.startsWith('https://') ? image : undefined;

const construireMessage = ({ titre, message, route, data, image }) => {

  const imageUrl = imageValide(image);

  return {
    notification: {
      title: tronquer(titre, 100),
      body: tronquer(message, 200),
      ...(imageUrl && { imageUrl })
    },
    data: versData({ ...data, route }),
    android: {
      priority: 'high',
      notification: {
        channelId: 'flechissons',
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          ...(imageUrl && { 'mutable-content': 1 })
        }
      },
      ...(imageUrl && { fcmOptions: { imageUrl } })
    }
  };

};

// Image d'un article : 1re image, sinon miniature de la vidéo YouTube
const imageArticle = (article) => {

  if (article?.images?.length) {
    return article.images[0];
  }

  const idYoutube = String(article?.youtube || '')
    .match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/)?.[1];

  return idYoutube
    ? `https://img.youtube.com/vi/${idYoutube}/hqdefault.jpg`
    : undefined;

};

// =====================================================
// NETTOYAGE DES TOKENS MORTS
// =====================================================

const supprimerTokensMorts = async (tokens) => {

  if (!tokens.length) {
    return;
  }

  try {
    await User.updateMany(
      { fcmTokens: { $in: tokens } },
      { $pull: { fcmTokens: { $in: tokens } } }
    );
    console.log(`🧹 ${tokens.length} token(s) FCM supprimé(s)`);
  } catch (error) {
    console.error('❌ Erreur nettoyage tokens FCM :', error.message);
  }

};

// =====================================================
// ENVOI À TOUS LES APPAREILS (TOPIC "tous")
// =====================================================

const envoyerATous = async ({ titre, message, route, data, image }) => {

  const fcm = getMessagingFirebase();
  if (!fcm) {
    return;
  }

  try {
    await fcm.send({
      ...construireMessage({ titre, message, route, data, image }),
      topic: TOPIC_TOUS
    });
    console.log(`🔔 Notification envoyée à tous : ${titre}`);
  } catch (error) {
    console.error('❌ Erreur notification (tous) :', error.message);
  }

};

// =====================================================
// ENVOI À DES CLIENTS PRÉCIS
// =====================================================
// userIds : identifiants des comptes à notifier
// Seuls les clients (role "user") ayant gardé les
// notifications activées sont notifiés.
// =====================================================

const envoyerAUtilisateurs = async (userIds, { titre, message, route, data, image }) => {

  const fcm = getMessagingFirebase();
  if (!fcm || !userIds || !userIds.length) {
    return;
  }

  try {

    const utilisateurs = await User.find({
      _id: { $in: userIds },
      role: 'user',
      'preferences.notifications': { $ne: false },
      'fcmTokens.0': { $exists: true }
    }).select('+fcmTokens');

    const tokens = [...new Set(utilisateurs.flatMap(u => u.fcmTokens))];

    if (!tokens.length) {
      return;
    }

    const base = construireMessage({ titre, message, route, data, image });
    const tokensMorts = [];

    for (const lot of decouper(tokens, TAILLE_LOT)) {

      const reponse = await fcm.sendEachForMulticast({ ...base, tokens: lot });

      reponse.responses.forEach((resultat, index) => {
        if (!resultat.success && ERREURS_TOKEN_MORT.includes(resultat.error?.code)) {
          tokensMorts.push(lot[index]);
        }
      });

    }

    console.log(`🔔 Notification "${titre}" envoyée à ${tokens.length} appareil(s)`);

    await supprimerTokensMorts(tokensMorts);

  } catch (error) {
    console.error('❌ Erreur notification (utilisateurs) :', error.message);
  }

};

// =====================================================
// ABONNEMENT AU TOPIC "tous"
// =====================================================

const abonnerAppareil = async (token) => {

  const fcm = getMessagingFirebase();
  if (!fcm || !token) {
    return false;
  }

  try {
    const reponse = await fcm.subscribeToTopic([token], TOPIC_TOUS);
    return reponse.successCount === 1;
  } catch (error) {
    console.error('❌ Erreur abonnement topic :', error.message);
    return false;
  }

};

// Abonne ou désabonne tous les appareils d'un compte selon
// sa préférence "notifications" (activée par défaut)
const synchroniserAbonnementUtilisateur = async (userId) => {

  const fcm = getMessagingFirebase();
  if (!fcm) {
    return;
  }

  try {

    const user = await User.findById(userId).select('+fcmTokens preferences');

    if (!user || !user.fcmTokens.length) {
      return;
    }

    const actif = user.preferences?.notifications !== false;

    for (const lot of decouper(user.fcmTokens, TAILLE_LOT)) {
      if (actif) {
        await fcm.subscribeToTopic(lot, TOPIC_TOUS);
      } else {
        await fcm.unsubscribeFromTopic(lot, TOPIC_TOUS);
      }
    }

  } catch (error) {
    console.error('❌ Erreur synchronisation abonnement :', error.message);
  }

};

// =====================================================
// ROUTES DE L'APPLICATION (deep links)
// =====================================================

const routes = {
  article: (articleId) => `/article/${articleId}`,
  commentaire: (articleId, commentaireId) => `/article/${articleId}?commentaire=${commentaireId}`,
  audio: (audioId) => `/tabs/tab2?audio=${audioId}`
};

module.exports = {
  envoyerATous,
  envoyerAUtilisateurs,
  abonnerAppareil,
  synchroniserAbonnementUtilisateur,
  imageArticle,
  routes
};
