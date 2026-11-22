// services/conversionVideo.js
// Conversion des vidéos de prédication en MP4 H.264 (lisible partout).
//
// Les iPhone filment en HEVC (H.265) : lu par iOS et Safari, mais pas par
// Chrome / Edge / Firefox sous Windows ni par beaucoup de téléphones Android.
// Après la publication d'une prédication téléversée, la vidéo est :
//   1. téléchargée depuis R2 dans un dossier temporaire,
//   2. analysée : déjà en MP4 H.264 → rien à faire,
//   3. sinon convertie (H.264 High, 30 i/s max, AAC, « faststart » pour démarrer vite),
//   4. renvoyée sur R2 sous une nouvelle clé (…-h264.mp4),
//   5. la publication pointe vers la nouvelle vidéo, puis l'originale est supprimée.
// Pendant la conversion, l'originale reste en ligne (lisible sur iPhone).
//
// Une vidéo à la fois (file d'attente) pour ne pas saturer le serveur.
// Au démarrage, les publications pas encore vérifiées sont reprises.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const r2 = require('../config/r2');
const Article = require('../models/article');

const { bucket: R2_BUCKET, publicUrl: R2_PUBLIC_URL } = r2.parametres;

// Binaire ffmpeg : variable FFMPEG_PATH, sinon celui du paquet ffmpeg-static, sinon « ffmpeg » du système
const cheminFfmpeg = () => {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const p = require('ffmpeg-static');
    if (p && fs.existsSync(p)) return p;
  } catch { /* paquet absent */ }
  return 'ffmpeg';
};

const EXTENSIONS_VIDEO = ['mp4', 'mov', 'webm', 'm4v'];

const file = [];
const enFile = new Set();
let occupe = false;

const executer = (args) => new Promise((resolve, reject) => {
  const processus = spawn(cheminFfmpeg(), args, { windowsHide: true });
  let stderr = '';
  processus.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-20000); });
  processus.on('error', reject);
  processus.on('close', (code) => resolve({ code, stderr }));
});

// Lit les flux du fichier (ffmpeg -i écrit la description sur stderr)
const analyser = async (fichier) => {
  const { stderr } = await executer(['-hide_banner', '-i', fichier]);
  const video = /Stream #[^\n]*Video: (\w+)/.exec(stderr);
  const conteneur = /Input #0, ([\w,]+), from/.exec(stderr);
  return {
    codecVideo: video ? video[1].toLowerCase() : null,
    mp4: !!conteneur && /mp4|mov/.test(conteneur[1]) && /\.(mp4|m4v)$/i.test(fichier)
  };
};

const telecharger = async (key, destination) => {
  const reponse = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  await pipeline(reponse.Body, fs.createWriteStream(destination));
};

const convertir = async (source, destination) => {
  const { code, stderr } = await executer([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', source,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
    '-preset', 'veryfast', '-crf', '23', '-maxrate', '5M', '-bufsize', '10M',
    // 30 images/s maximum (les iPhone filment souvent en 60)
    '-vf', "fps='min(30,source_fps)'",
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-threads', '2',
    destination
  ]);
  if (code !== 0) {
    throw new Error(`ffmpeg a échoué (code ${code}) : ${stderr.slice(-500)}`);
  }
};

const envoyerSurR2 = (fichier, key) => r2.send(new PutObjectCommand({
  Bucket: R2_BUCKET,
  Key: key,
  Body: fs.createReadStream(fichier),
  ContentLength: fs.statSync(fichier).size,
  ContentType: 'video/mp4',
  CacheControl: 'public, max-age=31536000, immutable'
}));

/** Traite une publication. Retourne ce qui a été fait (pour les journaux et les tests). */
const traiterArticle = async (articleId) => {

  const article = await Article.findById(articleId).select('youtube youtubeKey mediaVerifie');
  if (!article || !article.youtubeKey || article.mediaVerifie) {
    return { action: 'ignore' };
  }

  const ancienneKey = article.youtubeKey;
  const extension = ancienneKey.split('.').pop().toLowerCase();

  // Fichier audio : rien à convertir
  if (!EXTENSIONS_VIDEO.includes(extension)) {
    await Article.updateOne({ _id: article._id }, { $set: { mediaVerifie: true } });
    return { action: 'audio' };
  }

  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'flechissons-video-'));
  const source = path.join(dossier, `source.${extension}`);
  const sortie = path.join(dossier, 'sortie.mp4');

  try {
    await telecharger(ancienneKey, source);
    const { codecVideo, mp4 } = await analyser(source);

    if (codecVideo === 'h264' && mp4) {
      await Article.updateOne({ _id: article._id }, { $set: { mediaVerifie: true } });
      return { action: 'deja-compatible', codecVideo };
    }

    console.log(`🎬 Conversion vidéo (${codecVideo || 'codec inconnu'} → H.264) : ${ancienneKey}`);
    const debut = Date.now();
    await convertir(source, sortie);

    const nouvelleKey = ancienneKey.replace(/\.[^.]+$/, '') + '-h264.mp4';
    await envoyerSurR2(sortie, nouvelleKey);
    const nouvelleUrl = `${R2_PUBLIC_URL}/${nouvelleKey}`;

    // Mise à jour seulement si la publication pointe toujours vers l'originale
    const maj = await Article.updateOne(
      { _id: article._id, youtubeKey: ancienneKey },
      { $set: { youtube: nouvelleUrl, youtubeKey: nouvelleKey, mediaVerifie: true } }
    );

    if (maj.modifiedCount === 1) {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: ancienneKey })).catch((e) =>
        console.error(`❌ Suppression de l'originale ${ancienneKey} :`, e.message));
      console.log(`✅ Vidéo convertie en ${Math.round((Date.now() - debut) / 1000)} s : ${nouvelleKey}`);
      return { action: 'convertie', codecVideo, nouvelleKey, nouvelleUrl };
    }

    // Publication supprimée ou média remplacé pendant la conversion : on jette la copie
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: nouvelleKey })).catch(() => {});
    return { action: 'abandonnee' };

  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
};

const suivant = async () => {
  if (occupe) return;
  const articleId = file.shift();
  if (!articleId) return;

  occupe = true;
  try {
    await traiterArticle(articleId);
  } catch (error) {
    // Pas de mediaVerifie : sera retentée au prochain démarrage du serveur
    console.error(`❌ Conversion vidéo de la publication ${articleId} :`, error.message);
  } finally {
    enFile.delete(String(articleId));
    occupe = false;
    setImmediate(suivant);
  }
};

/** Ajoute une publication à la file de conversion (sans attendre) */
const planifierConversion = (articleId) => {
  const id = String(articleId);
  if (enFile.has(id)) return;
  enFile.add(id);
  file.push(id);
  setImmediate(suivant);
};

/** Au démarrage : reprend les publications téléversées pas encore vérifiées */
const reprendreConversions = async () => {
  try {
    const articles = await Article.find({
      youtubeKey: { $exists: true, $nin: [null, ''] },
      mediaVerifie: { $ne: true }
    }).select('_id').lean();
    articles.forEach((a) => planifierConversion(a._id));
    if (articles.length) {
      console.log(`🎬 ${articles.length} média(s) de prédication à vérifier / convertir.`);
    }
  } catch (error) {
    console.error('❌ Reprise des conversions vidéo :', error.message);
  }
};

module.exports = { planifierConversion, reprendreConversions, traiterArticle, analyser };
