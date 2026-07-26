import { Scene, ComfyModelPreset, ComfyPromptDetails } from '../types';

export const DEFAULT_COMFY_URL = 'http://127.0.0.1:8188';

export const COMFY_MODEL_INFO: Record<ComfyModelPreset, {
  displayName: string;
  description: string;
  badge: string;
  recommendedCfg: number;
  recommendedSteps: number;
  recommendedSampler: string;
  recommendedScheduler: string;
  defaultNegative: string;
}> = {
  'Wan2.1-T2V': {
    displayName: 'Wan 2.1 Text-to-Video',
    description: 'State-of-the-art open source video generation (14B/1.3B) in ComfyUI',
    badge: 'Wan 2.1 T2V',
    recommendedCfg: 6.0,
    recommendedSteps: 30,
    recommendedSampler: 'uni_pc',
    recommendedScheduler: 'simple',
    defaultNegative: 'bright colors, overexposed, static, blurry, low resolution, bad anatomy, text, watermark, jittery, flicker',
  },
  'Wan2.1-I2V': {
    displayName: 'Wan 2.1 Image-to-Video',
    description: 'Transforms reference keyframes or character photos into fluid 8s video',
    badge: 'Wan 2.1 I2V',
    recommendedCfg: 6.0,
    recommendedSteps: 30,
    recommendedSampler: 'uni_pc',
    recommendedScheduler: 'simple',
    defaultNegative: 'deformed, morphing, unnatural movement, jitter, extra limbs, low quality',
  },
  'HunyuanVideo': {
    displayName: 'HunyuanVideo (13B)',
    description: 'Tencent high-fidelity open video model for ComfyUI',
    badge: 'HunyuanVideo',
    recommendedCfg: 6.0,
    recommendedSteps: 25,
    recommendedSampler: 'euler',
    recommendedScheduler: 'normal',
    defaultNegative: 'low resolution, bad execution, motion blur, distorted faces, duplicate characters',
  },
  'AnimateDiff': {
    displayName: 'AnimateDiff (SDXL / SD1.5)',
    description: 'Rhythmic, stylized looping video generation in ComfyUI',
    badge: 'AnimateDiff',
    recommendedCfg: 7.5,
    recommendedSteps: 25,
    recommendedSampler: 'euler_ancestral',
    recommendedScheduler: 'karras',
    defaultNegative: 'deformed, distortion, bad hands, missing limbs, static background, artifact',
  },
  'CogVideoX': {
    displayName: 'CogVideoX (5B / 2B)',
    description: 'THUDM cinematic video generation node',
    badge: 'CogVideoX',
    recommendedCfg: 6.0,
    recommendedSteps: 30,
    recommendedSampler: 'ddim',
    recommendedScheduler: 'ddim_uniform',
    defaultNegative: 'blurry, distorted, bad movement, over-saturated, low detail',
  },
  'SVD-XT': {
    displayName: 'Stable Video Diffusion (SVD-XT)',
    description: '25-frame image-to-video motion model',
    badge: 'SVD-XT',
    recommendedCfg: 2.5,
    recommendedSteps: 25,
    recommendedSampler: 'euler',
    recommendedScheduler: 'karras',
    defaultNegative: 'flickering, jitter, sudden jumps, morphing, noise',
  },
  'Flux1-Dev': {
    displayName: 'Flux.1 Dev + Motion',
    description: 'Ultra-detailed keyframe generation + motion frame interpolation',
    badge: 'Flux.1 Dev',
    recommendedCfg: 3.5,
    recommendedSteps: 28,
    recommendedSampler: 'euler',
    recommendedScheduler: 'simple',
    defaultNegative: 'bad lighting, blurry, distorted, cartoonish when realistic requested',
  },
  'SDXL': {
    displayName: 'SDXL Cinematic Keyframes',
    description: 'High-res photorealistic / artistic keyframe generation in ComfyUI',
    badge: 'SDXL',
    recommendedCfg: 7.0,
    recommendedSteps: 30,
    recommendedSampler: 'dpmpp_2m_sde',
    recommendedScheduler: 'karras',
    defaultNegative: 'ugly, deformed, noise, blurry, low contrast, oversaturated, watermark, signature',
  },
};

/**
 * Checks if the local ComfyUI instance is online and reachable.
 */
export async function checkComfyConnection(serverUrl: string = DEFAULT_COMFY_URL): Promise<{ ok: boolean; info?: string; error?: string }> {
  const cleanUrl = serverUrl.replace(/\/$/, '');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // ComfyUI exposes /system_stats or /object_info
    const res = await fetch(`${cleanUrl}/system_stats`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const deviceName = data?.system?.devices?.[0]?.name || 'Local GPU';
      return { ok: true, info: `Connected (${deviceName})` };
    }
    return { ok: false, error: `HTTP ${res.status}: Unable to connect to ComfyUI` };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Connection timed out (Check if ComfyUI is running with --listen)' };
    }
    return { ok: false, error: 'Offline / CORS issue. (Make sure ComfyUI is launched with --enable-cors-header *)' };
  }
}

/**
 * Generates an API-compatible ComfyUI JSON Workflow object for direct submission or import.
 */
export function buildComfyWorkflowJson(scene: Scene, modelPreset: ComfyModelPreset = 'Wan2.1-T2V'): object {
  const info = COMFY_MODEL_INFO[modelPreset];
  const positive = scene.positivePrompt || scene.veoPrompt || scene.description;
  const negative = scene.negativePrompt || info.defaultNegative;
  const seed = scene.comfyPrompt?.seed || Math.floor(Math.random() * 10000000000);
  const steps = scene.comfyPrompt?.steps || info.recommendedSteps;
  const cfg = scene.comfyPrompt?.cfgScale || info.recommendedCfg;

  // Standard ComfyUI API Prompt Node structure
  return {
    "1": {
      "inputs": {
        "ckpt_name": modelPreset.includes('Wan') ? "wan2.1_t2v_14B_bf16.safetensors" : 
                     modelPreset === 'HunyuanVideo' ? "hunyuan_video_720p_bf16.safetensors" :
                     modelPreset === 'Flux1-Dev' ? "flux1-dev.safetensors" : "sd_xl_base_1.0.safetensors"
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "2": {
      "inputs": {
        "text": positive,
        "clip": ["1", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "3": {
      "inputs": {
        "text": negative,
        "clip": ["1", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "4": {
      "inputs": {
        "seed": seed,
        "steps": steps,
        "cfg": cfg,
        "sampler_name": info.recommendedSampler,
        "scheduler": info.recommendedScheduler,
        "denoise": 1.0,
        "model": ["1", 0],
        "positive": ["2", 0],
        "negative": ["3", 0],
        "latent_image": ["5", 0]
      },
      "class_type": "KSampler"
    },
    "5": {
      "inputs": {
        "width": 1280,
        "height": 720,
        "batch_size": modelPreset.includes('Video') || modelPreset.includes('Wan') || modelPreset.includes('SVD') || modelPreset.includes('AnimateDiff') ? 16 : 1
      },
      "class_type": "EmptyLatentImage"
    },
    "6": {
      "inputs": {
        "samples": ["4", 0],
        "vae": ["1", 2]
      },
      "class_type": "VAEDecode"
    },
    "7": {
      "inputs": {
        "filename_prefix": `MusicVideo_Scene_${scene.sceneNumber}`,
        "images": ["6", 0]
      },
      "class_type": "SaveImage"
    }
  };
}

/**
 * Downloads a formatted ComfyUI workflow JSON file to the user's computer.
 */
export function downloadWorkflowJson(scene: Scene, modelPreset: ComfyModelPreset, songTitle: string = 'MusicVideo'): void {
  const workflow = buildComfyWorkflowJson(scene, modelPreset);
  const jsonStr = JSON.stringify(workflow, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${songTitle.replace(/[^a-z0-9]/gi, '_')}_Scene_${scene.sceneNumber}_ComfyUI_${modelPreset}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Submits the scene prompt directly to a running local ComfyUI API (/prompt).
 */
export async function queueComfyPrompt(
  serverUrl: string, 
  scene: Scene, 
  modelPreset: ComfyModelPreset
): Promise<{ promptId: string }> {
  const cleanUrl = serverUrl.replace(/\/$/, '');
  const workflow = buildComfyWorkflowJson(scene, modelPreset);

  const response = await fetch(`${cleanUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ComfyUI API Error (${response.status}): ${text}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`ComfyUI execution error: ${JSON.stringify(data.error)}`);
  }
  return { promptId: data.prompt_id };
}

/**
 * Polls local ComfyUI history for job completion and returns generated preview URL.
 */
export async function pollComfyJob(serverUrl: string, promptId: string): Promise<{ done: boolean; mediaUrl?: string; error?: string }> {
  const cleanUrl = serverUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${cleanUrl}/history/${promptId}`);
    if (!res.ok) return { done: false };

    const history = await res.json();
    const job = history[promptId];
    if (!job) return { done: false };

    if (job.status?.completed) {
      const outputs = job.outputs;
      for (const nodeId of Object.keys(outputs)) {
        const images = outputs[nodeId]?.images || outputs[nodeId]?.videos;
        if (images && images.length > 0) {
          const item = images[0];
          const filename = item.filename;
          const subfolder = item.subfolder || '';
          const type = item.type || 'output';
          const mediaUrl = `${cleanUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
          return { done: true, mediaUrl };
        }
      }
      return { done: true };
    }
    return { done: false };
  } catch (err: any) {
    return { done: false, error: err.message };
  }
}
