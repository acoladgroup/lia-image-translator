import { ArrowRight, Check, ChevronDown, Copy, Download, Image as ImageIcon, Loader2, Lock, LogOut, Maximize2, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { MODELS } from './services/models';
import { detectLanguage, setAuthToken, setOnAuthExpired, translateImage, TranslationResult } from './services/translator';


const LANGUAGES = [
  'English', 'French', 'German', 'Dutch', 'Spanish', 'Italian', 
  'Portuguese', 'Chinese', 'Japanese', 'Korean', 'Arabic'
];

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        localStorage.setItem('auth_token', password);
        setAuthToken(password);
        onLogin();
      } else {
        setError('Invalid password');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-neutral-200 p-8">
          <div className="flex justify-center mb-6">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center">
              <Lock size={18} />
            </div>
          </div>
          <h1 className="text-lg font-semibold text-center mb-1">Image Translator</h1>
          <p className="text-sm text-neutral-400 text-center mb-6">Enter the access password</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 mb-3"
          />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <button
            type="submit"
            disabled={!password || loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-md font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enter'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function CostBar({ result }: { result: TranslationResult }) {
  const [copied, setCopied] = useState(false);
  const isGoogle = typeof result.inputCost !== 'undefined' && typeof result.outputCost !== 'undefined';

  const copyText = isGoogle && result.usage
    ? `in ${result.usage.promptTokens} tok ($${result.inputCost}) + out ${result.usage.completionTokens} tok ($${result.outputCost}) = $${result.cost}`
    : result.cost && result.cost !== 'Free tier'
      ? `$${result.cost}`
      : 'Free';

  const handleCopy = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mb-1.5 px-3 py-1.5 bg-neutral-50 border border-neutral-100 rounded-lg flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-mono flex-wrap">
        {isGoogle && result.usage ? (
          <>
            <span><span className="text-neutral-400">in</span> {result.usage.promptTokens.toLocaleString()} tok <span className="text-neutral-300 mx-1">·</span> <span className="text-neutral-600">${result.inputCost}</span></span>
            <span className="text-neutral-300">+</span>
            <span><span className="text-neutral-400">out</span> {result.usage.completionTokens.toLocaleString()} tok <span className="text-neutral-300 mx-1">·</span> <span className="text-neutral-600">${result.outputCost}</span></span>
            <span className="text-neutral-300">=</span>
            <span className="text-neutral-800 font-semibold">${result.cost}</span>
          </>
        ) : (
          <span className="text-neutral-800 font-semibold">
            {result.cost === 'Free tier' ? 'Free' : `$${result.cost}`}
            {result.usage && <span className="text-neutral-400 font-normal ml-2">{result.usage.totalTokens.toLocaleString()} tok</span>}
          </span>
        )}
      </div>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors shrink-0"
        title="Copy cost breakdown"
      >
        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => {
    const token = localStorage.getItem('auth_token');
    if (token) setAuthToken(token);
    return !!token;
  });

  useEffect(() => {
    setOnAuthExpired(() => setAuthed(false));
  }, []);
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
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

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
    setDetectedLang(null);

    setIsDetecting(true);
    detectLanguage(selectedFile)
      .then((lang) => setDetectedLang(lang))
      .catch(() => setDetectedLang(null))
      .finally(() => setIsDetecting(false));
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
    
    const resolvedLang = sourceLang === 'Auto-detect' && detectedLang ? detectedLang : sourceLang;

    const translationPromises = selectedModels.map(async (model) => {
      try {
        const result = await translateImage(file, resolvedLang, targetLang, model);
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
    const ext = imageUrl.startsWith('data:image/png') ? '.png' : imageUrl.startsWith('data:image/jpeg') ? '.jpg' : '.png';
    const baseName = (file?.name || 'image').replace(/\.[^.]+$/, '');
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `translated_${modelName.replace(/\s+/g, '_')}_${baseName}${ext}`;
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

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setAuthToken('');
    setAuthed(false);
  };

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="h-screen overflow-hidden bg-neutral-50 text-neutral-900 font-sans flex flex-col">
      {/* Toolbar — centered controls, connected to content */}
      <div className="bg-white border-b border-neutral-200 px-4 py-2 relative">
        <div className="max-w-[1600px] mx-auto flex items-center justify-center gap-2.5">
          <div className="relative">
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="pl-3 pr-7 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            >
              <option value="Auto-detect">
                {isDetecting ? 'Detecting...' : detectedLang && sourceLang === 'Auto-detect' ? `Auto (${detectedLang})` : 'Auto-detect'}
              </option>
              {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
            </select>
            {isDetecting && <Loader2 size={12} className="absolute right-6 top-1/2 -translate-y-1/2 animate-spin text-indigo-400" />}
          </div>

          <ArrowRight size={14} className="text-neutral-300 shrink-0" />

          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="pl-3 pr-7 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
          >
            {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
          </select>

          <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="pl-3 pr-7 py-1.5 bg-neutral-50 border border-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium flex items-center gap-2 text-left relative"
            >
              <span className="truncate text-neutral-700 max-w-[160px]">
                {selectedModelIds.length === 0 ? "Models..." :
                 selectedModelIds.length === 1 ? MODELS.find(m => m.id === selectedModelIds[0])?.name :
                 `${selectedModelIds.length} models`}
              </span>
              <ChevronDown size={13} className={`absolute right-2 text-neutral-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isModelDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute z-10 mt-1.5 w-60 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
                >
                  <div className="max-h-56 overflow-y-auto p-1 flex flex-col gap-px">
                    {MODELS.map(model => (
                      <button
                        key={model.id}
                        onClick={() => toggleModel(model.id)}
                        className="w-full px-2.5 py-1.5 rounded text-sm font-medium transition-all flex items-center gap-2 hover:bg-neutral-50 text-left"
                      >
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
                          selectedModelIds.includes(model.id)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-neutral-300 bg-white'
                        }`}>
                          {selectedModelIds.includes(model.id) && <Check size={10} strokeWidth={3} />}
                        </div>
                        <span className={selectedModelIds.includes(model.id) ? 'text-neutral-900' : 'text-neutral-500'}>{model.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleTranslate}
            disabled={!file || isTranslating || isDetecting || selectedModelIds.length === 0}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white rounded-md font-semibold text-sm flex items-center gap-1.5 transition-all"
          >
            {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <>Translate <ArrowRight size={13} /></>}
          </button>

          {error && <span className="text-red-500 text-xs ml-1">{error}</span>}

          <button onClick={handleLogout} className="absolute right-4 text-neutral-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors" title="Logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Two-column content — fills remaining viewport, no scroll */}
      <div className="flex-1 min-h-0 p-3">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-3 h-full">

          {/* Source */}
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden flex flex-col min-h-0">
            <div className="px-3 py-1.5 border-b border-neutral-100 flex justify-between items-center shrink-0">
              <h2 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Source</h2>
              {file && (
                <button
                  onClick={() => { setFile(null); setPreviewUrl(null); setResults([]); setDetectedLang(null); }}
                  className="text-neutral-400 hover:text-neutral-600 p-0.5 rounded hover:bg-neutral-100 transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex-1 p-2 flex flex-col min-h-0">
              {!previewUrl ? (
                <div
                  className="flex-1 border border-dashed border-neutral-200 rounded-lg flex flex-col items-center justify-center p-6 text-center hover:bg-neutral-50 hover:border-neutral-300 transition-colors cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-lg flex items-center justify-center mb-2.5">
                    <Upload size={18} />
                  </div>
                  <h3 className="text-sm font-medium mb-0.5">Upload original</h3>
                  <p className="text-neutral-400 text-xs">PNG, JPG, or PDF — max 50 MB</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, application/pdf"
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-neutral-50 rounded-lg overflow-hidden min-h-0">
                  {file?.type === 'application/pdf' ? (
                    <object data={previewUrl} type="application/pdf" className="w-full h-full rounded" />
                  ) : (
                    <img src={previewUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden flex flex-col min-h-0">
            <div className="px-2 pt-1.5 border-b border-neutral-100 flex gap-1 overflow-x-auto no-scrollbar shrink-0">
              {isTranslating || results.length > 0 ? (
                MODELS.filter(m => selectedModelIds.includes(m.id) || results.some(r => r.modelId === m.id)).map((model) => {
                  const result = results.find(r => r.modelId === model.id);
                  const isLoading = loadingModelIds.has(model.id);
                  const isGoogle = model.provider === 'google';
                  return (
                    <button
                      key={model.id}
                      onClick={() => setActiveTabId(model.id)}
                      className={`px-2.5 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                        activeTabId === model.id
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-neutral-400 hover:text-neutral-600'
                      }`}
                    >
                      {isLoading && <Loader2 size={10} className="animate-spin text-indigo-400" />}
                      {!isLoading && result && !result.error && <div className={`w-1.5 h-1.5 rounded-full ${activeTabId === model.id ? 'bg-indigo-500' : 'bg-green-500'}`} />}
                      {!isLoading && result?.error && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span className="flex flex-col items-start">
                        <span>{model.name}</span>
                        {result && !result.error && (result.cost || result.detectedLang) && (
                          <span className={`text-[9px] font-normal tracking-wide ${activeTabId === model.id ? 'text-indigo-400' : 'text-neutral-400'}`}>
                            {result.detectedLang && `${result.detectedLang}${result.cost ? ' · ' : ''}`}
                            {result.cost && (result.cost === 'Free tier' ? 'Free' : `$${result.cost}`)}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider border-b-2 border-transparent">
                  Result
                </div>
              )}
            </div>

            <div className="flex-1 p-2 flex flex-col relative min-h-0">
              <AnimatePresence mode="wait">
                {activeTabId && loadingModelIds.has(activeTabId) ? (
                  <motion.div
                    key={`loading-${activeTabId}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-2 flex flex-col items-center justify-center text-neutral-400 bg-neutral-50 rounded-lg"
                  >
                    <Loader2 size={24} className="animate-spin text-indigo-500 mb-2" />
                    <p className="text-xs font-medium text-neutral-500">Translating with {MODELS.find(m => m.id === activeTabId)?.name}...</p>
                  </motion.div>
                ) : activeResult ? (
                  <motion.div
                    key={activeResult.modelId}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 flex flex-col h-full relative group min-h-0"
                  >
                    {!activeResult.error && (activeResult.usage || activeResult.cost) && (
                      <CostBar result={activeResult} />
                    )}

                    {activeResult.error ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center bg-red-50/50 rounded-lg border border-red-100">
                        <X size={20} className="text-red-400 mb-1" />
                        <p className="text-xs font-medium text-red-600 max-w-md">{activeResult.error}</p>
                      </div>
                    ) : (
                      <div
                        className="flex-1 flex items-center justify-center bg-neutral-50 rounded-lg overflow-hidden relative cursor-zoom-in min-h-0"
                        onClick={() => setFullscreenResult(activeResult)}
                      >
                        <img src={activeResult.content} alt={activeResult.modelName} className="max-w-full max-h-full object-contain" />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-black/40 backdrop-blur-md p-1 rounded text-white"><Maximize2 size={13} /></div>
                        </div>
                      </div>
                    )}

                    {!activeResult.error && (
                      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownload(activeResult.content, activeResult.modelName); }}
                          className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-neutral-800 rounded font-medium flex items-center gap-1.5 hover:bg-white shadow-lg border border-neutral-200/50 transition-all text-xs"
                        >
                          <Download size={11} />
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
                    className="absolute inset-2 flex flex-col items-center justify-center text-neutral-300"
                  >
                    <ImageIcon size={36} className="mb-2 opacity-15" />
                    <p className="text-xs font-medium">Result will appear here</p>
                  </motion.div>
                )}
              </AnimatePresence>
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
              <button className="text-white/70 hover:text-white p-1.5 bg-white/10 rounded">
                <X size={20} />
              </button>
            </div>
            <img 
              src={fullscreenResult.content} 
              alt="Fullscreen Result" 
              className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded"
              onClick={(e) => e.stopPropagation()} 
            />
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(fullscreenResult.content, fullscreenResult.modelName);
              }}
              className="mt-4 px-8 py-2.5 bg-white text-black rounded-md font-semibold text-sm flex items-center gap-2.5 hover:bg-neutral-200 transition-colors"
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
