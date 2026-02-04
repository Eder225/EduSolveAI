
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UploadedFile } from "../types.ts";

// Types MIME officiellement supportés par Gemini pour les documents
const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'text/markdown',
  'application/json',
  'text/x-typescript'
];

export const solveExerciseWithContext = async (
  courses: UploadedFile[],
  exercise: UploadedFile
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const supportedCourses = courses.filter(f => SUPPORTED_MIME_TYPES.includes(f.type));
  const unsupportedCourseNames = courses.filter(f => !SUPPORTED_MIME_TYPES.includes(f.type)).map(f => f.name);

  const courseParts = supportedCourses.map(file => ({
    inlineData: {
      mimeType: file.type === 'application/pdf' ? 'application/pdf' : 'text/plain',
      data: file.base64.split(',')[1]
    }
  }));

  const exerciseParts = [];
  if (SUPPORTED_MIME_TYPES.includes(exercise.type)) {
    exerciseParts.push({
      inlineData: {
        mimeType: exercise.type === 'application/pdf' ? 'application/pdf' : 'text/plain',
        data: exercise.base64.split(',')[1]
      }
    });
  }

  const systemInstruction = `Tu es un expert en pédagogie et un ingénieur senior en développement web. 
Ta mission est de résoudre l'exercice fourni en te basant RIGOUREUSEMENT sur les documents de cours attachés.

RÈGLES CRUCIALES DE RÉPONSE :
1. LANGUE : Détecte la langue de l'énoncé. # 1. Solution dans la même langue. # 2. Explications en français.
2. STRUCTURE : # 1. Solution (directe) puis # 2. Explications détaillées.
3. CONTENU : Explique la logique, fais le lien avec les cours, et détaille les syntaxes si nécessaire.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { 
        parts: [
          ...courseParts,
          { text: `CONTEXTE (Supports de cours) : Voici les documents pédagogiques de référence.` },
          ...exerciseParts,
          { text: `ÉNONCÉ À RÉSOUDRE : Analyse cet exercice et produis la réponse structurée.` }
        ] 
      },
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    return response.text || "Désolé, je n'ai pas pu générer de réponse.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error("Une erreur est survenue lors de la communication avec l'IA.");
  }
};
