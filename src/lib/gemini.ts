import { GoogleGenAI, Type } from "@google/genai";
import { Lecture } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseTimetable(base64Data: string, mimeType: string, fileName?: string): Promise<{
  name: string;
  department: string;
  createdBy: string;
  classes: string[];
  lectures: Omit<Lecture, 'id' | 'timetableId'>[];
}> {
  console.log(`Starting AI extraction for ${fileName} (${mimeType})...`);
  console.time("AI_Total_Time");

  const prompt = `
    Analyze this university timetable document. FileName: "${fileName || 'Unknown'}".
    
    1. Extract Meta Info:
       - name: Short descriptive name (e.g., "BSCS-6M").
       - department: Department name.
       - createdBy: Issuing authority or creator.
       - classes: List of unique section/class identifiers.

    2. Extract ALL Lecture Slots:
       - Map each slot to its respective "day" (full name), "startTime", "endTime", "subject", "teacher", "room", and "className".
       - "slotIndex" should be the period number (1, 2, 3...).

    CRITICAL: Extract ALL data from ALL pages. If this is a multi-page PDF, process every page carefully and extract every single lecture slot mentioned.
    Return ONLY JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isTimetable: { type: Type.BOOLEAN },
            name: { type: Type.STRING },
            department: { type: Type.STRING },
            createdBy: { type: Type.STRING },
            classes: { type: Type.ARRAY, items: { type: Type.STRING } },
            lectures: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING },
                  startTime: { type: Type.STRING },
                  endTime: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  teacher: { type: Type.STRING },
                  room: { type: Type.STRING },
                  className: { type: Type.STRING },
                  slotIndex: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    console.timeEnd("AI_Total_Time");
    
    const cleanText = response.text || "{}";
    const parsed = JSON.parse(cleanText);

    if (parsed.isTimetable === false) {
      throw new Error("NOT_TIMETABLE");
    }

    // Sanitize to match Firestore rules
    const sanitizedClasses = Array.isArray(parsed.classes) && parsed.classes.length > 0 
      ? parsed.classes 
      : ['Unknown Class'];
    
    return {
      name: (parsed.name && parsed.name !== "Unknown") ? parsed.name.substring(0, 200) : fileName?.split('.')[0] || "Timetable",
      department: (parsed.department && parsed.department !== "Unknown") ? parsed.department : "General",
      createdBy: (parsed.createdBy && parsed.createdBy !== "Unknown") ? parsed.createdBy : "Official",
      classes: sanitizedClasses,
      lectures: (parsed.lectures || []).map((l: any) => ({
        day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(l.day) ? l.day : 'Monday',
        startTime: l.startTime || '00:00',
        endTime: l.endTime || '00:00',
        subject: l.subject || 'Lecture',
        teacher: l.teacher || 'TBA',
        room: l.room || 'TBA',
        className: l.className || (sanitizedClasses[0] || 'Unknown Class'),
        slotIndex: typeof l.slotIndex === 'number' ? l.slotIndex : 1
      }))
    };
  } catch (e: any) {
    console.error("AI Extraction Error:", e);
    throw new Error(e.message || "AI failed to provide valid structured data.");
  }
}
