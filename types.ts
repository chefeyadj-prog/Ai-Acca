export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  tax?: number;
  total?: number;
}

export interface InvoiceData {
  companyName: string;
  taxId: string;
  invoiceDate: string;
  invoiceNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  currency?: string;
  items: InvoiceItem[];
}

export interface ProcessedFile {
  id: string;
  file: File;
  status: 'idle' | 'analyzing' | 'success' | 'error';
  result?: InvoiceData;
  error?: string;
}

export interface AnalysisState {
  isAnalyzing: boolean;
  files: ProcessedFile[];
  combinedResult?: InvoiceData;
  combinedError?: string;
}