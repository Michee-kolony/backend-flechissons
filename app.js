require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');

// ===============================
// ROUTES
// ===============================

const routeAdmin = require('./routes/admin');
const routeArticle = require('./routes/article');
const routeAuth = require('./routes/user');
const routeRequete = require('./routes/requete');
const routeAudio = require('./routes/audio');
const routeDonation = require('./routes/donation');

// ===============================
// APPLICATION
// ===============================

const app = express();

// ===============================
// MONGODB
// ===============================

mongoose.connect(
  'mongodb://kolony:1708roosevelt@187.124.114.57:27017/flechissons?authSource=admin'
)
.then(() => {
  console.log('Connecté à MongoDB Flechissons');
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

app.use('/donation', routeDonation);

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