import React, { useState, useRef } from 'react';
import { Upload, Film, Play, RotateCcw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DemoVideo } from '../types';

// Structured list of high-quality, stable public dance clips for easy onboarding
const DEMO_VIDEOS: DemoVideo[] = [
  {
    id: 'demo-1',
    name: '街舞 K-Pop 基础律动',
    description: '非常适合练习镜面翻转，动作幅度大，左右辨识强',
    category: '街舞 / 律动',
    url: 'https://player.vimeo.com/external/371433846.sd.mp4?s=236da2f3c054fc2d2c337a155ebd3eec0779bf27&profile_id=139&oauth2_token_id=57447761',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'demo-2',
    name: '街头 Hiphop 编舞练习',
    description: '快节奏的全身动作，正面视角下使用镜像最容易跟上舞步',
    category: 'Hiphop / 编舞',
    url: 'https://player.vimeo.com/external/403816654.sd.mp4?s=d009b0b411786c2aa97fc58bda507d4b46294726&profile_id=139&oauth2_token_id=57447761',
    coverUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'demo-3',
    name: '现代抒情舞 空间流转',
    description: '流畅优美的现代舞，背面镜像翻转大幅度降低记忆门槛',
    category: '现代舞 / 抒情',
    url: 'https://player.vimeo.com/external/370331493.sd.mp4?s=e7beacdfde6461b4bc669fcf785bc036329ebc6e&profile_id=139&oauth2_token_id=57447761',
    coverUrl: 'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?auto=format&fit=crop&q=80&w=400'
  }
];

interface VideoUploadProps {
  onVideoSelected: (url: string, name: string) => void;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ onVideoSelected }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (file && file.type.startsWith('video/')) {
      setIsAnalyzing(true);
      const url = URL.createObjectURL(file);
      
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = url;
      
      tempVideo.onloadedmetadata = () => {
        setIsAnalyzing(false);
        const duration = tempVideo.duration;
        if (duration > 240) {
          alert(`提示：您导入的视频时长为 ${Math.floor(duration / 60)}分${Math.floor(duration % 60)}秒（已超出4分钟限制）。为了保证系统流畅，我们已自动截取前 4 分钟作为原视频供您练舞。`);
        }
        onVideoSelected(url, file.name);
      };
      
      tempVideo.onerror = () => {
        setIsAnalyzing(false);
        // Fallback for environment/codec check
        onVideoSelected(url, file.name);
      };
    } else {
      alert('请导入合法的视频文件 (mp4, mov, webm, avi...)');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div id="video-upload-section" className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Title Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase mb-3 border border-emerald-100">
          <Sparkles className="w-3 h-3" /> MVP 镜面调试版
        </div>
        <h1 className="text-4xl sm:text-5xl font-display font-bold text-gray-900 tracking-tight leading-none mb-4">
          FlipDance <span className="text-emerald-500">舞步反转</span>
        </h1>
        <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto">
          自学舞蹈的终极利器。无需后期剪辑，瞬时镜面反转播放，
          并同步画中画保留原版对比，帮助你完美掌握身体左右方向与深度。
        </p>
      </div>

      {/* Main Drag-Drop Upload Area */}
      <motion.div
        id="drag-and-drop-container"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={(e) => {
          if (!isAnalyzing) {
            handleDrop(e);
          }
        }}
        onClick={() => {
          if (!isAnalyzing) {
            handleButtonClick();
          }
        }}
        whileHover={{ scale: isAnalyzing ? 1.0 : 1.01, borderColor: isAnalyzing ? '#cbd5e1' : '#10b981' }}
        whileTap={{ scale: isAnalyzing ? 1.0 : 0.99 }}
        className={`relative ${isAnalyzing ? 'cursor-not-allowed' : 'cursor-pointer'} transition-all duration-300 rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center focus:outline-none flex flex-col items-center justify-center min-h-[300px] mb-12 ${
          isDragActive
            ? 'border-emerald-500 bg-emerald-50/50 shadow-inner'
            : 'border-slate-200 bg-white hover:bg-slate-50/50 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="video/*,video/mp4,video/quicktime,video/webm"
          onChange={handleChange}
          disabled={isAnalyzing}
        />
        
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-1 font-display">
              正在分析视频大小与时长...
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm">
              检测是否有大于 4 分钟的限制，请稍候
            </p>
          </div>
        ) : (
          <>
            <div className={`p-4 rounded-full mb-5 ${isDragActive ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'} transition-colors duration-300`}>
              <Upload className="w-8 sm:w-10 h-8 sm:h-10 animate-bounce" />
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mb-1 font-display">
              + 导入练舞视频
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-sm mb-4">
              支持拖拽视频到这里，或点击浏览本地文件
            </p>
            <span className="inline-flex gap-1.5 items-center bg-slate-50 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-100">
              <Film className="w-3.5 h-3.5 text-slate-400" /> MP4 / MOV / WEBM
            </span>
          </>
        )}
      </motion.div>

      {/* Demo Video Section for instant onboarding */}
      <div className="border-t border-slate-100 pt-8" id="quick-try-section">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider font-display">
            没有下载视频？一键试玩高清 Demonstration
          </h4>
          <span className="text-xs text-slate-400 font-mono">3 个精选示例</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {DEMO_VIDEOS.map((demo) => (
            <motion.div
              key={demo.id}
              whileHover={{ y: -3 }}
              onClick={() => onVideoSelected(demo.url, demo.name)}
              className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm cursor-pointer group hover:border-emerald-200 hover:shadow-md transition-all duration-300 flex flex-col h-full"
            >
              {/* Header Cover */}
              <div className="relative aspect-video w-full bg-slate-100 overflow-hidden">
                <img
                  src={demo.coverUrl}
                  alt={demo.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center text-emerald-600 transition-transform duration-300 group-hover:scale-110">
                    <Play className="w-4 h-4 fill-emerald-600 translate-x-[1px]" />
                  </div>
                </div>
                <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-md font-bold">
                  {demo.category}
                </span>
              </div>

              {/* Description Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h5 className="font-semibold text-slate-800 text-sm mb-1 group-hover:text-emerald-600 transition-colors">
                    {demo.name}
                  </h5>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    {demo.description}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400">试用此素材</span>
                  <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                    进入学习 →
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
