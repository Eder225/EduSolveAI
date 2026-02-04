
import React, { useState, useRef, useEffect } from 'react';
import { UploadedFile, AppStatus, Solution, ChatMessage } from './types.ts';
import { solveExerciseWithContext, startAssistantChat } from './services/gemini.ts';

type ViewState = 'UPLOAD' | 'RESOLUTION';

const App: React.FC = () => {
  const [courses, setCourses] = useState<UploadedFile[]>([]);
  const [exercise, setExercise] = useState<UploadedFile | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('UPLOAD');
  const [copied, setCopied] = useState(false);
  const [openExplanations, setOpenExplanations] = useState<Record<number, boolean>>({});
  
  // Chat Assistant States
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const courseInputRef = useRef<HTMLInputElement>(null);
  const exerciseInputRef = useRef<HTMLInputElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isExercise: boolean) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type || 'application/octet-stream',
        base64: fileData,
        size: file.size,
      });
    }

    if (isExercise) {
      setExercise(newFiles[0]);
    } else {
      setCourses(prev => [...prev, ...newFiles]);
    }
    if (e.target) e.target.value = '';
  };

  const handleSolve = async () => {
    if (courses.length === 0 || !exercise) {
      setError("Importez vos cours et votre exercice.");
      return;
    }
    setStatus(AppStatus.PROCESSING);
    setError(null);
    setSolution(null);
    setOpenExplanations({});
    setChatMessages([]);
    try {
      const result = await solveExerciseWithContext(courses, exercise);
      setSolution({ text: result, timestamp: Date.now() });
      setStatus(AppStatus.SOLVED);
      setCurrentView('RESOLUTION');
      chatSessionRef.current = startAssistantChat(courses, result);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || "Erreur de résolution.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !chatSessionRef.current || isChatLoading) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessage({ message: userMessage });
      setChatMessages(prev => [...prev, { role: 'model', text: result.text }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'model', text: "Désolé, j'ai rencontré une erreur en réfléchissant. Pouvez-vous répéter ?" }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!solution) return;
    navigator.clipboard.writeText(solution.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadPDF = () => {
    if (!solutionRef.current) return;
    const backup = { ...openExplanations };
    const allOpen: Record<number, boolean> = {};
    for (let i = 0; i < 100; i++) allOpen[i] = true;
    setOpenExplanations(allOpen);

    setTimeout(() => {
      const element = solutionRef.current;
      const opt = {
        margin: [10, 10, 15, 10],
        filename: `Correction_Expert_EduSolve.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // @ts-ignore
      window.html2pdf().from(element).set(opt).save().then(() => {
        setOpenExplanations(backup);
      });
    }, 600);
  };

  const toggleExplanation = (index: number) => {
    setOpenExplanations(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-extrabold text-gray-900">{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*')) return <em key={i} className="italic text-gray-600">{part.slice(1, -1)}</em>;
      return part;
    });
  };

  const renderSolutionContent = () => {
    if (!solution) return null;

    const lines = solution.text.split('\n');
    const content: React.ReactNode[] = [];
    let currentQuestionIdx = 0;
    let insideExpl = false;
    let explBuffer: string[] = [];

    lines.forEach((line, i) => {
      const trimmedLine = line.trim();

      if (trimmedLine.includes('[[EXPLICATION]]')) {
        insideExpl = true;
        return;
      }
      if (trimmedLine.includes('[[/EXPLICATION]]')) {
        insideExpl = false;
        const qIdx = currentQuestionIdx;
        const text = explBuffer.join('\n');
        content.push(
          <div 
            key={`expl-${i}`} 
            className={`mt-4 mb-10 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${openExplanations[qIdx] ? 'max-h-[3000px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-4'} print:max-h-none print:opacity-100 print:translate-y-0 print:mb-12`}
          >
            <div className="bg-orange-50/40 border-l-4 border-[#ff4d29] p-8 md:p-10 rounded-r-[2.5rem] shadow-sm relative group/expl">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-[#ff4d29]">
                  <i className="fas fa-brain text-sm"></i>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff4d29]/60">Analyse de l'expert</span>
              </div>
              <div className="prose prose-lg text-gray-700 leading-relaxed font-medium">
                {text.split('\n').map((l, idx) => (
                  <p key={idx} className="mb-4 last:mb-0">{renderFormattedText(l)}</p>
                ))}
              </div>
            </div>
          </div>
        );
        explBuffer = [];
        return;
      }

      if (insideExpl) {
        explBuffer.push(line);
        return;
      }

      if (trimmedLine.startsWith('# 1.')) {
        content.push(<h1 key={i} className="text-4xl font-black text-[#ff4d29] mb-12 mt-6 uppercase tracking-tighter border-b-8 border-orange-50 pb-6">{line.replace('# ', '')}</h1>);
        return;
      }
      if (trimmedLine.startsWith('# 2.')) {
        content.push(<h1 key={i} className="text-4xl font-black text-gray-900 mt-24 mb-12 uppercase tracking-tighter border-b-8 border-gray-100 pb-6 page-break-before-always">{line.replace('# ', '')}</h1>);
        return;
      }

      if (trimmedLine.startsWith('## ')) {
        currentQuestionIdx++;
        const qIdx = currentQuestionIdx;
        content.push(
          <div key={i} className="mt-16 mb-8 flex items-center justify-between group/q page-break-after-avoid">
            <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center leading-tight">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff4d29] mr-5 flex-shrink-0"></span>
              {line.replace('## ', '')}
            </h2>
            <button 
              onClick={() => toggleExplanation(qIdx)}
              className={`no-print flex-shrink-0 ml-6 w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-90 ${openExplanations[qIdx] ? 'bg-[#ff4d29] text-white shadow-orange-200' : 'bg-white text-gray-300 hover:text-[#ff4d29] border border-gray-100 hover:border-orange-100'}`}
            >
              <i className={`fas fa-bell ${openExplanations[qIdx] ? 'animate-none' : 'group-hover/q:animate-[swing_1s_ease-in-out_infinite]'}`}></i>
            </button>
          </div>
        );
        return;
      }

      if (trimmedLine.match(/^\d+\. /)) {
        content.push(<div key={i} className="mt-8 mb-4 font-extrabold text-gray-900 text-xl border-l-4 border-gray-50 pl-6 py-2">{renderFormattedText(line)}</div>);
      } else if (trimmedLine.includes('`')) {
        content.push(
          <div key={i} className="my-8 bg-[#1a1a1a] p-8 rounded-[2rem] font-mono text-sm text-orange-200 overflow-x-auto border-l-[12px] border-[#ff4d29] shadow-2xl page-break-inside-avoid">
            {line.split('`').map((part, index) => index % 2 === 1 ? <span key={index} className="text-white font-black">{part}</span> : part)}
          </div>
        );
      } else if (trimmedLine !== '') {
        content.push(<p key={i} className="text-gray-700 text-lg mb-6 leading-relaxed page-break-inside-avoid">{renderFormattedText(line)}</p>);
      }
    });

    return content;
  };

  return (
    <div className="min-h-screen pb-20 flex flex-col bg-[#fafafa]">
      <style>{`
        @keyframes swing {
          0% { transform: rotate(0deg); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-15deg); }
          60% { transform: rotate(10deg); }
          80% { transform: rotate(-10deg); }
          100% { transform: rotate(0deg); }
        }
        @media print {
          .page-break-before-always { page-break-before: always !important; }
          .page-break-after-avoid { page-break-after: avoid !important; }
          .page-break-inside-avoid { page-break-inside: avoid !important; }
          body { font-size: 12pt; }
          h1 { color: #ff4d29 !important; border-bottom: 2pt solid #ff4d29 !important; padding-bottom: 5pt !important; }
          h2 { border-left: 3pt solid #ff4d29 !important; padding-left: 10pt !important; }
        }
      `}</style>

      <div className="bg-[#1a1a1a] text-white py-2.5 px-6 text-center text-[10px] font-black uppercase tracking-[0.4em] no-print">
        <span className="text-[#ff4d29]">Deep Context Analysis</span> — v3.5 Stable Engine
      </div>

      <header className="glass-header sticky top-0 z-50 border-b border-gray-100 no-print">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setCurrentView('UPLOAD')}>
            <div className="w-11 h-11 bg-gradient-to-tr from-[#ff4d29] to-[#ff7b5e] rounded-xl flex items-center justify-center shadow-lg shadow-orange-100 group-hover:scale-105 transition-transform">
              <i className="fas fa-graduation-cap text-white text-lg"></i>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter">EduSolve <span className="text-[#ff4d29]">Expert</span></h1>
          </div>
          
          <div className="flex items-center space-x-6">
             {currentView === 'RESOLUTION' && (
                <button onClick={() => setCurrentView('UPLOAD')} className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-[#ff4d29] transition-colors">Nouveau</button>
             )}
             <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-300 shadow-sm"><i className="fas fa-shield-halved text-xs"></i></div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 mt-16">
        {currentView === 'UPLOAD' ? (
          <div className="animate-in fade-in duration-700 py-10">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-gray-900 mb-6 tracking-tight">Le Tuteur de Demain.</h2>
              <p className="text-gray-400 font-semibold text-lg max-w-xl mx-auto">Importez vos cours (PDF/Txt) et laissez l'IA générer une correction augmentée et interactive.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-16">
              <div onClick={() => courseInputRef.current?.click()} className="upload-dashed p-14 rounded-[3rem] flex flex-col items-center justify-center text-center cursor-pointer group hover:shadow-2xl hover:shadow-orange-100 transition-all">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-[#ff4d29] mb-8 group-hover:scale-110 transition-transform">
                  <i className="fas fa-layer-group text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-800">Supports de Cours</h3>
                <p className="text-sm text-gray-400 font-medium mb-6">Ajoutez les documents sur lesquels l'IA doit s'appuyer.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {courses.map(f => <span key={f.id} className="text-[10px] bg-[#ff4d29] text-white px-3 py-1.5 rounded-xl font-black shadow-sm">{f.name}</span>)}
                </div>
                <input type="file" ref={courseInputRef} multiple className="hidden" onChange={(e) => handleFileUpload(e, false)} />
              </div>

              <div onClick={() => exerciseInputRef.current?.click()} className="bg-white border-2 border-gray-100 p-14 rounded-[3rem] flex flex-col items-center justify-center text-center cursor-pointer group hover:border-[#ff4d29]/40 hover:shadow-2xl transition-all">
                <div className="w-20 h-20 bg-gray-50 rounded-3xl shadow-inner flex items-center justify-center text-gray-400 mb-8 group-hover:text-gray-900 transition-colors">
                  <i className="fas fa-edit text-2xl"></i>
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-800">Sujet de l'Exercice</h3>
                <p className="text-sm text-gray-400 font-medium mb-6">L'énoncé complet que vous souhaitez résoudre.</p>
                {exercise && <span className="text-[10px] bg-black text-white px-4 py-2 rounded-xl font-black shadow-lg">{exercise.name}</span>}
                <input type="file" ref={exerciseInputRef} className="hidden" onChange={(e) => handleFileUpload(e, true)} />
              </div>
            </div>

            <div className="flex flex-col items-center space-y-8">
              <button
                onClick={handleSolve}
                disabled={status === AppStatus.PROCESSING || courses.length === 0 || !exercise}
                className={`group px-24 py-7 rounded-[2rem] text-xl font-black tracking-widest uppercase transition-all shadow-2xl active:scale-95 ${
                  status === AppStatus.PROCESSING || courses.length === 0 || !exercise
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed shadow-none'
                  : 'bg-[#ff4d29] text-white hover:bg-black hover:shadow-orange-200'
                }`}
              >
                {status === AppStatus.PROCESSING ? (
                  <span className="flex items-center"><i className="fas fa-circle-notch animate-spin mr-4"></i> ANALYSE EN COURS...</span>
                ) : 'DÉBUTER LA CORRECTION'}
              </button>
              {error && <div className="bg-red-50 text-red-500 px-6 py-3 rounded-2xl font-bold text-sm border border-red-100">{error}</div>}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="flex items-center justify-between mb-16 no-print">
               <div className="flex items-center space-x-5">
                  <div className="w-14 h-14 bg-emerald-500 rounded-[1.25rem] flex items-center justify-center text-white text-2xl shadow-xl shadow-emerald-50">
                    <i className="fas fa-check-double"></i>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter text-gray-900">Rapport de Correction</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Précision garantie par IA Contextuelle</p>
                  </div>
               </div>
               <div className="flex space-x-3">
                  <button onClick={copyToClipboard} className={`p-5 rounded-2xl transition-all shadow-sm flex items-center justify-center ${copied ? 'bg-emerald-50 text-emerald-600' : 'bg-white border border-gray-100 text-gray-400 hover:text-[#ff4d29]'}`}>
                    <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                  </button>
                  <button onClick={downloadPDF} className="px-12 py-5 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-[#ff4d29] transition-all">Export PDF Expert</button>
               </div>
            </div>

            <div ref={solutionRef} className="bg-white rounded-[4rem] shadow-2xl p-12 md:p-24 border border-gray-50 overflow-hidden text-gray-900 leading-relaxed print:shadow-none print:border-none print:p-0 print:m-0">
               <div className="max-w-4xl mx-auto">
                  {renderSolutionContent()}
                  
                  <div className="mt-32 pt-12 border-t border-gray-100 flex flex-col items-center space-y-4 opacity-40 print:mt-10">
                     <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center"><i className="fas fa-graduation-cap text-gray-300"></i></div>
                     <p className="text-[10px] font-black uppercase tracking-[0.8em] text-gray-400">EduSolve AI — Expertise Pédagogique 2025</p>
                  </div>
               </div>
            </div>

            {/* Assistant Chat Section */}
            <div className="mt-16 no-print">
              <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-50 overflow-hidden">
                <div className="bg-[#1a1a1a] p-8 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-[#ff4d29] rounded-full flex items-center justify-center text-white">
                      <i className="fas fa-robot"></i>
                    </div>
                    <div>
                      <h3 className="text-white font-black text-lg">Assistant Personnel</h3>
                      <p className="text-[#ff4d29] text-[10px] font-bold uppercase tracking-widest">Expert en ligne</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Connecté</span>
                  </div>
                </div>

                <div className="h-[400px] overflow-y-auto p-8 space-y-6 bg-[#fafafa]/50">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                      <i className="fas fa-comments text-4xl mb-4 text-gray-300"></i>
                      <p className="font-bold text-gray-400">Une question sur la correction ? Posez-la ici.</p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-6 rounded-[2rem] shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-[#ff4d29] text-white rounded-tr-none' 
                        : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                      }`}>
                        <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-100 p-6 rounded-[2rem] rounded-tl-none shadow-sm flex items-center space-x-2">
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-100"></span>
                        <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce delay-200"></span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-gray-50 flex items-center space-x-4">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Posez votre question à l'assistant..."
                    className="flex-1 bg-gray-50 border-none px-6 py-4 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-[#ff4d29]/20 transition-all outline-none"
                    disabled={isChatLoading}
                  />
                  <button
                    type="submit"
                    disabled={isChatLoading || !chatInput.trim()}
                    className="w-14 h-14 bg-[#ff4d29] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-100 hover:bg-black transition-all disabled:opacity-50"
                  >
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 pb-16 text-center no-print opacity-20">
         <div className="text-[9px] font-black uppercase tracking-[1em] text-gray-900">Beyond Traditional Learning</div>
      </footer>
    </div>
  );
};

export default App;
