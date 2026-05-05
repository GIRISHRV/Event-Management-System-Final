"use client";

import { useEffect } from "react";

export function ClearServiceWorkers() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
          console.log("Unregistered service worker:", registration);
        }
      });
    }
  }, []);

  return null;
}
