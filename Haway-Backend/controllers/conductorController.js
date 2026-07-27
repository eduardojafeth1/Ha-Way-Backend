// controllers/conductorController.js
const db = require('../db');
const bcrypt = require('bcryptjs');
const { uploadToCloudinary } = require('../utils/cloudinary');

// Helper para obtener el id_conductor a partir del id_usuario
const getConductorId = async (id_usuario) => {
  const result = await db.query(
    'SELECT id_conductor FROM conductores WHERE id_usuario = $1',
    [id_usuario]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0].id_conductor;
};

// 1. Obtener solicitudes de transporte disponibles para ofertar (PUBLICADA o RECIBIENDO_OFERTAS)
exports.getSolicitudesDisponibles = async (req, res) => {
  try {
    const query = `
      SELECT s.*, d.direccion, d.referencia, d.latitud, d.longitud, d.nombre AS nombre_direccion,
             u.nombre AS cliente_nombre, u.apellido AS cliente_apellido
      FROM solicitudes s
      JOIN direcciones d ON s.id_direccion = d.id_direccion
      JOIN usuarios u ON s.id_cliente = u.id_usuario
      WHERE s.estado IN ('PUBLICADA', 'RECIBIENDO_OFERTAS')
      ORDER BY s.fecha_publicacion DESC;
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor al obtener solicitudes disponibles.' });
  }
};

// 2. Crear una oferta para una solicitud
exports.createOferta = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  const { id_solicitud, id_camion, precio, tiempo_estimado, distancia, mensaje } = req.body;

  if (!id_solicitud || !id_camion || !precio || !tiempo_estimado) {
    return res.status(400).json({ error: 'Los campos id_solicitud, id_camion, precio y tiempo_estimado son obligatorios.' });
  }

  const precioNum = parseFloat(precio);
  if (isNaN(precioNum) || precioNum <= 0) {
    return res.status(400).json({ error: 'El precio debe ser un número positivo.' });
  }

  const tiempoNum = parseInt(tiempo_estimado, 10);
  if (isNaN(tiempoNum) || tiempoNum <= 0) {
    return res.status(400).json({ error: 'El tiempo estimado debe ser un número entero de minutos positivo.' });
  }

  try {
    // Obtener id_conductor
    const id_conductor = await getConductorId(id_usuario);
    if (!id_conductor) {
      return res.status(404).json({ error: 'Perfil de conductor no encontrado.' });
    }

    // Validar que el camión pertenezca al conductor
    const camionQuery = await db.query(
      'SELECT id_camion, estado FROM camiones WHERE id_camion = $1 AND id_conductor = $2',
      [id_camion, id_conductor]
    );
    if (camionQuery.rows.length === 0) {
      return res.status(403).json({ error: 'El camión especificado no te pertenece o no existe.' });
    }
    if (camionQuery.rows[0].estado !== 'ACTIVO') {
      return res.status(400).json({ error: 'El camión no se encuentra activo.' });
    }

    // Validar estado de la solicitud
    const solQuery = await db.query(
      'SELECT estado FROM solicitudes WHERE id_solicitud = $1',
      [id_solicitud]
    );
    if (solQuery.rows.length === 0) {
      return res.status(404).json({ error: 'La solicitud no existe.' });
    }

    const solicitud = solQuery.rows[0];
    if (solicitud.estado !== 'PUBLICADA' && solicitud.estado !== 'RECIBIENDO_OFERTAS') {
      return res.status(400).json({ error: `La solicitud no está abierta para ofertas (estado actual: ${solicitud.estado}).` });
    }

    // Verificar si el conductor ya realizó una oferta activa en esta solicitud
    const existingQuery = await db.query(
      "SELECT id_oferta FROM ofertas WHERE id_solicitud = $1 AND id_conductor = $2 AND estado != 'CANCELADA'",
      [id_solicitud, id_conductor]
    );
    if (existingQuery.rows.length > 0) {
      return res.status(400).json({ error: 'Ya has realizado una oferta para esta solicitud.' });
    }

    await db.query('BEGIN');

    // Insertar oferta
    const insertOfertaQuery = `
      INSERT INTO ofertas (id_solicitud, id_conductor, id_camion, precio, tiempo_estimado, distancia, mensaje, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDIENTE')
      RETURNING *;
    `;
    const result = await db.query(insertOfertaQuery, [
      id_solicitud,
      id_conductor,
      id_camion,
      precioNum,
      tiempoNum,
      distancia ? parseFloat(distancia) : null,
      mensaje || null
    ]);

    // Si la solicitud estaba PUBLICADA, actualizarla a RECIBIENDO_OFERTAS
    if (solicitud.estado === 'PUBLICADA') {
      await db.query(
        "UPDATE solicitudes SET estado = 'RECIBIENDO_OFERTAS' WHERE id_solicitud = $1",
        [id_solicitud]
      );
    }

    await db.query('COMMIT');
    res.status(201).json({
      message: 'Oferta enviada exitosamente.',
      oferta: result.rows[0]
    });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor al crear la oferta.' });
  }
};

// 3. Obtener ofertas realizadas por el conductor
exports.getOfertas = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;

  try {
    const id_conductor = await getConductorId(id_usuario);
    if (!id_conductor) {
      return res.status(404).json({ error: 'Perfil de conductor no encontrado.' });
    }

    const query = `
      SELECT o.*, s.cantidad, s.unidad_medida, s.estado AS solicitud_estado,
             d.direccion, d.referencia, d.nombre AS nombre_direccion
      FROM ofertas o
      JOIN solicitudes s ON o.id_solicitud = s.id_solicitud
      JOIN direcciones d ON s.id_direccion = d.id_direccion
      WHERE o.id_conductor = $1
      ORDER BY o.fecha_oferta DESC;
    `;
    const result = await db.query(query, [id_conductor]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al obtener tus ofertas.' });
  }
};

// 4. Cancelar/Retirar una oferta
exports.cancelarOferta = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  const { id } = req.params;

  try {
    const id_conductor = await getConductorId(id_usuario);
    if (!id_conductor) {
      return res.status(404).json({ error: 'Perfil de conductor no encontrado.' });
    }

    // Verificar existencia y pertenencia
    const ofQuery = await db.query(
      'SELECT id_oferta, estado, id_solicitud FROM ofertas WHERE id_oferta = $1 AND id_conductor = $2',
      [id, id_conductor]
    );

    if (ofQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Oferta no encontrada o no te pertenece.' });
    }

    const oferta = ofQuery.rows[0];
    if (oferta.estado !== 'PENDIENTE') {
      return res.status(400).json({ error: `No se puede cancelar una oferta en estado: ${oferta.estado}.` });
    }

    await db.query('BEGIN');

    // Cancelar la oferta
    const result = await db.query(
      "UPDATE ofertas SET estado = 'CANCELADA' WHERE id_oferta = $1 RETURNING *",
      [id]
    );

    // Si ya no quedan ofertas activas en la solicitud, devolverla a PUBLICADA
    const checkActiveOffers = await db.query(
      "SELECT id_oferta FROM ofertas WHERE id_solicitud = $1 AND estado = 'PENDIENTE'",
      [oferta.id_solicitud]
    );
    if (checkActiveOffers.rows.length === 0) {
      await db.query(
        "UPDATE solicitudes SET estado = 'PUBLICADA' WHERE id_solicitud = $1 AND estado = 'RECIBIENDO_OFERTAS'",
        [oferta.id_solicitud]
      );
    }

    await db.query('COMMIT');
    res.json({
      message: 'Oferta cancelada/retirada exitosamente.',
      oferta: result.rows[0]
    });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno al cancelar la oferta.' });
  }
};

// 5. Obtener pedidos asignados al conductor
exports.getPedidos = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;

  try {
    const id_conductor = await getConductorId(id_usuario);
    if (!id_conductor) {
      return res.status(404).json({ error: 'Perfil de conductor no encontrado.' });
    }

    const query = `
      SELECT p.*, o.precio, o.tiempo_estimado, s.cantidad, s.unidad_medida, s.descripcion AS solicitud_descripcion,
             d.direccion, d.referencia, d.latitud AS dest_latitud, d.longitud AS dest_longitud,
             u_cli.nombre AS cliente_nombre, u_cli.apellido AS cliente_apellido, u_cli.telefono AS cliente_telefono,
             cam.placa AS camion_placa, cam.marca AS camion_marca, cam.modelo AS camion_modelo,
             pag.total AS pago_total, pag.estado AS pago_estado, pag.metodo AS pago_metodo
      FROM pedidos p
      JOIN solicitudes s ON p.id_solicitud = s.id_solicitud
      JOIN direcciones d ON s.id_direccion = d.id_direccion
      JOIN usuarios u_cli ON s.id_cliente = u_cli.id_usuario
      JOIN ofertas o ON p.id_oferta = o.id_oferta
      JOIN camiones cam ON o.id_camion = cam.id_camion
      LEFT JOIN pagos pag ON p.id_pedido = pag.id_pedido
      WHERE o.id_conductor = $1
      ORDER BY p.fecha_inicio DESC;
    `;
    const result = await db.query(query, [id_conductor]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al obtener los pedidos.' });
  }
};

// 6. Obtener detalles de un pedido específico del conductor
exports.getPedidoById = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  const { id } = req.params;

  try {
    const id_conductor = await getConductorId(id_usuario);
    if (!id_conductor) {
      return res.status(404).json({ error: 'Perfil de conductor no encontrado.' });
    }

    const pedQuery = `
      SELECT p.*, o.precio, o.tiempo_estimado, s.cantidad, s.unidad_medida, s.descripcion AS solicitud_descripcion,
             d.direccion, d.referencia, d.latitud AS dest_latitud, d.longitud AS dest_longitud,
             u_cli.nombre AS cliente_nombre, u_cli.apellido AS cliente_apellido, 
             u_cli.telefono AS cliente_telefono, u_cli.foto AS cliente_foto,
             cam.placa AS camion_placa, cam.marca AS camion_marca, cam.modelo AS camion_modelo, cam.color AS camion_color,
             pag.total AS pago_total, pag.estado AS pago_estado, pag.metodo AS pago_metodo
      FROM pedidos p
      JOIN solicitudes s ON p.id_solicitud = s.id_solicitud
      JOIN direcciones d ON s.id_direccion = d.id_direccion
      JOIN usuarios u_cli ON s.id_cliente = u_cli.id_usuario
      JOIN ofertas o ON p.id_oferta = o.id_oferta
      JOIN camiones cam ON o.id_camion = cam.id_camion
      LEFT JOIN pagos pag ON p.id_pedido = pag.id_pedido
      WHERE p.id_pedido = $1 AND o.id_conductor = $2;
    `;
    const pedResult = await db.query(pedQuery, [id, id_conductor]);

    if (pedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado o no está asignado a tu cuenta.' });
    }

    const segQuery = `
      SELECT id_seguimiento, estado, descripcion, latitud, longitud, fecha
      FROM seguimientos
      WHERE id_pedido = $1
      ORDER BY fecha DESC;
    `;
    const segResult = await db.query(segQuery, [id]);

    res.json({
      pedido: pedResult.rows[0],
      historial_seguimiento: segResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al obtener los detalles del pedido.' });
  }
};

// 7. Actualizar el estado de un pedido (Conductor)
exports.updatePedidoEstado = async (req, res) => {
  const id_usuario = req.usuario.id_usuario;
  const { id } = req.params;
  const { estado, descripcion, latitud, longitud } = req.body;

  if (!estado) {
    return res.status(400).json({ error: 'El campo estado es obligatorio.' });
  }

  const estadoUpper = estado.toUpperCase();
  const validEstados = ['PENDIENTE', 'PREPARANDO', 'EN_CAMINO', 'LLEGO', 'ENTREGADO', 'CANCELADO'];
  if (!validEstados.includes(estadoUpper)) {
    return res.status(400).json({ error: `Estado inválido. Los estados permitidos son: ${validEstados.join(', ')}` });
  }

  try {
    const id_conductor = await getConductorId(id_usuario);
    if (!id_conductor) {
      return res.status(404).json({ error: 'Perfil de conductor no encontrado.' });
    }

    // Obtener pedido actual y validar pertenencia
    const pedQuery = `
      SELECT p.*, o.id_conductor, s.id_solicitud
      FROM pedidos p
      JOIN ofertas o ON p.id_oferta = o.id_oferta
      JOIN solicitudes s ON p.id_solicitud = s.id_solicitud
      WHERE p.id_pedido = $1;
    `;
    const pedResult = await db.query(pedQuery, [id]);

    if (pedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }

    const pedido = pedResult.rows[0];
    if (pedido.id_conductor !== id_conductor) {
      return res.status(403).json({ error: 'No tienes permiso para actualizar este pedido.' });
    }

    // Validar transición de estados
    const currentEstado = pedido.estado;
    if (currentEstado === 'ENTREGADO' || currentEstado === 'CANCELADO') {
      return res.status(400).json({ error: 'No se puede modificar un pedido que ya está finalizado (ENTREGADO o CANCELADO).' });
    }

    // Validaciones de flujo secuencial (opcional pero recomendado para consistencia del negocio)
    if (estadoUpper !== 'CANCELADO') {
      const flow = {
        'PENDIENTE': ['PREPARANDO', 'EN_CAMINO'],
        'PREPARANDO': ['EN_CAMINO'],
        'EN_CAMINO': ['LLEGO'],
        'LLEGO': ['ENTREGADO']
      };
      if (flow[currentEstado] && !flow[currentEstado].includes(estadoUpper)) {
        return res.status(400).json({ 
          error: `Transición de estado no permitida. De "${currentEstado}" no puedes pasar a "${estadoUpper}".` 
        });
      }
    }

    await db.query('BEGIN');

    // 1. Actualizar el pedido
    const updatePedQuery = `
      UPDATE pedidos
      SET estado = $1::varchar,
          fecha_fin = CASE WHEN $1::varchar = 'ENTREGADO' THEN CURRENT_TIMESTAMP ELSE fecha_fin END
      WHERE id_pedido = $2
      RETURNING *;
    `;
    const updateResult = await db.query(updatePedQuery, [estadoUpper, id]);
    const updatedPedido = updateResult.rows[0];

    // 2. Mapear estado de pedido a estado de seguimiento
    // ck_estadoseguimiento: PEDIDO_CONFIRMADO, PREPARANDO, EN_CAMINO, LLEGO, ENTREGADO
    let segEstado = estadoUpper;
    if (estadoUpper === 'PENDIENTE') segEstado = 'PEDIDO_CONFIRMADO';

    // Insertar seguimiento (si es CANCELADO, no tiene un estado directo de seguimiento en ck_estadoseguimiento,
    // pero podemos registrarlo en seguimientos si la base de datos lo permite o saltarlo. 
    // Mirando la DDL: CONSTRAINT "ck_estadoseguimiento" CHECK (estado IN ('PEDIDO_CONFIRMADO', 'PREPARANDO', 'EN_CAMINO', 'LLEGO', 'ENTREGADO'))
    // Por lo tanto, para CANCELADO no insertamos seguimiento en esa tabla (o registramos el último paso como LLEGO y saltamos, o arrojamos error).
    // Para evitar violar el constraint ck_estadoseguimiento, solo insertamos en seguimientos si no es CANCELADO.
    if (segEstado !== 'CANCELADO') {
      const insertSegQuery = `
        INSERT INTO seguimientos (id_pedido, estado, descripcion, latitud, longitud)
        VALUES ($1, $2, $3, $4, $5);
      `;
      await db.query(insertSegQuery, [
        id,
        segEstado,
        descripcion || `Cambio de estado del pedido a ${estadoUpper}.`,
        latitud ? parseFloat(latitud) : null,
        longitud ? parseFloat(longitud) : null
      ]);
    }

    // 3. Acciones adicionales al entregar
    if (estadoUpper === 'ENTREGADO') {
      // Registrar pago como PAGADO
      await db.query(
        "UPDATE pagos SET estado = 'PAGADO', fecha_pago = CURRENT_TIMESTAMP WHERE id_pedido = $1",
        [id]
      );

      // Incrementar viajes realizados del conductor
      await db.query(
        "UPDATE conductores SET viajes_realizados = viajes_realizados + 1 WHERE id_conductor = $1",
        [id_conductor]
      );
      
      // Actualizar estado del camión a ACTIVO
      // (Por si acaso, asegurar que esté disponible)
    }

    // 4. Acciones adicionales al cancelar
    if (estadoUpper === 'CANCELADO') {
      // Cancelar la solicitud asociada para volver a disponibilizarla, o dejarla como cancelada
      await db.query(
        "UPDATE solicitudes SET estado = 'CANCELADA' WHERE id_solicitud = $1",
        [pedido.id_solicitud]
      );
      
      // Cancelar la oferta asociada
      await db.query(
        "UPDATE ofertas SET estado = 'CANCELADA' WHERE id_oferta = $1",
        [pedido.id_oferta]
      );
    }

    await db.query('COMMIT');

    res.json({
      message: `Pedido actualizado a ${estadoUpper} exitosamente.`,
      pedido: updatedPedido
    });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor al actualizar el estado del pedido.' });
  }
};

// =========================================================================
// REGISTRO COMPLETO DE CONDUCTOR (Paso 1, 2 y 3) con Cloudinary y Transacciones
// =========================================================================
exports.registrarConductor = async (req, res) => {
  // 1. Extraer los datos del cuerpo de la petición
  const {
    // Datos de usuario (Paso 1)
    nombre,
    apellido,
    correo,
    password,
    contrasena,
    telefono,
    
    // Datos de conductor (Paso 1)
    numero_licencia,
    fecha_vencimiento,
    identidad,
    nombre_empresa,
    rtn,
    motivo_solicitud,
    
    // Datos del camión (Paso 3)
    placa,
    marca,
    modelo,
    anio,
    capacidad_galones,
    color,
    revision_tecnica
  } = req.body;

  const passwordInput = password || contrasena;

  // 2. Validación de campos de texto obligatorios
  if (!nombre || !apellido || !correo || !passwordInput || !telefono ||
      !numero_licencia || !fecha_vencimiento || !identidad ||
      !placa || !capacidad_galones) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el registro del conductor.' });
  }

  // Validar capacidad_galones como número
  const capacidadNum = parseInt(capacidad_galones, 10);
  if (isNaN(capacidadNum) || capacidadNum <= 0) {
    return res.status(400).json({ error: 'La capacidad en galones debe ser un número entero positivo.' });
  }

  // Validar año del camión si se envía
  let anioNum = null;
  if (anio) {
    anioNum = parseInt(anio, 10);
    if (isNaN(anioNum) || anioNum <= 0) {
      return res.status(400).json({ error: 'El año del camión debe ser un número positivo.' });
    }
  }

  // 3. Validación de archivos requeridos (Paso 2)
  if (!req.files || 
      !req.files['cv'] || 
      !req.files['licencia'] || 
      !req.files['foto_perfil'] || 
      !req.files['foto_revision'] || 
      !req.files['foto_camion']) {
    return res.status(400).json({ 
      error: 'Se requieren todos los archivos del registro: cv, licencia, foto_perfil, foto_revision, foto_camion.' 
    });
  }

  // Variables para almacenar las URLs de Cloudinary
  let urlFotoPerfil = '';
  let urlCv = '';
  let urlLicencia = '';
  let urlFotoRevision = '';
  let urlFotoCamion = '';

  try {
    // 4. Subir archivos a Cloudinary concurrentemente
    const fileCv = req.files['cv'][0];
    const fileLicencia = req.files['licencia'][0];
    const fileFotoPerfil = req.files['foto_perfil'][0];
    const fileFotoRevision = req.files['foto_revision'][0];
    const fileFotoCamion = req.files['foto_camion'][0];

    // Subir a Cloudinary organizados por carpetas
    const [resPerfil, resCv, resLicencia, resRevision, resCamion] = await Promise.all([
      uploadToCloudinary(fileFotoPerfil.buffer, 'perfiles'),
      uploadToCloudinary(fileCv.buffer, 'cvs'),
      uploadToCloudinary(fileLicencia.buffer, 'licencias'),
      uploadToCloudinary(fileFotoRevision.buffer, 'revisiones'),
      uploadToCloudinary(fileFotoCamion.buffer, 'camiones')
    ]);

    urlFotoPerfil = resPerfil.secure_url;
    urlCv = resCv.secure_url;
    urlLicencia = resLicencia.secure_url;
    urlFotoRevision = resRevision.secure_url;
    urlFotoCamion = resCamion.secure_url;

  } catch (cloudinaryError) {
    console.error('Error al subir archivos a Cloudinary:', cloudinaryError);
    return res.status(500).json({ 
      error: 'Error al subir los documentos a Cloudinary. Por favor, intente de nuevo.' 
    });
  }

  // 5. Ejecutar la transacción en PostgreSQL
  try {
    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const contrasenaHash = await bcrypt.hash(passwordInput, salt);

    await db.query('BEGIN');

    // a) Tabla usuarios: rol='CONDUCTOR', foto=urlFotoPerfil
    const userQuery = `
      INSERT INTO usuarios (rol, nombre, apellido, correo, telefono, password, foto, estado)
      VALUES ('CONDUCTOR', $1, $2, $3, $4, $5, $6, 'ACTIVO')
      RETURNING id_usuario;
    `;
    const userResult = await db.query(userQuery, [
      nombre, apellido, correo, telefono, contrasenaHash, urlFotoPerfil
    ]);
    const id_usuario = userResult.rows[0].id_usuario;

    // b) Tabla conductores: asociarlo al id_usuario, estado='PENDIENTE'
    const conductorQuery = `
      INSERT INTO conductores (
        id_usuario, numero_licencia, fecha_vencimiento, identidad, disponible, estado, nombre_empresa, rtn, motivo_solicitud
      )
      VALUES ($1, $2, $3, $4, FALSE, 'PENDIENTE', $5, $6, $7)
      RETURNING id_conductor;
    `;
    const conductorResult = await db.query(conductorQuery, [
      id_usuario,
      numero_licencia,
      fecha_vencimiento,
      identidad,
      nombre_empresa || null,
      rtn || null,
      motivo_solicitud || null
    ]);
    const id_conductor = conductorResult.rows[0].id_conductor;

    // c) Tabla documentos: insertar un registro por cada documento subido
    const documentosParaInsertar = [
      { tipo: 'CV', url: urlCv },
      { tipo: 'LICENCIA', url: urlLicencia },
      { tipo: 'REVISION_TECNICA', url: urlFotoRevision },
      { tipo: 'FOTO_PERFIL', url: urlFotoPerfil },
      { tipo: 'FOTO_CAMION', url: urlFotoCamion }
    ];

    const docInsertQuery = `
      INSERT INTO documentos (id_conductor, tipo, url_archivo, estado)
      VALUES ($1, $2, $3, 'PENDIENTE');
    `;

    for (const doc of documentosParaInsertar) {
      await db.query(docInsertQuery, [id_conductor, doc.tipo, doc.url]);
    }

    // d) Tabla camiones: asociarlo al id_conductor, foto=urlFotoCamion, estado='ACTIVO'
    const camionInsertQuery = `
      INSERT INTO camiones (
        id_conductor, placa, marca, modelo, anio, capacidad_galones, color, foto, revision_tecnica, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVO')
      RETURNING id_camion;
    `;
    const camionResult = await db.query(camionInsertQuery, [
      id_conductor,
      placa,
      marca || null,
      modelo || null,
      anioNum,
      capacidadNum,
      color || null,
      urlFotoCamion,
      revision_tecnica || null
    ]);

    await db.query('COMMIT');

    // Retornar éxito
    res.status(201).json({
      message: 'Conductor y camión registrados exitosamente. Sus documentos están en revisión.',
      usuarioId: id_usuario,
      conductorId: id_conductor,
      camionId: camionResult.rows[0].id_camion
    });

  } catch (dbError) {
    // Si falla cualquier paso de base de datos, hacemos rollback para no dejar basura
    await db.query('ROLLBACK');
    console.error('Error en la transacción de base de datos:', dbError);
    
    // Devolver un error amigable en caso de violación de restricción única
    let errorMessage = 'Error al registrar la información en la base de datos.';
    if (dbError.code === '23505') { 
      if (dbError.constraint === 'usuarios_correo_key') {
        errorMessage = 'El correo electrónico ya está registrado.';
      } else if (dbError.constraint === 'usuarios_telefono_key') {
        errorMessage = 'El número de teléfono ya está registrado.';
      } else if (dbError.constraint === 'conductores_identidad_key') {
        errorMessage = 'El número de identidad ya está registrado.';
      } else if (dbError.constraint === 'camiones_placa_key') {
        errorMessage = 'La placa del camión ya está registrada.';
      } else {
        errorMessage = 'Alguno de los identificadores únicos (RTN, Licencia, Identidad o Placa) ya está registrado.';
      }
      return res.status(400).json({ error: errorMessage });
    }
    
    res.status(500).json({ error: dbError.message || errorMessage });
  }
};
