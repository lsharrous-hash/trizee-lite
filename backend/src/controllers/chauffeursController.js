const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /chauffeurs
 * Liste des chauffeurs
 */
const list = async (req, res) => {
  try {
    const { sous_traitant_id, actif } = req.query;
    
    let query = supabaseAdmin
      .from('chauffeurs')
      .select(`
        id,
        nom,
        prenom,
        telephone,
        actif,
        created_at,
        sous_traitant_id,
        sous_traitants (
          id,
          nom_entreprise
        )
      `)
      .order('nom');
    
    // Filtrer par sous-traitant
    if (req.user.role === 'sous_traitant') {
      query = query.eq('sous_traitant_id', req.user.sous_traitant_id);
    } else if (sous_traitant_id) {
      query = query.eq('sous_traitant_id', sous_traitant_id);
    }
    
    if (actif !== undefined) {
      query = query.eq('actif', actif === 'true');
    }
    
    const { data: chauffeurs, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: chauffeurs,
    });
    
  } catch (error) {
    console.error('List chauffeurs error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération des chauffeurs',
    });
  }
};

/**
 * GET /chauffeurs/:id
 * Détail d'un chauffeur
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: chauffeur, error } = await supabaseAdmin
      .from('chauffeurs')
      .select(`
        id,
        nom,
        prenom,
        telephone,
        actif,
        created_at,
        sous_traitant_id,
        sous_traitants (
          id,
          nom_entreprise
        )
      `)
      .eq('id', id)
      .single();
    
    if (error || !chauffeur) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Chauffeur non trouvé',
      });
    }
    
    // Vérifier accès pour sous-traitant
    if (req.user.role === 'sous_traitant' && chauffeur.sous_traitant_id !== req.user.sous_traitant_id) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Accès non autorisé',
      });
    }
    
    res.json({
      success: true,
      data: chauffeur,
    });
    
  } catch (error) {
    console.error('Get chauffeur error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération du chauffeur',
    });
  }
};

/**
 * POST /chauffeurs
 * Créer un chauffeur
 */
const create = async (req, res) => {
  try {
    const { sous_traitant_id, nom, prenom, telephone } = req.body;
    
    // Validation
    if (!sous_traitant_id || !nom) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Sous-traitant et nom sont requis',
      });
    }
    
    // Vérifier que le sous-traitant existe
    const { data: st } = await supabaseAdmin
      .from('sous_traitants')
      .select('id')
      .eq('id', sous_traitant_id)
      .single();
    
    if (!st) {
      return res.status(404).json({
        success: false,
        error: 'ST_NOT_FOUND',
        message: 'Sous-traitant non trouvé',
      });
    }
    
    // Créer le chauffeur
    const { data: chauffeur, error } = await supabaseAdmin
      .from('chauffeurs')
      .insert({
        sous_traitant_id,
        nom,
        prenom,
        telephone,
        actif: true,
      })
      .select(`
        id,
        nom,
        prenom,
        telephone,
        actif,
        sous_traitant_id,
        sous_traitants (
          id,
          nom_entreprise
        )
      `)
      .single();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      data: chauffeur,
    });
    
  } catch (error) {
    console.error('Create chauffeur error:', error);
    res.status(500).json({
      success: false,
      error: 'CREATE_ERROR',
      message: 'Erreur lors de la création du chauffeur',
    });
  }
};

/**
 * PUT /chauffeurs/:id
 * Modifier un chauffeur
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, telephone, actif, sous_traitant_id } = req.body;
    
    const updates = {};
    if (nom !== undefined) updates.nom = nom;
    if (prenom !== undefined) updates.prenom = prenom;
    if (telephone !== undefined) updates.telephone = telephone;
    if (actif !== undefined) updates.actif = actif;
    if (sous_traitant_id !== undefined) updates.sous_traitant_id = sous_traitant_id;
    
    const { data: chauffeur, error } = await supabaseAdmin
      .from('chauffeurs')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        nom,
        prenom,
        telephone,
        actif,
        sous_traitant_id,
        sous_traitants (
          id,
          nom_entreprise
        )
      `)
      .single();
    
    if (error) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Chauffeur non trouvé',
      });
    }
    
    res.json({
      success: true,
      data: chauffeur,
    });
    
  } catch (error) {
    console.error('Update chauffeur error:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_ERROR',
      message: 'Erreur lors de la mise à jour du chauffeur',
    });
  }
};

/**
 * DELETE /chauffeurs/:id
 * Supprimer un chauffeur
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabaseAdmin
      .from('chauffeurs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Chauffeur supprimé',
    });
    
  } catch (error) {
    console.error('Delete chauffeur error:', error);
    res.status(500).json({
      success: false,
      error: 'DELETE_ERROR',
      message: 'Erreur lors de la suppression du chauffeur',
    });
  }
};

/**
 * Recherche un chauffeur par nom (pour l'import)
 */
const findByName = async (nomComplet, sousTraitantId = null) => {
  try {
    // Parser le nom (format: "Prenom_Nom" ou "Prenom Nom" ou "Nom")
    const parts = nomComplet.replace(/_/g, ' ').trim().split(' ');
    
    let query = supabaseAdmin
      .from('chauffeurs')
      .select('id, nom, prenom, sous_traitant_id')
      .eq('actif', true);
    
    if (sousTraitantId) {
      query = query.eq('sous_traitant_id', sousTraitantId);
    }
    
    const { data: chauffeurs } = await query;
    
    if (!chauffeurs || chauffeurs.length === 0) return null;
    
    // Recherche exacte
    for (const chauffeur of chauffeurs) {
      const fullName = `${chauffeur.prenom} ${chauffeur.nom}`.toLowerCase();
      const reverseName = `${chauffeur.nom} ${chauffeur.prenom}`.toLowerCase();
      const searchName = nomComplet.replace(/_/g, ' ').toLowerCase();
      
      if (fullName === searchName || reverseName === searchName) {
        return chauffeur;
      }
    }
    
    // Recherche partielle (par nom ou prénom)
    for (const chauffeur of chauffeurs) {
      const nomLower = chauffeur.nom.toLowerCase();
      const prenomLower = chauffeur.prenom?.toLowerCase() || '';
      const searchLower = nomComplet.replace(/_/g, ' ').toLowerCase();
      
      if (nomLower === searchLower || prenomLower === searchLower) {
        return chauffeur;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Find chauffeur by name error:', error);
    return null;
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  findByName,
};
