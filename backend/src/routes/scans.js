const express = require('express');
const router = express.Router();
const scansController = require('../controllers/scansController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

/**
 * @route   POST /scans
 * @desc    Scanner un colis
 * @access  Authentifié (tous rôles)
 */
router.post('/', auth, scansController.scan);

/**
 * @route   GET /scans
 * @desc    Liste des scans du jour
 * @access  Admin
 */
router.get('/', auth, roles(['admin']), scansController.list);

/**
 * @route   GET /scans/recent
 * @desc    20 derniers scans
 * @access  Admin
 */
router.get('/recent', auth, roles(['admin']), scansController.recent);

/**
 * @route   POST /scans/sync
 * @desc    Synchroniser les scans hors-ligne
 * @access  Authentifié (tous rôles)
 */
router.post('/sync', auth, scansController.sync);

/**
 * @route   GET /scans/stats
 * @desc    Stats des scans pour un trieur
 * @access  Admin ou Trieur concerné
 */
router.get('/stats', auth, scansController.stats);

module.exports = router;
