const express = require('express');
const router = express.Router();
const journeesController = require('../controllers/journeesController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

/**
 * @route   GET /journees
 * @desc    Liste des journées
 * @access  Admin
 */
router.get('/', auth, roles(['admin']), journeesController.list);

/**
 * @route   GET /journees/today
 * @desc    Journée en cours avec stats
 * @access  Authentifié
 */
router.get('/today', auth, journeesController.today);

/**
 * @route   GET /journees/:id
 * @desc    Détail d'une journée
 * @access  Admin
 */
router.get('/:id', auth, roles(['admin']), journeesController.get);

/**
 * @route   POST /journees
 * @desc    Créer une nouvelle journée
 * @access  Admin
 */
router.post('/', auth, roles(['admin']), journeesController.create);

/**
 * @route   PUT /journees/:id
 * @desc    Modifier une journée (deadline)
 * @access  Admin
 */
router.put('/:id', auth, roles(['admin']), journeesController.update);

/**
 * @route   POST /journees/:id/terminer
 * @desc    Terminer une journée
 * @access  Admin
 */
router.post('/:id/terminer', auth, roles(['admin']), journeesController.terminer);

module.exports = router;
