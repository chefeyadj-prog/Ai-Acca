import React from 'react';
import { InvoiceData } from '../types';
import { Building2, Calendar, FileText, Hash, DollarSign, Calculator, FileSpreadsheet, Paperclip } from 'lucide-react';
import * as XLSX from 'xlsx';

interface InvoiceResultProps {
  data: InvoiceData;
  fileName?: string;
}

const InfoCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; subValue?: string }> = ({ icon, label, value, subValue }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-900 text-lg">{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </div>
  </div>
);

const InvoiceResult: React.FC<InvoiceResultProps> = ({ data, fileName }) => {
  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return '-';
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: data.currency || 'SAR' }).format(amount);
  };

  const handleDownloadExcel = () => {
    // Prepare data for Excel
    const ws_data = [
      ["تفاصيل الفاتورة الإلكترونية"],
      [""],
      ["اسم الملف", fileName || "-"],
      ["اسم الشركة", data.companyName],
      ["الرقم الضريبي", data.taxId],
      ["رقم الفاتورة", data.invoiceNumber],
      ["تاريخ الفاتورة", data.invoiceDate],
      [""],
      // Items Table Header
      ["الصنف", "الكمية", "سعر الوحدة", "الضريبة", "الإجمالي"],
    ];

    // Add items
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

    ws_data.push([""]); // Empty row
    
    // Add Totals
    ws_data.push(["", "", "", "الإجمالي قبل الضريبة", data.subtotal]);
    ws_data.push(["", "", "", "ضريبة القيمة المضافة", data.tax]);
    ws_data.push(["", "", "", "الإجمالي النهائي", data.total]);

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    // Set Right-To-Left view
    if (!ws['!views']) ws['!views'] = [];
    ws['!views'].push({ rightToLeft: true });

    // Set column widths
    ws['!cols'] = [
      { wch: 35 }, // Name
      { wch: 10 }, // Qty
      { wch: 15 }, // Price
      { wch: 15 }, // Tax
      { wch: 20 }, // Total
    ];

    XLSX.utils.book_append_sheet(wb, ws, "الفاتورة");
    
    // Generate file name
    const safeName = (data.invoiceNumber || 'invoice').replace(/[^a-z0-9]/gi, '_');
    XLSX.writeFile(wb, `${safeName}_analysis.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in p-6 bg-white rounded-2xl shadow-sm border border-gray-200">
      {/* Header with Title and Action Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
        <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-1">
                <div className="h-6 w-1 bg-indigo-600 rounded-full"></div>
                <h2 className="text-xl font-bold text-gray-900">
                    {data.companyName || "نتائج التحليل"}
                </h2>
            </div>
            {fileName && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mr-4">
                    <Paperclip className="w-3 h-3" />
                    <span>{fileName}</span>
                </div>
            )}
        </div>
        <button 
            onClick={handleDownloadExcel}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors text-sm font-medium"
        >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel</span>
        </button>
      </div>

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard 
          icon={<Building2 className="w-5 h-5" />}
          label="اسم الشركة"
          value={data.companyName || "غير متوفر"}
          subValue={data.taxId ? `الرقم الضريبي: ${data.taxId}` : undefined}
        />
        <InfoCard 
          icon={<FileText className="w-5 h-5" />}
          label="رقم الفاتورة"
          value={data.invoiceNumber || "غير متوفر"}
        />
        <InfoCard 
          icon={<Calendar className="w-5 h-5" />}
          label="تاريخ الفاتورة"
          value={data.invoiceDate || "غير متوفر"}
        />
        <InfoCard 
          icon={<Calculator className="w-5 h-5" />}
          label="الإجمالي النهائي"
          value={formatCurrency(data.total)}
        />
      </div>

      {/* Summary Breakdown */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="p-2">
                <p className="text-xs text-gray-500 mb-1">الإجمالي قبل الضريبة</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(data.subtotal)}</p>
            </div>
            <div className="p-2 border-r border-l border-gray-200 md:border-y-0 border-y md:border-x">
                <p className="text-xs text-blue-600 mb-1">قيمة الضريبة</p>
                <p className="text-lg font-bold text-blue-900">{formatCurrency(data.tax)}</p>
            </div>
            <div className="p-2">
                <p className="text-xs text-green-600 mb-1">الإجمالي شامل الضريبة</p>
                <p className="text-lg font-bold text-green-900">{formatCurrency(data.total)}</p>
            </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-500 text-xs">
              <tr>
                <th className="py-2 px-4 font-medium">اسم الصنف</th>
                <th className="py-2 px-4 font-medium w-20">الكمية</th>
                <th className="py-2 px-4 font-medium w-28">سعر الوحدة</th>
                <th className="py-2 px-4 font-medium w-28">الضريبة</th>
                <th className="py-2 px-4 font-medium w-28">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {data.items && data.items.length > 0 ? (
                data.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-4 text-gray-900">{item.name}</td>
                    <td className="py-2 px-4 text-gray-600">{item.quantity}</td>
                    <td className="py-2 px-4 text-gray-600">{formatCurrency(item.price)}</td>
                    <td className="py-2 px-4 text-gray-600">{formatCurrency(item.tax)}</td>
                    <td className="py-2 px-4 font-medium text-gray-900">
                        {formatCurrency(item.total ? item.total : (item.quantity * item.price) + (item.tax || 0))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    لا توجد أصناف ظاهرة في الفاتورة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoiceResult;