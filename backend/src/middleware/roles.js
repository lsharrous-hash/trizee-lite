/**
 * Middleware de vérification des rôles
 * @param {string[]} allowedRoles - Liste des rôles autorisés
 */
const roles = (allowedRoles) => {
  return (req, res, next) => {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'NOT_AUTHENTICATED',
        message: 'Authentification requise',
      });
    }
    
    // Vérifier le rôle
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Accès non autorisé pour ce rôle',
      });
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier l'accès à un sous-traitant spécifique
 * Un sous-traitant ne peut accéder qu'à ses propres données
 */
const checkSousTraitantAccess = (paramName = 'id') => {
  return (req, res, next) => {
    // Admin a accès à tout
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Sous-traitant ne peut accéder qu'à ses données
    if (req.user.role === 'sous_traitant') {
      const requestedId = req.params[paramName] || req.body.sous_traitant_id;
      
      if (requestedId && requestedId !== req.user.sous_traitant_id) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Accès non autorisé à ces données',
        });
      }
    }
    
    next();
  };
};

module.exports = { roles, checkSousTraitantAccess };
