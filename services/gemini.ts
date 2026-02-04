
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { UploadedFile } from "../types";

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

  // Filtrer les cours pour ne garder que ceux supportés par l'API en inlineData
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

RÈGLES CRUCIALES DE RÉPONSE (À RESPECTER SCRUPULEUSEMENT) :

1. LANGUE : 
   - Détecte la langue de l'énoncé de l'exercice. 
   - La section "# 1. Solution" doit être rédigée INTÉGRALEMENT dans la même langue que l'exercice.
   - La section "# 2. Explications détaillées" doit être rédigée en français.

2. STRUCTURE ET SÉPARATION : 
   - Ne mélange JAMAIS les explications avec la résolution.
   - # 1. Solution : Donne la résolution directe et propre. Suis la numérotation et l'ordre de l'exercice original.
   - # 2. Explications détaillées : Pour CHAQUE question ou tâche résolue dans la première section, fournis une explication pédagogique dédiée, L'UNE APRÈS L'AUTRE, en suivant le même ordre.

3. CONTENU DES EXPLICATIONS :
   - Pour chaque question, explique la logique de la réponse.
   - Fais le lien avec les concepts spécifiques mentionnés dans les cours fournis.
   - Si c'est du développement web, explique les bonnes pratiques ou la syntaxe utilisée.

Note : Si des fichiers Word/PPTX comme ${unsupportedCourseNames.join(', ')} ont été fournis, signale brièvement dans la section explicative que leur contenu binaire n'a pu être lu directement et suggère le format PDF pour les prochaines fois.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Utilisation du modèle Pro pour un meilleur suivi des instructions séquentielles complexes
      contents: { 
        parts: [
          ...courseParts,
          { text: `CONTEXTE (Supports de cours) : Voici les documents pédagogiques de référence.` },
          ...exerciseParts,
          { text: `ÉNONCÉ À RÉSOUDRE : Analyse cet exercice et produis la réponse structurée avec solution puis explications point par point.` }
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
    if (error.message?.includes("Unsupported MIME type")) {
      throw new Error("L'un des fichiers possède un format non supporté par l'IA. Veuillez privilégier le format PDF.");
    }
    throw new Error("Une erreur est survenue lors de la communication avec l'IA.");
  }
};
