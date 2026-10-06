const multer = require("multer");
const multerS3 = require("multer-s3");

const r2 = require("../config/r2");

// =====================================================
// FORMATS AUTORISÉS (PHOTO DE PROFIL)
// Tous les formats image courants sauf GIF (animé)
// et SVG (peut contenir du code)
// =====================================================

const MIME_AUTORISES = [
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/png",
    "image/x-png",
    "image/webp",
    "image/avif",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
    "image/bmp",
    "image/x-ms-bmp",
    "image/tiff",
    "image/jxl"
];

const EXTENSIONS_AUTORISEES = [
    "jpg",
    "jpeg",
    "jfif",
    "pjpeg",
    "pjp",
    "png",
    "webp",
    "avif",
    "heic",
    "heif",
    "bmp",
    "tif",
    "tiff",
    "jxl"
];

const TAILLE_MAX_MO = 10;

const getExtension = (nomFichier) =>
    nomFichier.split(".").pop().toLowerCase();

const storage = multerS3({

    s3: r2,

    bucket: "flechissons",

    contentType: multerS3.AUTO_CONTENT_TYPE,

    key: function (req, file, cb) {

        const filename =
            "profils/" +
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000) +
            "." +
            getExtension(file.originalname);

        console.log("📤 Upload R2 profil :", filename);

        cb(null, filename);
    }

});

const uploadProfil = multer({

    storage,

    limits: {

        fileSize: TAILLE_MAX_MO * 1024 * 1024,

        files: 1

    },

    fileFilter: (req, file, cb) => {

        console.log("📁 Fichier profil reçu :", file.originalname);
        console.log("📦 Type MIME :", file.mimetype);

        const extension = getExtension(file.originalname);

        // Certains navigateurs envoient les HEIC (iPhone) sans type MIME
        // précis : on accepte alors en se basant sur l'extension
        const mimeGenerique =
            !file.mimetype ||
            file.mimetype === "application/octet-stream";

        const accepte =
            MIME_AUTORISES.includes(file.mimetype) ||
            (mimeGenerique && EXTENSIONS_AUTORISEES.includes(extension));

        if (!accepte) {

            console.log("❌ Format refusé");

            return cb(
                new Error("FORMAT_IMAGE_INVALIDE")
            );
        }

        console.log("✅ Format accepté");

        cb(null, true);
    }

});

uploadProfil.TAILLE_MAX_MO = TAILLE_MAX_MO;

module.exports = uploadProfil;
