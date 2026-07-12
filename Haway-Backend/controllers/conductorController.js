// controllers/conductorController.js
const db = require('../db');

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
