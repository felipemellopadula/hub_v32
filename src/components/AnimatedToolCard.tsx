import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Tool {
  name: string;
  images?: string[];
  image?: string;
  video?: string;
  path?: string;
  hasArrow?: boolean;
  animated?: boolean;
  speed?: number;
}

interface AnimatedToolCardProps {
  tool: Tool;
}

export const AnimatedToolCard = ({ tool }: AnimatedToolCardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  // Preload images
  useEffect(() => {
    if (tool.animated && tool.images) {
      tool.images.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    }
  }, [tool.images, tool.animated]);

  // Animate through images - simple index rotation
  useEffect(() => {
    if (!tool.animated || !tool.images || tool.images.length <= 1) return;

    const intervalSpeed = tool.speed || 1500;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tool.images!.length);
    }, intervalSpeed);

    return () => clearInterval(interval);
  }, [tool.animated, tool.images, tool.speed]);

  // Get current and next image for crossfade
  const images = tool.images || [tool.image];
  const currentImage = images[currentIndex];
  const nextImage = images[(currentIndex + 1) % images.length];

  return (
    <div 
      onClick={() => tool.path && navigate(tool.path)}
      className="group relative flex-shrink-0 w-[140px] cursor-pointer"
    >
      <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-card hover:ring-2 hover:ring-primary/50 transition-all">
        {/* Video, animated images, or static image */}
        {tool.video ? (
          <video
            src={tool.video}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-200"
          />
        ) : tool.animated && images.length > 1 ? (
          images.map((img, index) => (
            <img
              key={img}
              src={img}
              alt={tool.name}
              className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-opacity duration-300 ${
                index === currentIndex ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))
        ) : (
          <img
            src={currentImage}
            alt={tool.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-200"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
      <div className="flex items-center justify-center gap-1 mt-2">
        <span className="text-xs font-medium text-foreground">{tool.name}</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
      </div>
    </div>
  );
};
