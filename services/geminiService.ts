import { GoogleGenAI, Type, Part } from "@google/genai";
import { VideoScript, MoodPreset, ComfyModelPreset, Scene } from '../types';
import { COMFY_MODEL_INFO, queueComfyPrompt, pollComfyJob } from './comfyService';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A creative and fitting title for the music video concept.",
    },
    overallMood: {
        type: Type.STRING,
        description: "A short description of the video's overall mood and aesthetic (e.g., 'somber and melancholic', 'energetic and vibrant', 'dreamy and surreal')."
    },
    analysis: {
        type: Type.OBJECT,
        description: "A detailed analysis of the song's musical and lyrical characteristics.",
        properties: {
            bpm: {
                type: Type.INTEGER,
                description: "The song's estimated beats per minute (BPM)."
            },
            musicalKey: {
                type: Type.STRING,
                description: "The musical key of the song, which MUST be in the format 'NOTE MODE' (e.g., 'C Minor', 'G Major')."
            },
            instrumentation: {
                type: Type.ARRAY,
                description: "A list of the dominant instruments identified in the song.",
                items: { type: Type.STRING }
            },
            dynamics: {
                type: Type.STRING,
                description: "A description of the song's dynamic arc (e.g., 'Starts soft, builds to a loud chorus, then fades')."
            },
            lyricalThemes: {
                type: Type.ARRAY,
                description: "A list of the primary lyrical themes or motifs.",
                items: { type: Type.STRING }
            },
            suggestedColorPalette: {
                type: Type.ARRAY,
                description: "A suggested color palette with hex codes and reasons.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        hex: { type: Type.STRING, description: "The hex color code (e.g., '#FFFFFF')." },
                        reason: { type: Type.STRING, description: "The reason this color fits the mood." }
                    },
                    required: ["hex", "reason"]
                }
            }
        },
        required: ["bpm", "musicalKey", "instrumentation", "dynamics", "lyricalThemes", "suggestedColorPalette"]
    },
    consistentElements: {
        type: Type.OBJECT,
        description: "An object containing lists of characters and props that should remain visually consistent across scenes.",
        properties: {
            characters: {
                type: Type.ARRAY,
                description: "A list of recurring characters in the music video.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "A short, descriptive name for the character (e.g., 'The Wanderer'). Use this exact name in prompts." },
                        description: { type: Type.STRING, description: "A brief description of the character's appearance, role, and emotion." }
                    },
                    required: ["name", "description"]
                }
            },
            props: {
                type: Type.ARRAY,
                description: "A list of recurring, important props or visual elements.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "A short, descriptive name for the prop (e.g., 'The Glowing Orb')." },
                        description: { type: Type.STRING, description: "A brief description of the prop's appearance and significance." }
                    },
                    required: ["name", "description"]
                }
            }
        },
        required: ["characters", "props"]
    },
    scenes: {
      type: Type.ARRAY,
      description: "An array of scenes for the music video script tailored for ComfyUI generation.",
      items: {
        type: Type.OBJECT,
        properties: {
          sceneNumber: {
            type: Type.INTEGER,
            description: "The sequential number of the scene.",
          },
          startTimeSeconds: {
            type: Type.INTEGER,
            description: "The estimated start time of this scene in total seconds from the beginning of the song."
          },
          endTimeSeconds: {
            type: Type.INTEGER,
            description: "The estimated end time of this scene in total seconds from the beginning of the song."
          },
          transition: {
            type: Type.STRING,
            description: "A suggested transition from the previous scene to this one (e.g., 'Cut to:', 'Dissolve to:')."
          },
          cameraAngle: {
            type: Type.STRING,
            description: "A specific, relevant camera angle for the scene."
          },
          description: {
            type: Type.STRING,
            description: "A detailed description of the scene's setting, action, characters, and atmosphere.",
          },
          positivePrompt: {
            type: Type.STRING,
            description: "A highly detailed ComfyUI positive prompt with trigger tags, lighting, atmosphere, lens details, and motion tags optimized for diffusion models like Wan 2.1, HunyuanVideo, AnimateDiff, and Flux."
          },
          negativePrompt: {
            type: Type.STRING,
            description: "A tailored ComfyUI negative prompt (e.g. 'blurry, low resolution, bad anatomy, text, watermark, jittery, flicker, distorted hands')."
          },
          veoPrompt: {
            type: Type.STRING,
            description: "Combined full prompt command string for quick copying.",
          },
          correspondingLyrics: {
            type: Type.ARRAY,
            description: "An array of lyric objects for this scene.",
            items: {
                type: Type.OBJECT,
                properties: {
                    text: {
                        type: Type.STRING,
                        description: "The line of lyric text."
                    },
                    timestampSeconds: {
                        type: Type.INTEGER,
                        description: "The precise time in total seconds when this lyric line is sung."
                    }
                },
                required: ["text", "timestampSeconds"]
            }
          },
        },
        required: ["sceneNumber", "description", "positivePrompt", "negativePrompt", "veoPrompt", "correspondingLyrics", "startTimeSeconds", "endTimeSeconds"],
      },
    },
  },
  required: ["title", "overallMood", "scenes", "analysis", "consistentElements"],
};

const getSceneCountInstruction = (totalSeconds: number): string => {
    const sceneCount = Math.ceil(totalSeconds / 8);
    return `The song is ${Math.floor(totalSeconds / 60)} minutes and ${totalSeconds % 60} seconds long. You must generate exactly ${sceneCount} scenes to cover this duration.`;
};

const getMoodInstruction = (mood: MoodPreset): string => {
    switch (mood) {
        case 'Cinematic':
            return "The desired visual style is **Cinematic**. Focus on narrative storytelling, 35mm film grain, 8k resolution, volumetric lighting, shallow depth of field, anamorphic lens flare, dolly shots, cinematic composition.";
        case 'Abstract':
            return "The desired visual style is **Abstract**. Deconstruct lyrics into surreal fluid motion, psychedelic light rays, generative art patterns, double exposure, vibrant color gradients, morphing geometries.";
        case 'Documentary':
            return "The desired visual style is **Documentary**. Photorealistic, handheld 16mm camera, natural ambient light, candid observational framing, realistic textures, raw grain.";
        case 'High Energy':
            return "The desired visual style is **High Energy**. Dynamic fast motion blur, strobe lights, neon glows, whip pans, energetic dance choreography, high contrast dramatic lighting.";
        case 'Cyberpunk':
            return "The desired visual style is **Cyberpunk**. Neon drenched rain-slicked streets, holographic UI elements, futuristic tech, octane render, unreal engine 5 quality, moody cyan and magenta contrast.";
        case 'Anime':
            return "The desired visual style is **Anime**. Makoto Shinkai aesthetic, cel-shaded anime animation, vibrant sky, glowing particles, expressive line art, dramatic anime camera angles.";
        case 'Vaporwave':
            return "The desired visual style is **Vaporwave**. 80s retro aesthetics, pastel pink and teal palettes, CRT scanlines, marble busts, glitch effects, lo-fi aesthetic.";
        default:
            return `The desired visual style is **${mood}**. Craft visuals with rich textures, precise lighting, and expressive camera work matching the ${mood} style.`;
    }
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            if (result) {
                resolve(result.split(',')[1]);
            } else {
                reject(new Error("Failed to read file as a data URL."));
            }
        };
        reader.onerror = error => reject(error);
    });
};

const getBasePrompt = (totalSeconds: number, mood: MoodPreset, comfyModel: ComfyModelPreset = 'Wan2.1-T2V') => {
  const sceneInstruction = getSceneCountInstruction(totalSeconds);
  const moodInstruction = getMoodInstruction(mood);
  const modelInfo = COMFY_MODEL_INFO[comfyModel];
  
  return `
    You are an expert Music Video Director and ComfyUI Workflow Specialist.
    Your goal is to generate a song analysis and a scene-by-scene music video script with prompts optimized specifically for **Local ComfyUI Video Models** (specifically targeting **${modelInfo.displayName}**).

    **Step 1: Song Analysis (MANDATORY)**
    Analyze the song with precision:
    - 'bpm': Single integer estimate for tempo.
    - 'musicalKey': String strictly format 'NOTE MODE' (e.g., 'C Minor', 'G Major').
    - 'instrumentation': Array of dominant instruments.
    - 'dynamics': Description of the song's dynamic arc.
    - 'lyricalThemes': 3-5 core themes.
    - 'suggestedColorPalette': 3-5 hex colors with rationale.

    **Step 2: Identify Consistent Elements (MANDATORY)**
    Define recurring characters and props under 'consistentElements' with exact 'name's to reuse in prompt generation for visual consistency across scenes.

    **Step 3: Script Generation for ComfyUI**
    Total song length: ${totalSeconds} seconds.
    ${moodInstruction}
    ${sceneInstruction}
    Target Model Architecture: **${comfyModel}** (${modelInfo.description}).

    **Pacing Rules:**
    1. Fixed 8-Second Scenes: Each scene represents an 8-second clip interval.
    2. Strict Timeline:
       - Scene 1 starts at 0s.
       - Scene N starts at (N-1)*8 seconds, ends at N*8 seconds (last scene ends at exactly ${totalSeconds}s).

    **ComfyUI Prompt Rules (CRUCIAL):**
    For each scene, generate:
    1. 'positivePrompt': A master quality positive prompt formatted for ComfyUI diffusion models (Wan 2.1, HunyuanVideo, AnimateDiff, Flux.1, SDXL). Include:
       - Subject & Action: Clear description of character/object motion.
       - Camera Movement & Shot: (e.g. 'low angle tracking shot, slow dolly zoom, 35mm lens').
       - Lighting & Mood: (e.g. 'cinematic volumetric lighting, golden hour glow, subtle lens flare').
       - Quality tags: 'masterpiece, best quality, cinematic lighting, highly detailed, fluid motion, 8k resolution'.
       - Reference consistent character/prop names if present.
    2. 'negativePrompt': ComfyUI negative prompt (e.g. '${modelInfo.defaultNegative}').
    3. 'veoPrompt': Complete positive prompt string.
    4. 'cameraAngle', 'transition', 'description', and 'correspondingLyrics' timestamped array.
  `;
}

export const generateVideoScript = async (
  input: { lyrics: string; audioFile: File | null }, 
  totalSeconds: number, 
  mood: MoodPreset,
  targetComfyModel: ComfyModelPreset = 'Wan2.1-T2V'
): Promise<VideoScript> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const basePrompt = getBasePrompt(totalSeconds, mood, targetComfyModel);
  const parts: Part[] = [];
  let textPrompt = '';

  if (input.audioFile && input.lyrics.trim()) {
    textPrompt = `
      Use the provided audio file to understand the song's structure, mood, and pacing. The provided lyrics are the definitive source for the words.
      Align the provided lyrics with the audio's structure and then ${basePrompt}
      
      Here are the lyrics:
      ---
      ${input.lyrics}
      ---
    `;
  } else if (input.audioFile) {
    textPrompt = `
      First, transcribe the lyrics and identify the structure from the provided audio file.
      Then, using the transcribed lyrics and audio analysis, ${basePrompt}
    `;
  } else if (input.lyrics.trim()) {
    textPrompt = `
      Analyze the following song lyrics to ${basePrompt}
      
      Here are the lyrics:
      ---
      ${input.lyrics}
      ---
    `;
  } else {
    throw new Error("Please provide either lyrics or an audio file.");
  }

  parts.push({ text: textPrompt });

  if (input.audioFile) {
    const audioBase64 = await fileToBase64(input.audioFile);
    const audioPart: Part = {
      inlineData: {
        mimeType: input.audioFile.type,
        data: audioBase64,
      },
    };
    parts.push(audioPart);
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: parts,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    if (response.promptFeedback?.blockReason) {
      console.error("Request blocked by safety settings:", response.promptFeedback);
      throw new Error(`Your request was blocked due to safety concerns (${response.promptFeedback.blockReason}). Please modify your input.`);
    }

    const jsonText = response.text.trim();

    if (!jsonText) {
      throw new Error("The AI returned an empty response. Please try modifying your input or try again.");
    }

    const parsedJson = JSON.parse(jsonText) as VideoScript;
    parsedJson.targetComfyModel = targetComfyModel;

    // Ensure scenes have comfyPrompt details
    const modelInfo = COMFY_MODEL_INFO[targetComfyModel];
    parsedJson.scenes = parsedJson.scenes.map(scene => ({
      ...scene,
      positivePrompt: scene.positivePrompt || scene.veoPrompt,
      negativePrompt: scene.negativePrompt || modelInfo.defaultNegative,
      comfyPrompt: {
        positivePrompt: scene.positivePrompt || scene.veoPrompt,
        negativePrompt: scene.negativePrompt || modelInfo.defaultNegative,
        targetModel: targetComfyModel,
        cfgScale: modelInfo.recommendedCfg,
        steps: modelInfo.recommendedSteps,
        sampler: modelInfo.recommendedSampler,
        scheduler: modelInfo.recommendedScheduler,
      }
    }));

    return parsedJson;
  } catch (error) {
    console.error("Error in generateVideoScript:", error);
    if (error instanceof Error && (
      error.message.includes("blocked due to safety concerns") ||
      error.message.includes("empty response") ||
      error.message.includes("invalid format")
    )) {
      throw error;
    }
    throw new Error("An unexpected error occurred communicating with the AI. Please check your network and try again.");
  }
};

/**
 * Generates a new, cinematic ComfyUI positive & negative prompt based on scene details.
 */
export const generateVeoPrompt = async (details: {
  description: string;
  cameraAngle?: string;
  overallMood: string;
  targetModel?: ComfyModelPreset;
}): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const { description, cameraAngle, overallMood, targetModel = 'Wan2.1-T2V' } = details;

  const prompt = `
    You are an expert ComfyUI Prompt Engineer.
    Create a highly detailed, master-quality ComfyUI positive prompt for a video generation scene based on:
    - Target Local Model: ${targetModel}
    - Mood: ${overallMood}
    - Scene Description: ${description}
    - Camera Angle: ${cameraAngle || 'dynamic shot'}

    Write a single flowing, highly descriptive positive prompt with subject action, camera movement, 35mm lens, volumetric lighting, cinematic mood, and quality tags. Return ONLY the positive prompt text.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Error generating ComfyUI prompt:", error);
    throw new Error("Failed to generate an updated ComfyUI prompt. Please try again.");
  }
};

export const generateComfyPrompt = generateVeoPrompt;

/**
 * Queues or generates video for a scene using local ComfyUI instance or fallback.
 */
export const generateVideoFromPrompt = async (
  scene: Scene,
  comfyServerUrl: string | undefined,
  targetModel: ComfyModelPreset = 'Wan2.1-T2V',
  onProgress: (status: string) => void
): Promise<string> => {
  const serverUrl = comfyServerUrl || 'http://127.0.0.1:8188';

  try {
    onProgress(`Connecting to local ComfyUI server (${serverUrl})...`);
    const { promptId } = await queueComfyPrompt(serverUrl, scene, targetModel);
    onProgress(`Job queued in ComfyUI! Prompt ID: ${promptId.slice(0, 8)}. Generating frames...`);

    let completed = false;
    let attempts = 0;
    while (!completed && attempts < 60) {
      await new Promise(r => setTimeout(r, 4000));
      attempts++;
      onProgress(`ComfyUI generating scene (Polling attempt ${attempts})...`);
      const res = await pollComfyJob(serverUrl, promptId);
      if (res.done) {
        if (res.mediaUrl) {
          onProgress('ComfyUI rendering complete!');
          return res.mediaUrl;
        }
        completed = true;
      }
    }
    throw new Error("ComfyUI generation timed out or produced no output image/video.");
  } catch (err: any) {
    console.warn("Local ComfyUI execution error:", err);
    throw new Error(`Local ComfyUI Error: ${err.message}. Make sure ComfyUI is running locally on ${serverUrl} with '--enable-cors-header *'. Or use 'Export ComfyUI Workflow JSON' to run manually!`);
  }
};

export const validateApiKey = async (): Promise<boolean> => {
  if (!process.env.API_KEY) {
    return false;
  }
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "test",
    });
    return true;
  } catch (error) {
    console.warn("API key validation failed:", error);
    return false;
  }
};
