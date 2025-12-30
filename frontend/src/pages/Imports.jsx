import { useState, useRef } from 'react';
import { useDate } from '../context/DateContext';
import { importsAPI } from '../services/api';
import {
  FileSpreadsheet,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Loader,
} from 'lucide-react';

export default function Imports() {
  const { selectedDate, formatDate } = useDate();
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const fileInputRef = useRef(null);
  const [importType, setImportType] = useState(null);

  const handleFileSelect = (type) => {
    setImportType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);

    for (const file of files) {
      const result = { fileName: file.name, status: 'uploading' };
      setResults((prev) => [...prev, result]);

      try {
        let response;
        if (importType === 'gofo') {
          response = await importsAPI.uploadGofo(file, selectedDate);
        } else if (importType === 'cainiao') {
          response = await importsAPI.uploadCainiao(file, selectedDate);
        } else if (importType === 'spoke') {
          response = await importsAPI.uploadSpoke(file, selectedDate);
        }

        setResults((prev) =>
          prev.map((r) =>
            r.fileName === file.name
              ? { ...r, status: 'success', data: response.data.data }
              : r
          )
        );
      } catch (error) {
        setResults((prev) =>
          prev.map((r) =>
            r.fileName === file.name
              ? { ...r, status: 'error', error: error.response?.data?.message || 'Erreur' }
              : r
          )
        );
      }
    }

    setUploading(false);
    e.target.value = '';
  };

  const clearResults = () => setResults([]);

  const importTypes = [
    { id: 'gofo', name: 'Gofo', description: 'Excel par chauffeur', icon: FileSpreadsheet, color: 'blue', accept: '.xlsx,.xls' },
    { id: 'cainiao', name: 'Cainiao', description: 'Excel par chauffeur', icon: FileSpreadsheet, color: 'orange', accept: '.xlsx,.xls' },
    { id: 'spoke', name: 'Spoke PDF', description: 'Multi-chauffeurs (Reims)', icon: FileText, color: 'purple', accept: '.pdf' },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-50',
    orange: 'bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-50',
    purple: 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-50',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import de fichiers</h1>
        <p className="text-gray-500">Import pour le {formatDate(selectedDate)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {importTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => handleFileSelect(type.id)}
            disabled={uploading}
            className={`p-6 rounded-xl border-2 border-dashed transition text-left ${colorClasses[type.color]} disabled:opacity-50`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                type.color === 'blue' ? 'bg-blue-200' : type.color === 'orange' ? 'bg-orange-200' : 'bg-purple-200'
              }`}>
                <type.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{type.name}</h3>
                <p className="text-sm opacity-75">{type.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple={importType !== 'spoke'}
        accept={importTypes.find((t) => t.id === importType)?.accept || '*'}
        onChange={handleFileChange}
        className="hidden"
      />

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">Résultats</h2>
            <button onClick={clearResults} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {results.map((result, index) => (
              <div key={index} className="p-4 flex items-center gap-4">
                {result.status === 'uploading' && <Loader className="w-5 h-5 text-blue-600 animate-spin" />}
                {result.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {result.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                <div className="flex-1">
                  <p className="font-medium">{result.fileName}</p>
                  {result.status === 'success' && (
                    <p className="text-sm text-green-600">
                      {result.data?.colis_importes || 0} colis importés
                      {result.data?.chauffeur_nom && ` pour ${result.data.chauffeur_nom}`}
                    </p>
                  )}
                  {result.status === 'error' && <p className="text-sm text-red-600">{result.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">💡 Comment importer ?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>1.</strong> Sélectionnez la date dans le header (demain par défaut)</li>
          <li><strong>2.</strong> Le nom du fichier = nom du chauffeur (ex: Hakim.xlsx)</li>
          <li><strong>3.</strong> Spoke PDF : fichier multi-chauffeurs pour Reims</li>
        </ul>
      </div>
    </div>
  );
}