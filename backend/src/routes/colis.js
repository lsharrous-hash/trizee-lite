const express = require('express');
const router = express.Router();
const colisController = require('../controllers/colisController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

/**
 * @route   GET /colis
 * @desc    Liste des colis du jour
 * @access  Admin, Sous-traitant (ses colis)
 */
router.get('/', auth, roles(['admin', 'sous_traitant']), colisController.list);

/**
 * @route   GET /colis/inconnus
 * @desc    Liste des colis inconnus du jour
 * @access  Admin
 */
router.get('/inconnus', auth, roles(['admin']), colisController.getInconnus);

/**
 * @route   GET /colis/:tracking
 * @desc    Rechercher un colis par tracking
 * @access  Authentifié
 */
router.get('/:tracking', auth, colisController.getByTracking);

module.exports = router;
