import { useState, useCallback, useRef, useEffect } from 'react';

export const isPiPSupported =
  typeof window !== 'undefined' && 'documentPictureInPicture' in window;

function cloneStyles(source: Document, target: Document) {
  for (const sheet of Array.from(source.styleSheets)) {
    try {
      if (sheet.href) {
        const link = target.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.head.appendChild(link);
      } else if (sheet.ownerNode) {
        target.head.appendChild(sheet.ownerNode.cloneNode(true));
      }
    } catch {
      // Cross-origin sheets may throw; skip them
    }
  }

  for (const font of Array.from(source.querySelectorAll('link[rel*="font"], link[href*="fonts"]'))) {
    target.head.appendChild(font.cloneNode(true));
  }
}

export function usePictureInPicture() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipRef = useRef<Window | null>(null);

  const isOpen = pipWindow !== null;

  const openPiP = useCallback(async () => {
    if (!isPiPSupported || pipRef.current) return null;

    const pip = await window.documentPictureInPicture!.requestWindow({
      width: 360,
      height: 580,
    });

    cloneStyles(document, pip.document);

    pip.document.body.style.margin = '0';
    pip.document.body.style.background = 'var(--color-bg, #0f1117)';

    pip.addEventListener('pagehide', () => {
      pipRef.current = null;
      setPipWindow(null);
    });

    pipRef.current = pip;
    setPipWindow(pip);
    return pip;
  }, []);

  const closePiP = useCallback(() => {
    if (pipRef.current) {
      pipRef.current.close();
      pipRef.current = null;
      setPipWindow(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      pipRef.current?.close();
    };
  }, []);

  return { pipWindow, isOpen, openPiP, closePiP, isSupported: isPiPSupported };
}
