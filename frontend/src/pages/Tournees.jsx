import { useState, useEffect } from 'react';
import { useDate } from '../context/DateContext';
import { tourneesAPI } from '../services/api';
import {
  Package,
  Truck,
  Download,
  Loader,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function Tournees() {
  const { selectedDate, formatDate } = useDate();
  const [tournees, setTournees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [colisData, setColisData] = useState({});
  const [loadingColis, setLoadingColis] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await tourneesAPI.list(selectedDate);
      setTournees(response.data.data || []);
    } catch (err) {
      console.error('Error fetching tournees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    setExpandedId(null);
    setColisData({});
  }, [selectedDate]);

  const toggleExpand = async (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    if (!colisData[id]) {
      setLoadingColis(id);
      try {
        const response = await tourneesAPI.get(id);
        setColisData((prev) => ({ ...prev, [id]: response.data.data.colis || [] }));
      } catch (err) {
        console.error('Error fetching colis:', err);
      } finally {
        setLoadingColis(null);
      }
    }
  };

  const handleExport = async (id, chauffeurNom) => {
    try {
      const response = await tourneesAPI.export(id);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tournee_${chauffeurNom}_${selectedDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erreur lors de l\'export');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tournées</h1>
        <p className="text-gray-500">{tournees.length} tournée(s) - {formatDate(selectedDate)}</p>
      </div>

      {tournees.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune tournée pour cette date</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tournees.map((tournee) => (
            <div key={tournee.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 cursor-pointer hover:bg-gray-50" onClick={() => toggleExpand(tournee.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <Truck className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{tournee.chauffeur?.prenom} {tournee.chauffeur?.nom}</h3>
                      <p className="text-sm text-gray-500">{tournee.sous_traitant?.nom_entreprise}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="hidden sm:flex items-center gap-4 text-center">
                      <div><p className="text-2xl font-bold">{tournee.nb_colis || 0}</p><p className="text-xs text-gray-500">Colis</p></div>
                      <div><p className="text-2xl font-bold text-green-600">{tournee.nb_tries || 0}</p><p className="text-xs text-gray-500">Triés</p></div>
                      <div><p className="text-2xl font-bold">{tournee.pourcentage || 0}%</p><p className="text-xs text-gray-500">Avancement</p></div>
                    </div>
                    {expandedId === tournee.id ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </div>
                <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${tournee.pourcentage || 0}%` }} />
                </div>
              </div>

              {expandedId === tournee.id && (
                <div className="border-t border-gray-100">
                  <div className="p-4 bg-gray-50">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(tournee.id, tournee.chauffeur?.nom); }}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Exporter Excel</span>
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {loadingColis === tournee.id ? (
                      <div className="p-8 text-center"><Loader className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Adresse</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {colisData[tournee.id]?.map((colis) => (
                            <tr key={colis.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-mono text-sm">{colis.tracking}</td>
                              <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{colis.adresse}{colis.ville && `, ${colis.ville}`}</td>
                              <td className="px-4 py-3 text-center">
                                {colis.statut === 'trie' ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                    <CheckCircle className="w-3 h-3" />Trié
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                    <Clock className="w-3 h-3" />En attente
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}