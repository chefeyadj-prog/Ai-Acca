import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceData } from "../types";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

export const analyzeInvoiceImage = async (images: { base64: string, mimeType: string }[]): Promise<InvoiceData> => {
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
            text: "قم بتحليل صور الفاتورة واستخرج البيانات المطلوبة..."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.1
      }
    });

    // 🔥 التعديل المهم هنا:
    const text = await response.response.text();

    if (!text) {
      throw new Error("لم يتم استلام أي بيانات من النموذج.");
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing invoice:", error);
    throw new Error("فشل في تحليل الفاتورة. يرجى التأكد من وضوح الصورة.");
  }
};
