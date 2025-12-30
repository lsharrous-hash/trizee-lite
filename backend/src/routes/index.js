const express = require('express');
const router = express.Router();

// Import des routes
const authRoutes = require('./auth');
const scansRoutes = require('./scans');
const journeesRoutes = require('./journees');
const statsRoutes = require('./stats');
const usersRoutes = require('./users');
const sousTraitantsRoutes = require('./sousTraitants');
const chauffeursRoutes = require('./chauffeurs');
const importsRoutes = require('./imports');
const tourneesRoutes = require('./tournees');
const colisRoutes = require('./colis');

// Routes
router.use('/auth', authRoutes);
router.use('/scans', scansRoutes);
router.use('/journees', journeesRoutes);
router.use('/stats', statsRoutes);
router.use('/users', usersRoutes);
router.use('/sous-traitants', sousTraitantsRoutes);
router.use('/chauffeurs', chauffeursRoutes);
router.use('/imports', importsRoutes);
router.use('/tournees', tourneesRoutes);
router.use('/colis', colisRoutes);

// Route de santé
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Trizee Lite API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
