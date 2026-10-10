"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { MeshGradient, PulsingBorder } from "@paper-design/shaders-react"
import { motion } from "framer-motion"

/* ── Static Fallback ────────────────────────────────────────────────────────── */

function StaticFallback() {
  return (
    <div
      className="absolute inset-0 w-full h-full"
      style={{
        background:
          "radial-gradient(ellipse at 30% 40%, #0e3a4d 0%, transparent 60%), " +
          "radial-gradient(ellipse at 70% 60%, #1a1a2e 0%, transparent 50%), " +
          "radial-gradient(ellipse at 50% 80%, #f97316 0%, transparent 40%), " +
          "#000000",
      }}
      aria-hidden="true"
    />
  )
}

/* ── Error Boundary ─────────────────────────────────────────────────────────── */

interface ErrorBoundaryState {
  hasError: boolean
}

interface ErrorBoundaryProps {
  children: ReactNode
}

import { Component } from "react"

class ShaderErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn("[HeroShader] Shader rendering failed, showing static fallback:", error)
  }

  render() {
    if (this.state.hasError) {
      return <StaticFallback />
    }
    return this.props.children
  }
}

/* ── Shader Layers ──────────────────────────────────────────────────────────── */

function ShaderLayers() {
  return (
    <>
      <MeshGradient
        className="absolute inset-0 w-full h-full"
        colors={["#000000", "#06b6d4", "#0891b2", "#164e63", "#f97316"]}
        speed={0.3}
      />
      <MeshGradient
        className="absolute inset-0 w-full h-full opacity-60"
        colors={["#000000", "#ffffff", "#06b6d4", "#f97316"]}
        speed={0.2}
      />
    </>
  )
}

/* ── Decorative Orb ─────────────────────────────────────────────────────────── */

function DecorativeOrb() {
  return (
    <div className="hero-shader-orb absolute top-8 right-8 z-30 pointer-events-none">
      <div className="relative w-20 h-20 flex items-center justify-center">
        <PulsingBorder
          colors={["#06b6d4", "#0891b2", "#f97316", "#00FF88", "#FFD700", "#FF6B35", "#ffffff"]}
          colorBack="#00000000"
          speed={1.5}
          roundness={1}
          thickness={0.1}
          softness={0.2}
          intensity={5}
          spots={5}
          spotSize={0.1}
          pulse={0.1}
          smoke={0.5}
          smokeSize={4}
          scale={0.65}
          rotation={0}
          frame={9161408.251009725}
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
          }}
        />

        <motion.svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          animate={{ rotate: 360 }}
          transition={{
            duration: 20,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
          style={{ transform: "scale(1.6)" }}
        >
          <defs>
            <path
              id="hero-circle-path"
              d="M 50, 50 m -38, 0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0"
            />
          </defs>
          <text className="text-sm fill-white/80 font-medium">
            <textPath href="#hero-circle-path" startOffset="0%">
              StandPoint · Photography Planner • Know the Spot • Pose • Rules •
            </textPath>
          </text>
        </motion.svg>
      </div>
    </div>
  )
}

/* ── HeroShader ─────────────────────────────────────────────────────────────── */

export default function HeroShader() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  return (
    <div
      ref={containerRef}
      className="hero-shader-root absolute inset-0 z-0 w-full h-full overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Static gradient fallback — always rendered behind shaders */}
      <StaticFallback />

      {/* Shader layers — hidden when reduced-motion is preferred */}
      {!prefersReducedMotion && (
        <ShaderErrorBoundary>
          <ShaderLayers />
        </ShaderErrorBoundary>
      )}

      {/* Decorative orb — hidden when reduced-motion is preferred */}
      {!prefersReducedMotion && (
        <ShaderErrorBoundary>
          <DecorativeOrb />
        </ShaderErrorBoundary>
      )}
    </div>
  )
}
