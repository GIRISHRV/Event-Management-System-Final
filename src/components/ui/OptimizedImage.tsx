"use client";

import { memo, useState } from "react";
import Image, { ImageProps } from "next/image";
import { ImageOff } from "lucide-react";

interface OptimizedImageProps extends Omit<ImageProps, "onError"> {
  fallbackIcon?: React.ReactNode;
  fallbackClassName?: string;
}

export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  fallbackIcon,
  fallbackClassName = "",
  className = "",
  ...props
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // If no src or error, show fallback
  if (!src || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-zinc-800 ${fallbackClassName || className}`}
        aria-label={alt}
      >
        {fallbackIcon || <ImageOff className="w-8 h-8 text-zinc-600" />}
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div
          className={`absolute inset-0 bg-zinc-800 animate-pulse ${className}`}
          aria-hidden="true"
        />
      )}
      <Image
        src={src}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoading ? "opacity-0" : "opacity-100"} ${className}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        loading="lazy"
        {...props}
      />
    </>
  );
});
