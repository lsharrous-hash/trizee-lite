const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /journees
 * Liste des journées
 */
const list = async (req, res) => {
  try {
    const { limit = 30 } = req.query;
    
    const { data: journees, error } = await supabaseAdmin
      .from('journees')
      .select('*')
      .order('date', { ascending: false })
      .limit(parseInt(limit));
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: journees,
    });
    
  } catch (error) {
    console.error('List journees error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération des journées',
    });
  }
};

/**
 * GET /journees/today
 * Journée en cours avec stats
 */
const today = async (req, res) => {
  try {
    const todayDate = new Date().toISOString().split('T')[0];
    
    // Récupérer ou créer la journée du jour
    let { data: journee, error } = await supabaseAdmin
      .from('journees')
      .select('*')
      .eq('date', todayDate)
      .single();
    
    // Si pas de journée, la créer
    if (!journee) {
      const { data: newJournee, error: createError } = await supabaseAdmin
        .from('journees')
        .insert({
          date: todayDate,
          deadline: '22:30:00',
          deadline_active: true,
          statut: 'en_cours',
        })
        .select()
        .single();
      
      if (createError) throw createError;
      journee = newJournee;
    }
    
    // Calculer les stats
    const { count: totalColis } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .eq('journee_id', journee.id)
      .neq('statut', 'inconnu');
    
    const { count: colisTries } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .eq('journee_id', journee.id)
      .eq('statut', 'trie');
    
    const { count: colisInconnus } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .eq('journee_id', journee.id)
      .eq('statut', 'inconnu');
    
    const colisRestants = (totalColis || 0) - (colisTries || 0);
    const pourcentage = totalColis > 0 
      ? Math.round((colisTries / totalColis) * 100) 
      : 0;
    
    res.json({
      success: true,
      data: {
        id: journee.id,
        date: journee.date,
        deadline: journee.deadline,
        deadline_active: journee.deadline_active,
        statut: journee.statut,
        stats: {
          total_colis: totalColis || 0,
          colis_tries: colisTries || 0,
          colis_restants: colisRestants,
          colis_inconnus: colisInconnus || 0,
          pourcentage,
        },
      },
    });
    
  } catch (error) {
    console.error('Today journee error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération de la journée',
    });
  }
};

/**
 * GET /journees/:id
 * Détail d'une journée
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: journee, error } = await supabaseAdmin
      .from('journees')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !journee) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Journée non trouvée',
      });
    }
    
    res.json({
      success: true,
      data: journee,
    });
    
  } catch (error) {
    console.error('Get journee error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération de la journée',
    });
  }
};

/**
 * POST /journees
 * Créer une nouvelle journée
 */
const create = async (req, res) => {
  try {
    const { date, deadline = '22:30:00', deadline_active = true } = req.body;
    
    const journeeDate = date || new Date().toISOString().split('T')[0];
    
    // Vérifier si une journée existe déjà pour cette date
    const { data: existing } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', journeeDate)
      .single();
    
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'ALREADY_EXISTS',
        message: 'Une journée existe déjà pour cette date',
      });
    }
    
    const { data: journee, error } = await supabaseAdmin
      .from('journees')
      .insert({
        date: journeeDate,
        deadline,
        deadline_active,
        statut: 'en_cours',
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      data: journee,
    });
    
  } catch (error) {
    console.error('Create journee error:', error);
    res.status(500).json({
      success: false,
      error: 'CREATE_ERROR',
      message: 'Erreur lors de la création de la journée',
    });
  }
};

/**
 * PUT /journees/:id
 * Modifier une journée (deadline)
 */
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { deadline, deadline_active } = req.body;
    
    const updates = {};
    if (deadline !== undefined) updates.deadline = deadline;
    if (deadline_active !== undefined) updates.deadline_active = deadline_active;
    
    const { data: journee, error } = await supabaseAdmin
      .from('journees')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Journée non trouvée',
      });
    }
    
    res.json({
      success: true,
      data: journee,
    });
    
  } catch (error) {
    console.error('Update journee error:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_ERROR',
      message: 'Erreur lors de la mise à jour de la journée',
    });
  }
};

/**
 * POST /journees/:id/terminer
 * Terminer une journée
 */
const terminer = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: journee, error } = await supabaseAdmin
      .from('journees')
      .update({ statut: 'terminee' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Journée non trouvée',
      });
    }
    
    res.json({
      success: true,
      message: 'Journée terminée',
      data: journee,
    });
    
  } catch (error) {
    console.error('Terminer journee error:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_ERROR',
      message: 'Erreur lors de la clôture de la journée',
    });
  }
};

module.exports = {
  list,
  today,
  get,
  create,
  update,
  terminer,
};
