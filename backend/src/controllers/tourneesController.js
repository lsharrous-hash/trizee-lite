const { supabaseAdmin } = require('../config/supabase');

/**
 * Retourne la date de demain au format YYYY-MM-DD
 */
function getTomorrowDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * GET /tournees
 * Liste des tournées pour une date donnée
 */
const list = async (req, res) => {
  try {
    const targetDate = req.query.date || getTomorrowDate();
    
    console.log('Fetching tournees for date:', targetDate);

    // Récupérer la journée
    const { data: journee, error: journeeError } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', targetDate)
      .single();

    console.log('Journee found:', journee, 'Error:', journeeError);

    if (!journee) {
      return res.json({ success: true, data: [] });
    }

    // Récupérer les tournées
    const { data: tournees, error: tourneesError } = await supabaseAdmin
      .from('tournees')
      .select('*')
      .eq('journee_id', journee.id);

    console.log('Tournees found:', tournees?.length, 'Error:', tourneesError);

    if (tourneesError) throw tourneesError;

    // Enrichir avec les infos du chauffeur et sous-traitant
    const enrichedTournees = await Promise.all(
      (tournees || []).map(async (tournee) => {
        // Récupérer le chauffeur
        let chauffeur = null;
        if (tournee.chauffeur_id) {
          const { data: chauffeurData } = await supabaseAdmin
            .from('chauffeurs')
            .select('id, nom, prenom, sous_traitant_id')
            .eq('id', tournee.chauffeur_id)
            .single();
          chauffeur = chauffeurData;
        }

        // Récupérer le sous-traitant
        let sousTraitant = null;
        if (chauffeur?.sous_traitant_id) {
          const { data: stData } = await supabaseAdmin
            .from('sous_traitants')
            .select('id, nom_entreprise')
            .eq('id', chauffeur.sous_traitant_id)
            .single();
          sousTraitant = stData;
        }

        // Compter les colis triés
        const { count: nbTries } = await supabaseAdmin
          .from('colis')
          .select('id', { count: 'exact', head: true })
          .eq('tournee_id', tournee.id)
          .eq('statut', 'trie');

        const pourcentage = tournee.nb_colis > 0
          ? Math.round(((nbTries || 0) / tournee.nb_colis) * 100)
          : 0;

        return {
          ...tournee,
          chauffeur,
          sous_traitant: sousTraitant,
          nb_tries: nbTries || 0,
          pourcentage,
        };
      })
    );

    console.log('Enriched tournees:', enrichedTournees.length);

    res.json({ success: true, data: enrichedTournees });
  } catch (error) {
    console.error('List tournees error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération des tournées',
    });
  }
};

/**
 * GET /tournees/:id
 * Détail d'une tournée avec ses colis
 */
const get = async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer la tournée
    const { data: tournee, error } = await supabaseAdmin
      .from('tournees')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !tournee) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Tournée non trouvée',
      });
    }

    // Récupérer le chauffeur
    let chauffeur = null;
    if (tournee.chauffeur_id) {
      const { data: chauffeurData } = await supabaseAdmin
        .from('chauffeurs')
        .select('id, nom, prenom')
        .eq('id', tournee.chauffeur_id)
        .single();
      chauffeur = chauffeurData;
    }

    // Récupérer les colis
    const { data: colis } = await supabaseAdmin
      .from('colis')
      .select('*')
      .eq('tournee_id', id)
      .order('created_at');

    res.json({
      success: true,
      data: {
        ...tournee,
        chauffeur,
        colis: colis || [],
      },
    });
  } catch (error) {
    console.error('Get tournee error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération de la tournée',
    });
  }
};

/**
 * GET /tournees/:id/export
 * Exporter une tournée au format Excel
 */
const exportTournee = async (req, res) => {
  try {
    const { id } = req.params;
    const XLSX = require('xlsx');

    // Récupérer la tournée
    const { data: tournee } = await supabaseAdmin
      .from('tournees')
      .select('*')
      .eq('id', id)
      .single();

    // Récupérer le chauffeur
    let chauffeurNom = 'export';
    if (tournee?.chauffeur_id) {
      const { data: chauffeur } = await supabaseAdmin
        .from('chauffeurs')
        .select('nom, prenom')
        .eq('id', tournee.chauffeur_id)
        .single();
      if (chauffeur) {
        chauffeurNom = `${chauffeur.prenom || ''}_${chauffeur.nom}`.trim();
      }
    }

    // Récupérer les colis
    const { data: colis } = await supabaseAdmin
      .from('colis')
      .select('tracking, adresse, ville, code_postal, statut')
      .eq('tournee_id', id)
      .order('created_at');

    // Créer le fichier Excel
    const wsData = [
      ['Tracking', 'Adresse', 'Ville', 'Code Postal', 'Statut'],
      ...(colis || []).map(c => [
        c.tracking,
        c.adresse,
        c.ville,
        c.code_postal,
        c.statut === 'trie' ? 'Trié' : 'En attente'
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Colis');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=tournee_${chauffeurNom}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('Export tournee error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de l\'export',
    });
  }
};

/**
 * POST /tournees/:id/spoke
 */
const importSpoke = async (req, res) => {
  res.status(501).json({
    success: false,
    error: 'NOT_IMPLEMENTED',
    message: 'Fonctionnalité non implémentée',
  });
};

module.exports = {
  list,
  get,
  exportTournee,
  importSpoke,
};
