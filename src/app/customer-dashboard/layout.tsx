import React from 'react';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-customer min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
