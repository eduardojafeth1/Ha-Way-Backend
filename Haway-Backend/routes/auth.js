// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { uploadCliente } = require('../middleware/upload');

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario (Exclusivo Cliente con foto de perfil)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [nombre, apellido, correo, password, telefono]
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Samuel
 *               apellido:
 *                 type: string
 *                 example: Paz
 *               correo:
 *                 type: string
 *                 example: samuel@gmail.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *               contrasena:
 *                 type: string
 *                 description: Soportado por compatibilidad (equivalente a password)
 *                 example: "123456"
 *               telefono:
 *                 type: string
 *                 example: "99990000"
 *               foto_perfil:
 *                 type: string
 *                 format: binary
 *                 description: Archivo de foto de perfil (Imagen opcional)
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 usuario:
 *                   type: object
 *                   properties:
 *                     id_usuario:
 *                       type: integer
 *                     rol:
 *                       type: string
 *                     nombre:
 *                       type: string
 *                     apellido:
 *                       type: string
 *                     correo:
 *                       type: string
 *                     telefono:
 *                       type: string
 *                     foto:
 *                       type: string
 *                     estado:
 *                       type: string
 *       400:
 *         description: Error en los datos proporcionados (usuario duplicado, campos faltantes, etc.)
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/register', uploadCliente, authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión y obtener token JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [correo, password]
 *             properties:
 *               correo:
 *                 type: string
 *                 example: samuel@gmail.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *               contrasena:
 *                 type: string
 *                 description: Soportado por compatibilidad (equivalente a password)
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login exitoso. Retorna el token JWT.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 usuario:
 *                   type: object
 *                   properties:
 *                     id_usuario:
 *                       type: integer
 *                     nombre:
 *                       type: string
 *                     apellido:
 *                       type: string
 *                     correo:
 *                       type: string
 *                     telefono:
 *                       type: string
 *                     rol:
 *                       type: string
 *                     foto:
 *                       type: string
 *                     estado:
 *                       type: string
 *       400:
 *         description: Correo o contraseña incorrectos, o campos faltantes.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/login', authController.login);

module.exports = router;
