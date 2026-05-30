const LETTERS = [
  { letter: "d", color: "#3b82f6" },
  { letter: "r", color: "#ef4444" },
  { letter: "a", color: "#22c55e" },
  { letter: "w", color: "#eab308" },
  { letter: "z", color: "#ec4899" },
  { letter: "i", color: "#f97316" },
  { letter: "l", color: "#8b5cf6" },
  { letter: "l", color: "#06b6d4" },
  { letter: "a", color: "#ef4444" },
]

let logoImgCache: HTMLImageElement | null = null

async function loadLogoImg(): Promise<HTMLImageElement | null> {
  if (logoImgCache) return logoImgCache
  const img = new Image()
  img.src = "/drawzilla-simplifed.svg"
  await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve() })
  if (img.complete && img.naturalWidth > 0) logoImgCache = img
  return logoImgCache
}

export async function drawWatermark(
  ctx: CanvasRenderingContext2D,
  _canvasW: number,
  canvasH: number,
  dpr = 1,
): Promise<void> {
  const fontSize = 22 * dpr
  const [, logo] = await Promise.all([
    document.fonts.load(`${fontSize}px "Caveat Brush"`),
    loadLogoImg(),
  ])

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 0.75
  ctx.font = `${fontSize}px "Caveat Brush", cursive`
  ctx.textBaseline = "middle"

  const iconSize = fontSize * 1.1
  const iconGap = 6 * dpr
  const letterWs = LETTERS.map(({ letter }) => ctx.measureText(letter).width)
  const logoTextW = letterWs.reduce((s, w) => s + w, 0)
  const totalW = logoTextW + (logo ? iconGap + iconSize : 0)

  const pad = 20 * dpr
  const bgPad = 8 * dpr
  const rowH = iconSize + bgPad * 2
  const bgX = pad - bgPad
  const bgY = canvasH - pad - rowH

  ctx.fillStyle = "rgba(0,0,0,0.5)"
  ctx.beginPath()
  ctx.roundRect(bgX, bgY, totalW + bgPad * 2, rowH, 6 * dpr)
  ctx.fill()

  const centerY = bgY + rowH / 2
  let x = pad

  for (let i = 0; i < LETTERS.length; i++) {
    ctx.fillStyle = LETTERS[i].color
    ctx.fillText(LETTERS[i].letter, x, centerY)
    x += letterWs[i]
  }

  if (logo) {
    ctx.globalAlpha = 0.75
    ctx.drawImage(logo, x + iconGap, centerY - iconSize / 2, iconSize, iconSize)
  }

  ctx.restore()
}
