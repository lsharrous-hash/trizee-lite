/**
 * Middleware de gestion globale des erreurs
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: err.message,
      details: err.errors,
    });
  }
  
  // Erreur Multer (upload fichier)
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'Fichier trop volumineux',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message: err.message,
    });
  }
  
  // Erreur de syntaxe JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_JSON',
      message: 'JSON invalide dans le corps de la requête',
    });
  }
  
  // Erreur par défaut
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erreur interne du serveur';
  
  res.status(statusCode).json({
    success: false,
    error: err.code || 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'Une erreur est survenue' 
      : message,
  });
};

/**
 * Middleware pour les routes non trouvées
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} non trouvée`,
  });
};

module.exports = { errorHandler, notFound };
