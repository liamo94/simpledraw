import { useState, useEffect } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useMutation } from '@tanstack/react-query'
import { loadStrokes, loadView } from '../canvas/storage'
import { getImageDataUrlFromIdb } from '../canvas/imageStore'

const migrationKey = (userId: string) => `drawtool-migrated-${userId}`
const LOCAL_CANVAS_MAX = 9
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

export type LocalCanvas = {
  index: number
  name: string
  strokeCount: number
}

export function useMigration(
  canvasLimit: number = 3,
  planLoading: boolean = false,
  workspacesLoaded: boolean = false,
  hasCloudCanvases: boolean = false,
  isDark: boolean = false,
) {
  const { isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [localCanvases, setLocalCanvases] = useState<LocalCanvas[]>([])

  useEffect(() => {
    if (!isSignedIn || planLoading || !user || !workspacesLoaded) return
    if (localStorage.getItem(migrationKey(user.id))) return
    // Already has cloud canvases — mark migration done, no modal needed
    if (hasCloudCanvases) {
      localStorage.setItem(migrationKey(user.id), '1')
      return
    }

    const found: LocalCanvas[] = []
    for (let i = 1; i <= LOCAL_CANVAS_MAX; i++) {
      const strokes = loadStrokes(i)
      if (strokes.length > 0) {
        const name = localStorage.getItem(`drawtool-canvas-name-${i}`) ?? `Canvas ${i}`
        found.push({ index: i, name, strokeCount: strokes.length })
      }
    }

    if (found.length > 0) {
      setLocalCanvases(found)
      setShowModal(true)
    } else {
      localStorage.setItem(migrationKey(user.id), '1')
    }
  }, [isSignedIn, planLoading, user?.id, workspacesLoaded, hasCloudCanvases])

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken()
      const canvases = await Promise.all(localCanvases.map(async ({ index, name }) => {
        const strokes = loadStrokes(index)
        const view = loadView(index)
        const imageIds = [...new Set(strokes.flatMap(s => s.imageId ? [s.imageId] : []))]
        const images: Record<string, string> = {}
        await Promise.all(imageIds.map(async id => {
          const url = await getImageDataUrlFromIdb(id)
          if (url) images[id] = url
        }))
        return {
          name,
          data: { strokes, view, savedDark: isDark, ...(Object.keys(images).length > 0 ? { images } : {}) },
        }
      }))
      const res = await fetch(`${API_URL}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ canvases }),
      })
      if (!res.ok) throw new Error('Migration failed')
    },
    onSuccess: () => {
      if (user) localStorage.setItem(migrationKey(user.id), '1')
      setShowModal(false)
    },
  })

  function skip() {
    if (user) localStorage.setItem(migrationKey(user.id), '1')
    setShowModal(false)
  }

  const willMigrateCount = Math.min(localCanvases.length, canvasLimit)
  const skippedCount = localCanvases.length - willMigrateCount

  return {
    showModal, localCanvases, willMigrateCount, skippedCount,
    migrate: () => migrateMutation.mutateAsync(),
    skip,
    migrating: migrateMutation.isPending,
    error: migrateMutation.isError ? 'Something went wrong. Please try again.' : null,
  }
}
