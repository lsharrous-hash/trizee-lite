const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

/**
 * @route   POST /auth/login
 * @desc    Connexion utilisateur
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   POST /auth/logout
 * @desc    Déconnexion (invalide le token)
 * @access  Authentifié
 */
router.post('/logout', auth, authController.logout);

/**
 * @route   POST /auth/refresh
 * @desc    Rafraîchir le token d'accès
 * @access  Public (avec refresh token)
 */
router.post('/refresh', authController.refresh);

/**
 * @route   GET /auth/me
 * @desc    Récupérer les infos de l'utilisateur connecté
 * @access  Authentifié
 */
router.get('/me', auth, authController.me);

module.exports = router;
