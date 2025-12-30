const express = require('express');
const router = express.Router();
const multer = require('multer');
const importsController = require('../controllers/importsController');
const { auth } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

// Configuration Multer pour l'upload en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accepter Excel et PDF
    const allowedMimes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/pdf',
    ];
    
    if (allowedMimes.includes(file.mimetype) || 
        file.originalname.endsWith('.xlsx') || 
        file.originalname.endsWith('.xls') ||
        file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Utilisez Excel (.xlsx, .xls) ou PDF.'));
    }
  },
});

/**
 * @route   GET /imports
 * @desc    Liste des imports du jour
 * @access  Admin
 */
router.get('/', auth, roles(['admin']), importsController.list);

/**
 * @route   POST /imports/gofo
 * @desc    Importer un fichier Gofo Excel (par chauffeur)
 * @access  Admin
 */
router.post('/gofo', auth, roles(['admin']), upload.single('file'), importsController.importGofo);

/**
 * @route   POST /imports/cainiao
 * @desc    Importer un fichier Cainiao Excel (par chauffeur)
 * @access  Admin
 */
router.post('/cainiao', auth, roles(['admin']), upload.single('file'), importsController.importCainiao);

/**
 * @route   POST /imports/spoke
 * @desc    Importer un fichier Spoke PDF multi-chauffeurs (cas Reims)
 * @access  Admin
 */
router.post('/spoke', auth, roles(['admin']), upload.single('file'), importsController.importSpoke);

/**
 * @route   DELETE /imports/:id
 * @desc    Supprimer un import
 * @access  Admin
 */
router.delete('/:id', auth, roles(['admin']), importsController.remove);

module.exports = router;
