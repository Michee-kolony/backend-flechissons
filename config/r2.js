const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');

const r2 = new S3Client({
  region: 'auto',

  endpoint: 'https://75fdb20f0e6a0ac6591025a64b863028.r2.cloudflarestorage.com',

  credentials: {
    accessKeyId: 'abc2b1bb3357d23bcf0bf9cf91187586',
    secretAccessKey: 'e7e236da479fc7788200f39f08013ae4716978cb904ec5f9289b4a7b477f0b38'
  }
});

 // Important pour Cloudflare R2
    forcePathStyle: true

    
// =====================================================
// TEST CONNEXION R2
// =====================================================

const testR2 = async () => {

    try {

        console.log("🔄 Test connexion R2...");

        const command = new HeadBucketCommand({
            Bucket: "flechissons"
        });

        const result = await r2.send(command);

        console.log("✅ R2 fonctionne !");

        console.log(result);

    } catch (error) {

        console.error("❌ ERREUR R2 :");
        console.error(error);

    }

};

testR2();

module.exports = r2;