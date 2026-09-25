'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const KEY = 'agenticos-sample-data'

const SampleDataContext = createContext<{
  sampleDataEnabled: boolean
  setSampleDataEnabled: (next: boolean) => void
}>({
  sampleDataEnabled: true,
  setSampleDataEnabled: () => {},
})

export function SampleDataProvider({ children }: { children: ReactNode }) {
  const [sampleDataEnabled, setEnabled] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY)
      if (stored === 'off') setEnabled(false)
      if (stored === 'on') setEnabled(true)
    } catch {
      // storage unavailable
    }
  }, [])

  const setSampleDataEnabled = (next: boolean) => {
    setEnabled(next)
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      // ignore
    }
  }

  return (
    <SampleDataContext.Provider value={{ sampleDataEnabled, setSampleDataEnabled }}>
      {children}
    </SampleDataContext.Provider>
  )
}

export function useSampleData() {
  return useContext(SampleDataContext)
}
