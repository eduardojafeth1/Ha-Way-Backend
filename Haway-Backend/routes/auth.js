// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController'); // Importa el controlador

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario (Cliente o Conductor)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, apellido, correo, contrasena, telefono, rol]
 *             properties:
 *               nombre: { type: string }
 *               apellido: { type: string }
 *               correo: { type: string }
 *               contrasena: { type: string }
 *               telefono: { type: string }
 *               rol: { type: string, enum: [cliente, conductor] }
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente.
 */
router.post('/register', authController.register); // Llama a la función del controlador

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [correo, contrasena]
 *             properties:
 *               correo: { type: string }
 *               contrasena: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso. Retorna el token JWT.
 */
router.post('/login', authController.login); // Llama a la función del controlador

module.exports = router;
