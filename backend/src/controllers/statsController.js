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
 * GET /stats/dashboard
 * Statistiques globales pour l'admin
 */
const dashboard = async (req, res) => {
  try {
    const targetDate = req.query.date || getTomorrowDate();

    // Récupérer la journée
    let { data: journee } = await supabaseAdmin
      .from('journees')
      .select('*')
      .eq('date', targetDate)
      .single();

    // Si pas de journée, créer une réponse vide
    if (!journee) {
      return res.json({
        success: true,
        data: {
          journee: null,
          colis: { total: 0, tries: 0, restants: 0, inconnus: 0, pourcentage: 0 },
          sous_traitants: { total: 0, en_retard: 0 },
          chauffeurs: { total: 0, avec_spoke: 0 },
          trieurs: { total: 0, actifs: 0 },
          vitesse_tri: 0,
        },
      });
    }

    // Compter les colis pour cette journée
    const { count: totalColis } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .eq('journee_id', journee.id);

    const { count: colisTries } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .eq('journee_id', journee.id)
      .eq('statut', 'trie');

    const { count: colisInconnus } = await supabaseAdmin
      .from('colis')
      .select('id', { count: 'exact', head: true })
      .eq('journee_id', journee.id)
      .is('tournee_id', null);

    // Compter les sous-traitants
    const { count: totalST } = await supabaseAdmin
      .from('sous_traitants')
      .select('id', { count: 'exact', head: true });

    // Compter les chauffeurs
    const { count: totalChauffeurs } = await supabaseAdmin
      .from('chauffeurs')
      .select('id', { count: 'exact', head: true });

    // Compter les chauffeurs avec spoke (tournées importées)
    const { count: chauffeursAvecSpoke } = await supabaseAdmin
      .from('tournees')
      .select('id', { count: 'exact', head: true })
      .eq('journee_id', journee.id)
      .eq('spoke_importe', true);

    // Compter les trieurs
    const { count: totalTrieurs } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'trieur');

    const restants = (totalColis || 0) - (colisTries || 0);
    const pourcentage = totalColis > 0 ? Math.round((colisTries / totalColis) * 100) : 0;

    res.json({
      success: true,
      data: {
        journee: {
          id: journee.id,
          date: journee.date,
          statut: journee.statut,
          deadline: journee.deadline,
          deadline_active: journee.deadline_active,
        },
        colis: {
          total: totalColis || 0,
          tries: colisTries || 0,
          restants: restants,
          inconnus: colisInconnus || 0,
          pourcentage: pourcentage,
        },
        sous_traitants: {
          total: totalST || 0,
          en_retard: 0,
        },
        chauffeurs: {
          total: totalChauffeurs || 0,
          avec_spoke: chauffeursAvecSpoke || 0,
        },
        trieurs: {
          total: totalTrieurs || 0,
          actifs: 0,
        },
        vitesse_tri: 0,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération des statistiques',
    });
  }
};

/**
 * GET /stats/dashboard/st
 * Statistiques pour un sous-traitant
 */
const dashboardST = async (req, res) => {
  try {
    const targetDate = req.query.date || getTomorrowDate();
    const userId = req.user.id;

    // Récupérer le sous-traitant de l'utilisateur
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('sous_traitant_id')
      .eq('id', userId)
      .single();

    if (!user?.sous_traitant_id) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Utilisateur non associé à un sous-traitant',
      });
    }

    // Récupérer la journée
    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', targetDate)
      .single();

    if (!journee) {
      return res.json({
        success: true,
        data: {
          colis: { total: 0, tries: 0, restants: 0, pourcentage: 0 },
          chauffeurs: 0,
        },
      });
    }

    // Récupérer les chauffeurs du ST
    const { data: chauffeurs } = await supabaseAdmin
      .from('chauffeurs')
      .select('id')
      .eq('sous_traitant_id', user.sous_traitant_id);

    const chauffeurIds = chauffeurs?.map((c) => c.id) || [];

    if (chauffeurIds.length === 0) {
      return res.json({
        success: true,
        data: {
          colis: { total: 0, tries: 0, restants: 0, pourcentage: 0 },
          chauffeurs: 0,
        },
      });
    }

    // Récupérer les tournées du ST
    const { data: tournees } = await supabaseAdmin
      .from('tournees')
      .select('id')
      .eq('journee_id', journee.id)
      .in('chauffeur_id', chauffeurIds);

    const tourneeIds = tournees?.map((t) => t.id) || [];

    // Compter les colis
    let totalColis = 0;
    let colisTries = 0;

    if (tourneeIds.length > 0) {
      const { count: total } = await supabaseAdmin
        .from('colis')
        .select('id', { count: 'exact', head: true })
        .in('tournee_id', tourneeIds);

      const { count: tries } = await supabaseAdmin
        .from('colis')
        .select('id', { count: 'exact', head: true })
        .in('tournee_id', tourneeIds)
        .eq('statut', 'trie');

      totalColis = total || 0;
      colisTries = tries || 0;
    }

    const restants = totalColis - colisTries;
    const pourcentage = totalColis > 0 ? Math.round((colisTries / totalColis) * 100) : 0;

    res.json({
      success: true,
      data: {
        colis: {
          total: totalColis,
          tries: colisTries,
          restants: restants,
          pourcentage: pourcentage,
        },
        chauffeurs: chauffeurIds.length,
      },
    });
  } catch (error) {
    console.error('Dashboard ST stats error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération des statistiques',
    });
  }
};

/**
 * GET /stats/avancement
 * Avancement du tri par chauffeur
 */
const avancement = async (req, res) => {
  try {
    const targetDate = req.query.date || getTomorrowDate();

    // Récupérer la journée
    const { data: journee } = await supabaseAdmin
      .from('journees')
      .select('id')
      .eq('date', targetDate)
      .single();

    if (!journee) {
      return res.json({ success: true, data: [] });
    }

    // Utiliser la vue si elle existe, sinon calculer manuellement
    const { data: tournees } = await supabaseAdmin
      .from('tournees')
      .select(`
        id,
        nb_colis,
        chauffeur:chauffeurs(id, nom, prenom, sous_traitant_id)
      `)
      .eq('journee_id', journee.id);

    const avancementData = await Promise.all(
      (tournees || []).map(async (tournee) => {
        // Compter les colis triés
        const { count: colisTries } = await supabaseAdmin
          .from('colis')
          .select('id', { count: 'exact', head: true })
          .eq('tournee_id', tournee.id)
          .eq('statut', 'trie');

        // Récupérer le nom du ST
        let stNom = '';
        if (tournee.chauffeur?.sous_traitant_id) {
          const { data: st } = await supabaseAdmin
            .from('sous_traitants')
            .select('nom_entreprise')
            .eq('id', tournee.chauffeur.sous_traitant_id)
            .single();
          stNom = st?.nom_entreprise || '';
        }

        const pourcentage = tournee.nb_colis > 0
          ? Math.round(((colisTries || 0) / tournee.nb_colis) * 100)
          : 0;

        return {
          chauffeur_id: tournee.chauffeur?.id,
          chauffeur_nom: tournee.chauffeur?.nom,
          chauffeur_prenom: tournee.chauffeur?.prenom,
          sous_traitant_nom: stNom,
          total_colis: tournee.nb_colis || 0,
          colis_tries: colisTries || 0,
          pourcentage: pourcentage,
        };
      })
    );

    res.json({ success: true, data: avancementData });
  } catch (error) {
    console.error('Avancement stats error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Erreur lors de la récupération de l\'avancement',
    });
  }
};

module.exports = {
  dashboard,
  dashboardST,
  avancement,
};