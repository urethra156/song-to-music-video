import React, { useState } from 'react';
import { VideoScript, Scene, SongAnalysis, ElementWithImage, ComfyModelPreset } from '../types';
import SceneCard from './SceneCard';
import { SparklesIcon, DownloadIcon, XCircleIcon, CpuChipIcon, ClipboardIcon, CheckIcon } from './icons/Icons';
import { COMFY_MODEL_INFO } from '../services/comfyService';

interface VideoScriptDisplayProps {
  script: VideoScript;
  elementsWithImages: ElementWithImage[];
  selectedComfyModel: ComfyModelPreset;
  comfyServerUrl: string;
  onUpdateScenes: (updatedScenes: Scene[]) => void;
  onSaveScript: () => void;
  onStartNew: () => void;
  onApiKeyError: () => void;
}

const AnalysisItem: React.FC<{ label: string; value: React.ReactNode; }> = ({ label, value }) => (
    <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</h4>
        <div className="text-base text-slate-200 mt-0.5">{value}</div>
    </div>
);

const SongAnalysisSummary: React.FC<{ analysis: SongAnalysis }> = ({ analysis }) => (
    <div className="mb-8 p-5 bg-slate-800/60 rounded-xl border border-slate-700">
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-300 mb-3">
            Song Audio & Lyric Analysis
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            <AnalysisItem label="Tempo" value={<><span className="font-bold text-indigo-300">{analysis.bpm}</span> BPM</>} />
            <AnalysisItem label="Musical Key" value={<span className="font-bold text-indigo-300">{analysis.musicalKey}</span>} />
            <AnalysisItem label="Dynamics" value={<span className="text-sm">{analysis.dynamics}</span>} />
            <div className="col-span-2 md:col-span-3">
                <AnalysisItem 
                    label="Lyrical Themes" 
                    value={
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {analysis.lyricalThemes.map(theme => (
                                <span key={theme} className="bg-slate-700/80 text-slate-300 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-600">
                                    {theme}
                                </span>
                            ))}
                        </div>
                    } 
                />
            </div>
             <div className="col-span-2 md:col-span-3">
                <AnalysisItem 
                    label="Instrumentation" 
                    value={
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {analysis.instrumentation.map(instrument => (
                                <span key={instrument} className="bg-slate-700/80 text-slate-300 text-xs font-medium px-2.5 py-1 rounded-md border border-slate-600">
                                    {instrument}
                                </span>
                            ))}
                        </div>
                    } 
                />
            </div>
            <div className="col-span-2 md:col-span-3">
                <AnalysisItem 
                    label="Suggested Color Palette" 
                    value={
                        <div className="flex flex-wrap gap-3 pt-1">
                            {analysis.suggestedColorPalette.map(color => (
                                <div key={color.hex} className="flex items-center" title={color.reason}>
                                    <div className="w-6 h-6 rounded-full border border-slate-400 mr-2 shadow-sm" style={{ backgroundColor: color.hex }}></div>
                                    <div>
                                        <p className="font-mono text-xs font-bold text-slate-200">{color.hex.toUpperCase()}</p>
                                        <p className="text-[11px] text-slate-400">{color.reason}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    } 
                />
            </div>
        </div>
    </div>
);

export const VideoScriptDisplay: React.FC<VideoScriptDisplayProps> = ({ 
  script, elementsWithImages, selectedComfyModel, comfyServerUrl,
  onUpdateScenes, onSaveScript, onStartNew, onApiKeyError 
}) => {
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);

  const modelInfo = COMFY_MODEL_INFO[selectedComfyModel];

  const handleEdit = (sceneNumber: number) => {
    setEditingSceneId(sceneNumber);
  };

  const handleSave = (updatedScene: Scene) => {
    const newScenes = script.scenes.map(s =>
      s.sceneNumber === updatedScene.sceneNumber ? updatedScene : s
    );
    onUpdateScenes(newScenes);
    setEditingSceneId(null);
  };

  const handleCancel = () => {
    setEditingSceneId(null);
  };

  const handleCopyBatchPrompts = () => {
    const batchText = script.scenes.map(scene => {
      const pos = scene.positivePrompt || scene.veoPrompt;
      const neg = scene.negativePrompt || modelInfo.defaultNegative;
      return `--- Scene ${scene.sceneNumber} (${scene.startTimeSeconds}s - ${scene.endTimeSeconds}s) ---\nPOSITIVE:\n${pos}\n\nNEGATIVE:\n${neg}\n`;
    }).join('\n========================================\n\n');

    navigator.clipboard.writeText(batchText);
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2000);
  };

  const handleExportComfyBatchJson = () => {
    const batchData = {
      title: script.title,
      overallMood: script.overallMood,
      targetModel: selectedComfyModel,
      comfyServerUrl: comfyServerUrl,
      scenes: script.scenes.map(scene => ({
        sceneNumber: scene.sceneNumber,
        timeRange: `${scene.startTimeSeconds}s - ${scene.endTimeSeconds}s`,
        positivePrompt: scene.positivePrompt || scene.veoPrompt,
        negativePrompt: scene.negativePrompt || modelInfo.defaultNegative,
        cfgScale: modelInfo.recommendedCfg,
        steps: modelInfo.recommendedSteps,
        sampler: modelInfo.recommendedSampler,
        scheduler: modelInfo.recommendedScheduler,
        description: scene.description
      }))
    };

    const blob = new Blob([JSON.stringify(batchData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${script.title.replace(/[^a-z0-9]/gi, '_')}_ComfyUI_Batch_Prompts.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* SCRIPT TITLE AND COMFY MODEL BADGE */}
      <div className="p-6 bg-slate-800/80 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-indigo-900/90 text-indigo-300 border border-indigo-700 text-xs font-mono font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5">
                    <CpuChipIcon className="w-4 h-4 text-indigo-400" />
                    Target Model: {modelInfo.displayName}
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-300">
                {script.title}
                </h2>
                <p className="mt-1 text-slate-400 text-sm flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4 text-yellow-400" />
                    Visual Style: <span className="font-semibold text-slate-200">{script.overallMood}</span>
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                 <button
                    onClick={handleCopyBatchPrompts}
                    className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-200 bg-slate-700 hover:bg-slate-600 transition-colors border border-slate-600"
                    title="Copy all scene positive & negative prompts to clipboard"
                >
                    {copiedBatch ? (
                      <>
                        <CheckIcon className="w-4 h-4 mr-1.5 text-emerald-400"/>
                        Prompts Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="w-4 h-4 mr-1.5 text-slate-300"/>
                        Copy All Prompts
                      </>
                    )}
                </button>

                <button
                    onClick={handleExportComfyBatchJson}
                    className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md"
                    title="Download batch JSON for ComfyUI queue automation"
                >
                    <DownloadIcon className="w-4 h-4 mr-1.5"/>
                    Batch ComfyUI JSON
                </button>

                 <button
                    onClick={onSaveScript}
                    className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
                    aria-label="Save full script as JSON file"
                >
                    Save Full Script
                </button>

                 <button
                    onClick={onStartNew}
                    className="inline-flex items-center px-3.5 py-2 text-xs font-semibold rounded-lg text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 transition-colors"
                >
                    <XCircleIcon className="w-4 h-4 mr-1.5"/>
                    Start New
                </button>
            </div>
        </div>
      </div>
      
      {script.analysis && <SongAnalysisSummary analysis={script.analysis} />}

      <div className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xl font-bold text-slate-200">
            ComfyUI Scene Timeline ({script.scenes.length} Scenes)
          </h3>
          <p className="text-xs text-slate-400">
            Each scene is formatted with Positive/Negative Prompts, CFG, & Steps for {modelInfo.badge}
          </p>
        </div>

        {script.scenes.map((scene) => (
          <SceneCard 
            key={scene.sceneNumber} 
            scene={scene}
            overallMood={script.overallMood}
            targetComfyModel={selectedComfyModel}
            comfyServerUrl={comfyServerUrl}
            songTitle={script.title}
            elementsWithImages={elementsWithImages}
            isEditing={editingSceneId === scene.sceneNumber}
            onEdit={() => handleEdit(scene.sceneNumber)}
            onSave={handleSave}
            onCancel={handleCancel}
            onApiKeyError={onApiKeyError}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoScriptDisplay;
