const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');

/**
 * Middleware d'authentification JWT
 * Vérifie le token et ajoute l'utilisateur à req.user
 */
const auth = async (req, res, next) => {
  try {
    // Récupérer le token du header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'NO_TOKEN',
        message: 'Token d\'authentification requis',
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Vérifier si le token est blacklisté
    const { data: blacklisted } = await supabaseAdmin
      .from('token_blacklist')
      .select('id')
      .eq('token_hash', hashToken(token))
      .single();
    
    if (blacklisted) {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_REVOKED',
        message: 'Token révoqué',
      });
    }
    
    // Vérifier et décoder le token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Récupérer l'utilisateur depuis la base
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        role,
        nom,
        prenom,
        telephone,
        sous_traitant_id,
        actif
      `)
      .eq('id', decoded.userId)
      .single();
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Utilisateur non trouvé',
      });
    }
    
    if (!user.actif) {
      return res.status(401).json({
        success: false,
        error: 'USER_INACTIVE',
        message: 'Compte désactivé',
      });
    }
    
    // Ajouter l'utilisateur à la requête
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Token expiré',
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Token invalide',
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'AUTH_ERROR',
      message: 'Erreur d\'authentification',
    });
  }
};

/**
 * Hash simple du token pour la blacklist
 */
function hashToken(token) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { auth, hashToken };
