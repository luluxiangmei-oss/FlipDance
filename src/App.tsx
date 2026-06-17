import React, { useState } from 'react';
import { VideoUpload } from './components/VideoUpload';
import { VideoPlayer } from './components/VideoPlayer';
import { VideoExporter } from './components/VideoExporter';
import { Sparkles, Music, HelpCircle, GraduationCap, Heart, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Video selected state
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [videoName, setVideoName] = useState<string>('');

  // Export settings triggering state
  const [exportConfig, setExportConfig] = useState<{
    isActive: boolean;
    layout: 'pip' | 'split';
    pipPos: string;
    isSwapped: boolean;
  } | null>(null);

  const handleVideoSelected = (url: string, name: string) => {
    setVideoUrl(url);
    // Remove extension name if uploaded file has one
    const cleanName = name.replace(/\.[^/.]+$/, "");
    setVideoName(cleanName);
  };

  const handleBackToUpload = () => {
    // If it's a blob object url, revoke it to avoid memory leakages
    if (videoUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(videoUrl);
      } catch (e) {}
    }
    setVideoUrl('');
    setVideoName('');
  };

  const handleTriggerExport = (
    mainRef: HTMLVideoElement, 
    pipRef: HTMLVideoElement, 
    layout: 'pip' | 'split', 
    pipPos: string, 
    isSwapped: boolean
  ) => {
    setExportConfig({
      isActive: true,
      layout,
      pipPos,
      isSwapped
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/70 font-sans antialiased text-slate-800 flex flex-col justify-between" id="flipdance-app-skeleton">
      
      {/* Universal Sticky Glass Header Block */}
      <header className="sticky top-0 z-35 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm px-4 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
              <Sparkles className="w-5 h-5 fill-white/10" />
            </div>
            <div>
              <span className="font-display font-black text-lg tracking-tight text-slate-900">
                FlipDance <span className="text-emerald-500">舞步反转</span>
              </span>
              <span className="text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded ml-1.5 border border-emerald-100">
                v1.0 (MVP)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <Music className="w-3.5 h-3.5 text-teal-500 animate-pulse" /> 右手对右手，极速扒舞
            </span>
            <a 
              href="mailto:luluxiangmei@gmail.com" 
              className="text-xs text-slate-400 hover:text-slate-650 transition-colors font-mono"
            >
              支持与意见反馈
            </a>
          </div>
        </div>
      </header>

      {/* Primary Dynamic Stage */}
      <main className="flex-1 pb-16">
        <AnimatePresence mode="wait">
          {!videoUrl ? (
            /* Upload & Trial Screen View */
            <motion.div
              key="upload-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <VideoUpload onVideoSelected={handleVideoSelected} />
            </motion.div>
          ) : (
            /* active Player Screen Workspace */
            <motion.div
              key="player-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <VideoPlayer 
                videoUrl={videoUrl} 
                videoName={videoName} 
                onBack={handleBackToUpload}
                onTriggerExport={handleTriggerExport}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Exporter modal overlay overlaying the primary dom tree */}
      <AnimatePresence>
        {exportConfig?.isActive && (
          <VideoExporter
            videoUrl={videoUrl}
            layout={exportConfig.layout}
            pipPos={exportConfig.pipPos}
            isSwapped={exportConfig.isSwapped}
            isMirrored={true} // exporting mirrored by default
            onClose={() => setExportConfig(null)}
          />
        )}
      </AnimatePresence>

      {/* High-Contrast Info Guide Footer */}
      <footer className="bg-white border-t border-slate-100 py-8 px-4 text-center mt-auto" id="applet-footer">
        <div className="max-w-4xl mx-auto">
          {/* Quick dancer guideline card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-left mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 mt-0.5">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-800 mb-1 font-display">1. 为什么用镜面模式？</h5>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  看老师做“镜面”跳时，你的身体和老师保持同方向（右手对右手），如同镜中对照，无需脑内方向反折，学习速度翻倍。
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 mt-0.5">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-800 mb-1 font-display">2. 什么是强同步对照？</h5>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  多核浏览器在多段视频同步播放时可能漂移。我们通过微秒级定时跟踪器，确保主副画面和音乐轨道时时刻刻同步。
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 mt-0.5">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-800 mb-1 font-display">3. 本地合成有何保障？</h5>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  合成借助浏览器渲染器现场生成，没有服务器流量转存，完全保障你的跳舞隐私，在安卓/苹果/PC均可稳定导出。
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-50 text-[11px] text-slate-400 font-mono">
            <span>© 2026 FlipDance 舞步反转. 自学舞蹈，一律反转。</span>
            <span className="flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> for dance lovers
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
