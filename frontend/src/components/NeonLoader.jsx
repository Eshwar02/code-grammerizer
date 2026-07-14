import { useEffect, useRef } from 'react'

// User-authored neon squiggle loader: a glowing path draws L→R with glitter,
// holds, erases, and loops. Ported from the original vanilla-JS/SVG version.
const PATH_D = "M 60 180 C 70 220, 95 262, 130 268 C 168 274, 195 240, 222 190 C 250 138, 285 72, 330 58 C 372 46, 402 68, 398 96 C 372 78, 330 82, 305 112 C 280 142, 282 182, 312 196 C 342 210, 382 196, 398 160 C 412 128, 404 96, 398 96 C 420 116, 432 160, 424 208 C 419 238, 408 268, 396 296 C 390 276, 378 258, 372 252 C 384 258, 412 262, 444 254 C 480 245, 520 230, 556 210 C 588 192, 614 168, 630 140"

// Brand blue #4361EE with lighter tints for the mid + bright-core strokes.
const C_GLOW = '#4361EE'
const C_MAIN = '#5B78F0'
const C_CORE = '#E5EAFF'
const GLITTER = ['#ffffff', '#A5B4FF', '#4361EE']

export default function NeonLoader({ label = 'Loading…', width = 240, inline = false, className = '' }) {
  const mainRef = useRef(null)
  const glowRef = useRef(null)
  const coreRef = useRef(null)
  const glitterRef = useRef(null)

  useEffect(() => {
    const main = mainRef.current, glow = glowRef.current, core = coreRef.current, glitterLayer = glitterRef.current
    if (!main || !glow || !core || !glitterLayer) return
    const realLen = main.getTotalLength()

    const DRAW_MS = 2600, HOLD_MS = 500, ERASE_MS = 1800, PAUSE_MS = 400
    const CYCLE = DRAW_MS + HOLD_MS + ERASE_MS + PAUSE_MS

    let particles = []
    let lastSpawn = 0
    let raf = 0
    const start = performance.now()

    const setOffset = (v) => {
      main.setAttribute('stroke-dashoffset', v)
      glow.setAttribute('stroke-dashoffset', v)
      core.setAttribute('stroke-dashoffset', v)
    }
    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

    const spawnGlitter = (x, y, now) => {
      const n = 2 + Math.floor(Math.random() * 2)
      for (let i = 0; i < n; i++) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        el.setAttribute('r', 0.8 + Math.random() * 1.8)
        el.setAttribute('fill', Math.random() < 0.35 ? GLITTER[0] : (Math.random() < 0.5 ? GLITTER[1] : GLITTER[2]))
        glitterLayer.appendChild(el)
        particles.push({
          el, born: now, life: 500 + Math.random() * 600,
          x: x + (Math.random() - 0.5) * 14,
          y: y + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 0.04,
          vy: -0.01 - Math.random() * 0.035,
        })
      }
    }

    const updateGlitter = (now) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        const age = now - p.born
        if (age > p.life) { p.el.remove(); particles.splice(i, 1); continue }
        const t = age / p.life
        p.x += p.vx * 16; p.y += p.vy * 16
        p.el.setAttribute('cx', p.x)
        p.el.setAttribute('cy', p.y)
        p.el.setAttribute('opacity', (1 - t) * (0.6 + 0.4 * Math.sin(age * 0.05)))
      }
    }

    const frame = (now) => {
      const t = (now - start) % CYCLE
      if (t < DRAW_MS) {
        const p = easeInOut(t / DRAW_MS)
        setOffset(1000 * (1 - p))
        if (now - lastSpawn > 30) {
          lastSpawn = now
          const pt = main.getPointAtLength(realLen * p)
          spawnGlitter(pt.x, pt.y, now)
        }
      } else if (t < DRAW_MS + HOLD_MS) {
        setOffset(0)
        if (now - lastSpawn > 90) {
          lastSpawn = now
          const q = main.getPointAtLength(Math.random() * realLen)
          spawnGlitter(q.x, q.y, now)
        }
      } else if (t < DRAW_MS + HOLD_MS + ERASE_MS) {
        const e = easeInOut((t - DRAW_MS - HOLD_MS) / ERASE_MS)
        setOffset(-1000 * e)
      } else {
        setOffset(1000)
      }
      updateGlitter(now)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      particles.forEach((p) => p.el.remove())
      particles = []
    }
  }, [])

  const common = {
    d: PATH_D, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
    pathLength: 1000, strokeDasharray: 1000, strokeDashoffset: 1000,
  }

  const svg = (
    <svg width={width} viewBox="0 0 680 340"
      style={{ display: inline ? 'inline-block' : 'block', overflow: 'visible', verticalAlign: 'middle' }}
      aria-hidden="true">
      <path ref={glowRef} {...common} stroke={C_GLOW} strokeWidth="9" opacity="0.22" />
      <path ref={mainRef} {...common} stroke={C_MAIN} strokeWidth="3" />
      <path ref={coreRef} {...common} stroke={C_CORE} strokeWidth="1.2" />
      <g ref={glitterRef} />
    </svg>
  )

  // Inline mode = bare SVG for buttons/rows (no wrapper, no label).
  if (inline) return svg

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`} role="status" aria-label={label || 'Loading'}>
      {svg}
      {label && <p className="text-sm text-ink-400 dark:text-gray-500 tracking-wide animate-pulse">{label}</p>}
    </div>
  )
}
