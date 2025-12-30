const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Initialiser l'application Express
const app = express();

// Middlewares globaux
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger des requêtes (en dev)
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Routes API
app.use('/api', routes);

// Route racine
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenue sur l\'API Trizee Lite',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Gestion des erreurs
app.use(notFound);
app.use(errorHandler);

// Démarrer le serveur
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 Trizee Lite API Server                                  ║
║                                                               ║
║   Version:     1.0.0                                          ║
║   Environment: ${config.nodeEnv.padEnd(45)}║
║   Port:        ${String(PORT).padEnd(45)}║
║   URL:         http://localhost:${String(PORT).padEnd(33)}║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
