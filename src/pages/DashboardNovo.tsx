import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Sparkles, ArrowUpCircle, UserCircle, Smile, Video } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsTabletOrMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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

interface CarouselProps {
  isActive: boolean;
  isTabletOrMobile: boolean;
}

const ImageCarousel: React.FC<CarouselProps> = ({ isActive, isTabletOrMobile }) => {
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
    if (!isActive || isTabletOrMobile) return;
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

      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent flex flex-col justify-end z-10 pointer-events-none",
        isTabletOrMobile ? "p-6" : "p-10"
      )}>
        <motion.div
          key={currentModelName}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Nome do Modelo como destaque secundário */}
          <div className="mb-2">
             <span className={cn(
               "text-cyan-400 font-mono tracking-[0.3em] font-bold",
               isTabletOrMobile ? "text-xs" : "text-sm"
             )}>
               {currentModelName}
             </span>
          </div>

          <h2 className={cn(
            "font-black text-white tracking-tighter mb-2 italic",
            isTabletOrMobile ? "text-4xl" : "text-6xl"
          )}>
            IMAGINE<span className="text-cyan-500">.</span>
          </h2>
          <p className={cn(
            "text-cyan-100/60 max-w-sm leading-relaxed mb-4",
            isTabletOrMobile ? "text-xs" : "text-sm mb-6"
          )}>
            Síntese de imagens com alta fidelidade. <br />
            <span className="text-cyan-400/50 italic text-xs uppercase tracking-widest">
              {isTabletOrMobile ? "Toque para explorar" : "Role para explorar modelos"}
            </span>
          </p>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "bg-cyan-600/10 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500 hover:text-black transition-all duration-300 rounded-full uppercase tracking-[0.2em] font-bold pointer-events-auto flex items-center gap-2",
                isTabletOrMobile ? "px-5 py-2 text-[9px]" : "px-8 py-3 text-[10px]"
              )}>
                Abrir Estúdio
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-black/90 backdrop-blur-xl border-cyan-500/30 text-cyan-400 min-w-[180px]">
              <DropdownMenuItem onClick={() => navigate('/image2')} className="hover:bg-cyan-500/20 focus:bg-cyan-500/20 cursor-pointer gap-2">
                <Sparkles className="w-4 h-4" />
                Gerar Imagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/image2?mode=upscale')} className="hover:bg-cyan-500/20 focus:bg-cyan-500/20 cursor-pointer gap-2">
                <ArrowUpCircle className="w-4 h-4" />
                Upscale
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/image2?mode=skin')} className="hover:bg-cyan-500/20 focus:bg-cyan-500/20 cursor-pointer gap-2">
                <Smile className="w-4 h-4" />
                Skin Enhancer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/image2?mode=avatar')} className="hover:bg-cyan-500/20 focus:bg-cyan-500/20 cursor-pointer gap-2">
                <UserCircle className="w-4 h-4" />
                AI Avatar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>
    </div>
  );
};

interface VideoLoopProps {
  isActive: boolean;
  isTabletOrMobile: boolean;
}

const VideoLoop: React.FC<VideoLoopProps> = ({ isActive, isTabletOrMobile }) => {
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
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent flex flex-col justify-end z-10 items-end text-right",
        isTabletOrMobile ? "p-6" : "p-10"
      )}>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className={cn(
            "font-black text-white tracking-tighter mb-2 italic uppercase",
            isTabletOrMobile ? "text-4xl" : "text-6xl"
          )}>
            Motion<span className="text-fuchsia-500">.</span>
          </h2>
          <p className={cn(
            "text-fuchsia-100/60 max-w-sm leading-relaxed mb-4",
            isTabletOrMobile ? "text-xs" : "text-sm mb-6"
          )}>
            Dinâmica temporal e geração de vídeo. <br />
            Dê vida a conceitos estáticos.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "bg-fuchsia-600/10 border border-fuchsia-500/50 text-fuchsia-400 hover:bg-fuchsia-500 hover:text-black transition-all duration-300 rounded-full uppercase tracking-[0.2em] font-bold flex items-center gap-2",
                isTabletOrMobile ? "px-5 py-2 text-[9px]" : "px-8 py-3 text-[10px]"
              )}>
                Criar Vídeo
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-black/90 backdrop-blur-xl border-fuchsia-500/30 text-fuchsia-400 min-w-[180px]">
              <DropdownMenuItem onClick={() => navigate('/video')} className="hover:bg-fuchsia-500/20 focus:bg-fuchsia-500/20 cursor-pointer gap-2">
                <Video className="w-4 h-4" />
                Gerar Vídeo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/video?mode=upscale')} className="hover:bg-fuchsia-500/20 focus:bg-fuchsia-500/20 cursor-pointer gap-2">
                <ArrowUpCircle className="w-4 h-4" />
                Upscale
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </div>
    </div>
  );
};

const DashboardNovo: React.FC = () => {
  const [hoveredSide, setHoveredSide] = useState<Side>(null);
  const isTabletOrMobile = useIsTabletOrMobile();

  const transitionSettings: Transition = {
    type: "spring",
    stiffness: 180,
    damping: 30,
  };

  // Toggle para mobile (click ao invés de hover)
  const handleSideClick = (side: Side) => {
    if (isTabletOrMobile) {
      setHoveredSide(prev => prev === side ? null : side);
    }
  };

  // Animação adaptativa: height em mobile, width em desktop
  const getLeftAnimation = () => {
    if (isTabletOrMobile) {
      return {
        height: hoveredSide === 'left' ? "65%" : hoveredSide === 'right' ? "35%" : "50%",
        filter: hoveredSide === 'right' ? "grayscale(1) brightness(0.5)" : "grayscale(0) brightness(1)"
      };
    }
    return {
      width: hoveredSide === 'left' ? "70%" : hoveredSide === 'right' ? "30%" : "50%",
      filter: hoveredSide === 'right' ? "grayscale(1) brightness(0.5)" : "grayscale(0) brightness(1)"
    };
  };

  const getRightAnimation = () => {
    if (isTabletOrMobile) {
      return {
        height: hoveredSide === 'right' ? "65%" : hoveredSide === 'left' ? "35%" : "50%",
        filter: hoveredSide === 'left' ? "grayscale(1) brightness(0.5)" : "grayscale(0) brightness(1)"
      };
    }
    return {
      width: hoveredSide === 'right' ? "70%" : hoveredSide === 'left' ? "30%" : "50%",
      filter: hoveredSide === 'left' ? "grayscale(1) brightness(0.5)" : "grayscale(0) brightness(1)"
    };
  };

  return (
    <div className={cn(
      "relative w-full h-screen bg-black flex overflow-hidden font-sans antialiased",
      isTabletOrMobile && "flex-col"
    )}>
      {/* Left Side (Top on mobile) */}
      <motion.div
        className={cn(
          "relative flex-shrink-0 z-10",
          isTabletOrMobile ? "w-full" : "h-full"
        )}
        onClick={() => handleSideClick('left')}
        onMouseEnter={!isTabletOrMobile ? () => setHoveredSide('left') : undefined}
        onMouseLeave={!isTabletOrMobile ? () => setHoveredSide(null) : undefined}
        animate={getLeftAnimation()}
        transition={transitionSettings}
      >
        <ImageCarousel isActive={hoveredSide === 'left'} isTabletOrMobile={isTabletOrMobile} />
      </motion.div>

      {/* Central Badge */}
      <div className={cn(
        "absolute z-50 pointer-events-none",
        isTabletOrMobile 
          ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      )}>
        <motion.div 
          animate={{ scale: hoveredSide ? 0.9 : 1, opacity: hoveredSide ? 0.3 : 1 }}
          className={cn(
            "bg-black/40 border border-white/10 backdrop-blur-xl rounded-full shadow-2xl flex items-center gap-3",
            isTabletOrMobile ? "px-4 py-2" : "px-8 py-4 gap-4"
          )}
        >
          <div className={`w-2 h-2 rounded-full ${hoveredSide === 'left' ? 'bg-cyan-400' : 'bg-white/20'}`} />
          <span className={cn(
            "font-black tracking-[0.3em] text-white uppercase",
            isTabletOrMobile ? "text-[10px] tracking-[0.2em]" : "text-sm tracking-[0.5em]"
          )}>Synergy Hub</span>
          <div className={`w-2 h-2 rounded-full ${hoveredSide === 'right' ? 'bg-fuchsia-400' : 'bg-white/20'}`} />
        </motion.div>
      </div>

      {/* Right Side (Bottom on mobile) */}
      <motion.div
        className={cn(
          "relative flex-shrink-0 z-10",
          isTabletOrMobile ? "w-full" : "h-full"
        )}
        onClick={() => handleSideClick('right')}
        onMouseEnter={!isTabletOrMobile ? () => setHoveredSide('right') : undefined}
        onMouseLeave={!isTabletOrMobile ? () => setHoveredSide(null) : undefined}
        animate={getRightAnimation()}
        transition={transitionSettings}
      >
        <VideoLoop isActive={hoveredSide === 'right'} isTabletOrMobile={isTabletOrMobile} />
      </motion.div>
    </div>
  );
};

export default DashboardNovo;
