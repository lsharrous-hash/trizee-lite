const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /colis
 * Liste des colis du jour
 */
const list = async (req, res) => {
  try {
    const { tournee_id, statut, limit = 100 } = req.query;
    const todayDate = new Date().toISOString().split('T')[0];
    
    // Récupérer la journée
    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', todayDate)
      .single();
    
    if (!journee) {
      return res.json({ success: true, data: [] });
    }
    
    // Construire la requête
    let query = supabaseAdmin
      .from('colis')
      .select(`
        id,
        tracking,
        adresse,
        ville,
        code_postal,
        numero_ordre,
        source,
        statut,
        created_at,
        tournee_id,
        tournees (
          id,
          chauffeur_id,
          chauffeurs (
            id,
            nom,
            prenom,
            sous_traitant_id,
            sous_traitants (
              id,
              nom_entreprise
            )
          )
        )
      `)
      .eq('journee_id', journee.id)
      .limit(parseInt(limit));
    
    if (tournee_id) {
      query = query.eq('tournee_id', tournee_id);
    }
    
    if (statut) {
      query = query.eq('statut', statut);
    }
    
    // Filtrer pour sous-traitant
    if (req.user.role === 'sous_traitant') {
      const { data: chauffeurs } = await supabaseAdmin
        .from('chauffeurs')
        .select('id')
        .eq('sous_traitant_id', req.user.sous_traitant_id);
      
      const chauffeurIds = chauffeurs?.map(c => c.id) || [];
      
      if (chauffeurIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      
      const { data: tournees } = await supabaseAdmin
        .from('tournees')
        .select('id')
        .in('chauffeur_id', chauffeurIds);
      
      const tourneeIds = tournees?.map(t => t.id) || [];
      
      if (tourneeIds.length > 0) {
        query = query.in('tournee_id', tourneeIds);
      } else {
        return res.json({ success: true, data: [] });
      }
    }
    
    const { data: colis, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Formater les résultats
    const formattedColis = colis.map(c => ({
      ...c,
      chauffeur: c.tournees?.chauffeurs 
        ? `${c.tournees.chauffeurs.prenom} ${c.tournees.chauffeurs.nom}`
        : null,
      sous_traitant: c.tournees?.chauffeurs?.sous_traitants?.nom_entreprise || null,
    }));
    
    res.json({
      success: true,
      data: formattedColis,
    });
    
  } catch (error) {
    console.error('List colis error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération des colis',
    });
  }
};

/**
 * GET /colis/:tracking
 * Rechercher un colis par tracking
 */
const getByTracking = async (req, res) => {
  try {
    const { tracking } = req.params;
    const todayDate = new Date().toISOString().split('T')[0];
    
    // Récupérer la journée
    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', todayDate)
      .single();
    
    if (!journee) {
      return res.status(404).json({
        success: false,
        error: 'NO_JOURNEE',
        message: 'Aucune journée en cours',
      });
    }
    
    // Rechercher le colis
    const { data: colis, error } = await supabaseAdmin
      .from('colis')
      .select(`
        id,
        tracking,
        adresse,
        ville,
        code_postal,
        numero_ordre,
        source,
        statut,
        tournee_id,
        tournees (
          id,
          chauffeur_id,
          chauffeurs (
            id,
            nom,
            prenom,
            sous_traitant_id,
            sous_traitants (
              id,
              nom_entreprise
            )
          )
        )
      `)
      .eq('journee_id', journee.id)
      .ilike('tracking', tracking)
      .single();
    
    if (error || !colis) {
      return res.status(404).json({
        success: false,
        error: 'COLIS_NOT_FOUND',
        message: 'Colis non trouvé',
      });
    }
    
    res.json({
      success: true,
      data: {
        ...colis,
        chauffeur: colis.tournees?.chauffeurs
          ? {
              id: colis.tournees.chauffeurs.id,
              nom: colis.tournees.chauffeurs.nom,
              prenom: colis.tournees.chauffeurs.prenom,
            }
          : null,
        sous_traitant: colis.tournees?.chauffeurs?.sous_traitants
          ? {
              id: colis.tournees.chauffeurs.sous_traitants.id,
              nom_entreprise: colis.tournees.chauffeurs.sous_traitants.nom_entreprise,
            }
          : null,
      },
    });
    
  } catch (error) {
    console.error('Get colis by tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la recherche du colis',
    });
  }
};

/**
 * GET /colis/inconnus
 * Liste des colis inconnus du jour
 */
const getInconnus = async (req, res) => {
  try {
    const todayDate = new Date().toISOString().split('T')[0];
    
    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', todayDate)
      .single();
    
    if (!journee) {
      return res.json({ success: true, data: [] });
    }
    
    const { data: colis, error } = await supabaseAdmin
      .from('colis')
      .select(`
        id,
        tracking,
        created_at
      `)
      .eq('journee_id', journee.id)
      .eq('statut', 'inconnu')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: colis,
    });
    
  } catch (error) {
    console.error('Get inconnus error:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_ERROR',
      message: 'Erreur lors de la récupération des colis inconnus',
    });
  }
};

module.exports = {
  list,
  getByTracking,
  getInconnus,
};
