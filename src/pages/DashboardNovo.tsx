import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// --- Types ---
type Side = 'left' | 'right' | null;

// --- Constants & Data ---
const IMAGES = [
  "/GPT_Image_1.5.png",
  "/GPT_IMAGE.png", 
  "/Qwen-Image.webp",
  "/Nano_Banana_2_Pro.png",
  "/Ideogram_3.0.jpg",
  "/FLUX_Kontext_Max.png",
  "/Seedream.webp",
  "/FLUXPRO.png",
];

const LOCAL_VIDEO_PATH = "/video_novo_hub.mp4";
const FALLBACK_VIDEO = "https://cdn.pixabay.com/video/2023/02/09/149955-797394857_large.mp4";
const VIDEO_POSTER = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964&auto=format&fit=crop";

/**
 * Formata o nome do arquivo para exibição:
 * Remove apenas a extensão final (.png, .jpg, etc) usando lastIndexOf,
 * permitindo que pontos decimais (ex: 1.5) permaneçam no nome.
 */
const formatModelName = (path: string) => {
  const fileNameWithExt = path.split('/').pop() || "";
  const lastDotIndex = fileNameWithExt.lastIndexOf('.');
  
  // Remove apenas o que vem depois do último ponto (a extensão)
  const fileName = lastDotIndex !== -1 
    ? fileNameWithExt.substring(0, lastDotIndex) 
    : fileNameWithExt;

  return fileName.replace(/_/g, ' ').replace(/-/g, ' ').toUpperCase();
};

// --- Components ---

const ImageCarousel: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const scrollTimeout = useRef<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isActive) {
        setCurrentIndex((prev) => (prev + 1) % IMAGES.length);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!isActive) return;
      if (scrollTimeout.current) return;
      
      scrollTimeout.current = true;
      if (e.deltaY > 0) {
        setCurrentIndex((prev) => (prev + 1) % IMAGES.length);
      } else {
        setCurrentIndex((prev) => (prev - 1 + IMAGES.length) % IMAGES.length);
      }

      setTimeout(() => {
        scrollTimeout.current = false;
      }, 400); 
    };

    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, [isActive]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isActive) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setMousePos({ x, y });
  };

  const currentModelName = formatModelName(IMAGES[currentIndex]);

  return (
    <div 
      className="relative w-full h-full overflow-hidden bg-black cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePos({ x: 50, y: 50 })}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 w-full h-full"
        >
          <motion.img
            src={IMAGES[currentIndex]}
            alt={currentModelName}
            style={{ 
              objectPosition: `${mousePos.x}% ${mousePos.y}%`,
              transition: "object-position 0.3s ease-out"
            }}
            className="w-full h-full object-cover opacity-70 scale-110" 
          />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent p-10 flex flex-col justify-end z-10 pointer-events-none">
        <motion.div
          key={currentModelName}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Nome do Modelo como destaque secundário */}
          <div className="mb-2">
             <span className="text-cyan-400 font-mono text-sm tracking-[0.3em] font-bold">
               {currentModelName}
             </span>
          </div>

          <h2 className="text-6xl font-black text-white tracking-tighter mb-2 italic">
            IMAGINE<span className="text-cyan-500">.</span>
          </h2>
          <p className="text-cyan-100/60 max-w-sm text-sm leading-relaxed mb-6">
            Síntese de imagens com alta fidelidade. <br />
            <span className="text-cyan-400/50 italic text-xs uppercase tracking-widest">Role para explorar modelos</span>
          </p>
          
          <button 
            onClick={() => navigate('/image2')}
            className="px-8 py-3 bg-cyan-600/10 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all duration-300 rounded-full uppercase tracking-[0.2em] text-[10px] font-bold pointer-events-auto"
          >
            Abrir Estúdio
          </button>
        </motion.div>
      </div>
    </div>
  );
};

const VideoLoop: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoSrc, setVideoSrc] = useState(LOCAL_VIDEO_PATH);
  const navigate = useNavigate();

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
    }
  }, [videoSrc]); 

  const handleVideoError = () => {
    if (videoSrc === LOCAL_VIDEO_PATH) setVideoSrc(FALLBACK_VIDEO);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <motion.video
        ref={videoRef}
        key={videoSrc}
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-opacity duration-700 ${isActive ? 'opacity-80' : 'opacity-40'}`}
        autoPlay
        loop
        muted
        playsInline
        poster={VIDEO_POSTER}
        src={videoSrc}
        onError={handleVideoError}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent p-10 flex flex-col justify-end z-10 items-end text-right">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-6xl font-black text-white tracking-tighter mb-2 italic uppercase">
            Motion<span className="text-fuchsia-500">.</span>
          </h2>
          <p className="text-fuchsia-100/60 max-w-sm text-sm leading-relaxed mb-6">
            Dinâmica temporal e geração de vídeo. <br />
            Dê vida a conceitos estáticos.
          </p>
          <button 
            onClick={() => navigate('/video')}
            className="px-8 py-3 bg-fuchsia-600/10 border border-fuchsia-500/50 text-fuchsia-400 hover:bg-fuchsia-500 hover:text-black transition-all duration-300 rounded-full uppercase tracking-[0.2em] text-[10px] font-bold"
          >
            Criar Vídeo
          </button>
        </motion.div>
      </div>
    </div>
  );
};

const DashboardNovo: React.FC = () => {
  const [hoveredSide, setHoveredSide] = useState<Side>(null);

  const transitionSettings: Transition = {
    type: "spring",
    stiffness: 180,
    damping: 30,
  };

  return (
    <div className="relative w-full h-screen bg-black flex overflow-hidden font-sans antialiased">
      {/* Left Side */}
      <motion.div
        className="relative h-full flex-shrink-0 z-10"
        onMouseEnter={() => setHoveredSide('left')}
        onMouseLeave={() => setHoveredSide(null)}
        animate={{ 
          width: hoveredSide === 'left' ? "70%" : hoveredSide === 'right' ? "30%" : "50%",
          filter: hoveredSide === 'right' ? "grayscale(1) brightness(0.5)" : "grayscale(0) brightness(1)"
        }}
        transition={transitionSettings}
      >
        <ImageCarousel isActive={hoveredSide === 'left'} />
      </motion.div>

      {/* Central Badge */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
        <motion.div 
            animate={{ scale: hoveredSide ? 0.9 : 1, opacity: hoveredSide ? 0.3 : 1 }}
            className="bg-black/40 border border-white/10 backdrop-blur-xl px-8 py-4 rounded-full shadow-2xl flex items-center gap-4"
        >
            <div className={`w-2 h-2 rounded-full ${hoveredSide === 'left' ? 'bg-cyan-400' : 'bg-white/20'}`} />
            <span className="text-sm font-black tracking-[0.5em] text-white uppercase">Synergy Hub</span>
            <div className={`w-2 h-2 rounded-full ${hoveredSide === 'right' ? 'bg-fuchsia-400' : 'bg-white/20'}`} />
        </motion.div>
      </div>

      {/* Right Side */}
      <motion.div
        className="relative h-full flex-shrink-0 z-10"
        onMouseEnter={() => setHoveredSide('right')}
        onMouseLeave={() => setHoveredSide(null)}
        animate={{ 
          width: hoveredSide === 'right' ? "70%" : hoveredSide === 'left' ? "30%" : "50%",
          filter: hoveredSide === 'left' ? "grayscale(1) brightness(0.5)" : "grayscale(0) brightness(1)"
        }}
        transition={transitionSettings}
      >
        <VideoLoop isActive={hoveredSide === 'right'} />
      </motion.div>
    </div>
  );
};

export default DashboardNovo;
