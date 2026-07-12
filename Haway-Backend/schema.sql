CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "calificaciones" (
	"id_calificacion" serial PRIMARY KEY,
	"id_pedido" integer NOT NULL,
	"id_cliente" integer NOT NULL,
	"id_conductor" integer NOT NULL,
	"puntuacion" smallint NOT NULL,
	"comentario" varchar(300),
	"fecha" timestamp DEFAULT CURRENT_TIMESTAMP,
	"tipo" varchar(25) DEFAULT 'CLIENTE_A_CONDUCTOR' NOT NULL,
	CONSTRAINT "uq_calificacion_pedido_tipo" UNIQUE("id_pedido","tipo"),
	CONSTRAINT "ck_puntuacion" CHECK (((puntuacion >= 1) AND (puntuacion <= 5))),
	CONSTRAINT "ck_tipocalificacion" CHECK (((tipo)::text = ANY ((ARRAY['CLIENTE_A_CONDUCTOR'::character varying, 'CONDUCTOR_A_CLIENTE'::character varying])::text[])))
);
CREATE TABLE "camiones" (
	"id_camion" serial PRIMARY KEY,
	"id_conductor" integer NOT NULL,
	"placa" varchar(20) NOT NULL CONSTRAINT "camiones_placa_key" UNIQUE,
	"marca" varchar(80),
	"modelo" varchar(80),
	"anio" smallint,
	"capacidad_galones" integer NOT NULL,
	"color" varchar(40),
	"foto" varchar(255),
	"revision_tecnica" date,
	"estado" varchar(25) DEFAULT 'ACTIVO',
	CONSTRAINT "ck_camionestado" CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'MANTENIMIENTO'::character varying, 'FUERA_SERVICIO'::character varying])::text[])))
);
CREATE TABLE "conductores" (
	"id_conductor" serial PRIMARY KEY,
	"id_usuario" integer NOT NULL CONSTRAINT "conductores_id_usuario_key" UNIQUE,
	"numero_licencia" varchar(50) NOT NULL,
	"fecha_vencimiento" date NOT NULL,
	"identidad" varchar(25) NOT NULL CONSTRAINT "conductores_identidad_key" UNIQUE,
	"disponible" boolean DEFAULT false,
	"calificacion" numeric(3, 2) DEFAULT '5.00',
	"viajes_realizados" integer DEFAULT 0,
	"latitud" numeric(10, 8),
	"longitud" numeric(11, 8),
	"estado" varchar(20) DEFAULT 'PENDIENTE',
	"nombre_empresa" varchar(150),
	"rtn" varchar(20),
	"motivo_solicitud" varchar(300),
	CONSTRAINT "ck_conductoresestado" CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'APROBADO'::character varying, 'RECHAZADO'::character varying])::text[])))
);
CREATE TABLE "direcciones" (
	"id_direccion" serial PRIMARY KEY,
	"id_usuario" integer NOT NULL,
	"nombre" varchar(50),
	"direccion" varchar(300) NOT NULL,
	"referencia" varchar(300),
	"latitud" numeric(10, 8) NOT NULL,
	"longitud" numeric(11, 8) NOT NULL,
	"principal" boolean DEFAULT false
);
CREATE TABLE "documentos" (
	"id_documento" serial PRIMARY KEY,
	"id_conductor" integer NOT NULL,
	"tipo" varchar(30) NOT NULL,
	"url_archivo" varchar(255) NOT NULL,
	"estado" varchar(20) DEFAULT 'PENDIENTE',
	"comentario_revision" varchar(300),
	"fecha_subida" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ck_estadodocumento" CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'APROBADO'::character varying, 'RECHAZADO'::character varying])::text[]))),
	CONSTRAINT "ck_tipodocumento" CHECK (((tipo)::text = ANY ((ARRAY['CV'::character varying, 'LICENCIA'::character varying, 'REVISION_TECNICA'::character varying, 'IDENTIDAD'::character varying, 'FOTO_PERFIL'::character varying, 'FOTO_CAMION'::character varying])::text[])))
);
CREATE TABLE "notificaciones" (
	"id_notificacion" serial PRIMARY KEY,
	"id_usuario" integer NOT NULL,
	"titulo" varchar(120) NOT NULL,
	"mensaje" varchar(300) NOT NULL,
	"tipo" varchar(20) DEFAULT 'SISTEMA',
	"leida" boolean DEFAULT false,
	"fecha" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ck_tiponotificacion" CHECK (((tipo)::text = ANY ((ARRAY['PEDIDO'::character varying, 'OFERTA'::character varying, 'PAGO'::character varying, 'SISTEMA'::character varying])::text[])))
);
CREATE TABLE "ofertas" (
	"id_oferta" serial PRIMARY KEY,
	"id_solicitud" integer NOT NULL,
	"id_conductor" integer NOT NULL,
	"id_camion" integer NOT NULL,
	"precio" numeric(10, 2) NOT NULL,
	"tiempo_estimado" integer NOT NULL,
	"distancia" numeric(8, 2),
	"mensaje" varchar(250),
	"fecha_oferta" timestamp DEFAULT CURRENT_TIMESTAMP,
	"estado" varchar(20) DEFAULT 'PENDIENTE',
	"fecha_expiracion" timestamp,
	CONSTRAINT "uq_oferta_solicitud_conductor" UNIQUE("id_solicitud","id_conductor"),
	CONSTRAINT "ck_estadooferta" CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'ACEPTADA'::character varying, 'RECHAZADA'::character varying, 'CANCELADA'::character varying])::text[])))
);
CREATE TABLE "pagos" (
	"id_pago" serial PRIMARY KEY,
	"id_pedido" integer NOT NULL CONSTRAINT "pagos_id_pedido_key" UNIQUE,
	"metodo" varchar(20) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"comision" numeric(10, 2) DEFAULT '0',
	"descuento" numeric(10, 2) DEFAULT '0',
	"impuesto" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"estado" varchar(20) DEFAULT 'PENDIENTE',
	"fecha_pago" timestamp,
	"referencia_transaccion" varchar(100),
	CONSTRAINT "ck_estadopago" CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PAGADO'::character varying, 'REEMBOLSADO'::character varying])::text[]))),
	CONSTRAINT "ck_metodopago" CHECK (((metodo)::text = ANY ((ARRAY['EFECTIVO'::character varying, 'TARJETA'::character varying, 'TRANSFERENCIA'::character varying, 'PAGO_ONLINE'::character varying])::text[])))
);
CREATE TABLE "pedidos" (
	"id_pedido" serial PRIMARY KEY,
	"id_solicitud" integer NOT NULL,
	"id_oferta" integer NOT NULL CONSTRAINT "pedidos_id_oferta_key" UNIQUE,
	"fecha_inicio" timestamp DEFAULT CURRENT_TIMESTAMP,
	"fecha_fin" timestamp,
	"estado" varchar(20) DEFAULT 'PENDIENTE',
	CONSTRAINT "ck_estadopedido" CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'PREPARANDO'::character varying, 'EN_CAMINO'::character varying, 'LLEGO'::character varying, 'ENTREGADO'::character varying, 'CANCELADO'::character varying])::text[])))
);
CREATE TABLE "seguimientos" (
	"id_seguimiento" serial PRIMARY KEY,
	"id_pedido" integer NOT NULL,
	"estado" varchar(30) NOT NULL,
	"descripcion" varchar(255),
	"latitud" numeric(10, 8),
	"longitud" numeric(11, 8),
	"fecha" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "ck_estadoseguimiento" CHECK (((estado)::text = ANY ((ARRAY['PEDIDO_CONFIRMADO'::character varying, 'PREPARANDO'::character varying, 'EN_CAMINO'::character varying, 'LLEGO'::character varying, 'ENTREGADO'::character varying])::text[])))
);
CREATE TABLE "solicitudes" (
	"id_solicitud" serial PRIMARY KEY,
	"id_cliente" integer NOT NULL,
	"id_direccion" integer NOT NULL,
	"cantidad" numeric(10, 2) NOT NULL,
	"unidad_medida" varchar(20) NOT NULL,
	"fecha_publicacion" timestamp DEFAULT CURRENT_TIMESTAMP,
	"fecha_programada" date,
	"hora_programada" time,
	"descripcion" varchar(250),
	"estado" varchar(30) DEFAULT 'PUBLICADA',
	CONSTRAINT "ck_estadosolicitud" CHECK (((estado)::text = ANY ((ARRAY['PUBLICADA'::character varying, 'RECIBIENDO_OFERTAS'::character varying, 'OFERTA_ACEPTADA'::character varying, 'CANCELADA'::character varying, 'EXPIRADA'::character varying])::text[]))),
	CONSTRAINT "ck_unidadmedida" CHECK (((unidad_medida)::text = ANY ((ARRAY['BARRILES'::character varying, 'GALONES'::character varying, 'CISTERNA'::character varying])::text[])))
);
CREATE TABLE "tarjetas" (
	"id_tarjeta" serial PRIMARY KEY,
	"id_usuario" integer NOT NULL,
	"marca" varchar(20),
	"titular" varchar(150) NOT NULL,
	"ultimos4" char(4) NOT NULL,
	"token" varchar(255),
	"principal" boolean DEFAULT false,
	CONSTRAINT "ck_marcatarjeta" CHECK (((marca)::text = ANY ((ARRAY['VISA'::character varying, 'MASTERCARD'::character varying, 'AMEX'::character varying, 'OTRA'::character varying])::text[])))
);
CREATE TABLE "usuarios" (
	"id_usuario" serial PRIMARY KEY,
	"rol" varchar(20) NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"apellido" varchar(100) NOT NULL,
	"correo" varchar(150) NOT NULL CONSTRAINT "usuarios_correo_key" UNIQUE,
	"telefono" varchar(20) NOT NULL CONSTRAINT "usuarios_telefono_key" UNIQUE,
	"password" varchar(255) NOT NULL,
	"foto" varchar(255),
	"estado" varchar(20) DEFAULT 'ACTIVO' NOT NULL,
	"fecha_registro" timestamp DEFAULT CURRENT_TIMESTAMP,
	"ultimo_acceso" timestamp,
	CONSTRAINT "ck_usuariosestado" CHECK (((estado)::text = ANY ((ARRAY['ACTIVO'::character varying, 'INACTIVO'::character varying, 'SUSPENDIDO'::character varying])::text[]))),
	CONSTRAINT "ck_usuariosrol" CHECK (((rol)::text = ANY ((ARRAY['CLIENTE'::character varying, 'CONDUCTOR'::character varying, 'ADMIN'::character varying])::text[])))
);

CREATE UNIQUE INDEX "calificaciones_pkey" ON "calificaciones" ("id_calificacion");
CREATE UNIQUE INDEX "uq_calificacion_pedido_tipo" ON "calificaciones" ("id_pedido","tipo");
CREATE UNIQUE INDEX "camiones_pkey" ON "camiones" ("id_camion");
CREATE UNIQUE INDEX "camiones_placa_key" ON "camiones" ("placa");
CREATE UNIQUE INDEX "conductores_id_usuario_key" ON "conductores" ("id_usuario");
CREATE UNIQUE INDEX "conductores_identidad_key" ON "conductores" ("identidad");
CREATE UNIQUE INDEX "conductores_pkey" ON "conductores" ("id_conductor");
CREATE INDEX "idx_conductor_disponible" ON "conductores" ("disponible");
CREATE UNIQUE INDEX "direcciones_pkey" ON "direcciones" ("id_direccion");
CREATE UNIQUE INDEX "documentos_pkey" ON "documentos" ("id_documento");
CREATE INDEX "idx_documentos_conductor" ON "documentos" ("id_conductor");
CREATE INDEX "idx_documentos_estado" ON "documentos" ("estado");
CREATE INDEX "idx_notificaciones_usuario" ON "notificaciones" ("id_usuario");
CREATE UNIQUE INDEX "notificaciones_pkey" ON "notificaciones" ("id_notificacion");
CREATE INDEX "idx_ofertas_conductor" ON "ofertas" ("id_conductor");
CREATE INDEX "idx_ofertas_solicitud" ON "ofertas" ("id_solicitud");
CREATE UNIQUE INDEX "ofertas_pkey" ON "ofertas" ("id_oferta");
CREATE UNIQUE INDEX "uq_oferta_solicitud_conductor" ON "ofertas" ("id_solicitud","id_conductor");
CREATE UNIQUE INDEX "pagos_id_pedido_key" ON "pagos" ("id_pedido");
CREATE UNIQUE INDEX "pagos_pkey" ON "pagos" ("id_pago");
CREATE INDEX "idx_pedidos_estado" ON "pedidos" ("estado");
CREATE UNIQUE INDEX "pedidos_id_oferta_key" ON "pedidos" ("id_oferta");
CREATE UNIQUE INDEX "pedidos_pkey" ON "pedidos" ("id_pedido");
CREATE UNIQUE INDEX "seguimientos_pkey" ON "seguimientos" ("id_seguimiento");
CREATE INDEX "idx_solicitudes_cliente" ON "solicitudes" ("id_cliente");
CREATE INDEX "idx_solicitudes_estado" ON "solicitudes" ("estado");
CREATE INDEX "idx_solicitudes_fecha_programada" ON "solicitudes" ("fecha_programada");
CREATE UNIQUE INDEX "solicitudes_pkey" ON "solicitudes" ("id_solicitud");
CREATE UNIQUE INDEX "tarjetas_pkey" ON "tarjetas" ("id_tarjeta");
CREATE INDEX "idx_usuario_correo" ON "usuarios" ("correo");
CREATE INDEX "idx_usuario_telefono" ON "usuarios" ("telefono");
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios" ("correo");
CREATE UNIQUE INDEX "usuarios_pkey" ON "usuarios" ("id_usuario");
CREATE UNIQUE INDEX "usuarios_telefono_key" ON "usuarios" ("telefono");

ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "usuarios"("id_usuario");
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_conductor_fkey" FOREIGN KEY ("id_conductor") REFERENCES "conductores"("id_conductor");
ALTER TABLE "calificaciones" ADD CONSTRAINT "calificaciones_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido");
ALTER TABLE "camiones" ADD CONSTRAINT "camiones_id_conductor_fkey" FOREIGN KEY ("id_conductor") REFERENCES "conductores"("id_conductor") ON DELETE CASCADE;
ALTER TABLE "conductores" ADD CONSTRAINT "conductores_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE;
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE;
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_id_conductor_fkey" FOREIGN KEY ("id_conductor") REFERENCES "conductores"("id_conductor") ON DELETE CASCADE;
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE;
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_id_camion_fkey" FOREIGN KEY ("id_camion") REFERENCES "camiones"("id_camion");
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_id_conductor_fkey" FOREIGN KEY ("id_conductor") REFERENCES "conductores"("id_conductor");
ALTER TABLE "ofertas" ADD CONSTRAINT "ofertas_id_solicitud_fkey" FOREIGN KEY ("id_solicitud") REFERENCES "solicitudes"("id_solicitud");
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido");
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_id_oferta_fkey" FOREIGN KEY ("id_oferta") REFERENCES "ofertas"("id_oferta");
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_id_solicitud_fkey" FOREIGN KEY ("id_solicitud") REFERENCES "solicitudes"("id_solicitud");
ALTER TABLE "seguimientos" ADD CONSTRAINT "seguimientos_id_pedido_fkey" FOREIGN KEY ("id_pedido") REFERENCES "pedidos"("id_pedido") ON DELETE CASCADE;
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "usuarios"("id_usuario");
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_id_direccion_fkey" FOREIGN KEY ("id_direccion") REFERENCES "direcciones"("id_direccion");
ALTER TABLE "tarjetas" ADD CONSTRAINT "tarjetas_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE;

CREATE OR REPLACE VIEW "vw_historial_cliente" AS 
(
  SELECT 
    p.id_pedido, 
    (u.nombre::text || ' '::text) || u.apellido::text AS cliente, 
    s.cantidad, 
    s.unidad_medida, 
    o.precio, 
    p.estado, 
    p.fecha_inicio, 
    p.fecha_fin 
  FROM pedidos p 
  JOIN solicitudes s ON p.id_solicitud = s.id_solicitud 
  JOIN ofertas o ON p.id_oferta = o.id_oferta 
  JOIN usuarios u ON s.id_cliente = u.id_usuario
);

CREATE OR REPLACE VIEW "vw_historial_conductor" AS 
(
  SELECT 
    p.id_pedido, 
    c.id_conductor, 
    (u.nombre::text || ' '::text) || u.apellido::text AS conductor, 
    s.cantidad, 
    s.unidad_medida, 
    o.precio, 
    p.estado, 
    p.fecha_inicio, 
    p.fecha_fin 
  FROM pedidos p 
  JOIN ofertas o ON p.id_oferta = o.id_oferta 
  JOIN solicitudes s ON p.id_solicitud = s.id_solicitud 
  JOIN conductores c ON o.id_conductor = c.id_conductor 
  JOIN usuarios u ON c.id_usuario = u.id_usuario
);
