import React, { useState, useEffect } from 'react';
import { ScanLine, Loader2, Sparkles, AlertCircle, FileSpreadsheet, Layers, Cloud, CheckCircle, Database } from 'lucide-react';
import FileUpload from './components/FileUpload';
import InvoiceResult from './components/InvoiceResult';
import { AnalysisState, ProcessedFile } from './types';
import { analyzeInvoiceImage } from './services/geminiService';
import { initGoogleClient, handleGoogleLogin, saveToGoogleWorkspace, isGoogleLoggedIn } from './services/googleCloudService';
import * as XLSX from 'xlsx';

const App: React.FC = () => {
  const [state, setState] = useState<AnalysisState>({
    isAnalyzing: false,
    files: [],
  });
  const [isMultiPage, setIsMultiPage] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    // Initialize Google API Client
    initGoogleClient(() => {
      setIsGoogleConnected(true);
    });
  }, []);

  const handleFilesSelect = (selectedFiles: File[]) => {
    const newProcessedFiles: ProcessedFile[] = selectedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'idle',
    }));

    setState(prev => ({
      ...prev,
      files: [...prev.files, ...newProcessedFiles],
      combinedResult: undefined,
      combinedError: undefined
    }));
    setCloudStatus('idle');
  };

  const handleRemoveFile = (id: string) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== id),
      combinedResult: undefined,
      combinedError: undefined
    }));
  };

  const handleClearAll = () => {
    setState({ isAnalyzing: false, files: [], combinedResult: undefined, combinedError: undefined });
    setCloudStatus('idle');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64Content = result.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleAnalyze = async () => {
    const filesToProcess = state.files.filter(f => f.status === 'idle' || f.status === 'error');
    if (filesToProcess.length === 0 && !isMultiPage) return;
    if (state.files.length === 0) return;

    setState(prev => ({ ...prev, isAnalyzing: true, combinedError: undefined }));
    setCloudStatus('idle');

    if (isMultiPage) {
      try {
        const allImages = await Promise.all(state.files.map(async (f) => ({
          base64: await fileToBase64(f.file),
          mimeType: f.file.type
        })));

        const result = await analyzeInvoiceImage(allImages);

        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          combinedResult: result,
          files: prev.files.map(f => ({ ...f, status: 'success' }))
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
        setState(prev => ({
          ...prev,
          isAnalyzing: false,
          combinedError: errorMessage,
          files: prev.files.map(f => ({ ...f, status: 'error' }))
        }));
      }
    } else {
      let currentFiles = [...state.files];
      for (const fileObj of filesToProcess) {
        setState(prev => ({
          ...prev,
          files: prev.files.map(f => f.id === fileObj.id ? { ...f, status: 'analyzing', error: undefined } : f)
        }));

        try {
          const base64Content = await fileToBase64(fileObj.file);
          const result = await analyzeInvoiceImage([{ base64: base64Content, mimeType: fileObj.file.type }]);
          
          setState(prev => ({
            ...prev,
            files: prev.files.map(f => f.id === fileObj.id ? { ...f, status: 'success', result } : f)
          }));

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
          setState(prev => ({
            ...prev,
            files: prev.files.map(f => f.id === fileObj.id ? { ...f, status: 'error', error: errorMessage } : f)
          }));
        }
      }
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  };

  const handleExportAll = () => {
    // ... Existing Excel export logic ...
    const successfulResults = isMultiPage && state.combinedResult 
      ? [{ result: state.combinedResult, name: 'فاتورة_مجمعة' }]
      : state.files.filter(f => f.status === 'success' && f.result).map(f => ({ result: f.result!, name: f.file.name }));

    if (successfulResults.length === 0) return;

    const wb = XLSX.utils.book_new();

    successfulResults.forEach((item, index) => {
      const data = item.result;
      const ws_data = [
        ["تفاصيل الفاتورة الإلكترونية"],
        [""],
        ["اسم الملف", item.name],
        ["اسم الشركة", data.companyName],
        ["الرقم الضريبي", data.taxId],
        ["رقم الفاتورة", data.invoiceNumber],
        ["تاريخ الفاتورة", data.invoiceDate],
        [""],
        ["الصنف", "الكمية", "سعر الوحدة", "الضريبة", "الإجمالي"],
      ];

      if (data.items) {
        data.items.forEach(item => {
          ws_data.push([
            item.name,
            item.quantity,
            item.price,
            item.tax || 0,
            item.total || ((item.quantity * item.price) + (item.tax || 0))
          ]);
        });
      }

      ws_data.push([""]); 
      ws_data.push(["", "", "", "الإجمالي قبل الضريبة", data.subtotal]);
      ws_data.push(["", "", "", "ضريبة القيمة المضافة", data.tax]);
      ws_data.push(["", "", "", "الإجمالي النهائي", data.total]);

      const ws = XLSX.utils.aoa_to_sheet(ws_data);
      if (!ws['!views']) ws['!views'] = [];
      ws['!views'].push({ rightToLeft: true });
      ws['!cols'] = [{ wch: 35 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
      
      let sheetName = (data.invoiceNumber || `F${index + 1}`).replace(/[:\\/?*[\]]/g, "");
      if (sheetName.length > 30) sheetName = sheetName.substring(0, 30);
      let uniqueSheetName = sheetName;
      let counter = 1;
      while (wb.SheetNames.includes(uniqueSheetName)) {
        uniqueSheetName = `${sheetName} (${counter++})`;
      }
      XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName);
    });

    XLSX.writeFile(wb, `Invoices_Analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSaveToCloud = async () => {
    if (!isGoogleConnected) {
      handleGoogleLogin();
      return;
    }

    setIsSavingToCloud(true);
    setCloudStatus('idle');

    try {
      if (isMultiPage && state.combinedResult && state.files.length > 0) {
        // For multi-page, we might want to zip them or just upload the first page as reference, 
        // OR upload all images. For simplicity, let's upload the first image and the combined data.
        await saveToGoogleWorkspace(state.files[0].file, state.combinedResult);
      } else {
        const successfulFiles = state.files.filter(f => f.status === 'success' && f.result);
        for (const fileObj of successfulFiles) {
          await saveToGoogleWorkspace(fileObj.file, fileObj.result!);
        }
      }
      setCloudStatus('success');
      alert("تم الحفظ بنجاح في Google Drive و Google Sheets");
    } catch (error) {
      console.error(error);
      setCloudStatus('error');
      alert("حدث خطأ أثناء الحفظ في Google Cloud");
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const successfulResults = state.files.filter(f => f.status === 'success');
  const hasResults = ((!isMultiPage && successfulResults.length > 0) || (isMultiPage && state.combinedResult));

  return (
    <div className="min-h-screen bg-[#f3f4f6] pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <ScanLine className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">محلل الفواتير الذكي</h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Google Connect Button */}
             {!isGoogleConnected ? (
                <button 
                  onClick={handleGoogleLogin}
                  className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition-colors text-sm font-medium"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                  <span>ربط بحساب Google</span>
                </button>
             ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm border border-blue-100">
                  <CheckCircle className="w-4 h-4" />
                  <span>متصل بـ Google</span>
                </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Intro */}
        <div className="text-center space-y-2 mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            تحليل الفواتير بدقة فائقة
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            ارفع صورة أو أكثر ودع الذكاء الاصطناعي يستخرج لك كافة التفاصيل بدقة عالية.
          </p>
        </div>

        {/* Upload Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          <FileUpload 
            files={state.files}
            onFilesSelect={handleFilesSelect}
            onRemoveFile={handleRemoveFile}
            isAnalyzing={state.isAnalyzing}
          />

          {/* Multi-page Checkbox */}
          {state.files.length > 1 && (
            <div className="mt-4 flex items-center justify-center">
              <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isMultiPage ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                    checked={isMultiPage}
                    onChange={(e) => setIsMultiPage(e.target.checked)}
                    disabled={state.isAnalyzing}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 select-none">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span className="font-medium">دمج الصور في فاتورة واحدة (فواتير متعددة الصفحات)</span>
                </div>
              </label>
            </div>
          )}
          
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {state.files.length > 0 && (
                <>
                    <button
                        onClick={handleClearAll}
                        disabled={state.isAnalyzing}
                        className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                        مسح الكل
                    </button>
                    <button
                        onClick={handleAnalyze}
                        disabled={state.isAnalyzing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center gap-2 text-lg disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                        {state.isAnalyzing ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                جاري التحليل...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                {isMultiPage ? 'تحليل كفاتورة واحدة' : `تحليل الفواتير (${state.files.filter(f => f.status === 'idle' || f.status === 'error').length})`}
                            </>
                        )}
                    </button>
                </>
            )}
          </div>
        </section>

        {/* Global Actions for Results */}
        {hasResults && (
            <div className="flex flex-wrap justify-end gap-3">
                <button
                    onClick={handleSaveToCloud}
                    disabled={isSavingToCloud}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl shadow-sm transition-colors font-medium text-white
                      ${cloudStatus === 'success' ? 'bg-blue-600 hover:bg-blue-700' : 
                        cloudStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : 
                        'bg-blue-600 hover:bg-blue-700'}
                      disabled:opacity-70 disabled:cursor-not-allowed
                    `}
                >
                    {isSavingToCloud ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Cloud className="w-5 h-5" />
                    )}
                    <span>
                      {isSavingToCloud ? 'جاري الحفظ...' : 'حفظ في Drive & Sheets'}
                    </span>
                </button>

                <button
                    onClick={handleExportAll}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm transition-colors font-medium"
                >
                    <FileSpreadsheet className="w-5 h-5" />
                    <span>تصدير النتائج (Excel)</span>
                </button>
            </div>
        )}

        {/* Results Section */}
        <div className="space-y-6">
            {/* Multi-page Result */}
            {isMultiPage && state.combinedResult && (
                 <InvoiceResult 
                    data={state.combinedResult} 
                    fileName={`تحليل مجمع (${state.files.length} صور)`}
                />
            )}
            
            {/* Multi-page Error */}
            {isMultiPage && state.combinedError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-sm">خطأ في التحليل المجمع</p>
                        <p className="text-sm">{state.combinedError}</p>
                    </div>
                </div>
            )}

            {/* Single Page Results */}
            {!isMultiPage && state.files.map((fileObj) => {
                if (fileObj.status === 'success' && fileObj.result) {
                    return (
                        <InvoiceResult 
                            key={fileObj.id} 
                            data={fileObj.result} 
                            fileName={fileObj.file.name}
                        />
                    );
                }
                if (fileObj.status === 'error') {
                    return (
                        <div key={fileObj.id} className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <div>
                                <p className="font-bold text-sm">{fileObj.file.name}</p>
                                <p className="text-sm">{fileObj.error}</p>
                            </div>
                        </div>
                    );
                }
                return null;
            })}
        </div>
      </main>
    </div>
  );
};

export default App;