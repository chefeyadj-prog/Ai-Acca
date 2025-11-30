import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceData } from "../types";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export const analyzeInvoiceImage = async (
  images: { base64: string; mimeType: string }[]
): Promise<InvoiceData> => {
  const model = "gemini-2.5-flash";

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      companyName: { type: Type.STRING },
      taxId: { type: Type.STRING },
      invoiceDate: { type: Type.STRING },
      invoiceNumber: { type: Type.STRING },
      subtotal: { type: Type.NUMBER },
      tax: { type: Type.NUMBER },
      total: { type: Type.NUMBER },
      currency: { type: Type.STRING },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            quantity: { type: Type.NUMBER },
            price: { type: Type.NUMBER },
            tax: { type: Type.NUMBER },
            total: { type: Type.NUMBER }
          },
          required: ["name", "quantity", "price"]
        }
      }
    },
    required: ["companyName", "total", "items"]
  };

  try {
    const parts = images.map(img => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64
      }
    }));

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          ...parts,
          {
            text: `
قم بتحليل صور الفاتورة التالية واستخرج البيانات المطلوبة بصيغة JSON فقط.

❗ تعليمات مهمة جداً:
- يجب أن تكون العملة دائماً هي "SAR" (الريال السعودي)، بغض النظر عن أي عملة مكتوبة في الفاتورة.
- إذا كانت الفاتورة تحتوي على عملة أخرى، تجاهلها تماماً واستخدم "SAR".
- لا تضف أي نص خارج JSON.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });

    const text = response.text;

    console.log("Gemini Response Raw:", text);

    if (!text) throw new Error("لم يتم استلام أي بيانات من النموذج.");

    const data = JSON.parse(text);

    // 💥 إجبار العملة على SAR حتى لو النموذج أرسل عملة غير صحيحة
    data.currency = "SAR";

    return data as InvoiceData;

  } catch (error: any) {
    console.error("Error analyzing invoice:", error);
    throw new Error(error?.message || "فشل في تحليل الفاتورة.");
  }
};
