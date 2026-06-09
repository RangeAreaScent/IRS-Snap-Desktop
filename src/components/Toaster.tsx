import { useEffect, useState } from "react";

interface Toast {
  id: number;
  message: string;
}

const TOAST_EVENT = "snap:toast";
const TOAST_DURATION = 1800;

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(TOAST_EVENT, { detail: message }));
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let nextId = 1;
    function onToast(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (!detail) return;
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message: detail }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, TOAST_DURATION);
    }
    window.addEventListener(TOAST_EVENT, onToast as EventListener);
    return () => window.removeEventListener(TOAST_EVENT, onToast as EventListener);
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className="toaster__item">
          {t.message}
        </div>
      ))}
    </div>
  );
}
