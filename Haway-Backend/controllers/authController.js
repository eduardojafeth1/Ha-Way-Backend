// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// LÓGICA DE REGISTRO
exports.register = async (req, res) => {
  const { 
    nombre, 
    apellido, 
    correo, 
    contrasena, // Soportar contrasena por compatibilidad
    password, 
    telefono, 
    rol,
    foto,
    // Campos específicos de conductor
    numero_licencia, 
    fecha_vencimiento, 
    identidad 
  } = req.body;

  const passwordInput = password || contrasena;

  if (!nombre || !apellido || !correo || !passwordInput || !telefono || !rol) {
    return res.status(400).json({ error: 'Todos los campos obligatorios (nombre, apellido, correo, password, telefono, rol) deben ser completados.' });
  }

  const rolUpper = rol.toUpperCase();
  if (rolUpper !== 'CLIENTE' && rolUpper !== 'CONDUCTOR') {
    return res.status(400).json({ error: 'El rol debe ser "CLIENTE" o "CONDUCTOR".' });
  }

  try {
    // Verificar si el correo o el teléfono ya están registrados
    const existeUsuario = await db.query(
      'SELECT id_usuario FROM usuarios WHERE correo = $1 OR telefono = $2', 
      [correo, telefono]
    );
    
    if (existeUsuario.rows.length > 0) {
      return res.status(400).json({ error: 'El correo o el teléfono ya están registrados.' });
    }

    const salt = await bcrypt.genSalt(10);
    const contrasenaHash = await bcrypt.hash(passwordInput, salt);

    await db.query('BEGIN');

    // Insertar en la tabla usuarios
    const insertarUsuarioQuery = `
      INSERT INTO usuarios (rol, nombre, apellido, correo, telefono, password, foto, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVO')
      RETURNING id_usuario, rol, nombre, apellido, correo, telefono, foto, estado;
    `;
    
    const nuevoUsuarioResult = await db.query(insertarUsuarioQuery, [
      rolUpper, nombre, apellido, correo, telefono, contrasenaHash, foto || null
    ]);
    
    const nuevoUsuario = nuevoUsuarioResult.rows[0];

    // Si el rol es CONDUCTOR, insertar datos específicos obligatorios
    if (rolUpper === 'CONDUCTOR') {
      if (!numero_licencia || !fecha_vencimiento || !identidad) {
        throw new Error('Los conductores requieren numero_licencia, fecha_vencimiento e identidad.');
      }
      
      const insertarConductorQuery = `
        INSERT INTO conductores (id_usuario, numero_licencia, fecha_vencimiento, identidad, disponible, estado)
        VALUES ($1, $2, $3, $4, FALSE, 'PENDIENTE');
      `;
      await db.query(insertarConductorQuery, [
        nuevoUsuario.id_usuario, 
        numero_licencia, 
        fecha_vencimiento, 
        identidad
      ]);
    }

    await db.query('COMMIT');
    res.status(201).json({ message: 'Usuario registrado exitosamente.', usuario: nuevoUsuario });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
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
