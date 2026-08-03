// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token; // Formato: Bearer TOKEN o query param

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'secreto_temporal');
    // verified contiene { id_usuario, rol }
    req.usuario = verified; 
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};
