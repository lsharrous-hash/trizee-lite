const express = require('express');
const router = express.Router();
const multer = require('multer');
const tourneesController = require('../controllers/tourneesController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

// Configuration Multer pour l'upload PDF
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés.'));
    }
  },
});

/**
 * @route   GET /tournees
 * @desc    Liste des tournées du jour
 * @access  Admin, Sous-traitant (ses tournées)
 */
router.get('/', auth, roles(['admin', 'sous_traitant']), tourneesController.list);

/**
 * @route   GET /tournees/:id
 * @desc    Détail d'une tournée avec ses colis
 * @access  Admin, Sous-traitant (ses tournées)
 */
router.get('/:id', auth, roles(['admin', 'sous_traitant']), tourneesController.get);

/**
 * @route   GET /tournees/:id/export
 * @desc    Exporter une tournée au format Excel
 * @access  Admin, Sous-traitant (ses tournées)
 */
router.get('/:id/export', auth, roles(['admin', 'sous_traitant']), tourneesController.exportTournee);

/**
 * @route   POST /tournees/create-spoke
 * @desc    Créer une tournée manuellement avec un fichier Spoke
 * @access  Admin uniquement
 */
router.post('/create-spoke', auth, roles(['admin']), upload.single('file'), tourneesController.createWithSpoke);

/**
 * @route   POST /tournees/:id/spoke
 * @desc    Importer un fichier Spoke pour une tournée (réimport ST)
 * @access  Admin, Sous-traitant (ses tournées)
 */
router.post('/:id/spoke', auth, roles(['admin', 'sous_traitant']), upload.single('file'), tourneesController.importSpoke);

/**
 * @route   DELETE /tournees/:id
 * @desc    Supprimer une tournée et ses colis
 * @access  Admin uniquement
 */
router.delete('/:id', auth, roles(['admin']), tourneesController.remove);

module.exports = router;
