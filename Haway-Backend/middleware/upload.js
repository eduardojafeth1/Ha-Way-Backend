// middleware/upload.js
const multer = require('multer');

// Configuración de almacenamiento en memoria para Multer
const storage = multer.memoryStorage();

// 1. Configuración para Conductor (múltiples archivos)
const uploadConductorRaw = multer({
  storage: storage,
  limits: {
    fileSize: 15 * 1024 * 1024 // Límite de 15MB por archivo para soportar PDFs grandes
  }
}).fields([
  { name: 'cv', maxCount: 1 },
  { name: 'licencia', maxCount: 1 },
  { name: 'foto_perfil', maxCount: 1 },
  { name: 'foto_revision', maxCount: 1 },
  { name: 'foto_camion', maxCount: 1 }
]);

const uploadConductor = (req, res, next) => {
  uploadConductorRaw(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Error de Multer (Conductor):', err);
      return res.status(400).json({ error: `Error en la recepción de archivos: ${err.message}` });
    } else if (err) {
      console.error('Error inesperado al recibir archivos (Conductor):', err);
      return res.status(500).json({ error: 'Error interno del servidor al procesar los archivos.' });
    }
    next();
  });
};

// 2. Configuración para Cliente (únicamente foto de perfil)
const uploadClienteRaw = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // Límite de 10MB para la foto de perfil
  }
}).fields([
  { name: 'foto_perfil', maxCount: 1 }
]);

const uploadCliente = (req, res, next) => {
  uploadClienteRaw(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Error de Multer (Cliente):', err);
      return res.status(400).json({ error: `Error en la recepción del archivo: ${err.message}` });
    } else if (err) {
      console.error('Error inesperado al recibir foto (Cliente):', err);
      return res.status(500).json({ error: 'Error interno del servidor al procesar el archivo.' });
    }
    next();
  });
};

module.exports = {
  uploadConductor,
  uploadCliente
};

