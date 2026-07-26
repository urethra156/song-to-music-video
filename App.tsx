import React, { useState, useCallback, useEffect } from 'react';
import { generateVideoScript, validateApiKey } from './services/geminiService';
import { VideoScript, MoodPreset, ComfyModelPreset, Scene, LyricLine, ElementWithImage, ConsistentElement } from './types';
import LyricsInput from './components/LyricsInput';
import ElementUploader from './components/ElementUploader';
import VideoScriptDisplay from './components/VideoScriptDisplay';
import Loader from './components/Loader';
import { FilmIcon, KeyIcon, CpuChipIcon } from './components/icons/Icons';
import { DEFAULT_COMFY_URL } from './services/comfyService';

const LOCAL_STORAGE_KEY = 'ai-music-video-script';

const normalizeScriptTimings = (script: VideoScript, totalSeconds: number): VideoScript => {
  if (!script || !script.scenes || script.scenes.length === 0) {
    return script;
  }

  const correctedScenes = script.scenes.map((scene, index) => {
    const startTime = index * 8;
    const endTime = Math.min((index + 1) * 8, totalSeconds);
    return {
      ...scene,
      sceneNumber: index + 1,
      startTimeSeconds: startTime,
      endTimeSeconds: endTime,
    };
  });

  if (correctedScenes.length > 0) {
    correctedScenes[correctedScenes.length - 1].endTimeSeconds = totalSeconds;
  }

  return { ...script, scenes: correctedScenes };
};

const formatTime = (totalSeconds: number | undefined): string => {
  if (totalSeconds === undefined || isNaN(totalSeconds)) {
    return '00:00';
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatScriptForSaving = (script: VideoScript): string => {
  let content = `Title: ${script.title}\n`;
  content += `Mood: ${script.overallMood}\n`;
  content += `Target ComfyUI Model: ${script.targetComfyModel || 'Wan2.1-T2V'}\n`;
  
  if (script.analysis) {
    content += `\n----------------------------------------\n`;
    content += `SONG ANALYSIS\n`;
    content += `----------------------------------------\n\n`;
    content += `Tempo: ${script.analysis.bpm} BPM\n`;
    content += `Key: ${script.analysis.musicalKey}\n`;
    content += `Dynamics: ${script.analysis.dynamics}\n`;
    content += `Instrumentation: ${script.analysis.instrumentation.join(', ')}\n`;
    content += `Lyrical Themes: ${script.analysis.lyricalThemes.join(', ')}\n\n`;
    content += `Suggested Color Palette:\n`;
    script.analysis.suggestedColorPalette.forEach(color => {
      content += `- ${color.hex.toUpperCase()}: ${color.reason}\n`;
    });
  }

  if (script.consistentElements && (script.consistentElements.characters.length > 0 || script.consistentElements.props.length > 0)) {
    content += `\n----------------------------------------\n`;
    content += `CONSISTENT ELEMENTS\n`;
    content += `----------------------------------------\n\n`;
    if(script.consistentElements.characters.length > 0) {
        content += `Characters:\n`;
        script.consistentElements.characters.forEach(char => {
            content += `- ${char.name}: ${char.description}\n`;
        });
        content += `\n`;
    }
    if(script.consistentElements.props.length > 0) {
        content += `Props:\n`;
        script.consistentElements.props.forEach(prop => {
            content += `- ${prop.name}: ${prop.description}\n`;
        });
    }
  }

  content += `\n========================================\n`;
  content += `COMFYUI SCENE SCRIPT & PROMPTS\n`;
  content += `========================================\n\n`;

  script.scenes.forEach(scene => {
    content += `SCENE ${scene.sceneNumber}\n`;
    content += `Time: ${formatTime(scene.startTimeSeconds)} - ${formatTime(scene.endTimeSeconds)}\n`;
    if (scene.transition) {
      content += `Transition: ${scene.transition}\n`;
    }
    if (scene.cameraAngle) {
      content += `Camera Angle: ${scene.cameraAngle}\n`;
    }
    
    content += `\nDescription:\n${scene.description}\n`;

    content += `\nLyrics:\n`;
    if (Array.isArray(scene.correspondingLyrics)) {
        if (scene.correspondingLyrics.length > 0) {
            scene.correspondingLyrics.forEach((line: LyricLine) => {
                content += `[${formatTime(line.timestampSeconds)}] ${line.text}\n`;
            });
        } else {
            content += `(No lyrics for this scene)\n`;
        }
    } else {
      content += `${scene.correspondingLyrics}\n`;
    }
    
    content += `\nComfyUI Positive Prompt:\n${scene.positivePrompt || scene.veoPrompt}\n`;
    if (scene.negativePrompt) {
      content += `ComfyUI Negative Prompt:\n${scene.negativePrompt}\n`;
    }
    content += `\n---\n\n`;
  });

  return content;
};

const App: React.FC = () => {
  const [appStep, setAppStep] = useState<'input' | 'elements' | 'script'>('input');
  const [lyrics, setLyrics] = useState<string>('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [songLength, setSongLength] = useState<{ minutes: string; seconds: string }>({ minutes: '03', seconds: '30' });
  const [videoScript, setVideoScript] = useState<VideoScript | null>(null);
  const [elementsWithImages, setElementsWithImages] = useState<ElementWithImage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [moodPreset, setMoodPreset] = useState<MoodPreset>('Cinematic');
  const [selectedComfyModel, setSelectedComfyModel] = useState<ComfyModelPreset>('Wan2.1-T2V');
  const [comfyServerUrl, setComfyServerUrl] = useState<string>(DEFAULT_COMFY_URL);

  const [isApiKeySelected, setIsApiKeySelected] = useState<boolean>(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState<boolean>(true);

  useEffect(() => {
    const checkAndValidateKey = async () => {
      setIsCheckingApiKey(true);
      setError(null);
      try {
        const keyIsSelected = await window.aistudio.hasSelectedApiKey();
        if (keyIsSelected) {
          const keyIsValid = await validateApiKey();
          if (keyIsValid) {
            setIsApiKeySelected(true);
          } else {
            setIsApiKeySelected(false);
            setError("Your selected API key appears to be invalid or lacks necessary permissions.");
          }
        } else {
          setIsApiKeySelected(false);
        }
      } catch (e) {
        console.error("Error during API key check:", e);
        setIsApiKeySelected(false);
        setError("An error occurred while verifying your API key.");
      } finally {
        setIsCheckingApiKey(false);
      }
    };
    checkAndValidateKey();
  }, []);

  useEffect(() => {
    try {
      const savedScriptJSON = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedScriptJSON) {
        const savedScript = JSON.parse(savedScriptJSON);
        setVideoScript(savedScript);
        if (savedScript.targetComfyModel) {
          setSelectedComfyModel(savedScript.targetComfyModel);
        }
        setAppStep('script');
      }
    } catch (error) {
      console.error("Failed to load script from local storage:", error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    try {
      if (videoScript && appStep === 'script') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(videoScript));
      } else if (!videoScript) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to save script to local storage:", error);
    }
  }, [videoScript, appStep]);

  const totalSeconds = (parseInt(songLength.minutes || '0', 10) * 60) + parseInt(songLength.seconds || '0', 10);

  const handleSelectKey = useCallback(async () => {
    setError(null);
    try {
      await window.aistudio.openSelectKey();
      setIsApiKeySelected(true);
    } catch (e) {
      console.error("Error opening API key selection:", e);
      setError("Failed to open API key selector.");
    }
  }, []);

  const handleApiKeyError = useCallback(() => {
    setIsApiKeySelected(false);
    setError("Your API key is invalid or has insufficient permissions.");
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!lyrics.trim() && !audioFile) {
      setError('Please enter lyrics or upload an audio file.');
      return;
    }

    if (totalSeconds <= 0) {
        setError('Please enter a valid song length greater than zero.');
        return;
    }
    
    setIsLoading(true);
    setError(null);
    setVideoScript(null);

    try {
      const rawScript = await generateVideoScript({ lyrics, audioFile }, totalSeconds, moodPreset, selectedComfyModel);
      const normalizedScript = normalizeScriptTimings(rawScript, totalSeconds);
      setVideoScript(normalizedScript);

      const elements = normalizedScript.consistentElements;
      if (elements && (elements.characters.length > 0 || elements.props.length > 0)) {
        const characters: ElementWithImage[] = elements.characters.map(c => ({...c, type: 'character'}));
        const props: ElementWithImage[] = elements.props.map(p => ({...p, type: 'prop'}));
        setElementsWithImages([...characters, ...props]);
        setAppStep('elements');
      } else {
        setAppStep('script');
        setElementsWithImages([]);
      }

    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred. Please try again.');
      }
      setAppStep('input');
    } finally {
      setIsLoading(false);
    }
  }, [lyrics, audioFile, totalSeconds, moodPreset, selectedComfyModel]);

  const handleElementsSubmitted = useCallback((updatedElements: ElementWithImage[]) => {
    setElementsWithImages(updatedElements);
    setAppStep('script');
  }, []);

  const handleUpdateScenes = useCallback((newScenes: Scene[]) => {
    setVideoScript(prevScript => {
      if (!prevScript) return null;
      return { ...prevScript, scenes: newScenes };
    });
  }, []);

  const handleSaveScript = useCallback(() => {
    if (!videoScript) return;

    const filename = `${videoScript.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_comfyui_script.txt`;
    const scriptText = formatScriptForSaving(videoScript);
    const blob = new Blob([scriptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [videoScript]);

  const handleStartNew = useCallback(() => {
    if (window.confirm("Are you sure you want to start a new script? Your current work will be cleared.")) {
        setVideoScript(null);
        setLyrics('');
        setAudioFile(null);
        setSongLength({ minutes: '03', seconds: '30' });
        setMoodPreset('Cinematic');
        setError(null);
        setElementsWithImages([]);
        setAppStep('input');
    }
  }, []);

  const renderContent = () => {
    if (isLoading) {
       return (
         <div className="flex flex-col items-center justify-center text-center p-12 bg-slate-800/40 rounded-2xl border border-slate-700">
           <Loader />
           <p className="mt-4 text-lg font-bold text-slate-200">
             Analyzing music & generating ComfyUI prompts for {selectedComfyModel}...
           </p>
           <p className="text-sm text-slate-400 mt-1">
             Creating scene timelines, positive/negative prompts, motion vectors, and color palettes.
           </p>
         </div>
       );
    }
    
    switch (appStep) {
        case 'input':
            return (
                <div className="bg-slate-800/50 rounded-xl shadow-2xl p-6 border border-slate-700 backdrop-blur-sm mb-8">
                    <LyricsInput
                      lyrics={lyrics}
                      setLyrics={setLyrics}
                      audioFile={audioFile}
                      setAudioFile={setAudioFile}
                      songLength={songLength}
                      setSongLength={setSongLength}
                      selectedMood={moodPreset}
                      setSelectedMood={setMoodPreset}
                      selectedComfyModel={selectedComfyModel}
                      setSelectedComfyModel={setSelectedComfyModel}
                      comfyServerUrl={comfyServerUrl}
                      setComfyServerUrl={setComfyServerUrl}
                      onSubmit={handleAnalyze}
                      isLoading={isLoading}
                    />
                </div>
            );
        case 'elements':
            return (
                 <div className="bg-slate-800/50 rounded-xl shadow-2xl p-6 border border-slate-700 backdrop-blur-sm mb-8">
                    <ElementUploader
                        elements={elementsWithImages}
                        onSubmit={handleElementsSubmitted}
                        onBack={() => setAppStep('input')}
                    />
                </div>
            )
        case 'script':
             if (videoScript) {
                 return (
                    <div className="mt-8">
                      <VideoScriptDisplay 
                          script={videoScript}
                          elementsWithImages={elementsWithImages} 
                          selectedComfyModel={selectedComfyModel}
                          comfyServerUrl={comfyServerUrl}
                          onUpdateScenes={handleUpdateScenes}
                          onSaveScript={handleSaveScript}
                          onStartNew={handleStartNew}
                          onApiKeyError={handleApiKeyError}
                      />
                    </div>
                 )
             }
             setAppStep('input');
             return null;
        default:
            return null;
    }
  };

  if (isCheckingApiKey) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!isApiKeySelected) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="max-w-xl mx-auto text-center bg-slate-800/50 rounded-lg shadow-2xl p-8 border border-slate-700">
          <div className="flex items-center justify-center gap-4 mb-4">
              <KeyIcon className="w-10 h-10 text-indigo-400" />
              <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                API Key Required
              </h1>
          </div>
          <p className="text-slate-400 text-lg mb-6">
            To generate AI video scripts and ComfyUI prompts, please select your Google AI Studio API key.
          </p>
          <button
            onClick={handleSelectKey}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-200"
          >
            <KeyIcon className="w-5 h-5 mr-2 -ml-1" />
            Select Your API Key
          </button>
          {error && (
            <div className="mt-4 text-sm text-red-400 p-3 bg-red-900/30 border border-red-700 rounded-md">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <FilmIcon className="w-10 h-10 text-indigo-400" />
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-300">
              AI Music Video Director
            </h1>
          </div>
          <p className="text-slate-400 text-base max-w-2xl mx-auto">
            Deeply analyze any song and generate scene-by-scene scripts, prompts, and workflows tailored for <span className="text-indigo-300 font-semibold">Local ComfyUI Models</span> (Wan 2.1, HunyuanVideo, AnimateDiff, Flux.1, SVD).
          </p>
        </header>

        <main>
          {renderContent()}

          {error && !isLoading && appStep === 'input' && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg relative mt-4" role="alert">
              <div className="flex">
                <div className="py-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400 mr-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-red-300">Analysis Failed</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
