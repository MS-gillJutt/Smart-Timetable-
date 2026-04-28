import { GoogleGenAI, Type } from "@google/genai";
import { Lecture, DAY_MAP } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseTimetable(base64Data: string, mimeType: string): Promise<{
  name: string;
  department: string;
  createdBy: string;
  classes: string[];
  lectures: Omit<Lecture, 'id' | 'timetableId'>[];
}> {
  const prompt = `
    Analyze this document/image.
    First, determine if the document actually represents a university or school timetable / schedule. 
    If the document does not look like a timetable (e.g., it is a book, a random picture, or unrelated text), set "isTimetable" to false.
    If it is a timetable:
    Extract the following information in JSON format:
    1. Timetable meta-info: name (e.g. "BSCS 6 M" or "Timetable 2026"), department, createdBy (e.g. who signed it).
    2. A flat list of every lecture slot found.
    
    CRITICAL INSTRUCTIONS:
    - If a specific piece of metadata (name, department, creator) is not found, use "Unknown". Do not leave it empty.
    - Extract ALL lectures from the image.
    - Structure the response exactly as follows:
    {
      "isTimetable": true,
      "name": "Class Name",
      "department": "Department Name",
      "createdBy": "Person Name",
      "classes": ["Class 1", "Class 2"],
      "lectures": [
        {
          "day": "Monday",
          "startTime": "8:00 AM",
          "endTime": "9:00 AM",
          "subject": "Artificial Intelligence Lab",
          "teacher": "Sameen Fatima",
          "room": "4.G.20 (CS Lab)",
          "className": "BSCS 6 M",
          "slotIndex": 1
        }
      ]
    }
    
    Note:
    - Days should be full names (Monday, Tuesday, etc.).
    - If a cell is empty or indicates a break, do not create a lecture for it.
    - Return valid JSON only.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts: [
          { text: prompt + "\nFollow the schema exactly." },
          { inlineData: { mimeType, data: base64Data } }
        ]
      }
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

  try {
    let cleanText = response.text || "{}";
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json/, "").replace(/```$/, "");
    }
    const parsed = JSON.parse(cleanText);

    if (parsed.isTimetable === false) {
      throw new Error("NOT_TIMETABLE");
    }

    // Sanitize to match Firestore rules
    const sanitizedClasses = Array.isArray(parsed.classes) && parsed.classes.length > 0 
      ? parsed.classes 
      : ['Unknown Class'];
    
    return {
      name: (parsed.name || "Unknown").substring(0, 200),
      department: parsed.department || "Unknown",
      createdBy: parsed.createdBy || "Unknown",
      classes: sanitizedClasses,
      lectures: (parsed.lectures || []).map((l: any) => ({
        day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(l.day) ? l.day : 'Monday',
        startTime: l.startTime || '00:00',
        endTime: l.endTime || '00:00',
        subject: l.subject || 'Unknown Subject',
        teacher: l.teacher || 'Unknown',
        room: l.room || 'TBA',
        className: l.className || (sanitizedClasses[0] || 'Unknown Class'),
        slotIndex: typeof l.slotIndex === 'number' ? l.slotIndex : 1
      }))
    };
  } catch (e) {
    console.error("Failed to parse AI response", response.text);
    throw new Error("AI failed to provide valid structured data.");
  }
}
