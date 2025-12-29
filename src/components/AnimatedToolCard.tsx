import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Tool {
  name: string;
  images?: string[];
  image?: string;
  path?: string;
  hasArrow?: boolean;
  animated?: boolean;
}

interface AnimatedToolCardProps {
  tool: Tool;
}

export const AnimatedToolCard = ({ tool }: AnimatedToolCardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Preload images
  useEffect(() => {
    if (tool.animated && tool.images) {
      tool.images.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    }
  }, [tool.images, tool.animated]);

  // Animate through images
  useEffect(() => {
    if (!tool.animated || !tool.images || tool.images.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setIsTransitioning(true);
      
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % tool.images!.length);
        setIsTransitioning(false);
      }, 300); // Half of transition duration
    }, 1500); // Change every 1.5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [tool.animated, tool.images]);

  const currentImage = tool.animated && tool.images 
    ? tool.images[currentIndex] 
    : tool.image;

  return (
    <div 
      onClick={() => tool.path && navigate(tool.path)}
      className="group relative flex-shrink-0 w-[140px] cursor-pointer"
    >
      <div className="relative rounded-xl overflow-hidden aspect-[3/4] bg-card hover:ring-2 hover:ring-primary/50 transition-all">
        <img
          src={currentImage}
          alt={tool.name}
          className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${
            isTransitioning ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
      <div className="flex items-center justify-center gap-1 mt-2">
        <span className="text-xs font-medium text-foreground">{tool.name}</span>
        <ArrowRight className="w-3 h-3 text-muted-foreground" />
      </div>
    </div>
  );
};
