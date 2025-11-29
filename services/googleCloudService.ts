import { InvoiceData } from "../types";

// TODO: استبدل هذا الرقم بـ Client ID الخاص بمشروعك من Google Cloud Console
// https://console.cloud.google.com/apis/credentials
const CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
const API_KEY = process.env.API_KEY; // Using the existing env key for discovery if needed, though mostly OAuth token is used.

// Scopes for Drive and Sheets
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets';

// Fix: Extend Window interface to include google and gapi properties
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

declare var gapi: any;
declare var google: any;

let tokenClient: any;
let accessToken: string | null = null;

export const initGoogleClient = (onLoggedIn: () => void) => {
  if (!window.google || !window.gapi) return;

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse: any) => {
      accessToken = tokenResponse.access_token;
      if (accessToken) {
        onLoggedIn();
      }
    },
  });

  gapi.load('client', async () => {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: [
        'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
        'https://sheets.googleapis.com/$discovery/rest?version=v4'
      ],
    });
  });
};

export const handleGoogleLogin = () => {
  if (tokenClient) {
    tokenClient.requestAccessToken();
  } else {
    alert("Google API لم يتم تهيئتها بعد. يرجى الانتظار أو تحديث الصفحة.");
  }
};

export const isGoogleLoggedIn = () => !!accessToken;

// --- Helper: Find or Create Folder ---
const getOrCreateFolder = async (folderName: string): Promise<string> => {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  const response = await gapi.client.drive.files.list({ q, fields: 'files(id, name)' });
  
  if (response.result.files && response.result.files.length > 0) {
    return response.result.files[0].id;
  } else {
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    const createRes = await gapi.client.drive.files.create({
      resource: fileMetadata,
      fields: 'id',
    });
    return createRes.result.id;
  }
};

// --- Helper: Upload File ---
const uploadFileToDrive = async (file: File, folderId: string): Promise<string> => {
  const metadata = {
    name: file.name,
    parents: [folderId],
  };

  const accessToken = gapi.auth.getToken().access_token;
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });
  
  const data = await res.json();
  return data.webViewLink;
};

// --- Helper: Find or Create Spreadsheet ---
const getOrCreateSheet = async (folderId: string, sheetName: string): Promise<string> => {
  const q = `mimeType='application/vnd.google-apps.spreadsheet' and name='${sheetName}' and '${folderId}' in parents and trashed=false`;
  const response = await gapi.client.drive.files.list({ q, fields: 'files(id, name)' });

  if (response.result.files && response.result.files.length > 0) {
    return response.result.files[0].id;
  } else {
    const resource = {
      properties: { title: sheetName },
    };
    const createRes = await gapi.client.sheets.spreadsheets.create({
      resource,
      fields: 'spreadsheetId',
    });
    
    // Move the new sheet into our folder
    const fileId = createRes.result.spreadsheetId;
    // Note: The create API doesn't support parents directly easily without Drive API move, 
    // but for simplicity, we might leave it in root or try to move it. 
    // Let's attempt to move it using Drive API update
    const file = await gapi.client.drive.files.get({ fileId, fields: 'parents' });
    const previousParents = file.result.parents.join(',');
    await gapi.client.drive.files.update({
      fileId,
      addParents: folderId,
      removeParents: previousParents,
      fields: 'id, parents',
    });

    // Add Headers
    const headers = ["اسم الملف", "رابط الصورة", "اسم الشركة", "الرقم الضريبي", "رقم الفاتورة", "التاريخ", "الإجمالي قبل الضريبة", "الضريبة", "الإجمالي النهائي"];
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: fileId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [headers] },
    });

    return fileId;
  }
};

// --- Main Function: Save Data ---
export const saveToGoogleWorkspace = async (
  file: File, 
  data: InvoiceData
): Promise<boolean> => {
  try {
    // 1. Ensure Folder exists
    const folderId = await getOrCreateFolder("محلل الفواتير - Invoices");

    // 2. Upload Image
    const webViewLink = await uploadFileToDrive(file, folderId);

    // 3. Ensure Spreadsheet exists
    const sheetId = await getOrCreateSheet(folderId, "سجل الفواتير");

    // 4. Append Data
    const row = [
      file.name,
      webViewLink,
      data.companyName,
      data.taxId,
      data.invoiceNumber,
      data.invoiceDate,
      data.subtotal,
      data.tax,
      data.total
    ];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1', // Appends to the end of data
      valueInputOption: 'USER_ENTERED',
      resource: { values: [row] },
    });

    return true;
  } catch (error) {
    console.error("Google Integration Error:", error);
    throw error;
  }
};