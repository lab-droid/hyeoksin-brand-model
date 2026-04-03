import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Upload, Image as ImageIcon, Sparkles, Loader2, X, Download, Key, Info, DollarSign, ExternalLink, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

function MainApp() {
  // Basic Info
  const [gender, setGender] = useState('');
  const [height, setHeight] = useState('');
  const [race, setRace] = useState('');
  const [age, setAge] = useState('');
  const [bodyType, setBodyType] = useState('');
  
  // Face & Hair
  const [facialImpression, setFacialImpression] = useState('');
  const [expression, setExpression] = useState('');
  const [hairstyle, setHairstyle] = useState('');
  
  // Style & Direction
  const [overallMood, setOverallMood] = useState('');
  const [clothingStyle, setClothingStyle] = useState('');
  const [pose, setPose] = useState('');
  
  // Environment
  const [background, setBackground] = useState('');
  const [lighting, setLighting] = useState('');
  const [photoshootStyle, setPhotoshootStyle] = useState('');
  const [aspectRatio, setAspectRatio] = useState('3:4');
  
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  
  const [benchmarkImage, setBenchmarkImage] = useState<File | null>(null);
  const [benchmarkImagePreview, setBenchmarkImagePreview] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // API Settings
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [manualApiKey, setManualApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [tempApiKey, setTempApiKey] = useState(manualApiKey);

  const saveApiKey = () => {
    setManualApiKey(tempApiKey);
    localStorage.setItem('GEMINI_API_KEY', tempApiKey);
    setShowApiKeyModal(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'benchmark') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'product') {
        setProductImage(file);
        setProductImagePreview(reader.result as string);
      } else {
        setBenchmarkImage(file);
        setBenchmarkImagePreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (type: 'product' | 'benchmark') => {
    if (type === 'product') {
      setProductImage(null);
      setProductImagePreview(null);
    } else {
      setBenchmarkImage(null);
      setBenchmarkImagePreview(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerate = async () => {
    if (!productImage) {
      setError('상품 이미지를 업로드해주세요.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      // @ts-ignore
      const envApiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : process.env.GEMINI_API_KEY;
      const apiKey = manualApiKey || envApiKey;

      if (!apiKey) {
        setError('API 키가 설정되지 않았습니다. 우측 상단 [API 키 설정] 버튼을 눌러 키를 입력해주세요.');
        setIsGenerating(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const parts: any[] = [];

      const productBase64 = await fileToBase64(productImage);
      parts.push({
        inlineData: {
          data: productBase64,
          mimeType: productImage.type,
        },
      });

      let promptText = `Generate a highly attractive and professional brand model image.
Model characteristics:
${gender ? `- Gender: ${gender}\n` : ''}${height ? `- Height: ${height}\n` : ''}${race ? `- Race/Ethnicity: ${race}\n` : ''}${age ? `- Age: ${age}\n` : ''}${bodyType ? `- Body Type: ${bodyType}\n` : ''}${facialImpression ? `- Facial Impression: ${facialImpression}\n` : ''}${hairstyle ? `- Hairstyle/Color: ${hairstyle}\n` : ''}${expression ? `- Eyes/Expression: ${expression}\n` : ''}${overallMood ? `- Overall Mood: ${overallMood}\n` : ''}${clothingStyle ? `- Clothing Style: ${clothingStyle}\n` : ''}${pose ? `- Pose: ${pose}\n` : ''}${background ? `- Background: ${background}\n` : ''}${lighting ? `- Lighting: ${lighting}\n` : ''}${photoshootStyle ? `- Photoshoot Style/Concept: ${photoshootStyle}\n` : ''}
The first attached image is the product image. The model MUST be naturally wearing, holding, or interacting with this product in a commercial photography style. `;

      if (benchmarkImage) {
        const benchmarkBase64 = await fileToBase64(benchmarkImage);
        parts.push({
          inlineData: {
            data: benchmarkBase64,
            mimeType: benchmarkImage.type,
          },
        });
        promptText += `The second attached image is the benchmarking concept. Please strictly copy its style, lighting, mood, tone and manner, and overall aesthetic. IMPORTANT: DO NOT copy the face from the benchmarking image. The generated model MUST have a completely new face that strictly matches the provided Model characteristics.`;
      } else {
        promptText += `Please determine the best tone and manner, lighting, and background that perfectly fits the product and the model characteristics to create a highly attractive brand image.`;
      }

      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K"
          }
        }
      });

      let foundImage = false;
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            setGeneratedImage(imageUrl);
            foundImage = true;
            break;
          }
        }
      }

      if (!foundImage) {
        throw new Error('이미지가 생성되지 않았습니다. 텍스트 응답만 반환되었습니다.');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || '이미지 생성 중 오류가 발생했습니다.');
      
      if (err.message && err.message.includes("Requested entity was not found")) {
         if (window.aistudio && window.aistudio.openSelectKey) {
            await window.aistudio.openSelectKey();
            setError('API 키 세션이 만료되었거나 유효하지 않습니다. 다시 시도해주세요.');
         }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-purple-100">
      <header className="border-b border-slate-200 sticky top-0 z-30 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-200">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">혁신 브랜드 모델 생성 AI</h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowCostModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-purple-700 text-xs font-medium transition-all"
            >
              <DollarSign className="w-3.5 h-3.5" />
              API 비용
            </button>
            <button 
              onClick={() => setShowApiKeyModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 text-xs font-medium transition-all"
            >
              <Key className="w-3.5 h-3.5" />
              API 키 설정
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 16:9 Banner */}
        <div className="relative w-full aspect-[16/9] mb-12 rounded-3xl overflow-hidden shadow-2xl group">
          <img 
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=2000" 
            alt="Fashion Banner" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/80 via-purple-900/40 to-transparent flex flex-col justify-center px-12 lg:px-20">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="inline-block px-4 py-1.5 bg-amber-400 text-amber-950 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full mb-6">
                Premium AI Generation
              </span>
              <h2 className="text-4xl lg:text-6xl font-black text-white mb-6 leading-tight drop-shadow-lg">
                혁신 브랜드 모델<br />
                <span className="text-amber-400">생성 AI</span>
              </h2>
              <p className="text-white/80 max-w-md text-lg font-light leading-relaxed mb-8">
                당신의 브랜드를 빛낼 완벽한 모델을<br />
                최첨단 생성형 AI 기술로 지금 바로 만나보세요.
              </p>
            </motion.div>
          </div>
          <div className="absolute bottom-0 right-0 p-8">
            <div className="w-24 h-24 border-t-2 border-r-2 border-amber-400/50 rounded-tr-3xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Form */}
          <div className="lg:col-span-5 space-y-10 h-[calc(100vh-12rem)] overflow-y-auto pr-4 pb-12 custom-scrollbar">
            
            {/* Basic Info */}
            <section className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Info className="w-4 h-4 text-purple-600" />
                </div>
                <h2 className="font-bold text-lg tracking-tight text-slate-800">기본 정보 (Basic Info)</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">성별 (Gender)</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 appearance-none font-medium">
                    <option value="">선택</option>
                    <option value="여성">여성</option>
                    <option value="남성">남성</option>
                    <option value="중성적">중성적</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">나이 (Age)</label>
                  <input type="text" value={age} onChange={(e) => setAge(e.target.value)} placeholder="예: 20대 초반" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">키 (Height)</label>
                  <input type="text" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="예: 170cm" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">체형 (Body Type)</label>
                  <input type="text" value={bodyType} onChange={(e) => setBodyType(e.target.value)} placeholder="예: 마른, 근육질" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">인종/민족 (Race/Ethnicity)</label>
                  <input type="text" value={race} onChange={(e) => setRace(e.target.value)} placeholder="예: 동양인, 혼혈, 북유럽풍" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
              </div>
            </section>

            {/* Face & Hair */}
            <section className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
                <h2 className="font-bold text-lg tracking-tight text-slate-800">얼굴 및 헤어 (Face & Hair)</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">얼굴 인상 (Facial Impression)</label>
                  <input type="text" value={facialImpression} onChange={(e) => setFacialImpression(e.target.value)} placeholder="예: 차가운, 부드러운, 이국적인" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">눈매 / 표정 (Eyes / Expression)</label>
                  <input type="text" value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="예: 무심한 표정, 날카로운 눈매" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">헤어스타일 / 머리색 (Hair)</label>
                  <input type="text" value={hairstyle} onChange={(e) => setHairstyle(e.target.value)} placeholder="예: 흑발 숏컷, 금발 웨이브" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
              </div>
            </section>

            {/* Style & Direction */}
            <section className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                </div>
                <h2 className="font-bold text-lg tracking-tight text-slate-800">스타일 및 연출 (Style & Direction)</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">전체 분위기 (Overall Mood)</label>
                  <input type="text" value={overallMood} onChange={(e) => setOverallMood(e.target.value)} placeholder="예: 시크한, 몽환적인, 스포티한" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">의상 스타일 (Clothing Style)</label>
                  <input type="text" value={clothingStyle} onChange={(e) => setClothingStyle(e.target.value)} placeholder="예: 미니멀 수트, 스트릿 패션" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">포즈 (Pose)</label>
                  <input type="text" value={pose} onChange={(e) => setPose(e.target.value)} placeholder="예: 당당하게 걷는 포즈, 턱을 괸 포즈" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
              </div>
            </section>

            {/* Environment */}
            <section className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Upload className="w-4 h-4 text-amber-600" />
                </div>
                <h2 className="font-bold text-lg tracking-tight text-slate-800">촬영 환경 (Environment)</h2>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">화보 스타일 / 촬영 콘셉트 (Concept)</label>
                  <input type="text" value={photoshootStyle} onChange={(e) => setPhotoshootStyle(e.target.value)} placeholder="예: 하이패션 매거진, 빈티지 필름" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">배경 (Background)</label>
                    <input type="text" value={background} onChange={(e) => setBackground(e.target.value)} placeholder="예: 스튜디오 단색 배경" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">조명 (Lighting)</label>
                    <input type="text" value={lighting} onChange={(e) => setLighting(e.target.value)} placeholder="예: 자연광, 드라마틱" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 placeholder:text-slate-300 font-medium" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">원하는 비율 (Aspect Ratio)</label>
                  <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all text-sm text-slate-700 appearance-none font-medium">
                    <option value="1:1">1:1 (Square)</option>
                    <option value="3:4">3:4 (Portrait)</option>
                    <option value="4:3">4:3 (Landscape)</option>
                    <option value="9:16">9:16 (Story/Reels)</option>
                    <option value="16:9">16:9 (Widescreen)</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Assets Section */}
            <section className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                </div>
                <h2 className="font-bold text-lg tracking-tight text-slate-800">이미지 에셋 (Visual Assets)</h2>
              </div>
              
              <div className="space-y-8">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                    상품 이미지 <span className="text-purple-600">*</span>
                  </label>
                  
                  {productImagePreview ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 group h-64 shadow-sm">
                      <img src={productImagePreview} alt="Product" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-purple-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <button 
                          onClick={() => removeImage('product')}
                          className="p-3 bg-white text-purple-600 rounded-full hover:scale-110 transition-transform shadow-xl"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-200 border-dashed rounded-2xl hover:border-purple-400 hover:bg-purple-50/30 transition-all cursor-pointer bg-white group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
                          <Upload className="w-6 h-6 text-slate-400 group-hover:text-purple-600 transition-colors" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-purple-600">Upload Product</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'product')} />
                    </label>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                    벤치마킹 컨셉 <span className="text-slate-400 font-normal">(선택)</span>
                  </label>
                  
                  {benchmarkImagePreview ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 group h-64 shadow-sm">
                      <img src={benchmarkImagePreview} alt="Benchmark" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-amber-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <button 
                          onClick={() => removeImage('benchmark')}
                          className="p-3 bg-white text-amber-600 rounded-full hover:scale-110 transition-transform shadow-xl"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-200 border-dashed rounded-2xl hover:border-amber-400 hover:bg-amber-50/30 transition-all cursor-pointer bg-white group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-amber-100 transition-colors">
                          <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-amber-600 transition-colors" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-amber-600">Upload Reference</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'benchmark')} />
                    </label>
                  )}
                </div>
              </div>
            </section>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 text-sm border border-red-100 rounded-2xl font-medium flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-5 px-6 bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-widest transition-all rounded-2xl shadow-xl shadow-purple-200 flex items-center justify-center gap-3 active:scale-[0.98]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  브랜드 모델 생성하기
                </>
              )}
            </button>
          </div>

          {/* Right Column: Result */}
          <div className="lg:col-span-7">
            <div className="sticky top-28 h-[calc(100vh-12rem)] flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                  </div>
                  <h2 className="font-bold text-2xl tracking-tight text-slate-800">생성 결과 (Result)</h2>
                </div>
                {generatedImage && (
                  <a 
                    href={generatedImage} 
                    download="brand-model.png"
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:border-purple-300 hover:text-purple-600 rounded-full text-slate-600 text-xs font-bold uppercase tracking-widest transition-all shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                )}
              </div>
              
              <div className="flex-1 border border-slate-100 bg-slate-50/50 rounded-[2.5rem] flex items-center justify-center overflow-hidden relative shadow-inner">
                <AnimatePresence mode="wait">
                  {isGenerating ? (
                    <motion.div 
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center text-slate-400"
                    >
                      <div className="relative mb-8">
                        <div className="w-16 h-16 border-4 border-purple-100 rounded-full animate-pulse" />
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600 absolute inset-0 m-auto" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-600/60">이미지를 제작하고 있습니다</p>
                    </motion.div>
                  ) : generatedImage ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", damping: 20 }}
                      className="w-full h-full p-8 flex items-center justify-center"
                    >
                      <img 
                        src={generatedImage} 
                        alt="Generated Brand Model" 
                        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl shadow-purple-900/10"
                      />
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center text-slate-300"
                    >
                      <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                        <ImageIcon className="w-10 h-10 opacity-20" />
                      </div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">입력을 기다리는 중입니다</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* API Key Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiKeyModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-xl tracking-tight text-slate-900">API 키 설정</h3>
                <button onClick={() => setShowApiKeyModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-6">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Gemini API 키를 입력해주세요. 입력된 키는 브라우저의 로컬 스토리지에 안전하게 저장됩니다.
                </p>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">Gemini API Key</label>
                  <input 
                    type="password" 
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="AIza..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowApiKeyModal(false)}
                    className="flex-1 py-4 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-colors"
                  >
                    취소
                  </button>
                  <button 
                    onClick={saveApiKey}
                    className="flex-1 py-4 bg-purple-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
                  >
                    저장하기
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  키가 없으시다면 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-purple-600">Google AI Studio</a>에서 발급받으실 수 있습니다.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Cost Modal */}
      <AnimatePresence>
        {showCostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCostModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="font-bold text-xl tracking-tight text-slate-900">GEMINI API 비용 안내</h3>
                </div>
                <button onClick={() => setShowCostModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-8">
                <div className="p-5 bg-purple-50 border border-purple-100 rounded-2xl">
                  <p className="text-sm text-purple-900 leading-relaxed">
                    본 앱은 <span className="font-bold">Gemini 3.0 Pro Image</span> 모델을 사용합니다. 
                    아래는 Google AI Studio의 표준 요금제 기준 예상 비용입니다 (1,350원/$ 환율 기준).
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">이미지 생성 (건당)</span>
                    <span className="text-base text-slate-900 font-bold">약 40.5원 <span className="text-slate-400 font-normal text-sm">($0.03)</span></span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">입력 토큰 (1,000개당)</span>
                    <span className="text-base text-slate-900 font-bold">약 1.7원 <span className="text-slate-400 font-normal text-sm">($0.00125)</span></span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">출력 토큰 (1,000개당)</span>
                    <span className="text-base text-slate-900 font-bold">약 6.8원 <span className="text-slate-400 font-normal text-sm">($0.005)</span></span>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl">
                  <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">참고 사항</h4>
                  <ul className="text-[11px] text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
                    <li>무료 티어 사용 시 일정 한도 내에서 비용이 발생하지 않을 수 있습니다.</li>
                    <li>실제 비용은 Google의 정책 및 환율에 따라 변동될 수 있습니다.</li>
                    <li>멀티모달(이미지 입력)의 경우 토큰 계산 방식이 다를 수 있습니다.</li>
                  </ul>
                </div>

                <button 
                  onClick={() => setShowCostModal(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                >
                  확인했습니다
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-40">
        <a 
          href="https://hyeoksinai.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-full text-slate-600 text-xs font-bold shadow-lg hover:border-purple-300 hover:text-purple-600 transition-all group"
        >
          <ExternalLink className="w-4 h-4" />
          혁신AI 플랫폼 바로가기
        </a>
        <button 
          onClick={() => setShowInquiryModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-purple-600 text-white rounded-full text-xs font-bold shadow-lg hover:bg-purple-700 transition-all group"
        >
          <MessageCircle className="w-4 h-4" />
          오류 및 유지보수 문의
        </button>
      </div>

      {/* Inquiry Modal */}
      <AnimatePresence>
        {showInquiryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInquiryModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2rem] p-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-xl tracking-tight text-slate-900">오류 및 유지보수 문의</h3>
                </div>
                <button onClick={() => setShowInquiryModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-6">
                <p className="text-sm text-slate-600 leading-relaxed">
                  오류 및 유지보수 요청사항이 있으실 경우 아래 메일로 어떤 부분의 오류 개선 또는 유지보수를 요청하시는지 상세하게 기입하여 보내주시면, 정혁신이 실시간으로 확인하여 답변 드리겠습니다.
                </p>
                
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-bold text-slate-900 block text-center">info@nextin.ai.kr</span>
                </div>

                <button 
                  onClick={() => setShowInquiryModal(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                >
                  확인했습니다
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <MainApp />
  );
}
