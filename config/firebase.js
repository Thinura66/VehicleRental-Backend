const admin = require('firebase-admin');

const initializeFirebase = () => {
  try {
    if (!admin.apps.length) {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });

      console.log('🔥 Firebase Admin initialized successfully');
    }
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    throw error;
  }
};

const bucket = () => {
  if (!admin.apps.length) {
    initializeFirebase();
  }
  return admin.storage().bucket();
};

const uploadToFirebase = async (file, folder = 'vehicles') => {
  try {
    const fileName = `${folder}/${Date.now()}_${file.originalname}`;
    const fileUpload = bucket().file(fileName);

    const stream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    return new Promise((resolve, reject) => {
      stream.on('error', (error) => {
        console.error('Upload error:', error);
        reject(error);
      });

      stream.on('finish', async () => {
        try {
          // Make the file public
          await fileUpload.makePublic();
          
          const publicUrl = `https://storage.googleapis.com/${bucket().name}/${fileName}`;
          
          resolve({
            url: publicUrl,
            filename: fileName,
            originalName: file.originalname
          });
        } catch (error) {
          reject(error);
        }
      });

      stream.end(file.buffer);
    });
  } catch (error) {
    console.error('Firebase upload error:', error);
    throw error;
  }
};

const deleteFromFirebase = async (filename) => {
  try {
    await bucket().file(filename).delete();
    console.log(`File ${filename} deleted successfully`);
  } catch (error) {
    console.error('Error deleting file from Firebase:', error);
    throw error;
  }
};

module.exports = {
  initializeFirebase,
  uploadToFirebase,
  deleteFromFirebase,
  bucket
};
