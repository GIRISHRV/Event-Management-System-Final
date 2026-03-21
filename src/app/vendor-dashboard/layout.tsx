import React from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';

export const dynamic = 'force-dynamic';

export default function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}
