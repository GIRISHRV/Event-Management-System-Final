import React from 'react';

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-vendor min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
