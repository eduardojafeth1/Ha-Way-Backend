// routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const verificarAuth = require('../middleware/auth');

/**
 * @openapi
 * /users/perfil:
 *   put:
 *     summary: Actualizar datos del perfil del usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               apellido: { type: string }
 *               telefono: { type: string }
 *               direccion_predeterminada: { type: string, description: 'Solo para clientes' }
 *               licencia_conducir: { type: string, description: 'Solo para conductores' }
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente.
 */
router.put('/perfil', verificarAuth, async (req, res) => {
  const { id, rol } = req.usuario; // Extraídos del token JWT por el middleware
  const { nombre, apellido, telefono, direccion_predeterminada, latitud_casa, longitud_casa, licencia_conducir, documento_identidad } = req.body;

  try {
    // Iniciar transacción SQL para asegurar que ambas tablas se actualicen juntas
    await db.query('BEGIN');

    // 1. Actualizar datos comunes en la tabla 'usuarios'
    const updateUsuarioQuery = `
      UPDATE usuarios 
      SET nombre = COALESCE($1, nombre), 
          apellido = COALESCE($2, apellido), 
          telefono = COALESCE($3, telefono)
      WHERE id = $4
    `;
    await db.query(updateUsuarioQuery, [nombre, apellido, telefono, id]);

    // 2. Actualizar tabla específica según el rol del usuario
    if (rol === 'cliente') {
      const updateClienteQuery = `
        UPDATE clientes 
        SET direccion_predeterminada = COALESCE($1, direccion_predeterminada),
            latitud_casa = COALESCE($2, latitud_casa),
            longitud_casa = COALESCE($3, longitud_casa)
        WHERE id = $4
      `;
      await db.query(updateClienteQuery, [direccion_predeterminada, latitud_casa, longitud_casa, id]);
    } 
    else if (rol === 'conductor') {
      const updateConductorQuery = `
        UPDATE conductores 
        SET licencia_conducir = COALESCE($1, licencia_conducir),
            documento_identidad = COALESCE($2, documento_identidad)
        WHERE id = $3
      `;
      await db.query(updateConductorQuery, [licencia_conducir, documento_identidad, id]);
    }

    // Confirmar cambios en la base de datos
    await db.query('COMMIT');
    res.json({ message: 'Perfil actualizado correctamente.' });

  } catch (err) {
    await db.query('ROLLBACK'); // Cancelar cambios si algo falla
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el perfil. Los datos únicos como el teléfono ya podrían existir.' });
  }
});

module.exports = router;
