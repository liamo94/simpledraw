import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth, useUser } from '@clerk/clerk-react'
import { createApi } from '../lib/api'
import { useTokenReady } from './useTokenReady'

export type UserPlan = 'free' | 'pro'
export type Subscription = { status: string; cancelAt: number | null }

type PlanData = { plan: UserPlan; subscription: Subscription | null }

export async function openBillingPortal(getToken: () => Promise<string | null>): Promise<boolean> {
  const api = createApi(getToken)
  try {
    const { url } = await api.post<{ url: string }>('/stripe/portal', { returnUrl: window.location.href })
    if (url) { window.location.href = url; return true }
    return false
  } catch {
    return false
  }
}

export function useUserPlan() {
  const { isSignedIn, isLoaded: clerkLoaded } = useUser()
  const { getToken } = useAuth()

  const api = useMemo(() => createApi(getToken), [getToken])
  const tokenReady = useTokenReady()

  const { data, isPending } = useQuery({
    queryKey: ['plan'],
    queryFn: async (): Promise<PlanData> => {
      const { plan, subscription } = await api.get<{ plan: string; subscription: Subscription | null }>('/stripe/status')
      return {
        plan: plan === 'pro' ? 'pro' : 'free',
        subscription: subscription ?? null,
      }
    },
    enabled: isSignedIn === true && tokenReady,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const plan = data?.plan ?? 'free'
  const planLoading = !clerkLoaded || (isPending && isSignedIn === true)

  return {
    plan,
    isPro: plan === 'pro',
    canvasLimit: plan === 'pro' ? 9 : 3,
    planLoading,
    subscription: data?.subscription ?? null,
  }
}
