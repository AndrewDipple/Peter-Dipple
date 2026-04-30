"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return; // Already installed
    }

    // Check if user dismissed prompt before
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after 30 seconds (so they get to explore first)
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('User accepted install');
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[200] mx-auto max-w-md">
      <div className="rounded-xl border border-gold bg-ink p-4 shadow-2xl">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="pr-6">
          <p className="font-semibold text-white">Install PT App</p>
          <p className="mt-1 text-sm text-white/80">
            Install the app for quick access and offline workout logging
          </p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink hover:bg-gold/90"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}