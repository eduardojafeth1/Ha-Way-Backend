// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// LÓGICA DE REGISTRO
exports.register = async (req, res) => {
  const { 
    nombre, apellido, correo, contrasena, telefono, rol,
    direccion_predeterminada, licencia_conducir, documento_identidad 
  } = req.body;

  if (!nombre || !apellido || !correo || !contrasena || !telefono || !rol) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
  }

  if (rol !== 'cliente' && rol !== 'conductor') {
    return res.status(400).json({ error: 'El rol debe ser "cliente" o "conductor".' });
  }

  try {
    const existeUsuario = await db.query(
      'SELECT id FROM usuarios WHERE correo = $1 OR telefono = $2', 
      [correo, telefono]
    );
    
    if (existeUsuario.rows.length > 0) {
      return res.status(400).json({ error: 'El correo o el teléfono ya están registrados.' });
    }

    const salt = await bcrypt.genSalt(10);
    const contrasenaHash = await bcrypt.hash(contrasena, salt);

    await db.query('BEGIN');

    const insertarUsuarioQuery = `
      INSERT INTO usuarios (nombre, apellido, correo, contrasena_hash, telefono, rol)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, nombre, apellido, correo, rol;
    `;
    
    const nuevoUsuarioResult = await db.query(insertarUsuarioQuery, [
      nombre, apellido, correo, contrasenaHash, telefono, rol
    ]);
    
    const nuevoUsuario = nuevoUsuarioResult.rows[0];

    if (rol === 'cliente') {
      const insertarClienteQuery = `INSERT INTO clientes (id, direccion_predeterminada) VALUES ($1, $2);`;
      await db.query(insertarClienteQuery, [nuevoUsuario.id, direccion_predeterminada || null]);
    } 
    else if (rol === 'conductor') {
      if (!licencia_conducir || !documento_identidad) {
        throw new Error('Los conductores requieren licencia y documento de identidad.');
      }
      const insertarConductorQuery = `
        INSERT INTO conductores (id, licencia_conducir, documento_identidad, estado_disponibilidad)
        VALUES ($1, $2, $3, 'inactivo');
      `;
      await db.query(insertarConductorQuery, [nuevoUsuario.id, licencia_conducir, documento_identidad]);
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
  const { correo, contrasena } = req.body;

  try {
    const userQuery = await db.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
    if (userQuery.rows.length === 0) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const usuario = userQuery.rows[0];

    const validPassword = await bcrypt.compare(contrasena, usuario.contrasena_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos.' });
    }

    db.query('UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id = $1', [usuario.id]);

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET || 'secreto_temporal',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo: usuario.correo,
        rol: usuario.rol
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};
