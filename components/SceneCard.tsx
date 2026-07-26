import React, { useState, useEffect } from 'react';
import { Scene, LyricLine, ElementWithImage, ComfyModelPreset } from '../types';
import { ClipboardIcon, CheckIcon, CameraIcon, ViewfinderIcon, ClockIcon, PencilIcon, InformationCircleIcon, FilmIcon, ArrowPathIcon, DownloadIcon, PlayIcon, CpuChipIcon } from './icons/Icons';
import { generateComfyPrompt, generateVideoFromPrompt } from '../services/geminiService';
import { COMFY_MODEL_INFO, downloadWorkflowJson, queueComfyPrompt, pollComfyJob } from '../services/comfyService';
import Loader from './Loader';

interface SceneCardProps {
  scene: Scene;
  isEditing: boolean;
  overallMood: string;
  targetComfyModel?: ComfyModelPreset;
  comfyServerUrl?: string;
  elementsWithImages: ElementWithImage[];
  songTitle?: string;
  onEdit: () => void;
  onSave: (scene: Scene) => void;
  onCancel: () => void;
  onApiKeyError: () => void;
}

const formatTime = (totalSeconds: number | undefined): string => {
  if (totalSeconds === undefined || isNaN(totalSeconds)) {
    return '00:00';
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const lyricsToStringForEditor = (lyrics: LyricLine[] | string): string => {
    if (typeof lyrics === 'string') {
        return lyrics;
    }
    if (!Array.isArray(lyrics)) return '';
    return lyrics
        .map(line => `[${formatTime(line.timestampSeconds)}] ${line.text}`)
        .join('\n');
};

const stringToLyricsForSave = (text: string): LyricLine[] | string => {
    const lines = text.trim().split('\n');
    const timestampRegex = /^\[\s*(\d{1,2})\s*:\s*(\d{1,2})\s*\]\s*(.*)/;
    
    const parsedLines: LyricLine[] = [];
    let hasTimestamp = false;

    for (const line of lines) {
        const match = line.trim().match(timestampRegex);
        if (match) {
            hasTimestamp = true;
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const lyricText = match[3].trim();

            if (lyricText) {
                parsedLines.push({ 
                    text: lyricText, 
                    timestampSeconds: (minutes * 60) + seconds 
                });
            }
        }
    }

    if (hasTimestamp) {
        return parsedLines;
    }
    return text.trim();
};

const validateLyricsString = (text: string): { isValid: boolean; error: string | null } => {
    const lines = text.trim().split('\n');
    const timestampRegex = /^\[\s*(\d{1,2})\s*:\s*(\d{1,2})\s*\]/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const match = line.match(timestampRegex);
        if (match) {
            const minutesStr = match[1];
            const secondsStr = match[2];
            const minutes = parseInt(minutesStr, 10);
            const seconds = parseInt(secondsStr, 10);

            if (isNaN(minutes) || isNaN(seconds)) {
                 return { isValid: false, error: `Invalid number in timestamp on line ${i + 1}.` };
            }

            if (seconds < 0 || seconds > 59) {
                return { isValid: false, error: `Seconds must be between 0 and 59 on line ${i + 1}.` };
            }
        }
    }
    return { isValid: true, error: null };
};

export const SceneCard: React.FC<SceneCardProps> = ({ 
  scene, isEditing, onEdit, onSave, onCancel, overallMood, 
  targetComfyModel = 'Wan2.1-T2V', comfyServerUrl = 'http://127.0.0.1:8188',
  elementsWithImages, songTitle = 'MusicVideo', onApiKeyError 
}) => {
  const [copiedPositive, setCopiedPositive] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);
  const [editedScene, setEditedScene] = useState<Scene>(scene);
  const [lyricsString, setLyricsString] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // State for ComfyUI execution
  const [isQueueingComfy, setIsQueueingComfy] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const modelInfo = COMFY_MODEL_INFO[targetComfyModel];

  useEffect(() => {
    setEditedScene(scene);
    setValidationError(null);
    if (isEditing) {
      setLyricsString(lyricsToStringForEditor(scene.correspondingLyrics));
    }
  }, [scene, isEditing]);

  const handleCopyPositive = () => {
    const pos = scene.positivePrompt || scene.veoPrompt;
    navigator.clipboard.writeText(pos);
    setCopiedPositive(true);
    setTimeout(() => setCopiedPositive(false), 2000);
  };

  const handleCopyNegative = () => {
    const neg = scene.negativePrompt || modelInfo.defaultNegative;
    navigator.clipboard.writeText(neg);
    setCopiedNegative(true);
    setTimeout(() => setCopiedNegative(false), 2000);
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedScene(prev => ({ ...prev, [name]: value }));
  };
  
  const handleLyricsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLyricsString(e.target.value);
  };

  const handleExportWorkflow = () => {
    downloadWorkflowJson(scene, targetComfyModel, songTitle);
  };

  const handleQueueInComfy = async () => {
    setIsQueueingComfy(true);
    setGenerationError(null);
    setGenerationStatus(`Sending prompt to local ComfyUI (${comfyServerUrl})...`);

    try {
      const { promptId } = await queueComfyPrompt(comfyServerUrl, scene, targetComfyModel);
      setGenerationStatus(`Queued in ComfyUI! Prompt ID: ${promptId.slice(0, 8)}. Waiting for render...`);

      let completed = false;
      let attempts = 0;
      while (!completed && attempts < 45) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;
        setGenerationStatus(`ComfyUI rendering... Attempt ${attempts}/45`);
        const res = await pollComfyJob(comfyServerUrl, promptId);
        if (res.done) {
          completed = true;
          if (res.mediaUrl) {
            onSave({ ...scene, videoUrl: res.mediaUrl });
            setGenerationStatus('Render complete!');
          } else {
            setGenerationStatus('ComfyUI finished job! Check output in your local ComfyUI output directory.');
          }
        }
      }
      if (!completed) {
        setGenerationStatus('Sent to local ComfyUI queue! Render is in progress on your local machine.');
      }
    } catch (err: any) {
      console.warn("Queue error:", err);
      setGenerationError(
        `Could not reach ComfyUI at ${comfyServerUrl}. Ensure ComfyUI is running locally with '--enable-cors-header *'. You can also click "Export ComfyUI Workflow JSON" to run manually in your local ComfyUI UI!`
      );
    } finally {
      setIsQueueingComfy(false);
    }
  };

  const handleSaveClick = async () => {
    setValidationError(null);
    const validationResult = validateLyricsString(lyricsString);

    if (!validationResult.isValid) {
        setValidationError(validationResult.error);
        return;
    }
    
    setIsGenerating(true);
    try {
        const newPosPrompt = await generateComfyPrompt({
            description: editedScene.description,
            cameraAngle: editedScene.cameraAngle,
            overallMood: overallMood,
            targetModel: targetComfyModel,
        });

        const parsedLyrics = stringToLyricsForSave(lyricsString);
        onSave({ 
          ...editedScene, 
          correspondingLyrics: parsedLyrics, 
          positivePrompt: editedScene.positivePrompt || newPosPrompt,
          veoPrompt: editedScene.positivePrompt || newPosPrompt, 
          negativePrompt: editedScene.negativePrompt || modelInfo.defaultNegative,
          videoUrl: scene.videoUrl 
        });
    } catch(err) {
        if (err instanceof Error) {
            setValidationError(err.message);
        } else {
            setValidationError("An error occurred while updating the prompt.");
        }
    } finally {
        setIsGenerating(false);
    }
  };

  const handleCancelClick = () => {
    setValidationError(null);
    onCancel();
  };

  const posPromptText = scene.positivePrompt || scene.veoPrompt;
  const negPromptText = scene.negativePrompt || modelInfo.defaultNegative;

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:border-slate-600">
      <div className="p-6">
        {/* SCENE HEADER */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 pb-3 border-b border-slate-700/60 gap-2">
            <div>
                {scene.transition && !isEditing && (
                  <div className="text-xs font-semibold text-cyan-400 mb-1 tracking-wider uppercase">
                    {scene.transition}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-indigo-400">Scene {scene.sceneNumber}</h3>
                  <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/80 text-xs font-mono px-2.5 py-0.5 rounded-md">
                    {modelInfo.badge}
                  </span>
                </div>
            </div>

            <div className="flex items-center gap-3">
              {(scene.startTimeSeconds !== undefined && scene.endTimeSeconds !== undefined) && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold bg-slate-900 text-indigo-300 px-3 py-1.5 rounded-full border border-slate-700">
                      <ClockIcon className="w-4 h-4 text-indigo-400" />
                      <span>{formatTime(scene.startTimeSeconds)} - {formatTime(scene.endTimeSeconds)}</span>
                  </div>
              )}
              {!isEditing && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleExportWorkflow}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                    title="Download ComfyUI Workflow JSON for this scene"
                  >
                    <DownloadIcon className="w-3.5 h-3.5 text-slate-300" />
                    Workflow JSON
                  </button>

                  <button 
                    onClick={handleQueueInComfy}
                    disabled={isQueueingComfy}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
                    title="Submit job directly to local ComfyUI API"
                  >
                    <PlayIcon className="w-3.5 h-3.5" />
                    Queue in ComfyUI
                  </button>

                  <button 
                    onClick={onEdit} 
                    disabled={isQueueingComfy}
                    className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-indigo-300 transition-colors" 
                    aria-label="Edit scene"
                    title="Edit Scene"
                  >
                    <PencilIcon className="w-4 h-4"/>
                  </button>
                </div>
              )}
            </div>
        </div>

        {/* STATUS AND RENDERING MESSAGES */}
        {generationStatus && (
          <div className="mb-4 p-3 bg-indigo-950/90 border border-indigo-700/80 rounded-lg text-xs text-indigo-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
              <span>{generationStatus}</span>
            </div>
          </div>
        )}

        {generationError && (
          <div className="mb-4 p-3 bg-amber-950/80 border border-amber-700/80 text-amber-200 text-xs rounded-lg space-y-2">
            <p className="font-bold">ComfyUI Local Queue Note:</p>
            <p className="leading-relaxed">{generationError}</p>
          </div>
        )}

        {scene.videoUrl && (
          <div className="my-4 bg-black rounded-lg overflow-hidden border border-slate-700">
            <video key={scene.videoUrl} controls className="w-full h-auto">
              <source src={scene.videoUrl} type="video/mp4" />
              Your browser does not support video playback.
            </video>
          </div>
        )}

        {/* EDITING FORM OR DISPLAY CARDS */}
        {isEditing ? (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`transition-${scene.sceneNumber}`} className="font-semibold text-xs text-slate-300 mb-1 block">Transition:</label>
                    <input
                        type="text"
                        id={`transition-${scene.sceneNumber}`}
                        name="transition"
                        value={editedScene.transition || ''}
                        onChange={handleFieldChange}
                        placeholder="e.g., Cut to:, Dissolve to:"
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label htmlFor={`cameraAngle-${scene.sceneNumber}`} className="font-semibold text-xs text-slate-300 mb-1 block">Camera Angle & Motion:</label>
                    <input
                        type="text"
                        id={`cameraAngle-${scene.sceneNumber}`}
                        name="cameraAngle"
                        value={editedScene.cameraAngle || ''}
                        onChange={handleFieldChange}
                        placeholder="e.g., Low angle tracking shot"
                        className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            <div>
                <label htmlFor={`description-${scene.sceneNumber}`} className="font-semibold text-xs text-slate-300 mb-1 block">Scene Action & Story Description:</label>
                <textarea
                    id={`description-${scene.sceneNumber}`}
                    name="description"
                    value={editedScene.description}
                    onChange={handleFieldChange}
                    rows={3}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-md text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {/* COMFYUI PROMPT EDITORS */}
            <div className="space-y-3 bg-slate-900/90 p-4 rounded-lg border border-slate-700">
              <h4 className="font-bold text-xs text-indigo-300 flex items-center gap-1.5">
                <CpuChipIcon className="w-4 h-4"/>
                ComfyUI Positive Prompt
              </h4>
              <textarea
                id={`positivePrompt-${scene.sceneNumber}`}
                name="positivePrompt"
                value={editedScene.positivePrompt || editedScene.veoPrompt}
                onChange={handleFieldChange}
                rows={3}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-md text-xs font-mono text-slate-200 focus:ring-2 focus:ring-indigo-500"
              />

              <h4 className="font-bold text-xs text-slate-400 flex items-center gap-1.5 pt-1">
                Negative Prompt
              </h4>
              <textarea
                id={`negativePrompt-${scene.sceneNumber}`}
                name="negativePrompt"
                value={editedScene.negativePrompt || modelInfo.defaultNegative}
                onChange={handleFieldChange}
                rows={2}
                className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-md text-xs font-mono text-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* LYRICS */}
            <div>
                <label htmlFor={`lyrics-editor-${scene.sceneNumber}`} className="font-semibold text-xs text-slate-300 mb-1 block">Corresponding Lyrics:</label>
                <textarea
                    id={`lyrics-editor-${scene.sceneNumber}`}
                    name="correspondingLyrics"
                    value={lyricsString}
                    onChange={handleLyricsChange}
                    rows={3}
                    placeholder="e.g., [00:12] Hello from the other side"
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-md italic text-xs text-slate-200 focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            {validationError && (
              <div className="p-2.5 bg-red-950/80 border border-red-800 text-red-200 text-xs rounded-md">
                {validationError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleCancelClick} className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600">
                Cancel
              </button>
              <button 
                onClick={handleSaveClick} 
                disabled={isGenerating}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
              >
                {isGenerating ? 'Regenerating...' : 'Save ComfyUI Scene'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* LYRICS & CAMERA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <p className="font-semibold text-xs text-slate-400 mb-1">Corresponding Lyrics:</p>
                    <div className="text-slate-300 italic bg-slate-900/60 p-3 rounded-md border-l-2 border-indigo-500 text-xs space-y-1">
                      {Array.isArray(scene.correspondingLyrics) ? (
                          scene.correspondingLyrics.length > 0 ? (
                            scene.correspondingLyrics.map((line, index) => (
                                <p key={index} className="flex items-baseline gap-2">
                                    <span className="font-mono text-cyan-400 text-[11px]">[{formatTime(line.timestampSeconds)}]</span>
                                    <span>"{line.text}"</span>
                                </p>
                            ))
                          ) : (
                            <p>(Instrumental / No lyrics)</p>
                          )
                      ) : (
                          <p>"{scene.correspondingLyrics}"</p>
                      )}
                    </div>
                </div>
                {scene.cameraAngle && (
                    <div>
                        <p className="font-semibold text-xs text-slate-400 mb-1 flex items-center gap-1.5">
                            <ViewfinderIcon className="w-4 h-4 text-indigo-400"/>
                            Camera Angle & Framing:
                        </p>
                        <p className="text-slate-300 bg-slate-900/60 p-3 rounded-md text-xs">{scene.cameraAngle}</p>
                    </div>
                )}
            </div>

            {/* DESCRIPTION */}
            <div>
              <p className="font-semibold text-xs text-slate-400 mb-1">Scene Description:</p>
              <p className="text-slate-200 text-sm leading-relaxed">{scene.description}</p>
            </div>

            {/* COMFYUI PROMPT DISPLAY CARDS */}
            <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-700 space-y-3">
              {/* POSITIVE PROMPT */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <h4 className="font-bold text-xs text-indigo-300 flex items-center gap-1.5">
                    <CameraIcon className="w-4 h-4 text-indigo-400"/>
                    ComfyUI Positive Prompt ({modelInfo.badge})
                  </h4>
                  <button
                    onClick={handleCopyPositive}
                    className="flex items-center text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                  >
                    {copiedPositive ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="w-3.5 h-3.5 mr-1" />
                        Copy Positive
                      </>
                    )}
                  </button>
                </div>
                <p className="text-slate-200 font-mono text-xs leading-relaxed bg-slate-950 p-2.5 rounded-md border border-slate-800/80">
                  {posPromptText}
                </p>
              </div>

              {/* NEGATIVE PROMPT */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-bold text-[11px] text-slate-400">
                    Negative Prompt
                  </h4>
                  <button
                    onClick={handleCopyNegative}
                    className="flex items-center text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors border border-slate-700"
                  >
                    {copiedNegative ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="w-3.5 h-3.5 mr-1" />
                        Copy Negative
                      </>
                    )}
                  </button>
                </div>
                <p className="text-slate-400 font-mono text-[11px] leading-relaxed bg-slate-950/80 p-2 rounded border border-slate-800/60">
                  {negPromptText}
                </p>
              </div>

              {/* COMFY PARAMETERS ROW */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-2">
                <div className="flex items-center gap-3">
                  <span>CFG: <strong className="text-indigo-300">{modelInfo.recommendedCfg}</strong></span>
                  <span>Steps: <strong className="text-indigo-300">{modelInfo.recommendedSteps}</strong></span>
                  <span>Sampler: <strong className="text-slate-300">{modelInfo.recommendedSampler}</strong></span>
                  <span>Scheduler: <strong className="text-slate-300">{modelInfo.recommendedScheduler}</strong></span>
                </div>
                <span className="text-slate-500">Seed: Random / Preset</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneCard;
