
import React from 'react';
import { UploadedFile } from '../types';

interface FileCardProps {
  file: UploadedFile;
  onRemove: (id: string) => void;
  isExercise?: boolean;
}

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/markdown',
  'application/json'
];

const FileCard: React.FC<FileCardProps> = ({ file, onRemove, isExercise = false }) => {
  const isSupported = SUPPORTED_MIME_TYPES.includes(file.type);

  const getIcon = () => {
    if (file.type.includes('pdf')) return 'fa-file-pdf text-red-500';
    if (file.type.includes('word') || file.type.includes('docx')) return 'fa-file-word text-blue-500';
    if (file.type.includes('presentation') || file.type.includes('pptx')) return 'fa-file-powerpoint text-orange-500';
    return 'fa-file text-gray-500';
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border bg-white shadow-sm transition-all hover:shadow-md ${isExercise ? 'border-indigo-200' : 'border-gray-200'}`}>
      <div className="flex items-center space-x-3 overflow-hidden">
        <i className={`fas ${getIcon()} text-xl flex-shrink-0`}></i>
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 truncate">{file.name}</span>
            {!isSupported && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold" title="Format non-lisible directement par l'IA. Convertissez en PDF pour une analyse complète.">
                CONSEIL: PDF
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
        </div>
      </div>
      <button 
        onClick={() => onRemove(file.id)}
        className="text-gray-400 hover:text-red-500 transition-colors p-2"
        title="Supprimer"
      >
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};

export default FileCard;
