"use client";

import { useEffect, useState } from "react";
import { X, Share } from "lucide-react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return; // Already installed
    }

    // Check if user dismissed prompt before
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    if (dismissed) return;

    // Check for iOS
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;

    if (isIOS && !isInStandaloneMode) {
      // Show iOS instructions after 30 seconds
      setTimeout(() => {
        setShowIOSPrompt(true);
      }, 30000);
      return;
    }

    // Non-iOS: use beforeinstallprompt
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

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSPrompt(false);
    localStorage.setItem('install-prompt-dismissed', 'true');
  };

  // Shared card styling — opaque, theme-aware, with strong contrast in both modes.
  // Light mode: white card, dark text. Dark mode: near-black card, light text.
  const cardClasses =
    "relative rounded-xl border border-gold p-4 shadow-2xl " +
    "bg-white text-gray-900 " +
    "dark:bg-neutral-900 dark:text-white";

  const closeButtonClasses =
    "absolute right-2 top-2 rounded-lg p-1 " +
    "text-gray-500 hover:bg-gray-100 hover:text-gray-900 " +
    "dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white";

  const subTextClasses = "mt-1 text-sm text-gray-600 dark:text-white/80";

  const tipBoxClasses =
    "mt-3 flex items-start gap-3 rounded-lg p-3 " +
    "bg-gray-100 text-gray-800 " +
    "dark:bg-white/10 dark:text-white/90";

  const secondaryButtonClasses =
    "rounded-lg border px-4 py-2 text-sm font-medium " +
    "border-gray-300 text-gray-700 hover:bg-gray-100 " +
    "dark:border-white/20 dark:text-white dark:hover:bg-white/10";

  // iOS Prompt
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-[200] mx-auto max-w-md">
        <div className={cardClasses}>
          <button
            onClick={handleDismiss}
            className={closeButtonClasses}
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>

          <div className="pr-6">
            <p className="font-semibold">Install PT App</p>
            <p className={subTextClasses}>
              Install the app for quick access and offline workout logging
            </p>

            <div className={tipBoxClasses}>
              <Share size={20} className="mt-0.5 flex-shrink-0 text-gold" />
              <div className="text-sm">
                <p>
                  Tap the <strong>Share</strong> button
                </p>
                <p className="mt-1">
                  Then select <strong>"Add to Home Screen"</strong>
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className={`${secondaryButtonClasses} mt-3 w-full`}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop Prompt
  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[200] mx-auto max-w-md">
      <div className={cardClasses}>
        <button
          onClick={handleDismiss}
          className={closeButtonClasses}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>

        <div className="pr-6">
          <p className="font-semibold">Install PT App</p>
          <p className={subTextClasses}>
            Install the app for quick access and offline workout logging
          </p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-ink hover:bg-gold/90"
            >
              Install
            </button>
            <button onClick={handleDismiss} className={secondaryButtonClasses}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
