const express = require('express');
const router = express.Router();
const sousTraitantsController = require('../controllers/sousTraitantsController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

/**
 * @route   GET /sous-traitants
 * @desc    Liste des sous-traitants
 * @access  Admin
 */
router.get('/', auth, roles(['admin']), sousTraitantsController.list);

/**
 * @route   GET /sous-traitants/:id
 * @desc    Détail d'un sous-traitant
 * @access  Admin, ST concerné
 */
router.get('/:id', auth, roles(['admin', 'sous_traitant']), sousTraitantsController.get);

/**
 * @route   POST /sous-traitants
 * @desc    Créer un sous-traitant
 * @access  Admin
 */
router.post('/', auth, roles(['admin']), sousTraitantsController.create);

/**
 * @route   PUT /sous-traitants/:id
 * @desc    Modifier un sous-traitant
 * @access  Admin
 */
router.put('/:id', auth, roles(['admin']), sousTraitantsController.update);

/**
 * @route   DELETE /sous-traitants/:id
 * @desc    Supprimer un sous-traitant
 * @access  Admin
 */
router.delete('/:id', auth, roles(['admin']), sousTraitantsController.remove);

/**
 * @route   GET /sous-traitants/:id/stats
 * @desc    Stats d'un sous-traitant
 * @access  Admin, ST concerné
 */
router.get('/:id/stats', auth, roles(['admin', 'sous_traitant']), sousTraitantsController.stats);

module.exports = router;
