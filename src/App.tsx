import { ArrowRight, Check, ChevronDown, Download, Image as ImageIcon, Loader2, Maximize2, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { MODELS } from './services/models';
import { translateImage, TranslationResult } from './services/translator';


const LANGUAGES = [
  'English', 'French', 'German', 'Dutch', 'Spanish', 'Italian', 
  'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic'
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState('Auto-detect');
  const [targetLang, setTargetLang] = useState('English');
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([MODELS[0].id]);
  const [results, setResults] = useState<TranslationResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fullscreenResult, setFullscreenResult] = useState<TranslationResult | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleModel = (id: string) => {
    setSelectedModelIds(prev => 
      prev.includes(id) 
        ? (prev.length > 1 ? prev.filter(m => m !== id) : prev) 
        : [...prev, id]
    );
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleFile = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/') && selectedFile.type !== 'application/pdf') {
      setError('Please upload a valid image or PDF file.');
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResults([]);
    setError(null);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const [loadingModelIds, setLoadingModelIds] = useState<Set<string>>(new Set());

  const handleTranslate = async () => {
    if (!file || selectedModelIds.length === 0) return;
    
    setIsTranslating(true);
    setError(null);
    setResults([]);
    
    const selectedModels = MODELS.filter(m => selectedModelIds.includes(m.id));
    setLoadingModelIds(new Set(selectedModels.map(m => m.id)));
    setActiveTabId(selectedModels[0].id);
    
    const translationPromises = selectedModels.map(async (model) => {
      try {
        const result = await translateImage(file, sourceLang, targetLang, model);
        setResults(prev => [...prev, result]);
      } catch (err: any) {
        setResults(prev => [...prev, {
          modelId: model.id,
          modelName: model.name,
          content: '',
          type: 'image' as const,
          error: err.message || 'Failed to translate image.',
        }]);
      } finally {
        setLoadingModelIds(prev => {
          const next = new Set(prev);
          next.delete(model.id);
          return next;
        });
      }
    });

    await Promise.all(translationPromises);
    setIsTranslating(false);
  };

  const handleDownload = (imageUrl: string, modelName: string) => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `translated_${modelName.replace(/\s+/g, '_')}_${file?.name || 'image.png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  useEffect(() => {
    if (results.length === 0 && !isTranslating) {
      setActiveTabId(null);
    }
  }, [results, isTranslating]);

  const activeResult = results.find(r => r.modelId === activeTabId) || results[0];

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 font-sans p-4 flex flex-col">
      <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col gap-6">
        
        {/* Main Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[700px]">
          
          {/* LEFT COLUMN: Source */}
          <div className="flex flex-col gap-4">
            
            {/* Source Configuration */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 max-w-[200px]">
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Source Language</label>
                  <select 
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  >
                    <option value="Auto-detect">Auto-detect</option>
                    {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Source Image Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
                <h2 className="text-sm font-semibold text-neutral-700">Source Image</h2>
                {file && (
                  <button 
                    onClick={() => { setFile(null); setPreviewUrl(null); setResults([]); }}
                    className="text-neutral-400 hover:text-neutral-600 p-1 rounded-md hover:bg-neutral-200 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <div className="flex-1 p-4 flex flex-col">
                {!previewUrl ? (
                  <div 
                    className="flex-1 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center p-8 text-center hover:bg-neutral-50 hover:border-neutral-300 transition-colors cursor-pointer"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4">
                      <Upload size={24} />
                    </div>
                    <h3 className="text-base font-medium mb-1">Upload original</h3>
                    <p className="text-neutral-500 text-xs mb-4">PNG, JPG, or PDF up to 10MB</p>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      accept="image/png, image/jpeg, application/pdf" 
                      className="hidden" 
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center bg-neutral-50 rounded-xl overflow-hidden min-h-[300px]">
                    {file?.type === 'application/pdf' ? (
                      <div className="flex flex-col items-center text-neutral-500">
                        <ImageIcon size={40} className="mb-3 opacity-50" />
                        <p className="text-sm">PDF Document</p>
                      </div>
                    ) : (
                      <img src={previewUrl} alt="Original" className="w-full h-full object-contain max-h-[60vh]" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Target & Models */}
          <div className="flex flex-col gap-4">
            
            {/* Target Configuration */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex-1 max-w-[200px]">
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Target Language</label>
                  <select 
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  >
                    {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                  </select>
                </div>
                
                <div className="flex-1 relative" ref={dropdownRef}>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Model Selection (Compare)</label>
                  <button
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium flex items-center justify-between text-left"
                  >
                    <span className="truncate pr-4 text-neutral-700">
                      {selectedModelIds.length === 0 ? "Select models..." : 
                       selectedModelIds.length === 1 ? MODELS.find(m => m.id === selectedModelIds[0])?.name : 
                       `${selectedModelIds.length} models selected`}
                    </span>
                    <ChevronDown size={16} className={`text-neutral-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <AnimatePresence>
                    {isModelDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-10 mt-2 w-full bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden"
                      >
                        <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-1">
                          {MODELS.map(model => (
                            <button
                              key={model.id}
                              onClick={() => toggleModel(model.id)}
                              className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-3 hover:bg-neutral-50 text-left relative group/item"
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                selectedModelIds.includes(model.id)
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-neutral-300 bg-white group-hover/item:border-indigo-400'
                              }`}>
                                {selectedModelIds.includes(model.id) && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span className={selectedModelIds.includes(model.id) ? 'text-neutral-900' : 'text-neutral-600'}>
                                {model.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={handleTranslate}
                  disabled={!file || isTranslating || selectedModelIds.length === 0}
                  className="px-6 py-2 h-[42px] bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-xl font-semibold flex items-center gap-2 transition-all min-w-[120px] justify-center"
                >
                  {isTranslating ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>Translate <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
              {error && (
                <div className="mt-3 p-2 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                  {error}
                </div>
              )}
            </div>

            {/* Target Result Area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
              {/* Tabs for Results */}
              <div className="px-3 pt-3 border-b border-neutral-100 bg-neutral-50/50 flex gap-2 overflow-x-auto no-scrollbar">
               {isTranslating || results.length > 0 ? (
                  MODELS.filter(m => selectedModelIds.includes(m.id) || results.some(r => r.modelId === m.id)).map((model) => {
                    const result = results.find(r => r.modelId === model.id);
                    const isLoading = loadingModelIds.has(model.id);
                    return (
                      <button
                        key={model.id}
                        onClick={() => setActiveTabId(model.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                          activeTabId === model.id
                            ? 'border-indigo-500 text-indigo-600 bg-white rounded-t-lg'
                            : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100/50 rounded-t-lg'
                        }`}
                      >
                        {isLoading && <Loader2 size={12} className="animate-spin text-indigo-400" />}
                        {!isLoading && result && !result.error && <div className={`w-1.5 h-1.5 rounded-full ${activeTabId === model.id ? 'bg-indigo-500' : 'bg-green-500'}`}></div>}
                        {!isLoading && result?.error && <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>}
                        <span className="flex flex-col items-start gap-px">
                          <span>{model.name}</span>
                          {result && !result.error && (result.cost || result.usage) && (
                             <span className={`text-[10px] font-normal tracking-wide ${activeTabId === model.id ? 'text-indigo-400' : 'text-neutral-400'}`}>
                               {result.cost && (result.cost === 'Free tier' ? 'Free tier' : `$${result.cost}`)}
                               {result.usage && ` · ${result.usage.totalTokens.toLocaleString()} tok`}
                             </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-2 text-sm font-semibold text-neutral-700 border-b-2 border-transparent">
                    Translation Result
                  </div>
                )}
              </div>

              {/* Active Result View */}
              <div className="flex-1 p-4 flex flex-col relative">
                <AnimatePresence mode="wait">
                  {activeTabId && loadingModelIds.has(activeTabId) ? (
                    <motion.div 
                      key={`loading-${activeTabId}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-4 flex flex-col items-center justify-center p-8 text-neutral-400 bg-neutral-50 rounded-xl"
                    >
                      <Loader2 size={32} className="animate-spin text-indigo-500 mb-3" />
                      <p className="text-sm font-medium text-neutral-600">Translating with {MODELS.find(m => m.id === activeTabId)?.name}...</p>
                    </motion.div>
                  ) : activeResult ? (
                    <motion.div
                      key={activeResult.modelId}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 flex flex-col h-full relative group"
                    >
                      {activeResult.error ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-red-50/50 rounded-xl border border-red-100 min-h-[300px]">
                          <X size={32} className="text-red-400 mb-2" />
                          <p className="text-sm font-medium text-red-600">{activeResult.error}</p>
                        </div>
                      ) : (
                        <div 
                          className="flex-1 flex items-center justify-center bg-neutral-50 rounded-xl overflow-hidden relative cursor-zoom-in min-h-[300px]"
                          onClick={() => setFullscreenResult(activeResult)}
                        >
                          <img src={activeResult.content} alt={activeResult.modelName} className="w-full h-full object-contain max-h-[60vh]" />
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/40 backdrop-blur-md p-1.5 rounded-lg text-white">
                              <Maximize2 size={16} />
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {!activeResult.error && (
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(activeResult.content, activeResult.modelName);
                            }}
                            className="px-4 py-2 bg-white/90 backdrop-blur-sm text-neutral-800 rounded-lg font-medium flex items-center gap-2 hover:bg-white shadow-lg border border-neutral-200/50 transition-all text-sm"
                          >
                            <Download size={14} />
                            Download
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-4 flex flex-col items-center justify-center p-8 text-neutral-300"
                    >
                      <ImageIcon size={48} className="mb-3 opacity-20" />
                      <p className="text-sm font-medium">Result will appear here</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      </div>

      <AnimatePresence>
        {fullscreenResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4"
            onClick={() => setFullscreenResult(null)}
          >
            <div className="w-full max-w-5xl flex justify-between items-center mb-4 px-4">
              <span className="text-white font-semibold text-lg">{fullscreenResult.modelName}</span>
              <button className="text-white/70 hover:text-white p-2 bg-white/10 rounded-full">
                <X size={24} />
              </button>
            </div>
            <img 
              src={fullscreenResult.content} 
              alt="Fullscreen Result" 
              className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded-lg"
              onClick={(e) => e.stopPropagation()} 
            />
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(fullscreenResult.content, fullscreenResult.modelName);
              }}
              className="mt-6 px-10 py-3 bg-white text-black rounded-xl font-bold flex items-center gap-3 hover:bg-neutral-200 transition-colors"
            >
              <Download size={20} />
              Download High-Res
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
