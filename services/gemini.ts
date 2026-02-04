
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { UploadedFile, ChatMessage } from "../types.ts";

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

  const systemInstruction = `Tu es "EduSolve Expert", un tuteur IA de haut niveau. 
Ton objectif est de fournir une correction d'une profondeur académique exceptionnelle en utilisant EXCLUSIVEMENT les documents fournis.

RÈGLE D'OR : Pour CHAQUE question de l'exercice, tu dois absolument respecter ce format :
1. Un titre de question utilisant obligatoirement le préfixe "## ".
2. La réponse directe.
3. Un bloc d'explication pédagogique riche encadré par les balises [[EXPLICATION]] et [[/EXPLICATION]].

STRUCTURE DE RÉPONSE STRICTE :

# 1. SOLUTION DÉTAILLÉE

## [Titre de la Question 1]
[Réponse directe]

[[EXPLICATION]]
[Analyse pédagogique profonde : pourquoi cette réponse ? Lien avec quel chapitre du cours ? Quelles erreurs éviter ?]
[[/EXPLICATION]]

## [Titre de la Question 2]
... etc.

# 2. SYNTHÈSE PÉDAGOGIQUE GLOBALE
[Résumé des points clés en français]

IMPORTANT : Sois extrêmement verbeux et détaillé dans les blocs [[EXPLICATION]]. C'est là que l'élève comprend la logique.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { 
        parts: [
          ...courseParts,
          { text: `DOCUMENTS DE RÉFÉRENCE : Analyse ces supports avant de répondre.` },
          ...exerciseParts,
          { text: `EXERCICE À RÉSOUDRE : Fournis la correction complète avec les explications tagguées.` }
        ] 
      },
      config: {
        systemInstruction,
        temperature: 0.1,
      },
    });

    return response.text || "Désolé, l'IA n'a pas pu générer de texte.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error("Erreur de communication avec Gemini.");
  }
};

export const startAssistantChat = (
  courses: UploadedFile[],
  solution: string
): Chat => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `Tu es l'assistant de suivi d'EduSolve. Ton rôle est d'aider l'étudiant à comprendre la correction qui vient d'être générée.
      Tu as accès au cours et à la correction. 
      Réponds de manière concise, encourageante et pédagogique.
      Si l'étudiant pose une question hors sujet, ramène-le doucement vers l'exercice.
      CORRECTION ACTUELLE : ${solution}`,
    }
  });
};
