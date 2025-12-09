import { GoogleGenAI, Modality, Type } from "@google/genai";
import { LessonPlanRequest } from "../types";

// Safe API Key retrieval function that works in both browser and typical build environments
const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    // Falls back to empty string if 'process' is not defined (prevents ReferenceError)
    return '';
  }
};

const apiKey = getApiKey();
// Warn if key is missing, this is the #1 cause of "AI not working"
if (!apiKey) {
    console.warn("Gemini API Key is missing! Check your process.env.API_KEY configuration.");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

/**
 * Generates a lesson plan using gemini-2.5-flash
 */
export const generateLessonPlan = async (request: LessonPlanRequest): Promise<string> => {
  const prompt = `
    Agis en tant qu'expert en ingénierie pédagogique. Crée une fiche de cours structurée, détaillée et visuellement claire.
    
    Paramètres:
    - Sujet: ${request.subject}
    - Niveau: ${request.level} (Classe: ${request.grade})
    - Durée: ${request.duration} minutes
    - Objectif: ${request.objective}
    - Méthode: ${request.method}
    
    RÈGLES STRICTES POUR MATIÈRES SCIENTIFIQUES (Maths, Physique, Chimie, SVT) :
    1. **TABLEAUX** : Si tu utilises un tableau, il doit être REMPLI avec du texte pertinent. Ne laisse JAMAIS de cases vides.
    2. **FORMULES** : Écris les formules mathématiques sur des lignes séparées en texte brut lisible (ex: a² + b² = c²). N'utilise PAS de LaTeX ($...$).
    3. **SCHÉMAS OBLIGATOIRES** : Pour la Géométrie (ex: Pythagore, Thalès) ou les Sciences, tu DOIS inclure un bloc visuel décrivant la figure à tracer.
       Utilise EXACTEMENT cette syntaxe : 
       > [SCHEMA] Description précise de la figure géométrique ou du schéma (ex: "Triangle rectangle ABC avec l'angle droit en A...").
    
    RÈGLES DE FORMATAGE (Markdown) :
    1. Titres H2 (##) EN MAJUSCULES.
    2. Listes à puces (-) pour le matériel.
    3. Gras (**texte**) pour les mots-clés.
    4. **INTERDICTIONS** : N'utilise JAMAIS de balises HTML (<br>, <div>) ni de symboles LaTeX ($). Tout doit être en Markdown pur.

    Structure attendue :
    ## 1. OBJECTIFS PÉDAGOGIQUES
    ## 2. MATÉRIEL ET RESSOURCES
    ## 3. DÉROULEMENT DU COURS
    (Introduction, Développement, Conclusion avec timings)
    ## 4. ACTIVITÉS DÉTAILLÉES
    ## 5. ÉVALUATION ET SYNTHÈSE
  `;

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.5,
          systemInstruction: "Tu es un concepteur pédagogique expert. Tes fiches sont complètes, prêtes à l'emploi et contiennent toujours des exemples concrets.",
        }
      });
      return response.text || "Erreur lors de la génération du contenu.";
  } catch (error) {
      console.error("Gemini Generation Error:", error);
      return "Une erreur est survenue lors de la communication avec l'IA. Vérifiez votre connexion ou votre clé API.";
  }
};

/**
 * Improves the formatting of an existing lesson plan text
 * Optimized for speed and strict visual layout
 */
export const improveLessonFormatting = async (currentContent: string): Promise<string> => {
  const prompt = `
    Agis comme un moteur de mise en page Markdown. Reformate le texte ci-dessous pour qu'il soit parfaitement lisible, propre et professionnel.
    
    RÈGLES :
    1. NE CHANGE PAS LE SENS DU TEXTE NI LE CONTENU.
    2. Mets tous les titres principaux (H1, H2) EN MAJUSCULES.
    3. Assure-toi que toutes les listes utilisent des tirets (-).
    4. Mets en **gras** les termes importants et les durées.
    5. Formate correctement les tableaux Markdown si présents.
    6. Garde la syntaxe > [SCHEMA] telle quelle.
    7. SUPPRIME toute balise HTML (<br>) ou code LaTeX ($).
    
    Texte :
    ${currentContent}
  `;

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.1, 
          maxOutputTokens: 4000,
        }
      });
      return response.text || currentContent;
  } catch (error) {
      console.error("Gemini Formatting Error:", error);
      return currentContent;
  }
};

/**
 * Generates speech from text using gemini-2.5-flash-preview-tts
 */
export const generateSpeech = async (text: string): Promise<ArrayBuffer | null> => {
  try {
    // Clean markdown symbols for speech
    const cleanText = text.replace(/[*#_>]/g, '').replace(/\[SCHEMA\]/g, 'Schéma visuel : ');
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText.substring(0, 4000) }] }], 
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    return null;
  } catch (error) {
    console.error("TTS Error", error);
    return null;
  }
};

/**
 * Chat with Search Grounding using gemini-2.5-flash
 * Supports file attachments and fallback if search fails
 */
export const chatWithSearch = async (
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  attachment?: { mimeType: string; data: string }
) => {
  // Construct user parts
  const userParts: any[] = [{ text: message }];
  if (attachment) {
    userParts.unshift({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
  }

  // Combine history with new message
  // Note: 'history' here must only contain 'user' or 'model' roles.
  const contents = [
      ...history,
      { role: 'user', parts: userParts }
  ];

  try {
    // Attempt 1: Try with Google Search Tool
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response;

  } catch (error) {
    console.warn("Search Grounding failed (likely API permission or config issue). Falling back to standard chat.", error);
    
    // Attempt 2: Fallback to standard chat without tools
    // This ensures the user gets an answer even if Search Grounding is not enabled on the API key
    try {
        const fallbackResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            // No tools config here
        });
        return fallbackResponse;
    } catch (fallbackError) {
        console.error("Fallback chat also failed:", fallbackError);
        throw fallbackError; // Rethrow original error if both fail
    }
  }
};

/**
 * Analyze an image using gemini-3-pro-preview
 */
export const analyzeImageResource = async (base64Image: string, mimeType: string, prompt: string) => {
  try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            },
            { text: prompt }
          ]
        }
      });
      return response.text;
  } catch (error) {
      console.error("Vision Error:", error);
      return "Erreur lors de l'analyse de l'image.";
  }
};

/**
 * Suggests lesson topics based on school level
 */
export const getLessonTopicSuggestions = async (level: string): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Propose-moi une liste de 5 sujets de cours populaires, engageants ou essentiels adaptés au niveau scolaire : "${level}". Ils doivent être variés (Sciences, Histoire, Maths, Littérature, etc.). Retourne UNIQUEMENT la liste en français.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Error getting suggestions:", error);
    return [];
  }
};

export const getLiveClient = () => {
  return ai.live;
};