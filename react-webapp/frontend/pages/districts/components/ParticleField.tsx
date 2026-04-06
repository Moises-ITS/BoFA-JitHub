// ─────────────────────────────────────────────────────────────────────────────
// components/ParticleField.tsx
// Canvas-based particle field for the background
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from "react"

interface Particle {
  x: number; y: number
  vx: number; vy: number
  r: number; opacity: number
  fadeDir: number
}

const COUNT = 80

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const particles: Particle[] = Array.from({ length: COUNT }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      vx:      (Math.random() - 0.5) * 0.18,
      vy:      (Math.random() - 0.5) * 0.18,
      r:        Math.random() * 1.4 + 0.4,
      opacity:  Math.random() * 0.5 + 0.1,
      fadeDir:  Math.random() > 0.5 ? 1 : -1,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        // Move
        p.x  += p.vx
        p.y  += p.vy
        // Fade breathe
        p.opacity += p.fadeDir * 0.003
        if (p.opacity > 0.55 || p.opacity < 0.05) p.fadeDir *= -1

        // Wrap
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180, 200, 255, ${p.opacity})`
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="rd-particles"
      style={{ opacity: 0.45 }}
    />
  )
}
