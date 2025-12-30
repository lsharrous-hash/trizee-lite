const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

/**
 * @route   GET /users
 * @desc    Liste tous les utilisateurs
 * @access  Admin
 */
router.get('/', auth, roles(['admin']), usersController.list);

/**
 * @route   GET /users/:id
 * @desc    Détail d'un utilisateur
 * @access  Admin
 */
router.get('/:id', auth, roles(['admin']), usersController.get);

/**
 * @route   POST /users
 * @desc    Créer un utilisateur
 * @access  Admin
 */
router.post('/', auth, roles(['admin']), usersController.create);

/**
 * @route   PUT /users/:id
 * @desc    Modifier un utilisateur
 * @access  Admin
 */
router.put('/:id', auth, roles(['admin']), usersController.update);

/**
 * @route   DELETE /users/:id
 * @desc    Supprimer un utilisateur
 * @access  Admin
 */
router.delete('/:id', auth, roles(['admin']), usersController.remove);

module.exports = router;
