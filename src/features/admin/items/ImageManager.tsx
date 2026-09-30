import { useRef, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { resolveImageUrl } from '../../../lib/imageUrl'
import { prepareImages, removeStoredFiles, uploadItemImages, type StagedImage } from '../../../lib/itemImages'
import { Notice } from '../AdminUi'
import { secondaryBtn } from '../adminStyles'

export interface SavedImage {
  id: string
  storage_path: string
  position: number
}

interface Props {
  /** When set, picked photos upload straight away. When null (new item) they wait in `staged`. */
  itemId: string | null
  saved: SavedImage[]
  onSavedChanged: () => void
  staged: StagedImage[]
  onStagedChange: (next: StagedImage[]) => void
}

export function ImageManager({ itemId, saved, onSavedChanged, staged, onStagedChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [working, setWorking] = useState(false)
  const [messages, setMessages] = useState<string[]>([])

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return
    setWorking(true)
    setMessages([])
    const { ok, errors } = await prepareImages([...files])
    try {
      if (itemId) {
        const start = saved.length ? Math.max(...saved.map((s) => s.position)) + 1 : 0
        await uploadItemImages(itemId, ok, start)
        onSavedChanged()
      } else {
        onStagedChange([...staged, ...ok])
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Upload failed.')
    }
    setMessages(errors)
    setWorking(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function removeSaved(img: SavedImage) {
    setWorking(true)
    const { error } = await supabase.from('item_images').delete().eq('id', img.id)
    if (error) setMessages([error.message])
    else await removeStoredFiles([img.storage_path])
    setWorking(false)
    onSavedChanged()
  }

  async function moveSaved(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= saved.length) return
    const order = [...saved]
    ;[order[index], order[j]] = [order[j], order[index]]
    setWorking(true)
    const results = await Promise.all(order.map((s, p) => (s.position === p ? null : supabase.from('item_images').update({ position: p }).eq('id', s.id))))
    const failed = results.find((r) => r?.error)
    if (failed?.error) setMessages([failed.error.message])
    setWorking(false)
    onSavedChanged()
  }

  function moveStaged(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= staged.length) return
    const next = [...staged]
    ;[next[index], next[j]] = [next[j], next[index]]
    onStagedChange(next)
  }

  const tiles = itemId
    ? saved.map((s, i) => ({ key: s.id, src: resolveImageUrl(s.storage_path), onLeft: () => moveSaved(i, -1), onRight: () => moveSaved(i, 1), onRemove: () => removeSaved(s) }))
    : staged.map((s, i) => ({
        key: s.id,
        src: s.previewUrl,
        onLeft: () => moveStaged(i, -1),
        onRight: () => moveStaged(i, 1),
        onRemove: () => {
          URL.revokeObjectURL(s.previewUrl)
          onStagedChange(staged.filter((x) => x.id !== s.id))
        },
      }))

  return (
    <div className="space-y-3">
      {tiles.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {tiles.map((t, i) => (
            <li key={t.key} className="space-y-1">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-brand-gray-100">
                <img src={t.src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-brand-gray-900 px-2 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex gap-1">
                  <button type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={working || i === 0} onClick={t.onLeft} className="px-1.5 py-0.5 text-brand-gray-600 disabled:opacity-30">◀</button>
                  <button type="button" aria-label={`Move photo ${i + 1} later`} disabled={working || i === tiles.length - 1} onClick={t.onRight} className="px-1.5 py-0.5 text-brand-gray-600 disabled:opacity-30">▶</button>
                </span>
                <button type="button" aria-label={`Remove photo ${i + 1}`} disabled={working} onClick={t.onRemove} className="px-1.5 py-0.5 font-medium text-brand-red disabled:opacity-40">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" id="item-photos" aria-label="Add photos" onChange={(e) => void onPick(e.target.files)} />
        <label htmlFor="item-photos" className={`${secondaryBtn} cursor-pointer ${working ? 'pointer-events-none opacity-50' : ''}`}>
          {working ? 'Working…' : tiles.length ? 'Add more photos' : 'Add photos'}
        </label>
        <p className="text-xs text-brand-gray-500">Photos are shrunk to under 300 KB automatically. The first one is the cover.</p>
      </div>
      {messages.map((m) => <Notice key={m}>{m}</Notice>)}
    </div>
  )
}
