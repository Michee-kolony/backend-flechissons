require('dotenv').config();
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const { demarrerRappelsEvenements } = require('./services/rappelEvenements');

// ===============================
// ROUTES
// ===============================

const routeAdmin = require('./routes/admin');
const routeArticle = require('./routes/article');
const routeAuth = require('./routes/user');
const routeRequete = require('./routes/requete');
const routeAudio = require('./routes/audio');
const routeNotification = require('./routes/notification');
const routePawapay = require('./routes/pawapay');
const routeLive = require('./routes/live');
const routeEglise = require('./routes/eglise');
const routeEvenement = require('./routes/evenement');

// ===============================
// APPLICATION
// ===============================

const app = express();

// ===============================
// MONGODB
// ===============================

mongoose.connect(
  'mongodb://kolony:1708roosevelt@187.7.27.156:27017/flechissons?authSource=flechissons'
)
.then(() => {
  console.log('Connecté à MongoDB Flechissons sur vps');

  // Rappels du calendrier : la veille et à l'heure de chaque évènement
  demarrerRappelsEvenements();
})
.catch((err) => {
  console.error('Erreur MongoDB:', err);
});

// ===============================
// CORS
// ===============================

app.use(cors());

// ===============================
// PARSING
// ===============================

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===============================
// ROUTE PRINCIPALE
// ===============================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Flechissons fonctionne correctement 🚀'
  });
});

// ===============================
// ROUTES API
// ===============================

app.use('/auth', routeAdmin);

app.use('/article', routeArticle);

app.use('/user', routeAuth);

app.use('/requete', routeRequete);

app.use('/audio', routeAudio);

app.use('/notification', routeNotification);

app.use('/api/pawapay', routePawapay);

app.use('/live', routeLive);

app.use('/eglise', routeEglise);

app.use('/evenement', routeEvenement);

// ===============================
// PAGE WEB DE DON
// (les dons ne sont plus proposés dans l'application iOS)
// ===============================

app.use('/donnation', express.static(path.join(__dirname, 'public', 'donnation')));

// ===============================
// PAGE WEB : POLITIQUE DE CONFIDENTIALITÉ
// (lien donné à l'App Store et au Google Play)
// ===============================

app.use('/confidentialite', express.static(path.join(__dirname, 'public', 'confidentialite')));

// ===============================
// 404
// ===============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route introuvable : ${req.method} ${req.originalUrl}`
  });
});

// ===============================
// EXPORT
// ===============================

module.exports = app;