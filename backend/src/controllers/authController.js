const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { supabaseAdmin } = require('../config/supabase');
const { hashToken } = require('../middleware/auth');

/**
 * POST /auth/login
 * Connexion utilisateur
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Email et mot de passe requis',
      });
    }
    
    // Rechercher l'utilisateur (case-insensitive)
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike('email', email)
      .single();
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect',
      });
    }
    
    // Vérifier si le compte est actif
    if (!user.actif) {
      return res.status(401).json({
        success: false,
        error: 'ACCOUNT_DISABLED',
        message: 'Compte désactivé',
      });
    }
    
    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe incorrect',
      });
    }
    
    // Générer les tokens
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
    
    // Récupérer les infos du sous-traitant si applicable
    let sousTraitantInfo = null;
    if (user.role === 'sous_traitant' && user.sous_traitant_id) {
      const { data: st } = await supabaseAdmin
        .from('sous_traitants')
        .select('id, nom_entreprise')
        .eq('id', user.sous_traitant_id)
        .single();
      sousTraitantInfo = st;
    }
    
    // Retourner les infos
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          nom: user.nom,
          prenom: user.prenom,
          sous_traitant: sousTraitantInfo,
        },
        accessToken,
        refreshToken,
      },
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'LOGIN_ERROR',
      message: 'Erreur lors de la connexion',
    });
  }
};

/**
 * POST /auth/logout
 * Déconnexion - invalide le token
 */
const logout = async (req, res) => {
  try {
    const token = req.token;
    
    // Décoder le token pour obtenir l'expiration
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);
    
    // Ajouter le token à la blacklist
    await supabaseAdmin
      .from('token_blacklist')
      .insert({
        token_hash: hashToken(token),
        expires_at: expiresAt.toISOString(),
      });
    
    res.json({
      success: true,
      message: 'Déconnexion réussie',
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'LOGOUT_ERROR',
      message: 'Erreur lors de la déconnexion',
    });
  }
};

/**
 * POST /auth/refresh
 * Rafraîchir le token d'accès
 */
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Refresh token requis',
      });
    }
    
    // Vérifier le refresh token
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Token invalide',
      });
    }
    
    // Vérifier que l'utilisateur existe et est actif
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, role, actif')
      .eq('id', decoded.userId)
      .single();
    
    if (error || !user || !user.actif) {
      return res.status(401).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Utilisateur non trouvé ou inactif',
      });
    }
    
    // Générer un nouveau access token
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    res.json({
      success: true,
      data: {
        accessToken,
      },
    });
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Refresh token expiré, veuillez vous reconnecter',
      });
    }
    
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'REFRESH_ERROR',
      message: 'Erreur lors du rafraîchissement du token',
    });
  }
};

/**
 * GET /auth/me
 * Récupérer les infos de l'utilisateur connecté
 */
const me = async (req, res) => {
  try {
    const user = req.user;
    
    // Récupérer les infos du sous-traitant si applicable
    let sousTraitantInfo = null;
    if (user.role === 'sous_traitant' && user.sous_traitant_id) {
      const { data: st } = await supabaseAdmin
        .from('sous_traitants')
        .select('id, nom_entreprise')
        .eq('id', user.sous_traitant_id)
        .single();
      sousTraitantInfo = st;
    }
    
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        nom: user.nom,
        prenom: user.prenom,
        telephone: user.telephone,
        sous_traitant: sousTraitantInfo,
      },
    });
    
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération des informations',
    });
  }
};

module.exports = {
  login,
  logout,
  refresh,
  me,
};
