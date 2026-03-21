"use client";

import React from "react";
import Squares from "@/components/ui/Squares";

interface BackgroundEffectsProps {
    variant?: "squares" | "gradient";
    className?: string;
}

const BackgroundEffects: React.FC<BackgroundEffectsProps> = ({ variant = "squares", className }) => {
    return (
        <div className={`fixed inset-0 z-0 pointer-events-none overflow-hidden ${className}`}>
            {variant === "squares" && (
                <>
                    <div className="absolute inset-0 opacity-10">
                        <Squares
                            direction="diagonal"
                            speed={0.3}
                            squareSize={40}
                            borderColor="rgba(37, 99, 235, 0.08)"
                            hoverFillColor="rgba(37, 99, 235, 0.05)"
                        />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#1a1a1a]/60 to-[#1a1a1a]" />
                </>
            )}

            {variant === "gradient" && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#2563eb]/5 via-[#1a1a1a] to-[#1a1a1a]" />
            )}
        </div>
    );
};

export { BackgroundEffects };
export default BackgroundEffects;
