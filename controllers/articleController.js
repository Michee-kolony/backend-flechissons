// controllers/articleController.js
const article = require("../models/article");
const Utilisateur = require("../models/user"); // ✅ Ajout de l'import Utilisateur
const multer = require("multer");

// ===============================
// URL PUBLIQUE R2
// ===============================

const R2_PUBLIC_URL =
  'https://pub-d21c8c5e48fb4a35ace1050c88bc8b91.r2.dev';

// =====================================================
// CRÉER UN ARTICLE
// =====================================================

const creerArticle = async (req, res) => {

  try {

    // ===============================
    // DONNÉES
    // ===============================

    const {
      titre,
      description,
      type,
      theme,
      youtube,
      lien
    } = req.body;

    // ===============================
    // VALIDATION
    // ===============================

    if (!titre || !description || !type || !theme) {

      return res.status(400).json({

        success: false,

        message:
          'Titre, description, type et thème sont obligatoires.'

      });

    }

    // ===============================
    // URLS PUBLIQUES R2
    // ===============================

    const images = (req.files || []).map(
      file => `${R2_PUBLIC_URL}/${file.key}`
    );

    // ===============================
    // CRÉATION ARTICLE
    // ===============================

    const nouvelArticle = await article.create({

      titre: titre.trim(),

      description: description.trim(),

      type,

      theme: theme.trim(),

      youtube: youtube
        ? youtube.trim()
        : null,

      lien: lien
        ? lien.trim()
        : null,

      images,

      likes: [],

      commentaires: []

    });

    // ===============================
    // RÉPONSE
    // ===============================

    return res.status(201).json({

      success: true,

      message:
        'Article créé avec succès.',

      article: nouvelArticle

    });

  } catch (error) {

    console.error(
      '❌ Erreur création article :',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        'Erreur lors de la création de l\'article.',

      error: error.message

    });

  }

};

// =====================================================
// RÉCUPÉRER TOUS LES ARTICLES
// =====================================================

const getArticles = async (req, res) => {

  try {

    const articles = await article
      .find()
      .sort({ createdAt: -1 });

    return res.status(200).json({

      success: true,

      message:
        'Articles récupérés avec succès.',

      articles

    });

  } catch (error) {

    console.error(
      '❌ Erreur récupération articles :',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        'Erreur lors de la récupération des articles.',

      error: error.message

    });

  }

};

// =====================================================
// RÉCUPÉRER UN ARTICLE
// =====================================================

const getArticle = async (req, res) => {

  try {

    const { id } = req.params;

    const articleTrouve =
      await article.findById(id);

    if (!articleTrouve) {

      return res.status(404).json({

        success: false,

        message: 'Article introuvable.'

      });

    }

    return res.status(200).json({

      success: true,

      message:
        'Article récupéré avec succès.',

      article: articleTrouve

    });

  } catch (error) {

    console.error(
      '❌ Erreur récupération article :',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        'Erreur lors de la récupération de l\'article.',

      error: error.message

    });

  }

};

// =====================================================
// LIKE / UNLIKE
// =====================================================

const toggleLike = async (req, res) => {

  try {

    const { id } = req.params;

    const { utilisateurId } = req.body;

    if (!utilisateurId) {

      return res.status(400).json({

        success: false,

        message:
          'utilisateurId est obligatoire.'

      });

    }

    const articleTrouve =
      await article.findById(id);

    if (!articleTrouve) {

      return res.status(404).json({

        success: false,

        message: 'Article introuvable.'

      });

    }

    const dejaLike =
      articleTrouve.likes.some(
        userId =>
          userId.toString() ===
          utilisateurId.toString()
      );

    if (dejaLike) {

      articleTrouve.likes =
        articleTrouve.likes.filter(
          userId =>
            userId.toString() !==
            utilisateurId.toString()
        );

    } else {

      articleTrouve.likes.push(
        utilisateurId
      );

    }

    await articleTrouve.save();

    return res.status(200).json({

      success: true,

      message: dejaLike
        ? 'Like retiré.'
        : 'Article aimé.',

      likes: articleTrouve.likes.length

    });

  } catch (error) {

    console.error(
      '❌ Erreur like :',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        'Erreur lors du traitement du like.',

      error: error.message

    });

  }

};

// =====================================================
// AJOUTER UN COMMENTAIRE (MODIFIÉ AVEC NOM, PRENOM, PHOTO)
// =====================================================

const ajouterCommentaire = async (req, res) => {

  try {

    const { id } = req.params;

    const {
      utilisateurId,
      contenu
    } = req.body;

    // ===============================
    // VALIDATION
    // ===============================

    if (!utilisateurId || !contenu) {

      return res.status(400).json({

        success: false,

        message:
          'utilisateurId et contenu sont obligatoires.'

      });

    }

    if (contenu.trim().length < 1) {

      return res.status(400).json({

        success: false,

        message:
          'Le commentaire ne peut pas être vide.'

      });

    }

    if (contenu.trim().length > 500) {

      return res.status(400).json({

        success: false,

        message:
          'Le commentaire ne peut pas dépasser 500 caractères.'

      });

    }

    // ===============================
    // RÉCUPÉRER L'UTILISATEUR
    // ===============================

    const user = await Utilisateur.findById(utilisateurId);

    if (!user) {

      return res.status(404).json({

        success: false,

        message:
          'Utilisateur non trouvé.'

      });

    }

    // ===============================
    // RÉCUPÉRER L'ARTICLE
    // ===============================

    const articleTrouve =
      await article.findById(id);

    if (!articleTrouve) {

      return res.status(404).json({

        success: false,

        message:
          'Article introuvable.'

      });

    }

    // ===============================
    // CRÉER LE COMMENTAIRE AVEC TOUTES LES INFOS
    // ===============================

    const nouveauCommentaire = {

      utilisateurId: utilisateurId,

      nom: user.nom || "Utilisateur",

      prenom: user.prenom || "",

      photo: user.photo || user.avatar || null,

      contenu: contenu.trim()

    };

    articleTrouve.commentaires.push(nouveauCommentaire);

    await articleTrouve.save();

    // ===============================
    // RÉCUPÉRER LE DERNIER COMMENTAIRE AJOUTÉ
    // ===============================

    const commentaireAjoute =
      articleTrouve.commentaires[articleTrouve.commentaires.length - 1];

    // ===============================
    // RÉPONSE
    // ===============================

    return res.status(201).json({

      success: true,

      message:
        'Commentaire ajouté avec succès.',

      commentaire: {
        _id: commentaireAjoute._id,
        utilisateurId: commentaireAjoute.utilisateurId,
        nom: commentaireAjoute.nom,
        prenom: commentaireAjoute.prenom,
        photo: commentaireAjoute.photo,
        contenu: commentaireAjoute.contenu,
        createdAt: commentaireAjoute.createdAt
      },

      totalCommentaires: articleTrouve.commentaires.length

    });

  } catch (error) {

    console.error(
      '❌ Erreur commentaire :',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        'Erreur lors de l\'ajout du commentaire.',

      error: error.message

    });

  }

};

// =====================================================
// SUPPRIMER UN ARTICLE
// =====================================================

const supprimerArticle = async (req, res) => {

  try {

    const { id } = req.params;

    const articleSupprime =
      await article.findByIdAndDelete(id);

    if (!articleSupprime) {

      return res.status(404).json({

        success: false,

        message:
          'Article introuvable.'

      });

    }

    return res.status(200).json({

      success: true,

      message:
        'Article supprimé avec succès.'

    });

  } catch (error) {

    console.error(
      '❌ Erreur suppression article :',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        'Erreur lors de la suppression de l\'article.',

      error: error.message

    });

  }

};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {

  creerArticle,

  getArticles,

  getArticle,

  toggleLike,

  ajouterCommentaire,

  supprimerArticle

};