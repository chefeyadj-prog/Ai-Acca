import React, { useRef, useState } from 'react';
import { Upload, FileImage, X, Plus } from 'lucide-react';
import { ProcessedFile } from '../types';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  files: ProcessedFile[];
  onRemoveFile: (id: string) => void;
  isAnalyzing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, files, onRemoveFile, isAnalyzing }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files) as File[];
      validateAndSetFiles(newFiles);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files) as File[];
      validateAndSetFiles(newFiles);
    }
    // Reset value to allow selecting the same file again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateAndSetFiles = (fileList: File[]) => {
    const validFiles = fileList.filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`الملف ${file.name} ليس صورة. يرجى تحميل صور فقط.`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length > 0) {
      onFilesSelect(validFiles);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // If we have files, show the grid view
  if (files.length > 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((fileObj) => (
            <div key={fileObj.id} className="relative group bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
              <div className="h-32 w-full bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center mb-3">
                <img 
                  src={URL.createObjectURL(fileObj.file)} 
                  alt="Preview" 
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-gray-900 truncate" title={fileObj.file.name}>{fileObj.file.name}</p>
                  <p className="text-[10px] text-gray-500">{(fileObj.file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                {/* Status Indicator */}
                {fileObj.status === 'success' && <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1" title="تم التحليل"></div>}
                {fileObj.status === 'error' && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1" title="خطأ"></div>}
                {fileObj.status === 'analyzing' && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse flex-shrink-0 mt-1" title="جاري التحليل"></div>}
              </div>

              {!isAnalyzing && (
                <button
                  onClick={() => onRemoveFile(fileObj.id)}
                  className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 border border-gray-200 rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}

          {/* Add More Button */}
          {!isAnalyzing && (
            <div 
              onClick={handleClick}
              className="flex flex-col items-center justify-center h-full min-h-[180px] cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-indigo-400 transition-all text-gray-400 hover:text-indigo-600"
            >
              <Plus className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">إضافة المزيد</span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          onChange={handleFileInput}
        />
      </div>
    );
  }

  // Initial Empty State
  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed
        p-12 text-center transition-all duration-200
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-50 scale-[1.01]' 
          : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400'
        }
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileInput}
      />
      <div className="flex flex-col items-center justify-center gap-4">
        <div className={`p-4 rounded-full ${isDragging ? 'bg-indigo-100' : 'bg-gray-100'}`}>
          <Upload className={`w-8 h-8 ${isDragging ? 'text-indigo-600' : 'text-gray-400'}`} />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-medium text-gray-900">
            اضغط لرفع الفواتير أو اسحب الصور هنا
          </p>
          <p className="text-sm text-gray-500">
            يمكنك رفع صور متعددة (JPG, PNG, WEBP)
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;