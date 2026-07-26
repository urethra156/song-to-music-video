export type MoodPreset = 
  // Core
  'Cinematic' | 'Abstract' | 'Documentary' | 'High Energy' |
  // Genres
  'Pop' | 'Rock' | 'Hip Hop' | 'Electronic' | 'Folk/Acoustic' |
  // Moods
  'Romantic' | 'Melancholic' | 'Psychedelic' |
  // Artistic Styles
  'Film Noir' | 'Vaporwave' | 'Anime' | 'Wes Anderson' | 'Minimalist' | 'Gothic' | 'Surrealist' |
  'Horror' | 'Thriller' | 'Cyberpunk' | 'Steampunk';

export type ComfyModelPreset = 
  | 'Wan2.1-T2V'
  | 'Wan2.1-I2V'
  | 'HunyuanVideo'
  | 'AnimateDiff'
  | 'CogVideoX'
  | 'SVD-XT'
  | 'Flux1-Dev'
  | 'SDXL';

export interface LyricLine {
  text: string;
  timestampSeconds: number;
}

export interface ComfyPromptDetails {
  positivePrompt: string;
  negativePrompt: string;
  targetModel: ComfyModelPreset;
  cfgScale: number;
  steps: number;
  sampler: string;
  scheduler: string;
  motionStrength?: number;
  seed?: number;
  aspectRatio?: string;
}

export interface Scene {
  sceneNumber: number;
  description: string;
  veoPrompt: string; // Retained for backwards-compatibility / quick unified string
  positivePrompt?: string;
  negativePrompt?: string;
  comfyPrompt?: ComfyPromptDetails;
  correspondingLyrics: LyricLine[] | string;
  transition?: string;
  cameraAngle?: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  videoUrl?: string;
}

export interface ColorSuggestion {
    hex: string;
    reason: string;
}

export interface SongAnalysis {
    bpm: number;
    musicalKey: string;
    instrumentation: string[];
    dynamics: string;
    lyricalThemes: string[];
    suggestedColorPalette: ColorSuggestion[];
}

export interface ConsistentElement {
    name: string;
    description: string;
}

// This type is for the UI state, including the uploaded image data.
export interface ElementWithImage extends ConsistentElement {
    type: 'character' | 'prop';
    imageDataUrl?: string; // base64 data URL for previews
}

export interface ConsistentElements {
    characters: ConsistentElement[];
    props: ConsistentElement[];
}

export interface VideoScript {
  title: string;
  overallMood: string;
  targetComfyModel?: ComfyModelPreset;
  comfyServerUrl?: string;
  scenes: Scene[];
  analysis?: SongAnalysis;
  consistentElements?: ConsistentElements;
}
