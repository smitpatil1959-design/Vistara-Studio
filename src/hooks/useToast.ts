import { useCallback, useEffect, useRef, useState } from 'react';

interface ToastState {
  toast: string;
  show: (message: string) => void;
}

/** Lightweight transient toast message. */
export function useToast(durationMs = 2400): ToastState {
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback(
    (message: string) => {
      setToast(message);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(''), durationMs);
    },
    [durationMs]
  );

  return { toast, show };
}
