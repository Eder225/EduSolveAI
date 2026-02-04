
import React, { useState, useRef } from 'react';
import { UploadedFile, AppStatus, Solution } from './types';
import { solveExerciseWithContext } from './services/gemini';

type ViewState = 'UPLOAD' | 'RESOLUTION';

const App: React.FC = () => {
  const [courses, setCourses] = useState<UploadedFile[]>([]);
  const [exercise, setExercise] = useState<UploadedFile | null>(null);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('UPLOAD');
  const [copied, setCopied] = useState(false);

  const courseInputRef = useRef<HTMLInputElement>(null);
  const exerciseInputRef = useRef<HTMLInputElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);

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
      setError("Veuillez uploader au moins un cours et un exercice.");
      return;
    }
    setStatus(AppStatus.PROCESSING);
    setError(null);
    setSolution(null);
    try {
      const result = await solveExerciseWithContext(courses, exercise);
      setSolution({ text: result, timestamp: Date.now() });
      setStatus(AppStatus.SOLVED);
      setCurrentView('RESOLUTION');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || "Erreur lors de la résolution.");
      setStatus(AppStatus.ERROR);
    }
  };

  const downloadPDF = () => {
    if (!solutionRef.current) return;
    
    const element = solutionRef.current;
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Correction_EduSolve_${new Date().toLocaleDateString()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // @ts-ignore
    window.html2pdf().from(element).set(opt).save();
  };

  const copyToClipboard = () => {
    if (!solution) return;
    navigator.clipboard.writeText(solution.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goToUpload = () => {
    setCurrentView('UPLOAD');
    setStatus(AppStatus.IDLE);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-extrabold text-gray-900 border-b-2 border-orange-100">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic text-gray-700">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen pb-20 flex flex-col bg-[#fafafa]">
      {/* Promo Banner Top */}
      <div className="bg-[#1a1a1a] text-white py-2 px-6 text-center text-[10px] font-black uppercase tracking-[0.3em] no-print">
        <span className="opacity-60">Offre Spéciale :</span> Débloquez le mode Illimité avec EduSolve Premium <i className="fas fa-external-link-alt ml-2 text-[#ff4d29]"></i>
      </div>

      {/* Header Premium */}
      <header className="glass-header sticky top-0 z-50 border-b border-gray-100 no-print">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-11 h-11 bg-gradient-to-tr from-[#ff4d29] to-[#ff7b5e] rounded-xl flex items-center justify-center shadow-lg shadow-orange-100 cursor-pointer transition-transform hover:scale-105 active:scale-95" 
              onClick={goToUpload}
            >
              <i className="fas fa-graduation-cap text-white text-xl"></i>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900 cursor-pointer" onClick={goToUpload}>
                EduSolve <span className="text-[#ff4d29]">AI</span>
              </h1>
              <div className="flex items-center space-x-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${status === AppStatus.PROCESSING ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {status === AppStatus.PROCESSING ? 'IA en action' : 'Studio prêt'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
             {currentView === 'RESOLUTION' && (
                <button onClick={goToUpload} className="hidden md:flex text-sm font-bold text-gray-500 hover:text-[#ff4d29]">
                  <i className="fas fa-plus-circle mr-2"></i> Nouveau
                </button>
             )}
             <div className="h-8 w-px bg-gray-200 hidden lg:block"></div>
             <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#ff4d29] shadow-sm">
                <i className="fas fa-bolt"></i>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 mt-12">
        {currentView === 'UPLOAD' ? (
          <div className="animate-in fade-in duration-500">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
              
              {/* Main Upload Area */}
              <div className="xl:col-span-3 space-y-12">
                <div className="flex flex-col lg:flex-row items-stretch gap-8">
                  {/* Courses */}
                  <div className="flex-1 bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 flex flex-col group transition-all hover:shadow-orange-100/30">
                    <div className="p-8 pb-4 flex items-center justify-between">
                      <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">Supports de cours</h2>
                    </div>
                    <div className="p-8 pt-4 flex-1">
                      <div onClick={() => courseInputRef.current?.click()} className="upload-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center space-y-5 cursor-pointer min-h-[300px]">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-50 border border-red-50 group-hover:scale-110 transition-transform">
                          <i className="fas fa-cloud-arrow-up text-[#ff4d29] text-2xl"></i>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-gray-700">Importez vos cours</p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {courses.map(file => (
                            <div key={file.id} className="bg-white border-2 border-orange-50 text-[#ff4d29] text-[10px] px-3 py-2 rounded-xl flex items-center space-x-2 font-bold shadow-sm">
                              <span className="max-w-[80px] truncate">{file.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); setCourses(prev => prev.filter(f => f.id !== file.id)); }}><i className="fas fa-times"></i></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <input type="file" ref={courseInputRef} multiple className="hidden" onChange={(e) => handleFileUpload(e, false)} />
                  </div>

                  {/* Exercise */}
                  <div className="flex-1 bg-white rounded-[2.5rem] shadow-2xl shadow-gray-200/50 border border-gray-100 flex flex-col group transition-all hover:shadow-orange-100/30">
                    <div className="p-8 pb-4 flex items-center space-x-3">
                      <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">Sujet</h2>
                    </div>
                    <div className="p-8 pt-4 flex-1">
                      <div onClick={() => exerciseInputRef.current?.click()} className="upload-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center space-y-5 cursor-pointer min-h-[300px]">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-50 border border-red-50 group-hover:scale-110 transition-transform">
                          <i className="fas fa-file-circle-check text-[#ff4d29] text-2xl"></i>
                        </div>
                        {exercise && (
                          <div className="bg-[#ff4d29] text-white text-[10px] px-5 py-3 rounded-2xl flex items-center space-x-3 shadow-xl font-bold">
                            <span className="max-w-[120px] truncate">{exercise.name}</span>
                            <button onClick={(e) => { e.stopPropagation(); setExercise(null); }}><i className="fas fa-times"></i></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <input type="file" ref={exerciseInputRef} className="hidden" onChange={(e) => handleFileUpload(e, true)} />
                  </div>
                </div>

                {/* Big Action Button */}
                <div className="flex flex-col items-center space-y-8 py-4">
                  <button
                    onClick={handleSolve}
                    disabled={status === AppStatus.PROCESSING || courses.length === 0 || !exercise}
                    className={`group px-32 py-7 rounded-[2.5rem] text-2xl font-black text-white shadow-2xl transition-all active:scale-[0.96] ${
                      status === AppStatus.PROCESSING || courses.length === 0 || !exercise
                      ? 'bg-gray-200 cursor-not-allowed opacity-50'
                      : 'bg-gradient-to-r from-[#ff4d29] to-[#ff7b5e] hover:shadow-orange-200/60 hover:-translate-y-1'
                    }`}
                  >
                    {status === AppStatus.PROCESSING ? 'ANALYSE...' : 'RÉSOUDRE'}
                  </button>
                  {error && <p className="text-red-500 font-bold">{error}</p>}
                </div>
              </div>

              {/* Sidebar Ad Display */}
              <div className="xl:col-span-1 space-y-6 no-print">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                    <i className="fas fa-rocket text-8xl"></i>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full mb-6 inline-block">Sponsorisé</span>
                  <h3 className="text-2xl font-black leading-tight mb-4">Besoin de cours particuliers ?</h3>
                  <p className="text-white/80 text-sm mb-6 font-medium leading-relaxed">Trouvez un tuteur certifié en moins de 5 minutes pour vous accompagner dans vos révisions.</p>
                  <button className="w-full py-4 bg-white text-indigo-700 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-100 transition-colors">Découvrir l'offre</button>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-[#ff4d29] text-2xl mb-4">
                    <i className="fas fa-mobile-alt"></i>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-2">EduSolve Mobile</h4>
                  <p className="text-gray-400 text-xs font-medium mb-6">Emportez votre tuteur partout avec vous. Disponible sur iOS et Android.</p>
                  <div className="flex space-x-2">
                    <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center text-white"><i className="fab fa-apple"></i></div>
                    <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center text-white"><i className="fab fa-google-play text-[10px]"></i></div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Resolution View */
          <div className="animate-in fade-in slide-in-from-right-10 duration-700 max-w-5xl mx-auto">
            {solution && (
              <div id="solution-section">
                <div className="bg-white rounded-[3.5rem] shadow-2xl overflow-hidden border border-gray-100 mb-16">
                  
                  {/* Floating Action Bar */}
                  <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-20 z-40 no-print">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center text-2xl"><i className="fas fa-check-double"></i></div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">Correction</h2>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button onClick={copyToClipboard} className={`px-6 py-4 rounded-2xl font-bold text-xs uppercase border-2 ${copied ? 'bg-emerald-50 text-emerald-600 border-emerald-500' : 'bg-white border-gray-100'}`}>
                        {copied ? 'Copié' : 'Copier'}
                      </button>
                      <button onClick={downloadPDF} className="px-10 py-4 bg-[#1a1a1a] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl">Exporter</button>
                    </div>
                  </div>

                  <div ref={solutionRef} className="p-10 md:p-20 bg-white overflow-hidden">
                    <div className="prose prose-2xl max-w-none text-gray-800">
                      {solution.text.split('\n').map((line, i) => {
                        // Injection d'une publicité contextuelle entre les sections
                        if (line.startsWith('# 2.')) {
                          return (
                            <React.Fragment key={i}>
                              <div className="my-16 no-print bg-[#fffaf9] border-2 border-dashed border-[#ff4d29]/20 rounded-[2.5rem] p-10 text-center flex flex-col items-center">
                                <span className="text-[10px] font-black text-[#ff4d29]/40 uppercase tracking-[0.4em] mb-4">Espace Partenaire</span>
                                <h4 className="text-2xl font-black text-gray-900 mb-2">Maîtrisez le Développement Web</h4>
                                <p className="text-gray-500 text-lg mb-8 max-w-md">Inscrivez-vous à notre Bootcamp intensif et devenez développeur Fullstack en 12 semaines.</p>
                                <button className="px-12 py-4 bg-[#ff4d29] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-100">En savoir plus</button>
                              </div>
                              <div className="mt-24 mb-16 p-12 rounded-[3rem] bg-gradient-to-br from-emerald-500 to-teal-400 border-l-[16px] border-emerald-700 text-white shadow-2xl page-break-avoid">
                                <h1 className="text-5xl font-black m-0 uppercase tracking-tighter flex items-center">
                                  <i className="fas fa-brain mr-6 text-4xl opacity-80"></i>
                                  {line.replace('# ', '')}
                                </h1>
                              </div>
                            </React.Fragment>
                          );
                        }
                        
                        if (line.startsWith('# 1.')) {
                          return (
                            <div key={i} className="mb-16 p-12 rounded-[3rem] bg-gradient-to-br from-[#ff4d29] to-[#ff7b5e] border-l-[16px] border-[#cc3d21] text-white shadow-2xl page-break-avoid">
                              <h1 className="text-5xl font-black m-0 uppercase tracking-tighter flex items-center">
                                <i className="fas fa-award mr-6 text-4xl opacity-80"></i>
                                {line.replace('# ', '')}
                              </h1>
                            </div>
                          );
                        }
                        
                        if (line.startsWith('## ')) return <h2 key={i} className="text-3xl font-black text-gray-900 mt-20 mb-10 border-b-8 border-[#ff4d29]/10 pb-6 tracking-tight">{line.replace('## ', '')}</h2>;
                        if (line.match(/^\d+\. /)) return <div key={i} className="text-2xl font-black text-[#ff4d29] mt-12 mb-6 border-l-8 border-[#ff4d29] pl-8 py-2">{renderFormattedText(line)}</div>;
                        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) return (
                          <div key={i} className="ml-8 text-gray-700 mb-5 text-xl flex items-start page-break-avoid">
                            <span className="mt-2.5 mr-5 w-3 h-3 rounded-full bg-orange-200 flex-shrink-0"></span>
                            <span className="font-medium leading-relaxed">{renderFormattedText(line.trim().substring(2))}</span>
                          </div>
                        );
                        if (line.includes('`')) return (
                          <div key={i} className="my-12 bg-[#0d1117] p-10 rounded-[2.5rem] font-mono text-lg text-[#e6edf3] overflow-x-auto border-[6px] border-[#161b22] shadow-2xl">
                             <div className="leading-relaxed">{line.split('`').map((part, index) => index % 2 === 1 ? <span key={index} className="text-[#79c0ff] font-bold">{part}</span> : part)}</div>
                          </div>
                        );
                        if (line.trim() === '') return <div key={i} className="h-8" />;
                        return <p key={i} className="text-gray-700 leading-relaxed text-2xl mb-10 font-medium">{renderFormattedText(line)}</p>;
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Application */}
      <footer className="mt-auto border-t border-gray-100 pt-20 pb-12 bg-white no-print">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center space-x-3 text-gray-900 font-black mb-8">
             <span className="text-xl tracking-tight">EduSolve <span className="text-[#ff4d29]">AI</span></span>
          </div>
          <div className="text-[11px] font-black uppercase tracking-[0.5em] text-gray-300">
            © 2025 EduSolve AI — Intelligence Contextuelle
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
