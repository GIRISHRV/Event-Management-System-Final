import { Loader2 } from "lucide-react";
import Squares from "./Squares";

interface LoadingScreenProps {
  message?: string;
  isLoading?: boolean;
}

export function LoadingScreen({ message = "Loading...", isLoading = true }: LoadingScreenProps) {
  // Simple approach: render based on isLoading prop directly with CSS transitions
  if (!isLoading) return null;

  return (
    <div 
      className="fixed inset-0 z-100 bg-zinc-950 flex items-center justify-center overflow-hidden animate-fade-in"
    >
      <div className="absolute inset-0 z-0">
        <Squares
          direction="diagonal"
          speed={0.8}
          borderColor="rgba(34, 197, 94, 0.3)"
          squareSize={40}
          hoverFillColor="rgba(34, 197, 94, 0.1)"
        />
      </div>
      
      <div className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-2xl bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 shadow-2xl">
        <div className="relative">
          <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full animate-pulse" />
          <Loader2 className="w-10 h-10 text-green-500 animate-spin relative z-10" />
        </div>
        <p className="text-zinc-400 font-medium animate-pulse">{message}</p>
      </div>
    </div>
  );
}
