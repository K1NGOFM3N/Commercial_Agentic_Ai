'use client'

import { useParams } from 'next/navigation'
import { JourneyView } from '@/components/agenticos/journey-view'

export default function Page() {
  const params = useParams<{ slug: string }>()
  return <JourneyView slug={params?.slug || ''} />
}
