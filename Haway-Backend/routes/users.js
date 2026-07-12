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
 *               nombre: { type: string, example: Samuel }
 *               apellido: { type: string, example: Paz }
 *               telefono: { type: string, example: "99990000" }
 *               direccion_predeterminada: { type: string, description: 'Solo para clientes. Se guardará en la tabla direcciones.', example: "Colonia Las Minitas, casa 4" }
 *               latitud_casa: { type: number, format: float, example: 14.0934 }
 *               longitud_casa: { type: number, format: float, example: -87.2065 }
 *               numero_licencia: { type: string, description: 'Solo para conductores.', example: "HN-55555" }
 *               licencia_conducir: { type: string, description: 'Solo por compatibilidad.', example: "HN-55555" }
 *               identidad: { type: string, description: 'Solo para conductores.', example: "0801-1990-12345" }
 *               documento_identidad: { type: string, description: 'Solo por compatibilidad.', example: "0801-1990-12345" }
 *               fecha_vencimiento: { type: string, format: date, description: 'Solo para conductores.', example: "2030-12-31" }
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente.
 */
router.put('/perfil', verificarAuth, async (req, res) => {
  const { id_usuario, rol } = req.usuario; // Extraídos del token JWT por el middleware (id_usuario y rol en mayúsculas)
  const { 
    nombre, 
    apellido, 
    telefono, 
    direccion_predeterminada, 
    latitud_casa, 
    longitud_casa, 
    numero_licencia, 
    licencia_conducir, 
    identidad, 
    documento_identidad,
    fecha_vencimiento 
  } = req.body;

  try {
    // Iniciar transacción SQL para asegurar consistencia
    await db.query('BEGIN');

    // 1. Actualizar datos comunes en la tabla 'usuarios'
    const updateUsuarioQuery = `
      UPDATE usuarios 
      SET nombre = COALESCE($1, nombre), 
          apellido = COALESCE($2, apellido), 
          telefono = COALESCE($3, telefono)
      WHERE id_usuario = $4
    `;
    await db.query(updateUsuarioQuery, [nombre, apellido, telefono, id_usuario]);

    const rolUpper = rol ? rol.toUpperCase() : '';

    // 2. Manejar datos específicos según el rol
    if (rolUpper === 'CLIENTE') {
      if (direccion_predeterminada || latitud_casa || longitud_casa) {
        // Consultar si ya tiene dirección principal
        const checkDir = await db.query(
          'SELECT id_direccion FROM direcciones WHERE id_usuario = $1 AND principal = TRUE',
          [id_usuario]
        );

        if (checkDir.rows.length > 0) {
          const updateDirQuery = `
            UPDATE direcciones 
            SET direccion = COALESCE($1, direccion),
                latitud = COALESCE($2, latitud),
                longitud = COALESCE($3, longitud)
            WHERE id_usuario = $4 AND principal = TRUE
          `;
          await db.query(updateDirQuery, [
            direccion_predeterminada, 
            latitud_casa, 
            longitud_casa, 
            id_usuario
          ]);
        } else {
          const insertDirQuery = `
            INSERT INTO direcciones (id_usuario, nombre, direccion, latitud, longitud, principal)
            VALUES ($1, 'Casa', $2, $3, $4, TRUE)
          `;
          await db.query(insertDirQuery, [
            id_usuario, 
            direccion_predeterminada || 'Dirección Principal', 
            latitud_casa || 0.0, 
            longitud_casa || 0.0
          ]);
        }
      }
    } 
    else if (rolUpper === 'CONDUCTOR') {
      const licencia = numero_licencia || licencia_conducir;
      const docIdentidad = identidad || documento_identidad;

      if (licencia || docIdentidad || fecha_vencimiento) {
        const updateConductorQuery = `
          UPDATE conductores 
          SET numero_licencia = COALESCE($1, numero_licencia),
              identidad = COALESCE($2, identidad),
              fecha_vencimiento = COALESCE($3, fecha_vencimiento)
          WHERE id_usuario = $4
        `;
        await db.query(updateConductorQuery, [
          licencia || null, 
          docIdentidad || null, 
          fecha_vencimiento || null, 
          id_usuario
        ]);
      }
    }

    // Confirmar cambios
    await db.query('COMMIT');
    res.json({ message: 'Perfil actualizado correctamente.' });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar el perfil. Los datos únicos como el teléfono, la licencia o la identidad ya podrían existir.' });
  }
});

module.exports = router;
