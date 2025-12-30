import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDate } from '../context/DateContext';
import { statsAPI } from '../services/api';
import {
  Package,
  Truck,
  Users,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { selectedDate, formatDate } = useDate();
  const [stats, setStats] = useState(null);
  const [avancement, setAvancement] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSousTraitant = user?.role === 'sous_traitant';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Stats selon le rôle
      const statsRes = await (isAdmin 
        ? statsAPI.dashboard(selectedDate) 
        : statsAPI.dashboardST(selectedDate));
      setStats(statsRes.data.data);

      // Avancement par chauffeur
      try {
        const avancementRes = await statsAPI.avancement(selectedDate);
        setAvancement(avancementRes.data.data || []);
      } catch (e) {
        // Pas grave si l'avancement n'est pas disponible
        setAvancement([]);
      }
    } catch (err) {
      console.error('Dashboard error:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [isAdmin, selectedDate]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
        {error}
      </div>
    );
  }

  const colisStats = stats?.colis || {};
  const sousTraitantsStats = stats?.sous_traitants || {};
  const chauffeursStats = stats?.chauffeurs || {};
  const trieursStats = stats?.trieurs || {};

  const statCards = [
    { label: 'Colis total', value: colisStats.total || 0, icon: Package, color: 'blue' },
    { label: 'Triés', value: colisStats.tries || 0, icon: CheckCircle, color: 'green' },
    { label: 'Restants', value: colisStats.restants || 0, icon: Clock, color: 'orange' },
    { label: 'Inconnus', value: colisStats.inconnus || 0, icon: AlertCircle, color: 'red' },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
  };

  // Calcul du pourcentage global
  const totalColis = colisStats.total || 0;
  const colisTries = colisStats.tries || 0;
  const pourcentageGlobal = totalColis > 0 ? Math.round((colisTries / totalColis) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dashboard {isSousTraitant && <span className="text-blue-600">- Mon équipe</span>}
          </h1>
          <p className="text-gray-500">{formatDate(selectedDate)}</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Stat Cards - Colis */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses[stat.color]}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progression globale */}
      {totalColis > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Progression globale</h2>
            <span className={`text-2xl font-bold ${pourcentageGlobal >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
              {pourcentageGlobal}%
            </span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pourcentageGlobal >= 100 ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(pourcentageGlobal, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats supplémentaires Admin */}
      {isAdmin && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sous-traitants</p>
                <p className="text-xl font-bold">{sousTraitantsStats.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <Truck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Chauffeurs</p>
                <p className="text-xl font-bold">{chauffeursStats.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Trieurs actifs</p>
                <p className="text-xl font-bold">{trieursStats.actifs || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-pink-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Vitesse tri</p>
                <p className="text-xl font-bold">{stats.vitesse_tri || 0}/min</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Sous-traitant */}
      {isSousTraitant && stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <Truck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Mes chauffeurs</p>
                <p className="text-xl font-bold">{chauffeursStats.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Tournées</p>
                <p className="text-xl font-bold">{stats.tournees || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progression par chauffeur */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">
            {isSousTraitant ? 'Progression de mes chauffeurs' : 'Progression par chauffeur'}
          </h2>
        </div>
        <div className="p-6">
          {avancement.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aucune tournée pour cette date
            </p>
          ) : (
            <div className="space-y-4">
              {avancement.map((item, index) => {
                const pct = item.pourcentage || 0;
                return (
                  <div key={item.chauffeur_id || index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <Truck className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {item.chauffeur_prenom} {item.chauffeur_nom}
                          </p>
                          {!isSousTraitant && item.sous_traitant_nom && (
                            <p className="text-xs text-gray-500">{item.sous_traitant_nom}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{item.colis_tries || 0}/{item.total_colis || 0}</p>
                        <p className="text-xs text-gray-500">{pct}%</p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 100 ? 'bg-green-500' : 
                          pct >= 50 ? 'bg-blue-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
