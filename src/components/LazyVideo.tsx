import { useEffect, useRef, useState } from "react";

interface LazyVideoProps {
  src: string;
  poster?: string;
  className?: string;
  priority?: boolean;
}

export const LazyVideo = ({ src, poster, className, priority = false }: LazyVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(priority);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Intersection Observer for non-priority videos
  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { 
        threshold: 0.1,
        rootMargin: "400px"
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  // Play video when visible
  useEffect(() => {
    if (isVisible && videoRef.current && !hasError) {
      const video = videoRef.current;
      
      const handleCanPlay = () => {
        setIsLoading(false);
        setIsPlaying(true);
        video.play().catch(() => {
          console.log("Video autoplay blocked");
        });
      };

      const handleError = () => {
        setHasError(true);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
      };
    }
  }, [isVisible, hasError]);

  // Determine video type from src
  const getVideoType = (url: string) => {
    if (url.includes('.webm')) return 'video/webm';
    return 'video/mp4';
  };

  return (
    <div ref={containerRef} className={`${className} relative overflow-hidden`}>
      {/* Loading state - animated gradient when no poster */}
      {isVisible && isLoading && !poster && !hasError && (
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-900/40 via-gray-900/60 to-gray-900/80 animate-pulse" />
      )}
      
      {/* Poster shown until video plays */}
      {poster && !isPlaying && !hasError && (
        <img
          src={poster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading={priority ? "eager" : "lazy"}
        />
      )}
      
      {/* Video */}
      {isVisible && !hasError && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload={priority ? "auto" : "metadata"}
          poster={poster}
          className={`w-full h-full object-cover transition-opacity duration-300 ${!isPlaying && poster ? 'opacity-0' : 'opacity-100'}`}
        >
          <source src={src} type={getVideoType(src)} />
        </video>
      )}
      
      {/* Error fallback */}
      {hasError && (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Vídeo indisponível</div>
        </div>
      )}
    </div>
  );
};
