// services/purgeMessagerie.js
// Purge mensuelle de la messagerie : le 1er de chaque mois (heure de Kinshasa),
// toutes les conversations du mois précédent sont effacées —
// messages, photos sur R2 et entrées « message » de la page Notifications.
//
// Vérification toutes les heures : tout ce qui date d'avant le début du mois
// en cours est supprimé. Sans état à mémoriser : si le serveur était arrêté
// le 1er, la purge se fait dès son redémarrage.

const Conversation = require('../models/conversation');
const Message = require('../models/message');
const Notification = require('../models/notification');
const { supprimerFichiersR2 } = require('../controllers/messagerie');

const INTERVALLE_MS = 60 * 60 * 1000;
// Kinshasa : UTC+1, sans heure d'été
const DECALAGE_KINSHASA_MS = 60 * 60 * 1000;
const LOT = 500;

let enCours = false;

// 1er du mois en cours à 00:00, heure de Kinshasa (en date UTC)
const debutDuMois = (maintenant = new Date()) => {
  const local = new Date(maintenant.getTime() + DECALAGE_KINSHASA_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - DECALAGE_KINSHASA_MS);
};

const purger = async (maintenant = new Date()) => {

  if (enCours) return null;
  enCours = true;

  try {
    const limite = debutDuMois(maintenant);
    let messages = 0;
    let photos = 0;

    // Messages par lots (les photos R2 d'abord, puis les documents)
    for (;;) {
      const lot = await Message.find({ createdAt: { $lt: limite } })
        .select('_id image.key')
        .limit(LOT)
        .lean();

      if (!lot.length) break;

      const cles = lot.map(m => m.image?.key).filter(Boolean);
      await supprimerFichiersR2(cles);
      photos += cles.length;

      const { deletedCount } = await Message.deleteMany({ _id: { $in: lot.map(m => m._id) } });
      messages += deletedCount;
    }

    // Conversations sans message du mois en cours
    const { deletedCount: conversations } = await Conversation.deleteMany({
      $or: [
        { 'dernierMessage.date': { $lt: limite } },
        { 'dernierMessage.date': null, createdAt: { $lt: limite } }
      ]
    });

    // Leurs notifications dans l'app (elles mèneraient à une conversation effacée)
    await Notification.deleteMany({ route: /^\/messagerie\//, createdAt: { $lt: limite } });

    if (messages || conversations) {
      console.log(`🧹 Messagerie : purge mensuelle — ${conversations} conversation(s), ${messages} message(s), ${photos} photo(s).`);
    }

    return { conversations, messages, photos };

  } catch (error) {
    console.error('❌ Purge mensuelle de la messagerie :', error.message);
    return null;
  } finally {
    enCours = false;
  }
};

const demarrerPurgeMessagerie = () => {
  purger();
  setInterval(purger, INTERVALLE_MS).unref?.();
};

module.exports = { demarrerPurgeMessagerie, purger, debutDuMois };
