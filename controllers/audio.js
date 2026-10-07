const Audio = require('../models/audio');

const {
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');

const r2 = require('../config/r2');

const {
  envoyerATous,
  routes
} = require('../services/notification');


// =====================================================
// CONFIGURATION R2
// =====================================================

const R2_BUCKET = 'flechissons';

const R2_PUBLIC_URL =
  'https://pub-d21c8c5e48fb4a35ace1050c88bc8b91.r2.dev';


// =====================================================
// CREATE AUDIO
// =====================================================

const createAudio = async (req, res) => {

  try {

    console.log("📦 BODY :", req.body);
    console.log("📁 FILES :", req.files);


    // =================================================
    // VÉRIFICATION PHOTO DE COUVERTURE
    // =================================================

    if (
      !req.files ||
      !req.files.photoCouverture ||
      !req.files.photoCouverture[0]
    ) {

      return res.status(400).json({
        success: false,
        message: "La photo de couverture est obligatoire."
      });
    }


    // =================================================
    // VÉRIFICATION FICHIER AUDIO
    // =================================================

    if (
      !req.files.fichierAudio ||
      !req.files.fichierAudio[0]
    ) {

      return res.status(400).json({
        success: false,
        message: "Le fichier audio est obligatoire."
      });
    }


    // =================================================
    // RÉCUPÉRATION DES FICHIERS
    // =================================================

    const photoCouverture =
      req.files.photoCouverture[0];

    const fichierAudio =
      req.files.fichierAudio[0];


    // =================================================
    // RÉCUPÉRATION DES DONNÉES
    // =================================================

    const {
      nom,
      personne,
      categorie,
      datePublication
    } = req.body;


    // =================================================
    // VALIDATION NOM
    // =================================================

    if (!nom || !nom.trim()) {

      return res.status(400).json({
        success: false,
        message: "Le nom de l'audio est obligatoire."
      });
    }


    // =================================================
    // VALIDATION PERSONNE
    // =================================================

    if (!personne || !personne.trim()) {

      return res.status(400).json({
        success: false,
        message: "Le nom de la personne est obligatoire."
      });
    }


    // =================================================
    // VALIDATION CATÉGORIE
    // =================================================

    const categoriesAutorisees = [
      'priere',
      'miracles',
      'esperances'
    ];


    if (!categorie) {

      return res.status(400).json({
        success: false,
        message: "La catégorie est obligatoire."
      });
    }


    if (!categoriesAutorisees.includes(categorie)) {

      return res.status(400).json({
        success: false,
        message:
          "Catégorie invalide. Utilisez priere, miracles ou esperances."
      });
    }


    // =================================================
    // RÉCUPÉRATION DES KEYS R2
    // =================================================

    const photoCouvertureKey =
      photoCouverture.key;

    const fichierAudioKey =
      fichierAudio.key;


    // =================================================
    // CRÉATION DES URLS PUBLIQUES
    // =================================================

    const photoCouvertureUrl =
      `${R2_PUBLIC_URL}/${photoCouvertureKey}`;

    const fichierAudioUrl =
      `${R2_PUBLIC_URL}/${fichierAudioKey}`;


    console.log(
      "🖼️ URL couverture :",
      photoCouvertureUrl
    );

    console.log(
      "🎵 URL audio :",
      fichierAudioUrl
    );


    // =================================================
    // ENREGISTREMENT MONGODB
    // =================================================

    const audio = await Audio.create({

      nom: nom.trim(),

      personne: personne.trim(),

      categorie,

      photoCouverture:
        photoCouvertureUrl,

      photoCouvertureKey,

      fichierAudio:
        fichierAudioUrl,

      fichierAudioKey,

      datePublication:
        datePublication || new Date()
    });


    // =================================================
    // NOTIFICATION
    // =================================================

    envoyerATous({
      titre: '🎧 Nouvel audio',
      message: `${audio.nom} — ${audio.personne}`,
      route: routes.audio(audio._id),
      image: audio.photoCouverture,
      data: { type: 'audio', audioId: audio._id }
    });


    // =================================================
    // RÉPONSE
    // =================================================

    return res.status(201).json({

      success: true,

      message:
        "Audio publié avec succès.",

      audio
    });


  } catch (error) {

    console.error(
      "❌ ERREUR CREATE AUDIO :",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Erreur lors de la publication de l'audio.",

      error: error.message
    });
  }
};



// =====================================================
// GET TOUS LES AUDIOS
// =====================================================

const getAudio = async (req, res) => {

  try {

    const audios = await Audio
      .find()
      .sort({
        datePublication: -1
      });


    return res.status(200).json({

      success: true,

      count: audios.length,

      audios
    });


  } catch (error) {

    console.error(
      "❌ ERREUR GET AUDIOS :",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Erreur lors de la récupération des audios.",

      error: error.message
    });
  }
};



// =====================================================
// GET AUDIO PAR ID
// =====================================================

const getAudioById = async (req, res) => {

  try {

    const {
      id
    } = req.params;


    // =================================================
    // RECHERCHE
    // =================================================

    const audio = await Audio.findById(id);


    // =================================================
    // AUDIO INTROUVABLE
    // =================================================

    if (!audio) {

      return res.status(404).json({

        success: false,

        message:
          "Audio introuvable."
      });
    }


    // =================================================
    // RÉPONSE
    // =================================================

    return res.status(200).json({

      success: true,

      audio
    });


  } catch (error) {

    console.error(
      "❌ ERREUR GET AUDIO BY ID :",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Erreur lors de la récupération de l'audio.",

      error: error.message
    });
  }
};



// =====================================================
// SUPPRIMER AUDIO
// =====================================================

const supprimerAudio = async (req, res) => {

  try {

    const {
      id
    } = req.params;


    console.log(
      "🗑️ Suppression audio ID :",
      id
    );


    // =================================================
    // RECHERCHER AUDIO
    // =================================================

    const audio = await Audio.findById(id);


    if (!audio) {

      return res.status(404).json({

        success: false,

        message:
          "Audio introuvable."
      });
    }


    // =================================================
    // SUPPRIMER PHOTO DE COUVERTURE DE R2
    // =================================================

    if (audio.photoCouvertureKey) {

      console.log(
        "🗑️ Suppression couverture R2 :",
        audio.photoCouvertureKey
      );


      const deleteCover =
        new DeleteObjectCommand({

          Bucket:
            R2_BUCKET,

          Key:
            audio.photoCouvertureKey

        });


      await r2.send(deleteCover);


      console.log(
        "✅ Photo de couverture supprimée de R2."
      );
    }


    // =================================================
    // SUPPRIMER FICHIER AUDIO DE R2
    // =================================================

    if (audio.fichierAudioKey) {

      console.log(
        "🗑️ Suppression fichier audio R2 :",
        audio.fichierAudioKey
      );


      const deleteAudio =
        new DeleteObjectCommand({

          Bucket:
            R2_BUCKET,

          Key:
            audio.fichierAudioKey

        });


      await r2.send(deleteAudio);


      console.log(
        "✅ Fichier audio supprimé de R2."
      );
    }


    // =================================================
    // SUPPRIMER DOCUMENT MONGODB
    // =================================================

    await Audio.findByIdAndDelete(id);


    // =================================================
    // RÉPONSE
    // =================================================

    return res.status(200).json({

      success: true,

      message:
        "Audio, photo de couverture et fichiers R2 supprimés avec succès."
    });


  } catch (error) {

    console.error(
      "❌ ERREUR SUPPRESSION AUDIO :",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Erreur lors de la suppression de l'audio.",

      error: error.message
    });
  }
};



// =====================================================
// EXPORTS
// =====================================================

module.exports = {

  createAudio,

  getAudio,

  getAudioById,

  supprimerAudio

};