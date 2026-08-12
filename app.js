const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');

//variables routes
const routeAdmin = require('./routes/admin');

const app = express();
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
// CONFIGURATION CORS
// ===============================

app.use(cors());


// ===============================
// PARSING DES DONNÉES
// ===============================

// JSON
app.use(bodyParser.json());

// Données envoyées depuis des formulaires
app.use(bodyParser.urlencoded({ extended: true }));


// ===============================
// ROUTE DE TEST
// ===============================

app.get('/', (req, res) => {
    res.json({
        message: 'API Kinova fonctionne correctement 🚀'
    });
});


app.use('/auth', routeAdmin);


module.exports = app;