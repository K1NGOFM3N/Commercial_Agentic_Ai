'use client'

import { Suspense } from 'react'
import { ConsoleView } from '@/components/agenticos/console-view'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading console…</div>}>
      <ConsoleView />
    </Suspense>
  )
}
