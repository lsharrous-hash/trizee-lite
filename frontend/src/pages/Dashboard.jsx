import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDate } from '../context/DateContext';
import { statsAPI, journeesAPI } from '../services/api';
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
  const { isAdmin } = useAuth();
  const { selectedDate, formatDate } = useDate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const statsRes = await (isAdmin 
        ? statsAPI.dashboard(selectedDate) 
        : statsAPI.dashboardST(selectedDate));
      setStats(statsRes.data.data);
    } catch (err) {
      console.error('Dashboard error:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
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
    </div>
  );
}