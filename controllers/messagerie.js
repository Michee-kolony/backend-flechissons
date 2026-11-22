const mongoose = require('mongoose');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const Admin = require('../models/admin');
const User = require('../models/user');
const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const r2 = require('../config/r2');
const Notification = require('../models/notification');
const { envoyerAUtilisateurs } = require('../services/notification');


// =====================================================
// MESSAGERIE
// Conversations privées entre un utilisateur de l'app mobile
// et un administrateur (admin ou superadmin / pasteur).
//
// Les mêmes fonctions servent aux deux côtés :
//  - côté « utilisateur » : req.utilisateur (middlewares/authUtilisateur)
//  - côté « admin »       : req.admin       (exigerAdminMessagerie ci-dessous)
// =====================================================

const LIMITE_PAGE = 50;
// Anti-abus : nombre de messages maximum par minute et par conversation
const MAX_PAR_MINUTE = 20;

const echapperRegex = (texte) => String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const erreurServeur = (res, contexte, error) => {
  console.error(`❌ MESSAGERIE — ${contexte} :`, error);
  return res.status(500).json({ success: false, message: 'Erreur serveur, réessayez plus tard.' });
};

const autreCote = (cote) => (cote === 'admin' ? 'utilisateur' : 'admin');

// Titre affiché aux utilisateurs : celui choisi par l'administrateur, sinon selon le rôle
const titreAdmin = (admin) =>
  (admin.titre && admin.titre.trim())
  || (admin.role === 'superadmin' ? 'Pasteur' : 'Administrateur');

const versContact = (admin) => admin && ({
  id: admin._id,
  nom: admin.nom,
  titre: titreAdmin(admin),
  photo: admin.photo || '',
  bio: admin.bio || ''
});

const versUtilisateur = (user) => user && ({
  id: user._id,
  nom: user.nom || '',
  prenom: user.prenom || '',
  photo: user.photo || '',
  email: user.email || ''
});

// Filtre « conversations de la personne connectée »
const filtreProprietaire = (req, cote) =>
  cote === 'admin' ? { admin: req.admin._id } : { utilisateur: req.utilisateur._id };

const formaterConversation = (conversation, cote) => ({
  _id: conversation._id,
  interlocuteur: cote === 'admin'
    ? versUtilisateur(conversation.utilisateur)
    : versContact(conversation.admin),
  dernierMessage: conversation.dernierMessage?.date ? conversation.dernierMessage : null,
  nonLus: cote === 'admin' ? conversation.nonLusAdmin : conversation.nonLusUtilisateur,
  // Mon dernier message a-t-il été lu par l'autre ? (coches dans la liste ; null si le dernier vient de l'autre)
  dernierMessageLu: conversation.dernierMessage?.auteur === cote
    ? (cote === 'admin' ? conversation.nonLusUtilisateur : conversation.nonLusAdmin) === 0
    : null,
  updatedAt: conversation.updatedAt
});

const peupler = (requete, cote) =>
  cote === 'admin'
    ? requete.populate('utilisateur', 'nom prenom photo email')
    : requete.populate('admin', 'nom role photo titre bio');

// Conversation de la personne connectée (ou null)
const trouverConversation = async (req, cote) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return null;
  }
  return Conversation.findOne({ _id: req.params.id, ...filtreProprietaire(req, cote) });
};


// =====================================================
// MIDDLEWARE : ADMINISTRATEUR AUTORISÉ À LA MESSAGERIE
// (après middlewares/auth.js → req.adminId)
// =====================================================

const exigerAdminMessagerie = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.adminId).select('nom role photo titre');
    if (!admin || !Admin.ROLES_MESSAGERIE.includes(admin.role)) {
      return res.status(403).json({
        success: false,
        message: 'La messagerie est réservée aux administrateurs et au pasteur.'
      });
    }
    req.admin = admin;
    next();
  } catch (error) {
    return erreurServeur(res, 'AUTH ADMIN', error);
  }
};


// =====================================================
// CONTACTS (côté utilisateur)
// GET /messagerie/contacts : pasteur et administrateurs à qui écrire
// =====================================================

const getContacts = async (req, res) => {
  try {
    const admins = await Admin.find({ role: { $in: Admin.ROLES_MESSAGERIE } })
      .select('nom role photo titre bio')
      .lean();

    // Superadmins (pasteur) en premier, puis ordre alphabétique
    admins.sort((a, b) =>
      (a.role === 'superadmin' ? 0 : 1) - (b.role === 'superadmin' ? 0 : 1)
      || String(a.nom).localeCompare(String(b.nom), 'fr')
    );

    return res.status(200).json({ success: true, contacts: admins.map(versContact) });
  } catch (error) {
    return erreurServeur(res, 'CONTACTS', error);
  }
};


// =====================================================
// UTILISATEURS (côté admin) : pour démarrer une conversation
// GET /messagerie/admin/utilisateurs?recherche=...
// =====================================================

const rechercherUtilisateurs = async (req, res) => {
  try {
    const recherche = String(req.query.recherche || '').trim();
    const filtre = {};

    if (recherche) {
      const regex = new RegExp(echapperRegex(recherche), 'i');
      filtre.$or = [{ nom: regex }, { prenom: regex }, { email: regex }];
    }

    const utilisateurs = await User.find(filtre)
      .select('nom prenom photo email')
      .sort({ nom: 1 })
      .limit(30)
      .lean();

    return res.status(200).json({ success: true, utilisateurs: utilisateurs.map(versUtilisateur) });
  } catch (error) {
    return erreurServeur(res, 'UTILISATEURS', error);
  }
};


// =====================================================
// LISTE DES CONVERSATIONS
// GET /messagerie/conversations          (utilisateur)
// GET /messagerie/admin/conversations    (admin)
// =====================================================

const listerConversations = (cote) => async (req, res) => {
  try {
    const conversations = await peupler(
      Conversation.find({
        ...filtreProprietaire(req, cote),
        'dernierMessage.date': { $ne: null },
        // Discussion supprimée par ce participant : réapparaît seulement avec un nouveau message
        $expr: { $gt: ['$dernierMessage.date', { $ifNull: [`$effaceeLe.${cote}`, new Date(0)] }] }
      })
        .sort({ 'dernierMessage.date': -1 })
        .limit(200),
      cote
    );

    return res.status(200).json({
      success: true,
      conversations: conversations.map(c => formaterConversation(c, cote))
    });
  } catch (error) {
    return erreurServeur(res, 'LISTE', error);
  }
};


// =====================================================
// OUVRIR (OU CRÉER) UNE CONVERSATION
// POST /messagerie/conversations         { adminId }       (utilisateur)
// POST /messagerie/admin/conversations   { utilisateurId } (admin)
// =====================================================

const ouvrirConversation = (cote) => async (req, res) => {
  try {
    let utilisateurId;
    let adminId;

    if (cote === 'admin') {
      utilisateurId = req.body.utilisateurId;
      adminId = req.admin._id;
      if (!mongoose.Types.ObjectId.isValid(utilisateurId) || !(await User.exists({ _id: utilisateurId }))) {
        return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
      }
    } else {
      utilisateurId = req.utilisateur._id;
      adminId = req.body.adminId;
      const admin = mongoose.Types.ObjectId.isValid(adminId)
        ? await Admin.findById(adminId).select('role')
        : null;
      if (!admin || !Admin.ROLES_MESSAGERIE.includes(admin.role)) {
        return res.status(404).json({ success: false, message: 'Ce contact est introuvable.' });
      }
    }

    // Une seule conversation par couple (création sans doublon même en cas de double clic)
    const conversation = await Conversation.findOneAndUpdate(
      { utilisateur: utilisateurId, admin: adminId },
      { $setOnInsert: { utilisateur: utilisateurId, admin: adminId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    await peupler(conversation, cote);

    return res.status(200).json({ success: true, conversation: formaterConversation(conversation, cote) });
  } catch (error) {
    // Course entre deux créations simultanées : on relit l'existante
    if (error.code === 11000) {
      return ouvrirConversation(cote)(req, res);
    }
    return erreurServeur(res, 'OUVERTURE', error);
  }
};


// =====================================================
// MESSAGES D'UNE CONVERSATION
// GET .../conversations/:id/messages
//   ?apres=<date ISO>  : nouveaux messages seulement (actualisation)
//   ?avant=<date ISO>  : messages plus anciens (défilement vers le haut)
// Sans « avant », les messages reçus sont marqués comme lus.
// =====================================================

const getMessages = (cote) => async (req, res) => {
  try {
    const conversation = await trouverConversation(req, cote);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    }

    const { avant, apres } = req.query;
    const filtre = { conversation: conversation._id };
    let messages;

    // Discussion supprimée par ce participant : les messages d'avant ne sont plus visibles
    const effaceeLe = conversation.effaceeLe?.[cote] || null;
    const bornes = effaceeLe ? { $gt: effaceeLe } : {};

    if (apres && !Number.isNaN(Date.parse(apres))) {
      const depuis = new Date(apres);
      filtre.createdAt = { $gt: effaceeLe && effaceeLe > depuis ? effaceeLe : depuis };
      messages = await Message.find(filtre).sort({ createdAt: 1 }).limit(200).lean();
    } else {
      filtre.createdAt = { ...bornes };
      if (avant && !Number.isNaN(Date.parse(avant))) {
        filtre.createdAt.$lt = new Date(avant);
      }
      if (!Object.keys(filtre.createdAt).length) {
        delete filtre.createdAt;
      }
      messages = (await Message.find(filtre).sort({ createdAt: -1 }).limit(LIMITE_PAGE).lean()).reverse();
    }

    // Lecture : les messages de l'autre deviennent « lus »
    if (!avant) {
      const champNonLus = cote === 'admin' ? 'nonLusAdmin' : 'nonLusUtilisateur';
      if (conversation[champNonLus] > 0) {
        await Promise.all([
          Message.updateMany(
            { conversation: conversation._id, auteur: autreCote(cote), luLe: null },
            { $set: { luLe: new Date() } }
          ),
          Conversation.updateOne({ _id: conversation._id }, { $set: { [champNonLus]: 0 } })
        ]);
      }
    }

    // Accusé de lecture : jusqu'où l'autre a lu mes messages
    const dernierLu = await Message.findOne({
      conversation: conversation._id,
      auteur: cote,
      luLe: { $ne: null }
    }).sort({ createdAt: -1 }).select('createdAt').lean();

    return res.status(200).json({
      success: true,
      messages,
      complet: !apres && messages.length < LIMITE_PAGE,
      luParInterlocuteurJusqua: dernierLu ? dernierLu.createdAt : null
    });
  } catch (error) {
    return erreurServeur(res, 'MESSAGES', error);
  }
};


// =====================================================
// ENVOYER UN MESSAGE
// POST .../conversations/:id/messages
//   JSON      : { texte }
//   multipart : photo (facultative) + texte (légende facultative)
// =====================================================

const supprimerFichiersR2 = async (keys) => {
  const liste = keys.filter(Boolean);
  for (let i = 0; i < liste.length; i += 1000) {
    try {
      await r2.send(new DeleteObjectsCommand({
        Bucket: r2.parametres.bucket,
        Delete: { Objects: liste.slice(i, i + 1000).map(Key => ({ Key })), Quiet: true }
      }));
    } catch (error) {
      console.error('❌ Suppression photos messagerie R2 :', error.message);
    }
  }
};

const APERCU_PHOTO = '📷 Photo';

// Une entrée par conversation dans la page « Notifications » de l'app,
// remise en tête à chaque nouveau message (au lieu d'une entrée par message).
// Type « autre » : les anciennes versions de l'app l'affichent sans problème.
const notifierDansHistorique = async (utilisateurId, conversationId, { titre, message, image }) => {
  try {
    // Pilote MongoDB direct : Mongoose interdit de modifier createdAt (champ immuable)
    await Notification.collection.updateOne(
      { destinataire: new mongoose.Types.ObjectId(String(utilisateurId)), route: `/messagerie/${conversationId}` },
      {
        $set: {
          type: 'autre',
          titre: String(titre).slice(0, 200),
          message: String(message).slice(0, 300),
          image: image || null,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('❌ Historique notification message :', error.message);
  }
};

const envoyerMessage = (cote) => async (req, res) => {

  // Photo déjà envoyée sur R2 par multer : supprimée si le message est refusé
  const cleePhoto = req.file ? req.file.key : null;
  const refuser = async (statut, message) => {
    await supprimerFichiersR2([cleePhoto]);
    return res.status(statut).json({ success: false, message });
  };

  try {
    const texte = String(req.body.texte || '').trim();

    if (!texte && !cleePhoto) {
      return refuser(400, 'Le message est vide.');
    }

    if (texte.length > Message.TAILLE_MAX) {
      return refuser(400, `Le message ne doit pas dépasser ${Message.TAILLE_MAX} caractères.`);
    }

    const conversation = await peupler(
      Conversation.findOne({ _id: mongoose.Types.ObjectId.isValid(req.params.id) ? req.params.id : null, ...filtreProprietaire(req, cote) }),
      cote
    );

    if (!conversation) {
      return refuser(404, 'Conversation introuvable.');
    }

    // L'interlocuteur n'existe plus (compte supprimé) ou n'a plus accès à la messagerie
    if (cote === 'utilisateur'
      && (!conversation.admin || !Admin.ROLES_MESSAGERIE.includes(conversation.admin.role))) {
      return refuser(410, "Ce contact n'est plus disponible.");
    }
    if (cote === 'admin' && !conversation.utilisateur) {
      return refuser(410, 'Ce compte utilisateur a été supprimé.');
    }

    const recents = await Message.countDocuments({
      conversation: conversation._id,
      auteur: cote,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) }
    });

    if (recents >= MAX_PAR_MINUTE) {
      return refuser(429, 'Trop de messages en peu de temps. Patientez un instant.');
    }

    const image = cleePhoto
      ? { url: `${r2.parametres.publicUrl}/${cleePhoto}`, key: cleePhoto }
      : undefined;

    const message = await Message.create({ conversation: conversation._id, auteur: cote, texte, image });

    const apercu = texte ? texte : APERCU_PHOTO;

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          dernierMessage: {
            texte: (cleePhoto && texte ? `${APERCU_PHOTO} · ${texte}` : apercu).slice(0, 200),
            auteur: cote,
            date: message.createdAt
          }
        },
        $inc: { [cote === 'admin' ? 'nonLusUtilisateur' : 'nonLusAdmin']: 1 }
      }
    );

    // Notification à l'utilisateur : push (bannière, son, badge) + entrée dans la cloche de l'app.
    // Les administrateurs, eux, voient le badge et une notification de bureau dans l'admin.
    if (cote === 'admin') {
      const utilisateurId = conversation.utilisateur._id;
      const titre = `💬 ${req.admin.nom} · ${titreAdmin(req.admin)}`;
      const corps = cleePhoto ? (texte ? `📷 ${texte}` : APERCU_PHOTO) : texte;

      (async () => {
        const [{ total } = { total: 0 }] = await Conversation.aggregate([
          { $match: { utilisateur: utilisateurId } },
          { $group: { _id: null, total: { $sum: '$nonLusUtilisateur' } } }
        ]);

        await notifierDansHistorique(utilisateurId, conversation._id, {
          titre: `Message de ${req.admin.nom}`,
          message: corps,
          image: req.admin.photo || null
        });

        await envoyerAUtilisateurs([utilisateurId], {
          titre,
          message: corps,
          route: `/messagerie/${conversation._id}`,
          // Photo reçue : affichée dans la notification
          image: image ? image.url : undefined,
          groupe: `conversation-${conversation._id}`,
          badge: total,
          data: { type: 'message', conversationId: String(conversation._id) },
          historique: false
        });
      })().catch(error => console.error('❌ Notification message :', error.message));
    }

    return res.status(201).json({ success: true, message });
  } catch (error) {
    await supprimerFichiersR2([cleePhoto]);
    return erreurServeur(res, 'ENVOI', error);
  }
};


// =====================================================
// SUPPRIMER UNE DISCUSSION (pour soi)
// DELETE /messagerie/conversations/:id
// Les messages disparaissent pour ce participant ; l'autre garde sa copie
// jusqu'à ce qu'il la supprime aussi, ou jusqu'à la purge mensuelle.
// Quand les deux l'ont supprimée, les messages (et leurs photos) sont effacés pour de bon.
// =====================================================

const supprimerConversation = (cote) => async (req, res) => {
  try {
    const conversation = await trouverConversation(req, cote);

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable.' });
    }

    const maintenant = new Date();
    conversation.set(`effaceeLe.${cote}`, maintenant);
    conversation[cote === 'admin' ? 'nonLusAdmin' : 'nonLusUtilisateur'] = 0;
    await conversation.save();

    // Son entrée dans la page « Notifications » de l'app disparaît aussi
    if (cote === 'utilisateur') {
      await Notification.deleteMany({
        destinataire: conversation.utilisateur,
        route: `/messagerie/${conversation._id}`
      }).catch(() => {});
    }

    // Supprimée des deux côtés : on efface définitivement ce que plus personne ne voit
    const autre = conversation.effaceeLe?.[autreCote(cote)];
    if (autre) {
      const limite = autre < maintenant ? autre : maintenant;
      const anciens = await Message.find({ conversation: conversation._id, createdAt: { $lte: limite } })
        .select('_id image.key').lean();
      await supprimerFichiersR2(anciens.map(m => m.image?.key).filter(Boolean));
      await Message.deleteMany({ _id: { $in: anciens.map(m => m._id) } });

      if (!(await Message.exists({ conversation: conversation._id }))) {
        await Conversation.deleteOne({ _id: conversation._id });
      }
    }

    return res.status(200).json({ success: true, message: 'Discussion supprimée.' });
  } catch (error) {
    return erreurServeur(res, 'SUPPRESSION', error);
  }
};


// =====================================================
// NOMBRE TOTAL DE MESSAGES NON LUS (badge)
// GET /messagerie/non-lus   |   GET /messagerie/admin/non-lus
// =====================================================

const getNonLus = (cote) => async (req, res) => {
  try {
    const champ = cote === 'admin' ? '$nonLusAdmin' : '$nonLusUtilisateur';
    const [resultat] = await Conversation.aggregate([
      { $match: filtreProprietaire(req, cote) },
      { $group: { _id: null, total: { $sum: champ } } }
    ]);
    return res.status(200).json({ success: true, nonLus: resultat ? resultat.total : 0 });
  } catch (error) {
    return erreurServeur(res, 'NON LUS', error);
  }
};


// =====================================================
// NETTOYAGE (suppression d'un compte utilisateur)
// =====================================================

const supprimerConversationsUtilisateur = async (utilisateurId) => {
  try {
    const conversations = await Conversation.find({ utilisateur: utilisateurId }).select('_id').lean();
    const ids = conversations.map(c => c._id);
    if (ids.length) {
      const photos = await Message.find({ conversation: { $in: ids }, 'image.key': { $ne: null } }).select('image.key').lean();
      await supprimerFichiersR2(photos.map(m => m.image.key));
      await Message.deleteMany({ conversation: { $in: ids } });
      await Conversation.deleteMany({ _id: { $in: ids } });
    }
  } catch (error) {
    console.error('❌ Nettoyage messagerie utilisateur :', error.message);
  }
};


module.exports = {
  supprimerFichiersR2,
  exigerAdminMessagerie,
  getContacts,
  rechercherUtilisateurs,
  listerConversations,
  ouvrirConversation,
  getMessages,
  envoyerMessage,
  supprimerConversation,
  getNonLus,
  supprimerConversationsUtilisateur
};
