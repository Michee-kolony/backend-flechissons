const multer = require("multer");
const multerS3 = require("multer-s3");

const r2 = require("../config/r2");

const storage = multerS3({

    s3: r2,

    bucket: "flechissons",

    contentType: multerS3.AUTO_CONTENT_TYPE,

    key: function (req, file, cb) {

        const extension = file.originalname
            .split(".")
            .pop()
            .toLowerCase();

        const filename =
            "articles/" +
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000) +
            "." +
            extension;

        console.log("📤 Upload R2 :", filename);

        cb(null, filename);
    }

});

const upload = multer({

    storage,

    limits: {

        fileSize: 5 * 1024 * 1024,

        files: 4

    },

    fileFilter: (req, file, cb) => {

        console.log("📁 Fichier reçu :", file.originalname);
        console.log("📦 Type MIME :", file.mimetype);

        const formatsAutorises = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!formatsAutorises.includes(file.mimetype)) {

            console.log("❌ Format refusé");

            return cb(
                new Error("FORMAT_IMAGE_INVALIDE")
            );
        }

        console.log("✅ Format accepté");

        cb(null, true);
    }

});

module.exports = upload;