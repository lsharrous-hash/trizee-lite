const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /sous-traitants
 * Liste tous les sous-traitants
 */
const list = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sous_traitants')
      .select(`
        id,
        nom_entreprise,
        siret,
        adresse,
        user_id,
        created_at
      `)
      .order('nom_entreprise');

    if (error) {
      console.error('List sous-traitants error:', error);
      throw error;
    }

    // Compter les chauffeurs pour chaque ST
    const sousTraitantsWithCount = await Promise.all(
      (data || []).map(async (st) => {
        const { count } = await supabaseAdmin
          .from('chauffeurs')
          .select('id', { count: 'exact', head: true })
          .eq('sous_traitant_id', st.id);

        return {
          ...st,
          nb_chauffeurs: count || 0,
        };
      })
    );

    res.json({
      success: true,
      data: sousTraitantsWithCount,
    });
  } catch (error) {
    console.error('List sous-traitants error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération des sous-traitants',
    });
  }
};

/**
 * GET /sous-traitants/:id
 * Récupère un sous-traitant par son ID
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from('sous_traitants')
      .select(`
        id,
        nom_entreprise,
        siret,
        adresse,
        user_id,
        created_at
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Sous-traitant non trouvé',
      });
    }

    // Compter les chauffeurs
    const { count } = await supabaseAdmin
      .from('chauffeurs')
      .select('id', { count: 'exact', head: true })
      .eq('sous_traitant_id', id);

    res.json({
      success: true,
      data: {
        ...data,
        nb_chauffeurs: count || 0,
      },
    });
  } catch (error) {
    console.error('Get sous-traitant error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération du sous-traitant',
    });
  }
};

/**
 * POST /sous-traitants
 * Crée un nouveau sous-traitant avec son compte utilisateur
 */
const create = async (req, res) => {
  try {
    const { nom_entreprise, siret, adresse, email, password } = req.body;

    if (!nom_entreprise || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Nom entreprise, email et mot de passe requis',
      });
    }

    // Vérifier si l'email existe déjà
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Cet email est déjà utilisé',
      });
    }

    // Hasher le mot de passe
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    // Créer le sous-traitant d'abord (sans user_id)
    const { data: sousTraitant, error: stError } = await supabaseAdmin
      .from('sous_traitants')
      .insert({
        nom_entreprise,
        siret,
        adresse,
      })
      .select()
      .single();

    if (stError) throw stError;

    // Créer l'utilisateur avec le lien vers le ST
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role: 'sous_traitant',
        nom: nom_entreprise,
        sous_traitant_id: sousTraitant.id,
      })
      .select()
      .single();

    if (userError) {
      // Rollback: supprimer le ST créé
      await supabaseAdmin.from('sous_traitants').delete().eq('id', sousTraitant.id);
      throw userError;
    }

    // Mettre à jour le ST avec l'ID de l'utilisateur
    await supabaseAdmin
      .from('sous_traitants')
      .update({ user_id: user.id })
      .eq('id', sousTraitant.id);

    res.status(201).json({
      success: true,
      data: {
        ...sousTraitant,
        user_id: user.id,
        nb_chauffeurs: 0,
      },
    });
  } catch (error) {
    console.error('Create sous-traitant error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la création du sous-traitant',
    });
  }
};

/**
 * PUT /sous-traitants/:id
 * Met à jour un sous-traitant
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom_entreprise, siret, adresse } = req.body;

    const { data, error } = await supabaseAdmin
      .from('sous_traitants')
      .update({
        nom_entreprise,
        siret,
        adresse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Sous-traitant non trouvé',
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Update sous-traitant error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la mise à jour du sous-traitant',
    });
  }
};

/**
 * DELETE /sous-traitants/:id
 * Supprime un sous-traitant
 */
const remove = async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer le ST pour avoir l'user_id
    const { data: st } = await supabaseAdmin
      .from('sous_traitants')
      .select('user_id')
      .eq('id', id)
      .single();

    // Supprimer le ST (les chauffeurs seront supprimés en cascade)
    const { error } = await supabaseAdmin
      .from('sous_traitants')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Supprimer l'utilisateur associé
    if (st?.user_id) {
      await supabaseAdmin.from('users').delete().eq('id', st.user_id);
    }

    res.json({
      success: true,
      message: 'Sous-traitant supprimé',
    });
  } catch (error) {
    console.error('Delete sous-traitant error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la suppression du sous-traitant',
    });
  }
};

/**
 * GET /sous-traitants/:id/stats
 * Statistiques d'un sous-traitant
 */
const stats = async (req, res) => {
  try {
    const { id } = req.params;
    const todayDate = new Date().toISOString().split('T')[0];

    // Récupérer la journée du jour
    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', todayDate)
      .single();

    if (!journee) {
      return res.json({
        success: true,
        data: {
          chauffeurs: 0,
          colis_total: 0,
          colis_tries: 0,
          pourcentage: 0,
        },
      });
    }

    // Compter les chauffeurs
    const { count: nbChauffeurs } = await supabaseAdmin
      .from('chauffeurs')
      .select('id', { count: 'exact', head: true })
      .eq('sous_traitant_id', id);

    // Récupérer les tournées du ST pour aujourd'hui
    const { data: chauffeurs } = await supabaseAdmin
      .from('chauffeurs')
      .select('id')
      .eq('sous_traitant_id', id);

    const chauffeurIds = chauffeurs?.map((c) => c.id) || [];

    if (chauffeurIds.length === 0) {
      return res.json({
        success: true,
        data: {
          chauffeurs: 0,
          colis_total: 0,
          colis_tries: 0,
          pourcentage: 0,
        },
      });
    }

    const { data: tournees } = await supabaseAdmin
      .from('tournees')
      .select('id')
      .eq('journee_id', journee.id)
      .in('chauffeur_id', chauffeurIds);

    const tourneeIds = tournees?.map((t) => t.id) || [];

    // Compter les colis
    const { count: totalColis } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .in('tournee_id', tourneeIds);

    const { count: colisTries } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .in('tournee_id', tourneeIds)
      .eq('statut', 'trie');

    const pourcentage = totalColis > 0 ? Math.round((colisTries / totalColis) * 100) : 0;

    res.json({
      success: true,
      data: {
        chauffeurs: nbChauffeurs || 0,
        colis_total: totalColis || 0,
        colis_tries: colisTries || 0,
        pourcentage,
      },
    });
  } catch (error) {
    console.error('Stats sous-traitant error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération des statistiques',
    });
  }
};

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  stats,
};