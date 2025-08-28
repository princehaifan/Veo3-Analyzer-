
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeVideoWithGemini } from './services/geminiService';
import { UploadIcon, DownloadIcon, ResetIcon, CopyIcon, FormatIcon } from './components/icons';
import type { VideoAnalysis, ShotPrompt, Scene } from './types';

const Spinner: React.FC = () => (
  <div className="border-4 border-gray-200 border-t-[#3F704F] rounded-full w-12 h-12 animate-spin"></div>
);

interface FileUploadAreaProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

const formatTime = (seconds: number): string => {
    const floorSeconds = Math.floor(seconds);
    const m = Math.floor(floorSeconds / 60);
    const s = floorSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

interface ShotPromptCardProps {
    shot: ShotPrompt;
    onClick: (scene: Scene) => void;
    isSelected: boolean;
}

const ShotPromptCard: React.FC<ShotPromptCardProps> = ({ shot, onClick, isSelected }) => {
    const [copyText, setCopyText] = useState('Copy');
    
    const handleCopy = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click event from firing
        navigator.clipboard.writeText(shot.prompt).then(() => {
            setCopyText('Copied!');
            setTimeout(() => setCopyText('Copy'), 2000);
        }).catch(err => {
            console.error("Failed to copy prompt: ", err);
        });
    }, [shot.prompt]);

    return (
        <div 
            onClick={() => onClick(shot.scene)}
            className={`bg-white/80 p-4 rounded-lg shadow-md flex flex-col justify-between cursor-pointer transition-all duration-200 ${isSelected ? 'ring-2 ring-[#CFB53B]' : 'hover:shadow-lg hover:scale-[1.02]'}`}
        >
            <div>
                <div className="text-sm font-semibold text-gray-500 mb-2">{shot.timestamp}</div>
                <p className="text-gray-800 text-base">{shot.scene.description}</p>
                 {shot.scene.dialogue && shot.scene.dialogue.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm font-semibold not-italic text-gray-600 mb-1">Dialogue:</p>
                        <div className="space-y-1 text-sm text-gray-700">
                        {shot.scene.dialogue.map((d, index) => (
                            <div key={index}>
                                <span className="font-semibold">{d.speaker}:</span>
                                <span className="italic ml-2">"{d.line}"</span>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
            </div>
            <button
                onClick={handleCopy}
                className="mt-4 self-end flex items-center gap-2 px-3 py-1.5 bg-[#3F704F] text-white text-sm font-semibold rounded-md hover:bg-opacity-90 transition-all duration-200"
            >
                <CopyIcon />
                {copyText}
            </button>
        </div>
    );
};

const FileUploadArea: React.FC<FileUploadAreaProps> = ({ onFileUpload, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLoading || !e.dataTransfer.files || e.dataTransfer.files.length === 0) {
      return;
    }
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onFileUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#3F704F] rounded-2xl bg-white/50 cursor-pointer hover:bg-white/80 transition-colors duration-300"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/*"
        className="hidden"
        disabled={isLoading}
      />
      <UploadIcon />
      <p className="mt-4 text-xl font-semibold text-[#3F704F]">
        Drag & Drop a video file here
      </p>
      <p className="text-gray-500">or click to select a file</p>
    </div>
  );
};


export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [jsonOutput, setJsonOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [copyButtonText, setCopyButtonText] = useState('Copy');
  const [shotPrompts, setShotPrompts] = useState<ShotPrompt[]>([]);
  const [activeTab, setActiveTab] = useState<'prompts' | 'json'>('prompts');
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
        setError('Please upload a valid video file.');
        return;
    }
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    setError(null);
    setIsLoading(true);
    setJsonOutput('');

    try {
      setProgressMessage('Preparing video for analysis...');
      const result = await analyzeVideoWithGemini(file, setProgressMessage);
      setProgressMessage('Formatting response...');
      setJsonOutput(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during analysis.');
    } finally {
      setIsLoading(false);
      setProgressMessage('');
    }
  }, []);

  const handleDownloadJson = useCallback(() => {
    if (!jsonOutput) return;
    const blob = new Blob([jsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoFile?.name.split('.')[0]}_analysis.json` || 'analysis.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [jsonOutput, videoFile]);

  const handleCopyJson = useCallback(() => {
    if (!jsonOutput) return;
    navigator.clipboard.writeText(jsonOutput).then(() => {
        setCopyButtonText('Copied!');
        setTimeout(() => setCopyButtonText('Copy'), 2000);
    }).catch(err => {
        console.error("Failed to copy JSON: ", err);
    });
  }, [jsonOutput]);
  
  const handleReset = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl(null);
    setJsonOutput('');
    setError(null);
    setIsLoading(false);
    setProgressMessage('');
    setCopyButtonText('Copy');
    setShotPrompts([]);
    setActiveTab('prompts');
    setSelectedSceneId(null);
  }, [videoUrl]);
  
  const handleFormatJson = useCallback(() => {
    try {
        const parsed = JSON.parse(jsonOutput);
        setJsonOutput(JSON.stringify(parsed, null, 2));
    } catch (e) {
        console.error("Could not format invalid JSON.", e);
        // Optionally, show a small error message to the user
    }
  }, [jsonOutput]);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const handleShotPromptClick = useCallback((scene: Scene) => {
    setSelectedSceneId(scene.scene_id);

    if (videoRef.current) {
        videoRef.current.currentTime = scene.timestamp_start_seconds;
        videoRef.current.play();
    }

    if (jsonTextareaRef.current && jsonOutput) {
        const sceneIdentifier = `"scene_id": ${scene.scene_id}`;
        const startIndex = jsonOutput.indexOf(sceneIdentifier);

        if (startIndex !== -1) {
            const endIndex = jsonOutput.indexOf('\n', startIndex);
            const finalEndIndex = endIndex === -1 ? jsonOutput.length : endIndex;

            setActiveTab('json');
            // Use timeout to ensure the textarea is visible before focusing
            setTimeout(() => {
                if (jsonTextareaRef.current) {
                    jsonTextareaRef.current.focus();
                    jsonTextareaRef.current.setSelectionRange(startIndex, finalEndIndex);
                }
            }, 0);
        }
    }
  }, [jsonOutput]);

  useEffect(() => {
    if (jsonOutput) {
        try {
            const analysis: VideoAnalysis = JSON.parse(jsonOutput);
            const prompts: ShotPrompt[] = analysis.scenes.map(scene => {
                let promptText = `Cinematic shot: ${scene.description}.`;
                if (scene.dialogue && scene.dialogue.length > 0) {
                    const dialogueText = scene.dialogue.map(d => `${d.speaker}: "${d.line}"`).join(' ');
                    promptText += ` Dialogue: ${dialogueText}.`;
                }
                promptText += ` Prominent objects: ${scene.objects.join(', ')}. Actions: ${scene.actions.join(', ')}.`;
                
                return {
                    id: scene.scene_id,
                    timestamp: `${formatTime(scene.timestamp_start_seconds)} - ${formatTime(scene.timestamp_end_seconds)}`,
                    prompt: promptText,
                    scene: scene,
                };
            });
            setShotPrompts(prompts);
            setActiveTab('prompts');
        } catch (e) {
            console.error("Failed to parse analysis JSON for prompts", e);
            setShotPrompts([]);
        }
    } else {
        setShotPrompts([]);
    }
}, [jsonOutput]);

  return (
    <div className="min-h-screen text-[#3F704F] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-[#3F704F]">Veo3 Analyzer</h1>
          <p className="mt-2 text-lg text-gray-600">Generate detailed JSON from your video files automatically.</p>
        </header>

        <main className="bg-white/60 shadow-2xl rounded-2xl p-6 md:p-8 backdrop-blur-sm">
          {!videoFile && !isLoading && (
            <FileUploadArea onFileUpload={handleFileUpload} isLoading={isLoading} />
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center space-y-4">
              <Spinner />
              <p className="text-lg font-medium">{progressMessage}</p>
              <p className="text-gray-500 text-sm">Please keep this window open.</p>
            </div>
          )}

          {error && (
             <div className="text-center">
              <p className="text-red-600 font-semibold">{error}</p>
              <button
                onClick={handleReset}
                className="mt-4 px-6 py-2 bg-[#3F704F] text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!isLoading && jsonOutput && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                 <h2 className="text-2xl font-semibold">Analysis Result</h2>
                 <div className="flex items-center flex-wrap gap-2">
                     <button
                        onClick={handleCopyJson}
                        className="flex items-center gap-2 px-4 py-2 bg-[#3F704F] text-white font-semibold rounded-lg hover:bg-opacity-90 transition-all duration-200"
                     >
                        <CopyIcon />
                        {copyButtonText}
                    </button>
                     <button
                        onClick={handleDownloadJson}
                        className="flex items-center gap-2 px-4 py-2 bg-[#CFB53B] text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
                     >
                        <DownloadIcon />
                        Download
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                    >
                       <ResetIcon />
                        New Video
                    </button>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="w-full">
                    {videoUrl && (
                        <video ref={videoRef} src={videoUrl} controls className="w-full rounded-lg shadow-lg aspect-video"></video>
                    )}
                </div>

                <div>
                    <div className="border-b border-gray-300 mb-4">
                        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('prompts')}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-lg transition-colors duration-200 ${
                                    activeTab === 'prompts'
                                    ? 'border-[#CFB53B] text-[#3F704F]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Shot Prompts
                            </button>
                            <button
                                onClick={() => setActiveTab('json')}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-lg transition-colors duration-200 ${
                                    activeTab === 'json'
                                    ? 'border-[#CFB53B] text-[#3F704F]'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Raw JSON
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'prompts' && (
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {shotPrompts.length > 0 ? (
                                shotPrompts.map(shot => 
                                    <ShotPromptCard 
                                        key={shot.id} 
                                        shot={shot} 
                                        onClick={handleShotPromptClick}
                                        isSelected={selectedSceneId === shot.id}
                                    />
                                )
                            ) : (
                                <p className="text-gray-600">Could not generate shot prompts from the JSON analysis.</p>
                            )}
                        </div>
                    )}

                    {activeTab === 'json' && (
                        <div className="relative">
                            <textarea
                            ref={jsonTextareaRef}
                            value={jsonOutput}
                            onChange={(e) => setJsonOutput(e.target.value)}
                            className="w-full h-[60vh] p-4 pr-12 border border-gray-300 rounded-lg shadow-inner bg-gray-50 text-sm text-gray-800 focus:ring-2 focus:ring-[#3F704F] focus:border-[#3F704F] transition"
                            spellCheck="false"
                            />
                            <button onClick={handleFormatJson} className="absolute top-2 right-2 p-2 rounded-md bg-gray-200 hover:bg-gray-300 transition-colors" aria-label="Format JSON">
                                <FormatIcon />
                            </button>
                        </div>
                    )}
                 </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
