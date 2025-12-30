const express = require('express');
const router = express.Router();
const chauffeursController = require('../controllers/chauffeursController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

/**
 * @route   GET /chauffeurs
 * @desc    Liste des chauffeurs
 * @access  Admin, Sous-traitant (ses chauffeurs uniquement)
 */
router.get('/', auth, roles(['admin', 'sous_traitant']), chauffeursController.list);

/**
 * @route   GET /chauffeurs/:id
 * @desc    Détail d'un chauffeur
 * @access  Admin, Sous-traitant (ses chauffeurs uniquement)
 */
router.get('/:id', auth, roles(['admin', 'sous_traitant']), chauffeursController.get);

/**
 * @route   POST /chauffeurs
 * @desc    Créer un chauffeur
 * @access  Admin
 */
router.post('/', auth, roles(['admin']), chauffeursController.create);

/**
 * @route   PUT /chauffeurs/:id
 * @desc    Modifier un chauffeur
 * @access  Admin
 */
router.put('/:id', auth, roles(['admin']), chauffeursController.update);

/**
 * @route   DELETE /chauffeurs/:id
 * @desc    Supprimer un chauffeur
 * @access  Admin
 */
router.delete('/:id', auth, roles(['admin']), chauffeursController.remove);

module.exports = router;
