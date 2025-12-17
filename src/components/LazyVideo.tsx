import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface LazyVideoProps {
  src: string;
  className?: string;
}

export const LazyVideo = ({ src, className }: LazyVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
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
        rootMargin: "200px"
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible && videoRef.current && !hasError) {
      const video = videoRef.current;
      
      const handleCanPlay = () => {
        setIsLoading(false);
        video.play().catch(() => {
          console.log("Video autoplay blocked");
        });
      };

      const handleError = () => {
        setHasError(true);
        setIsLoading(false);
      };

      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);
      
      // Force load
      video.load();

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
      };
    }
  }, [isVisible, hasError]);

  return (
    <div ref={containerRef} className={`${className} relative overflow-hidden`}>
      {/* Loading state */}
      {isVisible && isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      {/* Video */}
      {isVisible && !hasError && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`w-full h-full object-cover transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        >
          <source src={src} type="video/mp4" />
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
