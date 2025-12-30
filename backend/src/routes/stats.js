const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

/**
 * @route   GET /stats/dashboard
 * @desc    Stats dashboard admin
 * @access  Admin
 */
router.get('/dashboard', auth, roles(['admin']), statsController.dashboard);

/**
 * @route   GET /stats/dashboard/st
 * @desc    Stats dashboard sous-traitant
 * @access  Sous-traitant
 */
router.get('/dashboard/st', auth, roles(['sous_traitant']), statsController.dashboardST);

/**
 * @route   GET /stats/avancement
 * @desc    Avancement du tri par chauffeur
 * @access  Admin, Sous-traitant
 */
router.get('/avancement', auth, roles(['admin', 'sous_traitant']), statsController.avancement);

module.exports = router;
