import React, { useEffect, useRef, useState } from 'react';
import { 
  Download, Loader, Sparkles, AlertCircle, 
  CheckCircle2, XCircle, Play, Pause, ChevronRight, Share2, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VideoExporterProps {
  videoUrl: string;
  layout: 'pip' | 'split';
  pipPos: string;
  isSwapped: boolean;
  isMirrored: boolean;
  onClose: () => void;
}

export const VideoExporter: React.FC<VideoExporterProps> = ({
  videoUrl,
  layout,
  pipPos,
  isSwapped,
  isMirrored,
  onClose
}) => {
  const [status, setStatus] = useState<'idle' | 'rendering' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [outputSize, setOutputSize] = useState<string>('0 MB');
  const [fileExtension, setFileExtension] = useState<string>('mp4');
  const [selectedFormatLabel, setSelectedFormatLabel] = useState<string>('MP4');
  const [selectedFormat, setSelectedFormat] = useState<'mp4' | 'webm'>('webm');

  // Video references for background rendering
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const renderLoopRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Detect Safari or iOS to set the best default format on active browsers
    const isSafariOrIOS = /Safari|iPhone|iPad|iPod/i.test(navigator.userAgent) && !/Chrome|CriOS|Android/i.test(navigator.userAgent);
    if (isSafariOrIOS) {
      setSelectedFormat('mp4');
    } else {
      setSelectedFormat('webm');
    }

    return () => {
      cleanupResources();
    };
  }, []);

  const cleanupResources = () => {
    if (renderLoopRef.current) {
      cancelAnimationFrame(renderLoopRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (mainVideoRef.current) {
      mainVideoRef.current.pause();
      mainVideoRef.current.src = '';
    }
    if (pipVideoRef.current) {
      pipVideoRef.current.pause();
      pipVideoRef.current.src = '';
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  };

  const startRendering = async () => {
    setStatus('rendering');
    setProgress(0);
    chunksRef.current = [];

    try {
      // 1. Resolve source sizes before initializing
      const tempVideo = document.createElement('video');
      tempVideo.src = videoUrl;
      await new Promise<void>((resolve, reject) => {
        tempVideo.onloadedmetadata = () => resolve();
        tempVideo.onerror = () => reject(new Error('视频元数据解析失败'));
      });

      const videoWidth = tempVideo.videoWidth || 1280;
      const videoHeight = tempVideo.videoHeight || 720;
      const duration = tempVideo.duration || 10;

      // 2. Setup Canvas based on Layout
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('画布初始化失败');

      if (layout === 'split') {
        // Left & Right: Canvas is double the width of one target
        canvas.width = videoWidth * 2;
        canvas.height = videoHeight;
      } else {
        // PiP overlay is bound to main video coordinates
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }

      const mainVideo = mainVideoRef.current;
      const pipVideo = pipVideoRef.current;

      if (!mainVideo || !pipVideo) {
        throw new Error('渲染媒体节点损坏');
      }

      // Ensure both are properly preloaded
      mainVideo.currentTime = 0;
      pipVideo.currentTime = 0;

      // Unmute so audio pipeline gets data, but we don't connect 
      // the context to destination, ensuring SILENT encoding in the background!
      mainVideo.muted = false;
      pipVideo.muted = true; // PiP remains completely quiet

      // Create browser-native audio capture node to extract main music
      let audioTrack: MediaStreamTrack | null = null;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        
        // Connect the element to destination destination stream
        const source = audioCtx.createMediaElementSource(mainVideo);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        
        // Explicitly resume AudioContext inside user microtask to resolve browser autoplay blocking state
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        
        // Capture audio track
        audioTrack = dest.stream.getAudioTracks()[0];
      } catch (ae) {
        console.warn('Audio graph connection warning. Trying default capture: ', ae);
      }

      // Prepare canvas capturing stream at 30fps
      const canvasStream = canvas.captureStream(30);
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      } else {
        // Fallback: capture main volume using captureStream of the video element if browser supports it
        try {
          const videoStream = (mainVideo as any).captureStream?.();
          const backupAudioTrack = videoStream?.getAudioTracks()[0];
          if (backupAudioTrack) canvasStream.addTrack(backupAudioTrack);
        } catch (f) {}
      }

      // Determine appropriate mime types based on user selection
      let typeCandidate = '';
      let ext = selectedFormat;
      let formatLabel = selectedFormat.toUpperCase();

      const mp4Types = [
        'video/mp4;codecs=avc1,mp4a.40.2', // High standard Apple AAC & H.264
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264',
        'video/mp4;codecs=vp9,opus',        // Chrome fallback
        'video/mp4'
      ];

      const webmTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];

      if (selectedFormat === 'mp4') {
        for (const t of mp4Types) {
          if (MediaRecorder.isTypeSupported(t)) {
            typeCandidate = t;
            ext = 'mp4';
            formatLabel = 'MP4';
            break;
          }
        }
        if (!typeCandidate) {
          for (const t of webmTypes) {
            if (MediaRecorder.isTypeSupported(t)) {
              typeCandidate = t;
              ext = 'webm';
              formatLabel = 'WebM';
              break;
            }
          }
        }
      } else {
        for (const t of webmTypes) {
          if (MediaRecorder.isTypeSupported(t)) {
            typeCandidate = t;
            ext = 'webm';
            formatLabel = 'WebM';
            break;
          }
        }
        if (!typeCandidate) {
          for (const t of mp4Types) {
            if (MediaRecorder.isTypeSupported(t)) {
              typeCandidate = t;
              ext = 'mp4';
              formatLabel = 'MP4';
              break;
            }
          }
        }
      }

      if (!typeCandidate) {
        typeCandidate = 'video/webm';
        ext = 'webm';
        formatLabel = 'WebM';
      }

      setFileExtension(ext);
      setSelectedFormatLabel(formatLabel);

      const options = MediaRecorder.isTypeSupported(typeCandidate) ? { mimeType: typeCandidate } : undefined;
      const recorder = new MediaRecorder(canvasStream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const resultBlob = new Blob(chunksRef.current, { type: typeCandidate || 'video/mp4' });
        
        // Calculate file size
        const sizeInMb = (resultBlob.size / (1024 * 1024)).toFixed(2);
        setOutputSize(`${sizeInMb} MB`);
        
        const fileUrl = URL.createObjectURL(resultBlob);
        setDownloadUrl(fileUrl);
        setStatus('completed');
      };

      // 3. Dual sync launch
      await Promise.all([
        mainVideo.play(),
        pipVideo.play()
      ]);

      recorder.start();

      // Mirror settings
      const isMainMirrored = isSwapped ? !isMirrored : isMirrored;
      const isPipMirrored = isSwapped ? isMirrored : !isMirrored;

      // Draw rendering loop
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('画笔上下文载入失败');

      const render = () => {
        if (mainVideo.paused || mainVideo.ended) {
          // If ended or paused, double check progress
          if (mainVideo.currentTime >= duration - 0.2) {
            recorder.stop();
            return;
          }
        }

        // Strongly enforce sync for sub-frame drift
        const diff = Math.abs(mainVideo.currentTime - pipVideo.currentTime);
        if (diff > 0.08) {
          pipVideo.currentTime = mainVideo.currentTime;
        }

        // Draw background
        ctx.fillStyle = '#0f172a'; // rich darkness background
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Core compilation layouts
        if (layout === 'split') {
          // Side by Side
          const subWidth = videoWidth;
          const subHeight = videoHeight;

          // 1. Draw Left Split (Main)
          ctx.save();
          if (isMainMirrored) {
            ctx.translate(subWidth, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(mainVideo, 0, 0, subWidth, subHeight);
          } else {
            ctx.drawImage(mainVideo, 0, 0, subWidth, subHeight);
          }
          ctx.restore();

          // 2. Draw Right Split (Pip/Secondary)
          ctx.save();
          ctx.translate(subWidth, 0); // shift cursor to half width
          if (isPipMirrored) {
            ctx.translate(subWidth, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(pipVideo, 0, 0, subWidth, subHeight);
          } else {
            ctx.drawImage(pipVideo, 0, 0, subWidth, subHeight);
          }
          ctx.restore();

          // 3. Split partition line
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(subWidth, 0);
          ctx.lineTo(subWidth, subHeight);
          ctx.stroke();
        } else {
          // Picture in Picture
          // 1. Draw Background (Main Screen)
          ctx.save();
          if (isMainMirrored) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
          } else {
            ctx.drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
          }
          ctx.restore();

          // 2. Draw Overlay (Pip Screen)
          // Scale pip overlay down to 22% of total width, preserving height aspect
          const scaleRatio = 0.22;
          const pipW = canvas.width * scaleRatio;
          const pipH = canvas.height * scaleRatio;
          const pad = canvas.width * 0.03; // margin
          
          let pipX = canvas.width - pipW - pad;
          let pipY = pad;

          if (pipPos === 'top-left') {
            pipX = pad;
            pipY = pad;
          } else if (pipPos === 'bottom-left') {
            pipX = pad;
            pipY = canvas.height - pipH - pad - 60; // offset controls room
          } else if (pipPos === 'bottom-right') {
            pipX = canvas.width - pipW - pad;
            pipY = canvas.height - pipH - pad - 60;
          }

          // Render border with round shadow bounds
          ctx.fillStyle = '#000000';
          ctx.fillRect(pipX - 2, pipY - 2, pipW + 4, pipH + 4);

          ctx.save();
          if (isPipMirrored) {
            ctx.translate(pipX + pipW, pipY);
            ctx.scale(-1, 1);
            ctx.drawImage(pipVideo, 0, 0, pipW, pipH);
          } else {
            ctx.drawImage(pipVideo, pipX, pipY, pipW, pipH);
          }
          ctx.restore();

          // White border highlight
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.strokeRect(pipX, pipY, pipW, pipH);
        }

        // Compute real progress percentage
        const progressCount = Math.min(100, Math.floor((mainVideo.currentTime / duration) * 100));
        setProgress(progressCount);

        if (mainVideo.currentTime < duration && !mainVideo.ended) {
          renderLoopRef.current = requestAnimationFrame(render);
        } else {
          // Completed
          recorder.stop();
        }
      };

      renderLoopRef.current = requestAnimationFrame(render);

    } catch (err: any) {
      console.error("Video synthesis failed: ", err);
      setErrorMessage(err?.message || '视频渲染或音频混流管道异常，请换文件重试。');
      setStatus('failed');
    }
  };

  const handleManualDownload = () => {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `FlipDance_Sync_${layout}_${Date.now()}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div id="export-overlay-modal" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
      >
        {/* Hidden asset loading tags for pure frame capture */}
        <div className="absolute opacity-0 pointer-events-none w-1 h-1 overflow-hidden">
          <video
            ref={mainVideoRef}
            src={videoUrl}
            crossOrigin="anonymous"
            playsInline
          />
          <video
            ref={pipVideoRef}
            src={videoUrl}
            crossOrigin="anonymous"
            playsInline
          />
          <canvas ref={canvasRef} />
        </div>

        {/* Dynamic State Views */}
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle-stage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-left"
            >
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 font-display leading-tight">
                    配置并离线合成视频
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    在浏览器本地对镜像视频进行双重对齐合并
                  </p>
                </div>
              </div>

              {/* Layout Info */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 mb-4 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">当前画面排版模式:</span>
                <span className="text-xs font-bold text-slate-700 bg-emerald-100/60 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-100">
                  {layout === 'split' ? '左右分屏对照' : '画中画悬浮对比'}
                </span>
              </div>

              {/* Format selection */}
              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-700 mb-2 tracking-wider uppercase">
                  选择输出视频格式
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setSelectedFormat('webm')}
                    className={`py-3 px-1 rounded-xl font-bold border text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                      selectedFormat === 'webm'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-500'
                    }`}
                  >
                    <span className="text-[13px] font-black">WEBM 格式</span>
                    <span className="text-[9px] font-normal text-slate-400 mt-1">
                      (Chrome / 电脑 / 安卓 强荐)
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFormat('mp4')}
                    className={`py-3 px-1 rounded-xl font-bold border text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                      selectedFormat === 'mp4'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-500'
                    }`}
                  >
                    <span className="text-[13px] font-black">MP4 格式</span>
                    <span className="text-[9px] font-normal text-slate-400 mt-1">
                      (Safari / 苹果 iPhone 强荐)
                    </span>
                  </button>
                </div>

                {/* Compatibility notice tooltip */}
                <div className="bg-amber-50 border border-amber-200/50 p-3 rounded-xl flex items-start gap-2">
                  <span className="text-amber-500 text-sm leading-none mt-0.5">⚠️</span>
                  <div className="text-[10.5px] text-amber-800 leading-relaxed font-sans">
                    <strong>浏览器导出音频说明：</strong>
                    <ul className="list-disc pl-3 mt-1 space-y-1 text-slate-600">
                      <li><strong>Chrome/Firefox/微端：</strong>由于专利限制，Chrome 在 MP4 容器中无法编码 AAC 音轨（仅能采用 Opus）。这会导致部分系统自带播放器（如 QuickTime 或苹果相册）播放时<strong>有视频却没声音</strong>。推荐安卓与电脑选择 <strong>WEBM 格式</strong> 下载，或者用 VLC、浏览器打开进行播放。</li>
                      <li><strong>苹果 iOS / macOS Safari：</strong>完美支持 MP4 + AAC 标准组合，极力推荐在此直接选用 <strong>MP4 格式</strong> 导出。</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  取消返回
                </button>
                <button
                  type="button"
                  onClick={startRendering}
                  className="flex-[2] py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 开始本地混流合成
                </button>
              </div>
            </motion.div>
          )}

          {status === 'rendering' && (
            <motion.div
              key="rendering-stage"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Loader className="w-16 h-16 animate-spin text-emerald-500 absolute" />
                <span className="text-sm font-bold font-mono text-emerald-600">{progress}%</span>
              </div>

              <h3 className="text-xl font-bold font-display text-slate-800 mb-2">
                正在本地合成舞步视频
              </h3>
              
              <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto mb-5">
                正在按帧合成 <strong>镜面反转</strong> 主屏与 <strong>{layout === 'split' ? '双侧拼屏' : '悬浮画中画'}</strong> 对比副屏。
                无需服务器，不消耗流量，大约需要 10 - 20 秒，请勿关闭本标签页。
              </p>

              {/* Simulated visual waveform */}
              <div className="flex justify-center items-center gap-1 h-5 overflow-hidden">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full transition-all"
                    style={{
                      height: `${Math.random() * 16 + 4}px`,
                      animation: `bounce 0.8s ease-in-out infinite alternate`,
                      animationDelay: `${i * 0.08}s`
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {status === 'completed' && (
            <motion.div
              key="completed-stage"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-100">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h3 className="text-xl font-bold font-display text-slate-800 mb-2">
                舞步反转合成成功！
              </h3>
              <p className="text-slate-500 text-xs mb-6 font-mono">
                文件大小: {outputSize} | 格式: {selectedFormatLabel}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleManualDownload}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold text-white rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer text-sm"
                >
                  <Download className="w-4 h-4" /> 立即下载保存到手机/电脑
                </button>

                <p className="text-[10px] text-slate-400">
                  * 镜面反转让右手对右手，直接跟跳即可！
                </p>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-600 rounded-xl text-xs transition-colors cursor-pointer mt-2"
                >
                  返回继续练习
                </button>
              </div>
            </motion.div>
          )}

          {status === 'failed' && (
            <motion.div
              key="failed-stage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-rose-100">
                <XCircle className="w-10 h-10" />
              </div>

              <h3 className="text-xl font-bold font-display text-slate-800 mb-2">
                视频合成异常
              </h3>
              <p className="text-rose-600 text-xs mb-6 px-4 bg-rose-50 py-2 rounded-lg border border-rose-100 leading-relaxed font-mono">
                {errorMessage}
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={startRendering}
                  className="w-full py-3 bg-rose-500 hover:bg-rose-600 font-bold text-white rounded-xl text-sm transition-all shadow cursor-pointer"
                >
                  重新尝试合成
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 font-semibold text-slate-600 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  取消防护返回
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bounce keyframe helper style injection for nice visual waveforms code */}
      <style>{`
        @keyframes bounce {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1.3); }
        }
      `}</style>
    </div>
  );
};
