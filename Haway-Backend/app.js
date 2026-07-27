var express = require('express');

var swaggerUi = require("swagger-ui-express");
var swaggerJsdoc = require("swagger-jsdoc");
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require("./routes/auth");
var clienteRouter = require('./routes/cliente');
var conductorRouter = require('./routes/conductor');

var app = express();

// En tu archivo app.js, reemplaza tu swaggerOptions actual por este:

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ha-Way',
      version: '1.0.0',
      description: 'Documentación de mi API con Swagger',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
    // 1. Agregar definición de seguridad para JWT
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Introduce tu token JWT directamente en el campo de texto.',
        },
      },
    },
    // 2. Aplicar seguridad de forma global (opcional, habilita el candado en todas las rutas)
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js'], 
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Middleware de CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/cliente', clienteRouter);
app.use('/conductor', conductorRouter);


module.exports = app;
