const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /users
 * Liste tous les utilisateurs
 */
const list = async (req, res) => {
  try {
    const { role, actif } = req.query;
    
    let query = supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        role,
        nom,
        prenom,
        telephone,
        sous_traitant_id,
        actif,
        created_at,
        sous_traitants (
          id,
          nom_entreprise
        )
      `)
      .order('created_at', { ascending: false });
    
    if (role) {
      query = query.eq('role', role);
    }
    
    if (actif !== undefined) {
      query = query.eq('actif', actif === 'true');
    }
    
    const { data: users, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: users,
    });
    
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération des utilisateurs',
    });
  }
};

/**
 * GET /users/:id
 * Détail d'un utilisateur
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;
    
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
        actif,
        created_at,
        sous_traitants (
          id,
          nom_entreprise
        )
      `)
      .eq('id', id)
      .single();
    
    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Utilisateur non trouvé',
      });
    }
    
    res.json({
      success: true,
      data: user,
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération de l\'utilisateur',
    });
  }
};

/**
 * POST /users
 * Créer un utilisateur
 */
const create = async (req, res) => {
  try {
    const { email, password, role, nom, prenom, telephone, sous_traitant_id } = req.body;
    
    // Validation
    if (!email || !password || !role || !nom) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Email, mot de passe, rôle et nom sont requis',
      });
    }
    
    if (!['admin', 'sous_traitant', 'trieur'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ROLE',
        message: 'Rôle invalide',
      });
    }
    
    // Vérifier si l'email existe déjà
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('email', email)
      .single();
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Cet email est déjà utilisé',
      });
    }
    
    // Hasher le mot de passe
    const password_hash = await bcrypt.hash(password, 10);
    
    // Créer l'utilisateur
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash,
        role,
        nom,
        prenom,
        telephone,
        sous_traitant_id: sous_traitant_id || null,
        actif: true,
      })
      .select(`
        id,
        email,
        role,
        nom,
        prenom,
        telephone,
        sous_traitant_id,
        actif,
        created_at
      `)
      .single();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      data: user,
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'CREATE_ERROR',
      message: 'Erreur lors de la création de l\'utilisateur',
    });
  }
};

/**
 * PUT /users/:id
 * Modifier un utilisateur
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, nom, prenom, telephone, sous_traitant_id, actif } = req.body;
    
    const updates = {};
    
    if (email !== undefined) {
      // Vérifier si l'email existe déjà pour un autre utilisateur
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id')
        .ilike('email', email)
        .neq('id', id)
        .single();
      
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'EMAIL_EXISTS',
          message: 'Cet email est déjà utilisé',
        });
      }
      updates.email = email.toLowerCase();
    }
    
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }
    
    if (nom !== undefined) updates.nom = nom;
    if (prenom !== undefined) updates.prenom = prenom;
    if (telephone !== undefined) updates.telephone = telephone;
    if (sous_traitant_id !== undefined) updates.sous_traitant_id = sous_traitant_id;
    if (actif !== undefined) updates.actif = actif;
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        email,
        role,
        nom,
        prenom,
        telephone,
        sous_traitant_id,
        actif,
        created_at
      `)
      .single();
    
    if (error) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Utilisateur non trouvé',
      });
    }
    
    res.json({
      success: true,
      data: user,
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_ERROR',
      message: 'Erreur lors de la mise à jour de l\'utilisateur',
    });
  }
};

/**
 * DELETE /users/:id
 * Supprimer un utilisateur
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier que l'utilisateur existe
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('id', id)
      .single();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Utilisateur non trouvé',
      });
    }
    
    // Empêcher la suppression de son propre compte
    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'CANNOT_DELETE_SELF',
        message: 'Vous ne pouvez pas supprimer votre propre compte',
      });
    }
    
    const { error } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Utilisateur supprimé',
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'DELETE_ERROR',
      message: 'Erreur lors de la suppression de l\'utilisateur',
    });
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
};
