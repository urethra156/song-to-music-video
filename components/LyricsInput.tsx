import React, { useState, useEffect } from 'react';
import { SparklesIcon, UploadIcon, AudioWaveIcon, XCircleIcon, ServerIcon, CpuChipIcon } from './icons/Icons';
import { MoodPreset, ComfyModelPreset } from '../types';
import { COMFY_MODEL_INFO, DEFAULT_COMFY_URL, checkComfyConnection } from '../services/comfyService';

interface LyricsInputProps {
  lyrics: string;
  setLyrics: (lyrics: string) => void;
  audioFile: File | null;
  setAudioFile: (file: File | null) => void;
  songLength: { minutes: string; seconds: string };
  setSongLength: (length: { minutes: string; seconds: string }) => void;
  selectedMood: MoodPreset;
  setSelectedMood: (mood: MoodPreset) => void;
  selectedComfyModel: ComfyModelPreset;
  setSelectedComfyModel: (model: ComfyModelPreset) => void;
  comfyServerUrl: string;
  setComfyServerUrl: (url: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const visualStyles: MoodPreset[] = [
    'Cinematic', 'Abstract', 'Documentary', 'High Energy', 'Pop', 'Rock', 'Hip Hop', 'Electronic', 'Folk/Acoustic',
    'Romantic', 'Melancholic', 'Psychedelic', 'Film Noir', 'Vaporwave', 'Anime', 'Wes Anderson', 'Minimalist', 'Gothic', 'Surrealist',
    'Horror', 'Thriller', 'Cyberpunk', 'Steampunk'
];

const comfyModelsList: ComfyModelPreset[] = [
  'Wan2.1-T2V',
  'Wan2.1-I2V',
  'HunyuanVideo',
  'AnimateDiff',
  'CogVideoX',
  'SVD-XT',
  'Flux1-Dev',
  'SDXL'
];

export const LyricsInput: React.FC<LyricsInputProps> = ({ 
  lyrics, setLyrics, audioFile, setAudioFile, songLength, setSongLength, 
  selectedMood, setSelectedMood, selectedComfyModel, setSelectedComfyModel,
  comfyServerUrl, setComfyServerUrl, onSubmit, isLoading 
}) => {
  const [comfyStatus, setComfyStatus] = useState<{ checked: boolean; ok: boolean; info?: string; error?: string }>({ checked: false, ok: false });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(false);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    const result = await checkComfyConnection(comfyServerUrl);
    setComfyStatus({ checked: true, ok: result.ok, info: result.info, error: result.error });
    setIsTestingConnection(false);
  };

  useEffect(() => {
    // Quick test on initial render
    handleTestConnection();
  }, []);

  const handleTimeChange = (part: 'minutes' | 'seconds', value: string) => {
    const sanitizedValue = value.replace(/[^0-9]/g, '').slice(0, 2);
    setSongLength({ ...songLength, [part]: sanitizedValue });
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setAudioFile(file);

      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      
      audio.onloadedmetadata = () => {
        window.URL.revokeObjectURL(audio.src);
        const duration = audio.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        setSongLength({
          minutes: String(minutes).padStart(2, '0'),
          seconds: String(seconds).padStart(2, '0')
        });
      };
      
      audio.src = window.URL.createObjectURL(file);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* COMFYUI LOCAL SERVER HEADER BADGE */}
      <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950/80 rounded-lg text-indigo-400 border border-indigo-800/50">
              <ServerIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-200">Local ComfyUI Integration</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  comfyStatus.ok 
                    ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-700' 
                    : 'bg-amber-950/90 text-amber-300 border border-amber-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-1.5 ${comfyStatus.ok ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                  {comfyStatus.ok ? (comfyStatus.info || 'Connected') : 'Offline (Copy / Workflow Export Mode)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generates prompts, params, & workflows for local execution on ComfyUI ({comfyServerUrl})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600 transition-colors"
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              type="button"
              onClick={() => setShowServerSettings(!showServerSettings)}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-900/60 text-indigo-300 hover:bg-indigo-800/80 border border-indigo-700/60 transition-colors"
            >
              {showServerSettings ? 'Hide Settings' : 'Configure URL'}
            </button>
          </div>
        </div>

        {showServerSettings && (
          <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="comfy-url" className="block text-xs font-medium text-slate-400 mb-1">
                ComfyUI API Server Address:
              </label>
              <input
                type="text"
                id="comfy-url"
                value={comfyServerUrl}
                onChange={(e) => setComfyServerUrl(e.target.value)}
                placeholder="http://127.0.0.1:8188"
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-md text-slate-200 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <button
                type="button"
                onClick={handleTestConnection}
                className="w-full px-3 py-1.5 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
              >
                Save & Test
              </button>
            </div>
            {comfyStatus.error && (
              <p className="col-span-full text-xs text-amber-400 mt-1">
                Note: {comfyStatus.error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* COMFYUI MODEL SELECTION GRID */}
      <fieldset className="bg-slate-900/60 border border-slate-700/80 rounded-xl p-5">
        <legend className="text-lg font-bold text-slate-200 px-2 flex items-center gap-2">
          <CpuChipIcon className="w-5 h-5 text-indigo-400" />
          Select Target ComfyUI Model Architecture
        </legend>
        <p className="text-xs text-slate-400 mb-4">
          Choose the local video model you run in ComfyUI. Prompts, negative triggers, steps, CFG, and samplers will be specifically tuned for this architecture.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {comfyModelsList.map((model) => {
            const info = COMFY_MODEL_INFO[model];
            const isSelected = selectedComfyModel === model;
            return (
              <button
                key={model}
                type="button"
                onClick={() => setSelectedComfyModel(model)}
                disabled={isLoading}
                className={`p-3.5 rounded-xl text-left border-2 transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-800/50 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm text-indigo-300">{info.badge}</span>
                    {isSelected && <span className="w-2 h-2 rounded-full bg-indigo-400"></span>}
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 leading-tight mb-1">{info.displayName}</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{info.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>CFG: {info.recommendedCfg}</span>
                  <span>Steps: {info.recommendedSteps}</span>
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* SONG INPUT & METADATA */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
         <div>
            <h2 className="text-lg font-semibold text-slate-300">
                Provide Your Song Details
            </h2>
             <p className="text-sm text-slate-400 mt-1">Upload an audio file and/or paste lyrics below.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            <label htmlFor="minutes" className="text-sm font-medium text-slate-400 whitespace-nowrap">Song Length:</label>
            <div className="flex items-center gap-1">
                <input
                    type="number"
                    id="minutes"
                    name="minutes"
                    value={songLength.minutes}
                    onChange={(e) => handleTimeChange('minutes', e.target.value)}
                    onBlur={(e) => setSongLength({...songLength, minutes: e.target.value.padStart(2, '0')})}
                    disabled={isLoading || !!audioFile}
                    className="w-14 bg-slate-900 border border-slate-600 rounded-md text-slate-200 text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 py-1.5 px-1 disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="MM"
                    aria-label="Song length in minutes"
                    min="0"
                    max="99"
                />
                <span className="text-slate-400 font-bold">:</span>
                <input
                    type="number"
                    id="seconds"
                    name="seconds"
                    value={songLength.seconds}
                    onChange={(e) => handleTimeChange('seconds', e.target.value)}
                    onBlur={(e) => setSongLength({...songLength, seconds: e.target.value.padStart(2, '0')})}
                    disabled={isLoading || !!audioFile}
                    className="w-14 bg-slate-900 border border-slate-600 rounded-md text-slate-200 text-center text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 py-1.5 px-1 disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="SS"
                    aria-label="Song length in seconds"
                    min="0"
                    max="59"
                />
            </div>
        </div>
      </div>

      <div>
        {!audioFile ? (
          <>
            <input 
              type="file" 
              id="audio-upload" 
              className="hidden" 
              onChange={handleFileChange} 
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/flac,audio/aac" 
              disabled={isLoading}
            />
            <label 
              htmlFor="audio-upload"
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-all duration-200 border-2 border-dashed border-slate-600 text-slate-300
                ${isLoading 
                  ? 'cursor-not-allowed opacity-50' 
                  : 'cursor-pointer hover:bg-slate-700/50 hover:border-indigo-500 hover:text-white'
                }`
              }
            >
              <UploadIcon className="w-5 h-5"/>
              Upload Song Audio File (MP3, WAV, FLAC, etc.)
            </label>
          </>
        ) : (
          <div className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-slate-900/80 border-2 border-indigo-500 text-slate-200">
            <div className="flex items-center gap-2 overflow-hidden">
                <AudioWaveIcon className="w-5 h-5 text-indigo-400 flex-shrink-0"/>
                <span className="truncate" title={audioFile.name}>{audioFile.name}</span>
            </div>
            <button 
              onClick={() => setAudioFile(null)} 
              disabled={isLoading}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50"
              aria-label="Remove audio file"
            >
                <XCircleIcon className="w-5 h-5"/>
            </button>
          </div>
        )}
      </div>
      
      <textarea
        id="lyrics"
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder={
            audioFile 
              ? "Optional: Paste lyrics here to guide the AI, or leave blank to transcribe from audio." 
              : `e.g.,\n\n[Verse 1]\nWalking through neon rain in the night\nCity lights fading out of view\n\n[Chorus]\nTake me back to where we started...\n\n[Guitar Solo]\n...\n`
          }
        className="w-full h-44 p-4 bg-slate-900 border border-slate-600 rounded-md resize-y text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 disabled:opacity-40 disabled:bg-slate-800"
        disabled={isLoading}
        aria-label="Song lyrics input"
      />

      {/* VISUAL STYLE MOOD SELECTION */}
      <fieldset>
        <legend className="text-lg font-semibold text-slate-300 mb-3">Choose Cinematic Visual Style</legend>
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
            {visualStyles.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSelectedMood(preset)}
                disabled={isLoading}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-all border ${
                  selectedMood === preset
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:border-slate-500'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <button
        onClick={onSubmit}
        disabled={isLoading}
        className="inline-flex items-center justify-center px-6 py-3.5 border border-transparent text-base font-bold rounded-xl shadow-lg text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 disabled:bg-indigo-950 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-200 group mt-2"
      >
        <SparklesIcon className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:rotate-12" />
        {isLoading ? 'Composing Script & ComfyUI Prompts...' : `Generate ComfyUI Script (${selectedComfyModel})`}
      </button>
    </div>
  );
};

export default LyricsInput;
