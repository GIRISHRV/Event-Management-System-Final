"use client";

import { useCallback, useState } from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  animationDuration: number;
  animationDelay: number;
}

interface ConfettiProps {
  pieces: ConfettiPiece[];
}

const COLORS = [
  "#22c55e", // green-500
  "#4ade80", // green-400
  "#86efac", // green-300
  "#f97316", // orange-500
  "#fb923c", // orange-400
  "#fbbf24", // amber-400
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#ffffff", // white
];

// Generate pieces - called outside of render
function generatePieces(count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 20,
      rotation: Math.random() * 360,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 8 + Math.random() * 8,
      animationDuration: 2 + Math.random() * 2,
      animationDelay: Math.random() * 0.5,
    });
  }
  return pieces;
}

// Pure render component
function ConfettiDisplay({ pieces }: ConfettiProps) {
  if (pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-9999 overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.x}%`,
            top: `-${piece.y}px`,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg)`,
            borderRadius: "2px",
            animationDuration: `${piece.animationDuration}s`,
            animationDelay: `${piece.animationDelay}s`,
          }}
        />
      ))}
    </div>
  );
}

// Hook to trigger confetti - manages state and generation
export function useConfetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  const triggerConfetti = useCallback(() => {
    // Generate pieces in event handler (not in effect or render)
    const newPieces = generatePieces(60);
    setPieces(newPieces);
    
    // Clear after animation completes
    setTimeout(() => {
      setPieces([]);
    }, 3500);
  }, []);

  const ConfettiComponent = useCallback(
    () => <ConfettiDisplay pieces={pieces} />,
    [pieces]
  );

  return { triggerConfetti, Confetti: ConfettiComponent };
}
