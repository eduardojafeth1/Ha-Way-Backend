// utils/cloudinary.js
const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary con variables de entorno
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Sube un buffer de archivo a Cloudinary usando upload_stream.
 * Soporta imágenes y PDFs dinámicamente gracias a resource_type: "auto".
 * 
 * @param {Buffer} fileBuffer - Buffer del archivo en memoria (Multer).
 * @param {string} folder - Carpeta destino en Cloudinary (ej. 'perfiles', 'cvs').
 * @returns {Promise<object>} - Promesa que resuelve al objeto de resultado de Cloudinary.
 */
const uploadToCloudinary = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
        resource_type: 'auto' // Soporta imágenes y documentos PDF por igual
      },
      (error, result) => {
        if (error) {
          console.error(`Error en la subida a Cloudinary en carpeta ${folder}:`, error);
          return reject(error);
        }
        resolve(result);
      }
    );
    
    // Escribir el buffer al stream
    uploadStream.end(fileBuffer);
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary
};
