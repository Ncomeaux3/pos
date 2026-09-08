'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

// Every save in the design raises a toast that says where the record went, so
// this is app-wide rather than per screen. Fifty lines beats a dependency.

type Toast = { id: number; message: string }

const ToastContext = createContext<(message: string) => void>(() => {})

/** `toast("Filed to Records")`. Auto dismisses after four seconds. */
export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string) => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), message }])
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            message={t.message}
            onDone={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="pointer-events-auto border border-brand bg-bg-elev px-4 py-2.5 text-[13px] text-ink duration-200 animate-in fade-in slide-in-from-bottom-2">
      {message}
    </div>
  )
}
