import { useState, useRef, useCallback } from 'react';
import { useDate } from '../context/DateContext';
import { importsAPI } from '../services/api';
import {
  FileSpreadsheet,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Loader,
  Upload,
} from 'lucide-react';

export default function Imports() {
  const { selectedDate, formatDate } = useDate();
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(null); // 'gofo', 'cainiao', 'spoke'

  const fileInputRefs = {
    gofo: useRef(null),
    cainiao: useRef(null),
    spoke: useRef(null),
  };

  const importTypes = [
    { id: 'gofo', name: 'Gofo', description: 'Excel par chauffeur', icon: FileSpreadsheet, color: 'blue', accept: '.xlsx,.xls', multiple: true },
    { id: 'cainiao', name: 'Cainiao', description: 'Excel par chauffeur', icon: FileSpreadsheet, color: 'orange', accept: '.xlsx,.xls', multiple: true },
    { id: 'spoke', name: 'Spoke PDF', description: 'Multi-chauffeurs (Reims)', icon: FileText, color: 'purple', accept: '.pdf', multiple: false },
  ];

  const uploadFile = async (file, type) => {
    const resultId = `${file.name}-${Date.now()}`;
    const result = { id: resultId, fileName: file.name, type, status: 'uploading' };
    setResults((prev) => [...prev, result]);

    try {
      let response;
      if (type === 'gofo') {
        response = await importsAPI.uploadGofo(file, selectedDate);
      } else if (type === 'cainiao') {
        response = await importsAPI.uploadCainiao(file, selectedDate);
      } else if (type === 'spoke') {
        response = await importsAPI.uploadSpoke(file, selectedDate);
      }

      setResults((prev) =>
        prev.map((r) =>
          r.id === resultId
            ? { ...r, status: 'success', data: response.data.data }
            : r
        )
      );
    } catch (error) {
      setResults((prev) =>
        prev.map((r) =>
          r.id === resultId
            ? { ...r, status: 'error', error: error.response?.data?.message || 'Erreur d\'import' }
            : r
        )
      );
    }
  };

  const handleFiles = async (files, type) => {
    if (files.length === 0) return;

    setUploading(true);

    // Traiter tous les fichiers en parallèle (max 3 à la fois)
    const fileArray = Array.from(files);
    
    for (let i = 0; i < fileArray.length; i += 3) {
      const batch = fileArray.slice(i, i + 3);
      await Promise.all(batch.map((file) => uploadFile(file, type)));
    }

    setUploading(false);
  };

  const handleFileSelect = (type) => {
    fileInputRefs[type].current?.click();
  };

  const handleFileChange = (e, type) => {
    handleFiles(e.target.files, type);
    e.target.value = '';
  };

  // Drag & Drop handlers
  const handleDragEnter = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(type);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Vérifier si on quitte vraiment la zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(null);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Filtrer par extension si nécessaire
      const typeConfig = importTypes.find((t) => t.id === type);
      const acceptedExtensions = typeConfig.accept.split(',').map((ext) => ext.trim().toLowerCase());
      
      const validFiles = Array.from(files).filter((file) => {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        return acceptedExtensions.includes(ext);
      });

      if (validFiles.length === 0) {
        alert(`Format non supporté. Formats acceptés : ${typeConfig.accept}`);
        return;
      }

      // Si pas multiple, prendre seulement le premier
      if (!typeConfig.multiple && validFiles.length > 1) {
        handleFiles([validFiles[0]], type);
      } else {
        handleFiles(validFiles, type);
      }
    }
  }, []);

  const clearResults = () => setResults([]);

  const colorClasses = {
    blue: {
      base: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      active: 'bg-blue-100 border-blue-400 ring-2 ring-blue-400',
      icon: 'bg-blue-200 text-blue-600',
      text: 'text-blue-600',
    },
    orange: {
      base: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
      active: 'bg-orange-100 border-orange-400 ring-2 ring-orange-400',
      icon: 'bg-orange-200 text-orange-600',
      text: 'text-orange-600',
    },
    purple: {
      base: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      active: 'bg-purple-100 border-purple-400 ring-2 ring-purple-400',
      icon: 'bg-purple-200 text-purple-600',
      text: 'text-purple-600',
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import de fichiers</h1>
        <p className="text-gray-500">Import pour le {formatDate(selectedDate)}</p>
      </div>

      {/* Zones de drop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {importTypes.map((type) => {
          const colors = colorClasses[type.color];
          const isActive = dragOver === type.id;

          return (
            <div
              key={type.id}
              onClick={() => !uploading && handleFileSelect(type.id)}
              onDragEnter={(e) => handleDragEnter(e, type.id)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, type.id)}
              className={`
                relative p-6 rounded-xl border-2 border-dashed transition-all cursor-pointer
                ${isActive ? colors.active : colors.base}
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colors.icon}`}>
                  <type.icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className={`font-semibold text-lg ${colors.text}`}>{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
                <div className={`flex items-center gap-2 text-sm ${colors.text}`}>
                  <Upload className="w-4 h-4" />
                  <span>
                    {isActive ? 'Déposez ici !' : 'Glisser-déposer ou cliquer'}
                  </span>
                </div>
                {type.multiple && (
                  <span className="text-xs text-gray-400">Plusieurs fichiers acceptés</span>
                )}
              </div>

              <input
                ref={fileInputRefs[type.id]}
                type="file"
                multiple={type.multiple}
                accept={type.accept}
                onChange={(e) => handleFileChange(e, type.id)}
                className="hidden"
              />
            </div>
          );
        })}
      </div>

      {/* Résultats */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">
              Résultats ({results.filter((r) => r.status === 'success').length}/{results.length} réussis)
            </h2>
            <button onClick={clearResults} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {results.map((result) => (
              <div key={result.id} className="p-4 flex items-center gap-4">
                {result.status === 'uploading' && <Loader className="w-5 h-5 text-blue-600 animate-spin" />}
                {result.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
                {result.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{result.fileName}</p>
                  {result.status === 'success' && (
                    <p className="text-sm text-green-600">
                      {result.data?.colis_importes || result.data?.total_colis || 0} colis importés
                      {result.data?.chauffeur_nom && ` pour ${result.data.chauffeur_nom}`}
                      {result.data?.chauffeurs_count && ` (${result.data.chauffeurs_count} chauffeurs)`}
                    </p>
                  )}
                  {result.status === 'error' && (
                    <p className="text-sm text-red-600">{result.error}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  result.type === 'gofo' ? 'bg-blue-100 text-blue-600' :
                  result.type === 'cainiao' ? 'bg-orange-100 text-orange-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {result.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          💡 Comment importer ?
        </h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>Sélectionnez la date dans le header (demain par défaut)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>Glissez-déposez vos fichiers dans la zone correspondante</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>Le nom du fichier = nom du chauffeur (ex: <code className="bg-blue-100 px-1 rounded">Hakim.xlsx</code>)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>Gofo/Cainiao : plusieurs fichiers à la fois • Spoke : un seul PDF multi-chauffeurs</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
