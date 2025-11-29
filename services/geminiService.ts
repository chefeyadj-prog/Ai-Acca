import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceData } from "../types";

const ai = new GoogleGenAI({ apiKey: __GEMINI_API_KEY__ });

export const analyzeInvoiceImage = async (images: { base64: string, mimeType: string }[]): Promise<InvoiceData> => {
  const model = "gemini-2.5-flash";

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      companyName: {
        type: Type.STRING,
        description: "اسم الشركة أو المؤسسة المصدرة للفاتورة",
      },
      taxId: {
        type: Type.STRING,
        description: "الرقم الضريبي للمنشأة",
      },
      invoiceDate: {
        type: Type.STRING,
        description: "تاريخ الفاتورة بصيغة YYYY-MM-DD",
      },
      invoiceNumber: {
        type: Type.STRING,
        description: "رقم الفاتورة التسلسلي",
      },
      subtotal: {
        type: Type.NUMBER,
        description: "المبلغ الإجمالي قبل الضريبة",
      },
      tax: {
        type: Type.NUMBER,
        description: "قيمة الضريبة المضافة الإجمالية",
      },
      total: {
        type: Type.NUMBER,
        description: "المبلغ الإجمالي النهائي شامل الضريبة",
      },
      currency: {
        type: Type.STRING,
        description: "العملة المستخدمة (مثل SAR, USD)",
      },
      items: {
        type: Type.ARRAY,
        description: "قائمة الأصناف الموجودة في الفاتورة",
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "اسم المنتج أو الخدمة",
            },
            quantity: {
              type: Type.NUMBER,
              description: "الكمية",
            },
            price: {
              type: Type.NUMBER,
              description: "سعر الوحدة",
            },
            tax: {
              type: Type.NUMBER,
              description: "قيمة الضريبة لهذا الصنف",
            },
            total: {
              type: Type.NUMBER,
              description: "إجمالي السعر لهذا الصنف",
            },
          },
          required: ["name", "quantity", "price"],
        },
      },
    },
    required: ["companyName", "total", "items"],
  };

  try {
    const parts = images.map(img => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      },
    }));

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          ...parts,
          {
            text: "قم بتحليل صور الفاتورة هذه واستخرج البيانات المطلوبة باللغة العربية. هذه الصور قد تكون صفحات متعددة لنفس الفاتورة، لذا قم بدمج المعلومات كفاتورة واحدة. إذا كانت الفاتورة بلغة أخرى، قم بترجمة أسماء العناصر إلى العربية.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature for factual extraction
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("لم يتم استلام أي بيانات من النموذج.");
    }

    return JSON.parse(text) as InvoiceData;
  } catch (error) {
    console.error("Error analyzing invoice:", error);
    throw new Error("فشل في تحليل الفاتورة. يرجى التأكد من وضوح الصورة والمحاولة مرة أخرى.");
  }
};
