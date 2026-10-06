// controllers/articleController.js
const Article = require("../models/article");
const Utilisateur = require("../models/user");
const multer = require("multer");
const { diffuser } = require("../realtime/articleEvents");

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

    const {
      titre,
      description,
      type,
      theme,
      youtube,
      lien
    } = req.body;

    if (!titre || !description || !type || !theme) {
      return res.status(400).json({
        success: false,
        message: 'Titre, description, type et thème sont obligatoires.'
      });
    }

    const images = (req.files || []).map(
      file => `${R2_PUBLIC_URL}/${file.key}`
    );

    const nouvelArticle = await Article.create({
      titre: titre.trim(),
      description: description.trim(),
      type,
      theme: theme.trim(),
      youtube: youtube ? youtube.trim() : null,
      lien: lien ? lien.trim() : null,
      images,
      likes: [],
      commentaires: []
    });

    return res.status(201).json({
      success: true,
      message: 'Article créé avec succès.',
      article: nouvelArticle
    });

  } catch (error) {
    console.error('❌ Erreur création article :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'article.',
      error: error.message
    });
  }

};

// =====================================================
// RÉCUPÉRER TOUS LES ARTICLES
// =====================================================

const getArticles = async (req, res) => {

  try {
    const articles = await Article.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Articles récupérés avec succès.',
      articles
    });

  } catch (error) {
    console.error('❌ Erreur récupération articles :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des articles.',
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
    const articleTrouve = await Article.findById(id);

    if (!articleTrouve) {
      return res.status(404).json({
        success: false,
        message: 'Article introuvable.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Article récupéré avec succès.',
      article: articleTrouve
    });

  } catch (error) {
    console.error('❌ Erreur récupération article :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'article.',
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
        message: 'utilisateurId est obligatoire.'
      });
    }

    const articleTrouve = await Article.findById(id);

    if (!articleTrouve) {
      return res.status(404).json({
        success: false,
        message: 'Article introuvable.'
      });
    }

    const dejaLike = articleTrouve.likes.some(
      userId => userId.toString() === utilisateurId.toString()
    );

    if (dejaLike) {
      articleTrouve.likes = articleTrouve.likes.filter(
        userId => userId.toString() !== utilisateurId.toString()
      );
    } else {
      articleTrouve.likes.push(utilisateurId);
    }

    await articleTrouve.save();

    diffuser('like', {
      articleId: articleTrouve._id,
      likes: articleTrouve.likes
    });

    return res.status(200).json({
      success: true,
      message: dejaLike ? 'Like retiré.' : 'Article aimé.',
      likes: articleTrouve.likes.length
    });

  } catch (error) {
    console.error('❌ Erreur like :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du like.',
      error: error.message
    });
  }

};

// =====================================================
// AJOUTER UN COMMENTAIRE (CORRIGÉ)
// =====================================================

const ajouterCommentaire = async (req, res) => {

  try {
    const { id } = req.params;
    const { utilisateurId, contenu, nom, prenom, photo } = req.body;

    console.log('📝 Ajout commentaire:');
    console.log('- Article ID:', id);
    console.log('- Utilisateur ID:', utilisateurId);
    console.log('- Nom reçu:', nom);
    console.log('- Prénom reçu:', prenom);

    // ===============================
    // VALIDATION
    // ===============================

    if (!utilisateurId || !contenu) {
      return res.status(400).json({
        success: false,
        message: 'utilisateurId et contenu sont obligatoires.'
      });
    }

    if (contenu.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Le commentaire ne peut pas être vide.'
      });
    }

    if (contenu.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Le commentaire ne peut pas dépasser 500 caractères.'
      });
    }

    // ===============================
    // RÉCUPÉRER L'ARTICLE
    // ===============================

    const articleTrouve = await Article.findById(id);

    if (!articleTrouve) {
      return res.status(404).json({
        success: false,
        message: 'Article introuvable.'
      });
    }

    // ===============================
    // RÉCUPÉRER L'UTILISATEUR (OPTIONNEL)
    // ===============================

    let user = null;
    let userNom = nom || 'Utilisateur';
    let userPrenom = prenom || '';
    let userPhoto = photo || null;

    try {
      user = await Utilisateur.findById(utilisateurId);
      if (user) {
        console.log('👤 Utilisateur trouvé:', user.email);
        // Utiliser les données de l'utilisateur si disponibles
        userNom = user.nom || userNom;
        userPrenom = user.prenom || userPrenom;
        userPhoto = user.photo || user.avatar || userPhoto;
      } else {
        console.log('⚠️ Utilisateur non trouvé en base, utilisation des données frontend');
      }
    } catch (err) {
      console.log('⚠️ Erreur recherche utilisateur, utilisation des données frontend');
    }

    // ===============================
    // CRÉER LE COMMENTAIRE AVEC VALEURS PAR DÉFAUT
    // ===============================

    const nouveauCommentaire = {
      utilisateurId: utilisateurId,
      nom: userNom || 'Utilisateur',
      prenom: userPrenom || '',
      photo: userPhoto || null,
      contenu: contenu.trim()
    };

    console.log('📝 Nouveau commentaire créé:', nouveauCommentaire);

    articleTrouve.commentaires.push(nouveauCommentaire);
    await articleTrouve.save();

    const commentaireAjoute = articleTrouve.commentaires[articleTrouve.commentaires.length - 1];

    const commentaire = {
      _id: commentaireAjoute._id,
      utilisateurId: commentaireAjoute.utilisateurId,
      nom: commentaireAjoute.nom,
      prenom: commentaireAjoute.prenom,
      photo: commentaireAjoute.photo,
      contenu: commentaireAjoute.contenu,
      createdAt: commentaireAjoute.createdAt
    };

    diffuser('commentaire', {
      articleId: articleTrouve._id,
      commentaire
    });

    return res.status(201).json({
      success: true,
      message: 'Commentaire ajouté avec succès.',
      commentaire,
      totalCommentaires: articleTrouve.commentaires.length
    });

  } catch (error) {
    console.error('❌ Erreur commentaire:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du commentaire.',
      error: error.message
    });
  }

};

// =====================================================
// MODIFIER UN COMMENTAIRE
// =====================================================

const modifierCommentaire = async (req, res) => {

  try {
    const { id, commentaireId } = req.params;
    const { utilisateurId, contenu } = req.body;

    // ===============================
    // VALIDATION
    // ===============================

    if (!utilisateurId || !contenu) {
      return res.status(400).json({
        success: false,
        message: 'utilisateurId et contenu sont obligatoires.'
      });
    }

    if (contenu.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Le commentaire ne peut pas être vide.'
      });
    }

    if (contenu.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Le commentaire ne peut pas dépasser 500 caractères.'
      });
    }

    // ===============================
    // RÉCUPÉRER L'ARTICLE ET LE COMMENTAIRE
    // ===============================

    const articleTrouve = await Article.findById(id);

    if (!articleTrouve) {
      return res.status(404).json({
        success: false,
        message: 'Article introuvable.'
      });
    }

    const commentaireTrouve = articleTrouve.commentaires.id(commentaireId);

    if (!commentaireTrouve) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire introuvable.'
      });
    }

    // ===============================
    // SEUL L'AUTEUR PEUT MODIFIER
    // ===============================

    if (commentaireTrouve.utilisateurId.toString() !== utilisateurId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que vos propres commentaires.'
      });
    }

    commentaireTrouve.contenu = contenu.trim();
    await articleTrouve.save();

    const commentaire = {
      _id: commentaireTrouve._id,
      utilisateurId: commentaireTrouve.utilisateurId,
      nom: commentaireTrouve.nom,
      prenom: commentaireTrouve.prenom,
      photo: commentaireTrouve.photo,
      contenu: commentaireTrouve.contenu,
      createdAt: commentaireTrouve.createdAt,
      updatedAt: commentaireTrouve.updatedAt
    };

    diffuser('commentaire-modifie', {
      articleId: articleTrouve._id,
      commentaire
    });

    return res.status(200).json({
      success: true,
      message: 'Commentaire modifié avec succès.',
      commentaire
    });

  } catch (error) {
    console.error('❌ Erreur modification commentaire:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du commentaire.',
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

    // 1️⃣ Récupérer l'article AVANT suppression
    const article = await Article.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article introuvable."
      });
    }

    // 2️⃣ Supprimer les images de Cloudflare R2
    if (article.images && article.images.length > 0) {
      for (const imageUrl of article.images) {

        // Exemple :
        // https://pub-xxx.r2.dev/articles/172458923-image.jpg

        const key = imageUrl.replace(`${R2_PUBLIC_URL}/`, "");

        try {
          await s3.send(
            new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: key
            })
          );

          console.log(`🗑️ Image R2 supprimée : ${key}`);

        } catch (r2Error) {
          console.error(
            `❌ Erreur suppression R2 pour ${key}:`,
            r2Error.message
          );
        }
      }
    }

    // 3️⃣ Supprimer l'article MongoDB
    await Article.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Article et fichiers associés supprimés avec succès."
    });

  } catch (error) {
    console.error("❌ Erreur suppression article :", error);

    return res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression de l'article.",
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
  modifierCommentaire,
  supprimerArticle
};