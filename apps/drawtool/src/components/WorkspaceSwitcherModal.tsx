import { useState, useEffect, useRef, useCallback } from 'react'
import type { CloudWorkspace } from '../hooks/useCloudCanvas'
import type { Theme } from '../hooks/useSettings'
import { getPanelBackground } from '../canvas/canvasUtils'

type Props = {
  allWorkspaces: CloudWorkspace[]
  activeWorkspaceId: string | null
  activeCanvasId: string | null
  isPro: boolean
  loading: boolean
  isDark: boolean
  theme: Theme
  onSelectCanvas: (workspaceId: string, canvasId: string) => void
  onSelectWorkspace: (workspaceId: string) => void
  onCreateWorkspace: (name: string) => void
  onRenameCanvas: (id: string, name: string) => Promise<boolean>
  onRenameWorkspace: (id: string, name: string) => Promise<boolean>
  onRemoveCanvas: (id: string, isLast: boolean) => Promise<boolean>
  onDeleteWorkspace: (id: string) => Promise<boolean>
  onResetWorkspace: (id: string) => Promise<boolean>
  showTips: boolean
  onClose: () => void
  onPrefetchThumbnail: (id: string) => Promise<string | null>
}

type Editing =
  | { kind: 'workspace'; id: string; name: string }
  | { kind: 'canvas'; id: string; name: string }
  | null

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1.5" y1="2.5" x2="8.5" y2="2.5" />
      <path d="M3.5 2.5V1.5h3v1" />
      <rect x="2" y="2.5" width="6" height="6.5" rx="0.75" />
      <line x1="4" y1="4.5" x2="4" y2="7.5" />
      <line x1="6" y1="4.5" x2="6" y2="7.5" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5l1.5 1.5L3 8.5H1.5V7L7 1.5z" />
    </svg>
  )
}

export default function WorkspaceSwitcherModal({
  allWorkspaces,
  activeWorkspaceId,
  activeCanvasId,
  isPro,
  loading,
  isDark,
  theme,
  showTips,
  onSelectCanvas,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameCanvas,
  onRenameWorkspace,
  onRemoveCanvas,
  onDeleteWorkspace,
  onResetWorkspace,
  onClose,
  onPrefetchThumbnail,
}: Props) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ kind: 'workspace' | 'canvas'; id: string } | null>(null)
  const [creatingWs, setCreatingWs] = useState(false)
  const [newWsName, setNewWsName] = useState('')
  const [viewingWsId, setViewingWsId] = useState<string | null>(null)
  const [showAllWs, setShowAllWs] = useState(false)
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>()
    for (const ws of allWorkspaces) {
      for (const canvas of ws.canvases) {
        const url = localStorage.getItem(`drawtool-thumb-${canvas.id}`)
        if (url) map.set(canvas.id, url)
      }
    }
    return map
  })

  useEffect(() => {
    const missing = allWorkspaces
      .flatMap(ws => ws.canvases)
      .filter(c => !thumbnails.has(c.id) && c.is_empty !== 1)
    if (missing.length === 0) return
    for (const canvas of missing) {
      onPrefetchThumbnail(canvas.id).then(url => {
        if (url) setThumbnails(prev => new Map(prev).set(canvas.id, url))
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const searchRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const newWsInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    } else if (creatingWs) {
      newWsInputRef.current?.focus()
    } else {
      searchRef.current?.focus()
    }
  }, [editing?.id, editing?.kind, creatingWs])

  const q = query.trim().toLowerCase()

  const filtered = allWorkspaces
    .map(ws => ({
      ...ws,
      canvases: q
        ? ws.canvases.filter(c => c.name.toLowerCase().includes(q) || ws.name.toLowerCase().includes(q))
        : ws.canvases,
    }))
    .filter(ws => !q || ws.canvases.length > 0 || ws.name.toLowerCase().includes(q))

  const viewingWs = filtered.find(w => w.id === (viewingWsId ?? activeWorkspaceId)) ?? filtered[0] ?? null

  const activate = useCallback((workspaceId: string, canvasId?: string) => {
    if (canvasId) onSelectCanvas(workspaceId, canvasId)
    else onSelectWorkspace(workspaceId)
    onClose()
  }, [onSelectCanvas, onSelectWorkspace, onClose])

  function startEdit(e: React.MouseEvent, kind: 'workspace' | 'canvas', id: string, name: string) {
    e.stopPropagation()
    setConfirmDelete(null)
    setEditing({ kind, id, name })
  }

  function requestDelete(e: React.MouseEvent, kind: 'workspace' | 'canvas', id: string) {
    e.stopPropagation()
    setEditing(null)
    setConfirmDelete(prev => (prev?.id === id ? null : { kind, id }))
  }

  async function confirmDeleteAction(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirmDelete) return
    const { kind, id } = confirmDelete
    setConfirmDelete(null)
    if (kind === 'canvas') {
      const ws = allWorkspaces.find(w => w.canvases.some(c => c.id === id))
      await onRemoveCanvas(id, (ws?.canvases.length ?? 1) === 1)
    } else if (allWorkspaces.length === 1) {
      await onResetWorkspace(id)
    } else {
      await onDeleteWorkspace(id)
    }
  }

  async function commitEdit() {
    if (!editing) return
    const trimmed = editing.name.trim()
    if (trimmed && trimmed !== (editing.kind === 'workspace'
      ? allWorkspaces.find(w => w.id === editing.id)?.name
      : allWorkspaces.flatMap(w => w.canvases).find(c => c.id === editing.id)?.name)) {
      if (editing.kind === 'workspace') await onRenameWorkspace(editing.id, trimmed)
      else await onRenameCanvas(editing.id, trimmed)
    }
    setEditing(null)
  }

  function editInputKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { e.preventDefault(); setEditing(null) }
  }

  function submitNewWorkspace() {
    const name = newWsName.trim()
    setCreatingWs(false)
    setNewWsName('')
    onCreateWorkspace(name)
    onClose()
  }

  const iconBtn = `shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-white/30 hover:text-white/70 hover:bg-white/10' : 'text-black/25 hover:text-black/60 hover:bg-black/[0.07]'}`

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center pt-[8vh]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative z-10 w-[min(860px,calc(100vw-2rem))] rounded-2xl border shadow-2xl flex flex-col h-[min(84vh,720px)] ${isDark ? 'border-white/12' : 'border-black/10'}`}
        style={{ background: getPanelBackground(theme) }}
        onKeyDown={e => {
          if (editing || creatingWs) return
          if (e.key === 'Escape') { e.preventDefault(); onClose() }
          if (e.ctrlKey && e.key === 'n' && isPro && !loading) { e.preventDefault(); setCreatingWs(true) }
          if (!q && !showAllWs && viewingWs) {
            const num = parseInt(e.key)
            if (num >= 1 && num <= 9) {
              const canvas = viewingWs.canvases.find(c => c.position + 1 === num)
              if (canvas) { e.preventDefault(); activate(viewingWs.id, canvas.id) }
            }
          }
        }}
      >
        {/* Search header */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b shrink-0 ${isDark ? 'border-white/10' : 'border-black/8'}`}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={`shrink-0 ${isDark ? 'text-white/30' : 'text-black/30'}`}>
            <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="15" y2="15" />
          </svg>
          {isPro ? (
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Escape') { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation() }
                if (e.ctrlKey && e.key === 'n' && isPro && !loading) { e.preventDefault(); setCreatingWs(true) }
                if (!query && !showAllWs && viewingWs) {
                  const num = parseInt(e.key)
                  if (num >= 1 && num <= 9) {
                    const canvas = viewingWs.canvases.find(c => c.position + 1 === num)
                    if (canvas) { e.preventDefault(); activate(viewingWs.id, canvas.id) }
                  }
                }
              }}
              placeholder="Search workspaces and canvases…"
              className={`flex-1 bg-transparent outline-none text-sm placeholder:opacity-30 ${isDark ? 'text-white/85' : 'text-black/85'}`}
            />
          ) : (
            <span className={`flex-1 text-sm ${isDark ? 'text-white/70' : 'text-black/70'}`}>My Workspace</span>
          )}
          <button
            onClick={onClose}
            className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'text-white/30 hover:text-white/70 hover:bg-white/10' : 'text-black/25 hover:text-black/60 hover:bg-black/[0.07]'}`}
          >
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>

        {q ? (
          /* ── Search results ── */
          <div className="flex-1 overflow-y-auto py-2">
            {filtered.length === 0 && (
              <div className={`px-4 py-12 text-center text-sm ${isDark ? 'text-white/30' : 'text-black/30'}`}>No results</div>
            )}
            {filtered.flatMap(ws => [
              <div
                key={`ws-${ws.id}`}
                onClick={() => activate(ws.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 mx-2 mb-0.5 rounded-lg cursor-pointer transition-all ${
                  ws.id === activeWorkspaceId
                    ? isDark ? 'bg-[#3b82f6]/10 ring-1 ring-[#3b82f6]/25' : 'bg-blue-500/7 ring-1 ring-blue-500/20'
                    : isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.03]'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"
                  className={ws.id === activeWorkspaceId ? isDark ? 'text-[#3b82f6]/70' : 'text-blue-500/70' : isDark ? 'text-white/30' : 'text-black/25'}>
                  <rect x="1" y="1" width="10" height="10" rx="2" /><line x1="1" y1="4.5" x2="11" y2="4.5" /><line x1="4" y1="4.5" x2="4" y2="11" />
                </svg>
                <span className={`flex-1 text-[11px] font-bold uppercase tracking-widest truncate ${
                  ws.id === activeWorkspaceId ? isDark ? 'text-[#93c5fd]' : 'text-blue-600' : isDark ? 'text-white/55' : 'text-black/50'
                }`}>{ws.name}</span>
                <span className={`text-[9px] ${isDark ? 'text-white/20' : 'text-black/20'}`}>Workspace</span>
              </div>,
              ...ws.canvases.map(canvas => {
                const isActive = canvas.id === activeCanvasId
                const isEmpty = canvas.is_empty === 1
                return (
                  <div
                    key={canvas.id}
                    onClick={() => activate(ws.id, canvas.id)}
                    className={`flex items-center gap-2.5 pl-6 pr-3 py-2 mx-2 mb-0.5 rounded-lg cursor-pointer transition-all ${
                      isActive
                        ? isDark ? 'bg-[#3b82f6]/8 ring-1 ring-[#3b82f6]/20' : 'bg-blue-500/6 ring-1 ring-blue-500/15'
                        : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.03]'
                    }`}
                  >
                    <span className={`w-[18px] h-[18px] flex items-center justify-center rounded text-[9px] font-bold tabular-nums shrink-0 ${
                      isActive ? 'bg-[#3b82f6] text-white' : isEmpty ? isDark ? 'bg-white/5 text-white/18' : 'bg-black/4 text-black/18' : isDark ? 'bg-white/8 text-white/35' : 'bg-black/6 text-black/30'
                    }`}>{canvas.position + 1}</span>
                    <span className={`flex-1 text-sm font-semibold truncate ${
                      isEmpty ? isDark ? 'text-white/20' : 'text-black/20'
                      : isActive ? isDark ? 'text-[#93c5fd]' : 'text-blue-600'
                      : isDark ? 'text-white/65' : 'text-black/60'
                    }`}>{canvas.name || `Canvas ${canvas.position + 1}`}</span>
                    <span className={`text-[9px] truncate max-w-[100px] ${isDark ? 'text-white/18' : 'text-black/18'}`}>{ws.name}</span>
                  </div>
                )
              })
            ])}
          </div>
        ) : (
          <>
            {/* ── Workspace tab strip ── */}
            <div className={`shrink-0 flex items-center border-b ${isDark ? 'border-white/[0.07]' : 'border-black/[0.05]'}`}>
              <div className="flex items-center gap-1.5 px-4 py-3 overflow-x-auto flex-1 min-w-0" style={{ scrollbarWidth: 'none' }}>
                {filtered.map(ws => {
                  const isViewing = !showAllWs && ws.id === (viewingWsId ?? activeWorkspaceId)
                  const isActiveWs = ws.id === activeWorkspaceId
                  return (
                    <button
                      key={ws.id}
                      onClick={() => { setViewingWsId(ws.id); setShowAllWs(false) }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap ${
                        isViewing
                          ? isDark ? 'bg-white/10 text-white/90' : 'bg-black/8 text-black/80'
                          : isDark ? 'text-white/35 hover:text-white/65 hover:bg-white/[0.06]' : 'text-black/35 hover:text-black/65 hover:bg-black/[0.04]'
                      }`}
                    >
                      {isActiveWs && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDark ? 'bg-[#93c5fd]' : 'bg-blue-500'}`} />}
                      <span className="uppercase tracking-wider">{ws.name}</span>
                      <span className={`tabular-nums ${isViewing ? 'opacity-50' : 'opacity-40'}`}>{ws.canvases.length}</span>
                    </button>
                  )
                })}
              </div>
              <div className={`shrink-0 px-2 py-1.5 border-l ${isDark ? 'border-white/[0.07]' : 'border-black/[0.05]'}`}>
                <button
                  onClick={() => setShowAllWs(v => !v)}
                  title="View all workspaces"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                    showAllWs
                      ? isDark ? 'bg-white/10 text-white/90' : 'bg-black/8 text-black/80'
                      : isDark ? 'text-white/35 hover:text-white/65 hover:bg-white/[0.06]' : 'text-black/35 hover:text-black/65 hover:bg-black/[0.04]'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="1" y1="3" x2="11" y2="3" /><line x1="1" y1="6" x2="11" y2="6" /><line x1="1" y1="9" x2="11" y2="9" />
                  </svg>
                  All
                </button>
              </div>
            </div>

            {/* ── All workspaces list ── */}
            {showAllWs && (
              <div className="flex-1 min-h-0 overflow-y-auto py-3 px-3">
                {filtered.map(ws => {
                  const isActiveWs = ws.id === activeWorkspaceId
                  const emptyCount = ws.canvases.filter(c => c.stroke_count === 0).length
                  const usedCount = ws.canvases.length - emptyCount
                  return (
                    <button
                      key={ws.id}
                      onClick={() => { setViewingWsId(ws.id); setShowAllWs(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 mb-1 rounded-xl text-left transition-all ${
                        isActiveWs
                          ? isDark ? 'bg-[#3b82f6]/10 ring-1 ring-[#3b82f6]/25' : 'bg-blue-500/7 ring-1 ring-blue-500/20'
                          : isDark ? 'hover:bg-white/[0.05]' : 'hover:bg-black/[0.03]'
                      }`}
                    >
                      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4"
                        className={isActiveWs ? isDark ? 'text-[#93c5fd]' : 'text-blue-500' : isDark ? 'text-white/30' : 'text-black/25'}>
                        <rect x="1" y="1" width="10" height="10" rx="2" /><line x1="1" y1="4.5" x2="11" y2="4.5" /><line x1="4" y1="4.5" x2="4" y2="11" />
                      </svg>
                      <span className={`flex-1 text-sm font-semibold truncate ${
                        isActiveWs ? isDark ? 'text-[#93c5fd]' : 'text-blue-600' : isDark ? 'text-white/75' : 'text-black/70'
                      }`}>{ws.name}</span>
                      <span className={`text-[11px] tabular-nums ${isDark ? 'text-white/30' : 'text-black/30'}`}>
                        {usedCount}/{ws.canvases.length}
                      </span>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        className={isDark ? 'text-white/20' : 'text-black/20'}>
                        <path d="M3 2l4 3-4 3" />
                      </svg>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Canvas grid ── */}
            {!showAllWs && <div className="flex-1 min-h-0 overflow-y-auto p-5">
              {viewingWs ? (
                <>
                  {/* Workspace header */}
                  {(() => {
                    const isEditingWs = editing?.kind === 'workspace' && editing.id === viewingWs.id
                    const isConfirmingWs = confirmDelete?.id === viewingWs.id && confirmDelete.kind === 'workspace'
                    return (
                      <div className="flex items-center gap-2 mb-4">
                        {isEditingWs ? (
                          <input
                            ref={editInputRef}
                            value={editing!.name}
                            onChange={e => setEditing(ed => ed ? { ...ed, name: e.target.value } : ed)}
                            onBlur={commitEdit}
                            onKeyDown={editInputKeyDown}
                            className={`flex-1 text-sm font-semibold rounded-lg px-2 py-1 outline-none ${isDark ? 'bg-white/8 border border-white/20 text-white/85' : 'bg-black/5 border border-black/15 text-black/80'}`}
                          />
                        ) : (
                          <span className={`flex-1 text-sm font-semibold ${isDark ? 'text-white/40' : 'text-black/35'}`}>
                            {viewingWs.name}
                          </span>
                        )}
                        {isConfirmingWs ? (
                          <>
                            <span className={`text-[10px] font-semibold ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                              {allWorkspaces.length === 1 ? 'Reset?' : 'Delete?'}
                            </span>
                            <button onClick={confirmDeleteAction} className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-md ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-500/10'}`}>✓</button>
                            <button onClick={e => { e.stopPropagation(); setConfirmDelete(null) }} className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-md ${isDark ? 'text-white/30 hover:bg-white/10' : 'text-black/30 hover:bg-black/7'}`}>✕</button>
                          </>
                        ) : !isEditingWs && (
                          <div className="flex items-center gap-0.5">
                            <button onClick={e => startEdit(e, 'workspace', viewingWs.id, viewingWs.name)} className={iconBtn}><PencilIcon /></button>
                            <button onClick={e => requestDelete(e, 'workspace', viewingWs.id)} className={iconBtn}><TrashIcon /></button>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {viewingWs.canvases.length === 0 && (
                    <div className={`py-16 text-center text-sm ${isDark ? 'text-white/20' : 'text-black/20'}`}>No canvases yet</div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    {viewingWs.canvases.map(canvas => {
                      const isActive = canvas.id === activeCanvasId
                      const isEmpty = canvas.is_empty === 1
                      const strokeCount = !isEmpty && (canvas.stroke_count ?? 0) > 0 ? canvas.stroke_count : null
                      const displayName = canvas.name || `Canvas ${canvas.position + 1}`
                      const isEditingCanvas = editing?.kind === 'canvas' && editing.id === canvas.id
                      const isConfirmingCanvas = confirmDelete?.id === canvas.id && confirmDelete.kind === 'canvas'

                      return (
                        <div
                          key={canvas.id}
                          onClick={() => !isEditingCanvas && !isConfirmingCanvas && activate(viewingWs.id, canvas.id)}
                          className="group flex flex-col gap-2 cursor-pointer"
                        >
                          {/* Preview card */}
                          <div
                            className={`relative rounded-xl overflow-hidden transition-all duration-150 ${
                              isActive
                                ? isDark ? 'ring-2 ring-[#3b82f6]/60' : 'ring-2 ring-blue-500/50'
                                : isDark ? 'ring-1 ring-white/[0.08] group-hover:ring-white/20' : 'ring-1 ring-black/[0.07] group-hover:ring-black/15'
                            }`}
                            style={{
                              paddingTop: '65%',
                              background: isActive
                                ? isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)'
                                : isEmpty
                                  ? isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'
                                  : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                              backgroundImage: isEmpty
                                ? isDark
                                  ? 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)'
                                  : 'radial-gradient(circle, rgba(0,0,0,0.09) 1px, transparent 1px)'
                                : undefined,
                              backgroundSize: isEmpty ? '18px 18px' : undefined,
                            }}
                          >
                            {/* Thumbnail */}
                            {thumbnails.has(canvas.id) && (
                              <img
                                src={thumbnails.get(canvas.id)}
                                alt=""
                                className="absolute inset-0 w-full h-full object-contain"
                                draggable={false}
                              />
                            )}

                            {/* Number badge */}
                            <span className={`absolute top-2.5 left-2.5 w-[22px] h-[22px] flex items-center justify-center rounded-lg text-[10px] font-bold tabular-nums ${
                              isActive ? 'bg-[#3b82f6] text-white'
                              : isEmpty ? isDark ? 'bg-white/6 text-white/20' : 'bg-black/5 text-black/20'
                              : isDark ? 'bg-white/10 text-white/50' : 'bg-black/8 text-black/40'
                            }`}>
                              {canvas.position + 1}
                            </span>

                            {/* Stroke count */}
                            {strokeCount !== null && !thumbnails.has(canvas.id) && (
                              <span className={`absolute bottom-2 right-2.5 text-[10px] tabular-nums ${isDark ? 'text-white/20' : 'text-black/20'}`}>
                                {strokeCount}
                              </span>
                            )}

                            {/* Hover actions */}
                            {!isConfirmingCanvas && (
                              <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={e => startEdit(e, 'canvas', canvas.id, canvas.name)} className={iconBtn}><PencilIcon /></button>
                                <button onClick={e => requestDelete(e, 'canvas', canvas.id)} className={iconBtn}><TrashIcon /></button>
                              </div>
                            )}

                            {/* Confirm delete overlay */}
                            {isConfirmingCanvas && (
                              <div className="absolute inset-0 flex items-center justify-center gap-2 backdrop-blur-sm"
                                style={{ background: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }}>
                                <span className={`text-[11px] font-semibold ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                                  {viewingWs.canvases.length === 1 ? 'Clear?' : 'Delete?'}
                                </span>
                                <button onClick={confirmDeleteAction} className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-500/10'}`}>✓</button>
                                <button onClick={e => { e.stopPropagation(); setConfirmDelete(null) }} className={`w-6 h-6 flex items-center justify-center rounded-md text-sm ${isDark ? 'text-white/50 hover:bg-white/10' : 'text-black/50 hover:bg-black/7'}`}>✕</button>
                              </div>
                            )}
                          </div>

                          {/* Canvas name */}
                          {isEditingCanvas ? (
                            <input
                              ref={editInputRef}
                              value={editing!.name}
                              onChange={e => setEditing(ed => ed ? { ...ed, name: e.target.value } : ed)}
                              onBlur={commitEdit}
                              onClick={e => e.stopPropagation()}
                              onKeyDown={editInputKeyDown}
                              className={`text-[13px] font-semibold rounded-md px-2 py-0.5 outline-none w-full ${isDark ? 'bg-white/8 border border-white/20 text-white/85' : 'bg-black/5 border border-black/15 text-black/85'}`}
                            />
                          ) : (
                            <span className={`text-[13px] font-semibold truncate px-0.5 ${
                              isEmpty ? isDark ? 'text-white/18' : 'text-black/18'
                              : isActive ? isDark ? 'text-[#93c5fd]' : 'text-blue-600'
                              : isDark ? 'text-white/70' : 'text-black/65'
                            }`}>
                              {displayName}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </div>}
          </>
        )}

        {/* Footer */}
        <div className={`border-t px-4 py-2 flex items-center gap-2 shrink-0 ${isDark ? 'border-white/10' : 'border-black/8'}`}>
          {creatingWs ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                ref={newWsInputRef}
                value={newWsName}
                onChange={e => setNewWsName(e.target.value)}
                onKeyDown={e => {
                  e.stopPropagation(); e.nativeEvent.stopImmediatePropagation()
                  if (e.key === 'Enter') { e.preventDefault(); submitNewWorkspace() }
                  if (e.key === 'Escape') { e.preventDefault(); setCreatingWs(false); setNewWsName('') }
                }}
                placeholder={`Workspace ${allWorkspaces.length + 1}`}
                className={`flex-1 text-sm bg-transparent outline-none placeholder:opacity-30 ${isDark ? 'text-white/85' : 'text-black/85'}`}
              />
              <button onClick={submitNewWorkspace} className={`shrink-0 text-xs px-2.5 py-1 rounded-md transition-colors ${isDark ? 'text-white/60 hover:text-white/90 hover:bg-white/8' : 'text-black/55 hover:text-black/85 hover:bg-black/5'}`}>
                Create
              </button>
              <button onClick={() => { setCreatingWs(false); setNewWsName('') }} className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition-colors ${isDark ? 'text-white/25 hover:text-white/55 hover:bg-white/8' : 'text-black/20 hover:text-black/50 hover:bg-black/5'}`}>
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1" />
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('drawtool:open-canvas-manager')) }}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors ${isDark ? 'text-white/35 hover:text-white/70 hover:bg-white/[0.07]' : 'text-black/30 hover:text-black/65 hover:bg-black/[0.04]'}`}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="1" width="10" height="10" rx="1.5" /><line x1="1" y1="4.5" x2="11" y2="4.5" /><line x1="4" y1="4.5" x2="4" y2="11" />
                  </svg>
                  Canvas manager
                </button>
                {isPro ? (
                  <button
                    onClick={() => setCreatingWs(true)}
                    disabled={loading}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 ${isDark ? 'text-white/35 hover:text-white/70 hover:bg-white/[0.07]' : 'text-black/30 hover:text-black/65 hover:bg-black/[0.04]'}`}
                  >
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                      <line x1="4.5" y1="1" x2="4.5" y2="8" /><line x1="1" y1="4.5" x2="8" y2="4.5" />
                    </svg>
                    New workspace
                    {showTips && <span className={`opacity-40 font-mono text-[10px]`}>⌃N</span>}
                  </button>
                ) : (
                  <span className={`text-[10px] ${isDark ? 'text-white/18' : 'text-black/18'}`}>Multiple workspaces · Pro</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
