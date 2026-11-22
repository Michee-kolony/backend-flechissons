const express = require('express');

const router = express.Router();

const { auth } = require('../middlewares/auth');
const authUtilisateur = require('../middlewares/authUtilisateur');

const {
  exigerAdminMessagerie,
  getContacts,
  rechercherUtilisateurs,
  listerConversations,
  ouvrirConversation,
  getMessages,
  envoyerMessage,
  getNonLus
} = require('../controllers/messagerie');


// ======================================================
// CÔTÉ ADMINISTRATION (admin et superadmin / pasteur)
// Déclaré avant les routes utilisateur : « /admin/... » ne doit
// jamais être lu comme un identifiant de conversation.
// ======================================================

const admin = express.Router();

admin.use(auth, exigerAdminMessagerie);

admin.get('/non-lus', getNonLus('admin'));
admin.get('/utilisateurs', rechercherUtilisateurs);
admin.get('/conversations', listerConversations('admin'));
admin.post('/conversations', ouvrirConversation('admin'));
admin.get('/conversations/:id/messages', getMessages('admin'));
admin.post('/conversations/:id/messages', envoyerMessage('admin'));

router.use('/admin', admin);


// ======================================================
// CÔTÉ APPLICATION MOBILE (utilisateur connecté)
// ======================================================

router.use(authUtilisateur);

router.get('/non-lus', getNonLus('utilisateur'));
router.get('/contacts', getContacts);
router.get('/conversations', listerConversations('utilisateur'));
router.post('/conversations', ouvrirConversation('utilisateur'));
router.get('/conversations/:id/messages', getMessages('utilisateur'));
router.post('/conversations/:id/messages', envoyerMessage('utilisateur'));


module.exports = router;
