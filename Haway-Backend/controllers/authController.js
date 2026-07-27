// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { uploadToCloudinary } = require('../utils/cloudinary');

// LÓGICA DE REGISTRO
exports.register = async (req, res) => {
  const { 
    nombre, 
    apellido, 
    correo, 
    contrasena, // Soportar contrasena por compatibilidad
    password, 
    telefono, 
    foto // URL opcional en texto para compatibilidad
  } = req.body;

  const passwordInput = password || contrasena;

  // 1. Validación de campos obligatorios
  if (!nombre || !apellido || !correo || !passwordInput || !telefono) {
    return res.status(400).json({ error: 'Todos los campos obligatorios (nombre, apellido, correo, password, telefono) deben ser completados.' });
  }

  // 2. Procesar subida de foto de perfil a Cloudinary si existe
  let urlFotoPerfil = foto || null;
  if (req.files && req.files['foto_perfil'] && req.files['foto_perfil'][0]) {
    try {
      const fileFotoPerfil = req.files['foto_perfil'][0];
      const resultCloudinary = await uploadToCloudinary(fileFotoPerfil.buffer, 'perfiles');
      urlFotoPerfil = resultCloudinary.secure_url;
    } catch (cloudinaryError) {
      console.error('Error al subir foto de perfil de cliente a Cloudinary:', cloudinaryError);
      return res.status(500).json({ error: 'Error al subir la foto de perfil a Cloudinary. Por favor intente de nuevo.' });
    }
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const contrasenaHash = await bcrypt.hash(passwordInput, salt);

    await db.query('BEGIN');

    // Insertar en la tabla usuarios con rol='CLIENTE'
    const insertarUsuarioQuery = `
      INSERT INTO usuarios (rol, nombre, apellido, correo, telefono, password, foto, estado)
      VALUES ('CLIENTE', $1, $2, $3, $4, $5, $6, 'ACTIVO')
      RETURNING id_usuario, rol, nombre, apellido, correo, telefono, foto, estado;
    `;
    
    const nuevoUsuarioResult = await db.query(insertarUsuarioQuery, [
      nombre, apellido, correo, telefono, contrasenaHash, urlFotoPerfil
    ]);
    
    const nuevoUsuario = nuevoUsuarioResult.rows[0];

    await db.query('COMMIT');
    res.status(201).json({ message: 'Usuario registrado exitosamente.', usuario: nuevoUsuario });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Error al registrar cliente:', err);

    // Responder de forma clara si hay duplicación de campos únicos (código 23505)
    if (err.code === '23505') {
      let errorMessage = 'El correo o el teléfono ya están registrados.';
      if (err.constraint === 'usuarios_correo_key') {
        errorMessage = 'El correo electrónico ya está registrado.';
      } else if (err.constraint === 'usuarios_telefono_key') {
        errorMessage = 'El número de teléfono ya está registrado.';
      }
      return res.status(400).json({ error: errorMessage });
    }

    res.status(500).json({ error: err.message || 'Error interno al registrar el usuario.' });
  }
};

// LÓGICA DE LOGIN
exports.login = async (req, res) => {
  const { correo, contrasena, password } = req.body;
  const passwordInput = password || contrasena;

  if (!correo || !passwordInput) {
    return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
  }

  try {
    const userQuery = await db.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const usuario = userQuery.rows[0];

    // Comparar contraseña con el campo password
    const validPassword = await bcrypt.compare(passwordInput, usuario.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    // Actualizar el campo ultimo_acceso en vez de ultimo_login
    await db.query('UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id_usuario = $1', [usuario.id_usuario]);

    const token = jwt.sign(
      { id_usuario: usuario.id_usuario, rol: usuario.rol },
      process.env.JWT_SECRET || 'secreto_temporal',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id_usuario: usuario.id_usuario,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        telefono: usuario.telefono,
        rol: usuario.rol,
        foto: usuario.foto,
        estado: usuario.estado
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
