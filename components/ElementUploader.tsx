import React, { useState } from 'react';
import { ElementWithImage } from '../types';
import { UserIcon, CubeIcon, UploadIcon, XCircleIcon, SparklesIcon } from './icons/Icons';

interface ElementUploaderProps {
  elements: ElementWithImage[];
  onSubmit: (elements: ElementWithImage[]) => void;
  onBack: () => void;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const ElementCard: React.FC<{
    element: ElementWithImage;
    onFileChange: (file: File | null) => void;
}> = ({ element, onFileChange }) => {
    
    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            const file = event.target.files[0];
            onFileChange(file);
        }
    };

    const handleRemoveImage = () => {
        onFileChange(null);
    };

    const Icon = element.type === 'character' ? UserIcon : CubeIcon;

    return (
        <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-6 h-6 text-indigo-400 flex-shrink-0" />
                    <div>
                        <h3 className="text-lg font-bold text-slate-200">{element.name}</h3>
                        <p className="text-sm text-slate-400 capitalize">{element.type}</p>
                    </div>
                </div>
                <p className="text-sm text-slate-300">{element.description}</p>
            </div>

            <div className="sm:w-48 flex-shrink-0">
                {element.imageDataUrl ? (
                    <div className="relative group">
                        <img src={element.imageDataUrl} alt={`Preview for ${element.name}`} className="w-full h-32 object-cover rounded-md border-2 border-indigo-500"/>
                        <button 
                            onClick={handleRemoveImage}
                            className="absolute top-1 right-1 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                            aria-label="Remove image"
                        >
                            <XCircleIcon className="w-5 h-5"/>
                        </button>
                    </div>
                ) : (
                    <>
                        <input
                            type="file"
                            id={`upload-${element.name}`}
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileSelect}
                        />
                        <label 
                            htmlFor={`upload-${element.name}`}
                            className="w-full h-32 flex flex-col items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-all duration-200 border-2 border-dashed border-slate-600 text-slate-400 cursor-pointer hover:bg-slate-700/50 hover:border-indigo-500 hover:text-white"
                        >
                           <UploadIcon className="w-6 h-6"/>
                           Upload Image
                        </label>
                    </>
                )}
            </div>
        </div>
    );
};


const ElementUploader: React.FC<ElementUploaderProps> = ({ elements, onSubmit, onBack }) => {
  const [localElements, setLocalElements] = useState<ElementWithImage[]>(elements);

  const handleFileChange = async (index: number, file: File | null) => {
    const updatedElements = [...localElements];
    if (file) {
        try {
            const imageDataUrl = await fileToDataUrl(file);
            updatedElements[index] = { ...updatedElements[index], imageDataUrl };
        } catch (error) {
            console.error("Error converting file to data URL:", error);
            // Optionally set an error state
        }
    } else {
        // If file is null, it means we are removing the image
        delete updatedElements[index].imageDataUrl;
    }
    setLocalElements(updatedElements);
  };
  
  const handleContinue = () => {
    onSubmit(localElements);
  }

  const handleSkip = () => {
      // Submit with no images attached
      onSubmit(elements);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-200">
            Define Your Visual Elements
        </h2>
        <p className="text-slate-400 mt-1">
            The AI has identified these key characters and props. Upload a reference image for each to ensure visual consistency across all scenes.
        </p>
      </div>

      <div className="space-y-4">
        {localElements.map((element, index) => (
            <ElementCard 
                key={`${element.name}-${index}`} 
                element={element}
                onFileChange={(file) => handleFileChange(index, file)}
            />
        ))}
      </div>
      
      <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4">
         <button
            onClick={handleSkip}
            className="w-full sm:w-auto px-6 py-2 text-sm font-medium rounded-md text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 focus:ring-offset-slate-800 transition-colors"
         >
            Skip for Now
        </button>
        <button
            onClick={handleContinue}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-900 transition-all duration-200 group"
        >
            <SparklesIcon className="w-5 h-5 mr-2 -ml-1 transition-transform duration-300 group-hover:rotate-12" />
            Continue to Script
        </button>
      </div>
    </div>
  );
};

export default ElementUploader;