
import { GoogleGenAI, Type } from "@google/genai";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = (reader.result as string).split(',')[1];
      if (result) {
        resolve(result);
      } else {
        reject(new Error("Failed to convert file to base64."));
      }
    };
    reader.onerror = error => reject(error);
  });
};

export const analyzeVideoWithGemini = async (
    videoFile: File, 
    setProgress: (message: string) => void
): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const videoBase64 = await fileToBase64(videoFile);
    
    setProgress('Uploading and analyzing with Gemini AI... This may take a moment.');

    const videoPart = {
        inlineData: {
            mimeType: videoFile.type,
            data: videoBase64,
        },
    };

    const textPart = {
        text: `
          Analyze this video in detail to generate prompts for a video generation model. Create a comprehensive JSON object that describes the video's content.
          The JSON should include a title, a brief summary, and a breakdown of key scenes.
          IMPORTANT: Each scene must not be longer than 8 seconds. If a continuous action takes longer than 8 seconds, you must split it into multiple consecutive scenes.
          For each scene, provide a start and end timestamp (in seconds, as a number), a detailed description, a list of prominent objects, and a list of actions taking place.
          Additionally, if there is any spoken dialogue or speech in a scene, transcribe it accurately. IMPORTANT: You must identify and separate dialogue by speaker. Label them generically as 'Person 1', 'Person 2', etc., unless their names are clear. Structure the dialogue as a list of objects, each with a 'speaker' and their 'line'.
          Adhere strictly to the provided JSON schema. Ensure all descriptions are clear and concise, suitable for generating cinematic shots.
        `
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "A concise, descriptive title for the video." },
            summary: { type: Type.STRING, description: "A one-paragraph summary of the video content." },
            scenes: {
                type: Type.ARRAY,
                description: "A list of distinct scenes in the video, each no longer than 8 seconds.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        scene_id: { type: Type.INTEGER, description: "A unique identifier for the scene, starting from 1." },
                        timestamp_start_seconds: { type: Type.NUMBER, description: "The start time of the scene in seconds." },
                        timestamp_end_seconds: { type: Type.NUMBER, description: "The end time of the scene in seconds." },
                        description: { type: Type.STRING, description: "A detailed description of what happens in this scene." },
                        dialogue: { 
                            type: Type.ARRAY,
                            description: "Transcribed dialogue or speech from the scene, separated by speaker. Omit if there is no speech.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    speaker: { type: Type.STRING, description: "The identified speaker (e.g., 'Person 1', 'Narrator')." },
                                    line: { type: Type.STRING, description: "The transcribed line of dialogue." }
                                },
                                required: ["speaker", "line"]
                            }
                        },
                        objects: {
                            type: Type.ARRAY,
                            description: "A list of prominent objects visible in the scene.",
                            items: { type: Type.STRING }
                        },
                        actions: {
                            type: Type.ARRAY,
                            description: "A list of key actions or events occurring in the scene.",
                            items: { type: Type.STRING }
                        }
                    },
                    required: ["scene_id", "timestamp_start_seconds", "timestamp_end_seconds", "description", "objects", "actions"]
                }
            }
        },
        required: ["title", "summary", "scenes"]
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, videoPart] },
        config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
        },
    });

    const jsonText = response.text;
    
    try {
        const parsedJson = JSON.parse(jsonText);
        return JSON.stringify(parsedJson, null, 2);
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON", e);
        // Return raw text if parsing fails, so user can see what went wrong.
        return jsonText;
    }
};
