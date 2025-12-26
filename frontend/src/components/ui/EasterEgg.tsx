'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

const SECRET_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'KeyB', 'KeyA'
]

const CAT_EMOJIS = ['😺', '😸', '😹', '😻', '🐱', '🎉', '✨', '⭐', '💫', '🌟', '💖']

// GIFs de gatitos bailando (URLs públicas)
const CAT_GIFS = [
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3dlOW9samRtZHB5Ym1sY3JnMjR3d2U4M3JhcTFyZ3AxajB5ODltZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/G6TgcESZt8FFk8XV7K/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTF3N2pxaWo1a2ZqZXF1ZmRlYzVuaW5ybHhrM3pyaG14eGdtZDNlbiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/okfvUCpgArv3y/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ODh3djVoNGNseGVtb3J1cGt4ZzVxZzFiZnAxZTJ6cWYwbDhsZGx0ZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/VpysUTI25mTlK/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZHo4Z24yYnVyYmNudnd2YTBkcHhocnVhMTJseTM5bWVieXg2aWxpayZlcD12MV9naWZzX3NlYXJjaCZjdD1n/k1Psl92gw7YPSPYFKm/giphy.gif',
  'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3d29ncnhnZGV5YW55emZ2NXd0eGJoNjcxOGZtNWRmanp0ZnNucjJ3NCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/F1P5wA3Ai0jFAAWQFA/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdmszYzM4bmdqNDNyMWtiMDZ1d251NXh2cGIzeWR2ZzE2ZmUzdDRyMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/117FHDNGAJmVTG/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3dHBtNDYzeXR2N25qZXphbWQ2Y3c2dGtuNG11bXRzbWtzNzkxMGJtZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/g6Oox9mVXakOCWSkf9/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3cjBhMjJjcXk5NmZ6NXI4azZ1czloaTRic2l4ZXlhcDM0d2F4eTh5aiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/aCoHdEdxEhJcU8jXZd/giphy.gif',
  'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExOXI5N3A1OHkwdDduMDloaXc0bnc1b3dpbWRmeXE2aW5hMjRpb3p3NSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/In0Lpu4FVivjISX9HT/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNjY4MXl1cmZ0amFrMHd0M2ZobnRqaDZ6cW4xOG1xamNjeWcweGlxNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/y93x7gLXTO5dnSWCEI/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNjY4MXl1cmZ0amFrMHd0M2ZobnRqaDZ6cW4xOG1xamNjeWcweGlxNyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UmnWEKDFoPmcZHmwFl/giphy.gif',
  'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExemo3Y2U1dmM5bWVnbmhpYjk5NnU0Mjc5NTd0bGJndWlsMHZkcnFkbSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/sMhrHvLAiI0EjIozU9/giphy.gif'
]

// Posiciones para los GIFs alrededor de la pantalla
const GIF_POSITIONS = [
  // Esquinas
  { top: '2%', left: '2%' },
  { top: '2%', right: '2%' },
  { bottom: '2%', left: '2%' },
  { bottom: '2%', right: '2%' },
  // Bordes superiores
  { top: '2%', left: '25%' },
  { top: '2%', right: '25%' },
  // Bordes inferiores
  { bottom: '2%', left: '25%' },
  { bottom: '2%', right: '25%' },
  // Lados izquierdo
  { top: '25%', left: '2%' },
  { top: '50%', left: '2%' },
  { top: '75%', left: '2%' },
  // Lados derecho
  { top: '25%', right: '2%' },
  { top: '50%', right: '2%' },
  { top: '75%', right: '2%' },
  // Extras en medio-bordes
  { top: '15%', left: '12%' },
  { top: '15%', right: '12%' },
  { bottom: '15%', left: '12%' },
  { bottom: '15%', right: '12%' },
]

export default function EasterEgg() {
  const [isActive, setIsActive] = useState(false)
  const [inputSequence, setInputSequence] = useState<string[]>([])
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; left: number; delay: number; duration: number }>>([])
  const [pulse, setPulse] = useState(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    const key = event.code

    setInputSequence(prev => {
      const newSequence = [...prev, key].slice(-SECRET_CODE.length)

      if (newSequence.length === SECRET_CODE.length &&
          newSequence.every((k, i) => k === SECRET_CODE[i])) {
        setIsActive(true)
        return []
      }

      return newSequence
    })
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Configurar Web Audio API para detectar el beat
  useEffect(() => {
    if (isActive && videoRef.current) {
      const video = videoRef.current

      const setupAudio = () => {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext()
          const source = audioContextRef.current.createMediaElementSource(video)
          analyserRef.current = audioContextRef.current.createAnalyser()
          analyserRef.current.fftSize = 256
          source.connect(analyserRef.current)
          analyserRef.current.connect(audioContextRef.current.destination)
        }

        const analyser = analyserRef.current!
        const dataArray = new Uint8Array(analyser.frequencyBinCount)

        const detectBeat = () => {
          analyser.getByteFrequencyData(dataArray)

          // Obtener el promedio de las frecuencias bajas (bass) para detectar el beat
          const bassRange = dataArray.slice(0, 10)
          const average = bassRange.reduce((a, b) => a + b, 0) / bassRange.length

          // Convertir a escala de pulso (1 a 1.15)
          const normalizedPulse = 1 + (average / 255) * 0.15
          setPulse(normalizedPulse)

          animationRef.current = requestAnimationFrame(detectBeat)
        }

        detectBeat()
      }

      video.addEventListener('play', setupAudio)
      if (!video.paused) {
        setupAudio()
      }

      return () => {
        video.removeEventListener('play', setupAudio)
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    }
  }, [isActive])

  useEffect(() => {
    if (isActive) {
      const newParticles = Array.from({ length: 25 }, (_, i) => ({
        id: i,
        emoji: CAT_EMOJIS[Math.floor(Math.random() * CAT_EMOJIS.length)],
        left: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 3 + Math.random() * 4
      }))
      setParticles(newParticles)
    }
  }, [isActive])

  const handleClose = () => {
    setIsActive(false)
    setParticles([])
    setPulse(1)
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  if (!isActive) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden cursor-pointer"
      onClick={handleClose}
    >
      {/* Fondo disco/fiesta EPICO */}
      <div className="absolute inset-0 disco-bg" style={{ filter: `brightness(${0.8 + pulse * 0.3})` }} />

      {/* Capa de estrellas */}
      <div className="absolute inset-0 stars-bg" />

      {/* Rayos de luz */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="light-rays" style={{ opacity: pulse - 0.5 }} />
      </div>

      {/* Destello central que pulsa */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(255,255,255,${(pulse - 1) * 2}) 0%, transparent 70%)`,
        }}
      />

      {/* Ondas de colores */}
      <div className="absolute inset-0 color-waves" />

      {/* Particulas de emojis cayendo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute text-4xl animate-fall"
            style={{
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`
            }}
          >
            {p.emoji}
          </div>
        ))}
      </div>

      {/* MUCHOS GIFs de gatitos por todos lados - BAILANDO */}
      {GIF_POSITIONS.map((pos, i) => {
        const bounceY = (pulse - 1) * 150 * (i % 2 === 0 ? -1 : 1)
        const bounceX = (pulse - 1) * 50 * (i % 3 === 0 ? -1 : 1)
        const rotation = (pulse - 1) * 30 * (i % 2 === 0 ? 1 : -1)

        return (
          <img
            key={i}
            src={CAT_GIFS[i % CAT_GIFS.length]}
            alt="cat"
            className="absolute w-20 h-20 md:w-28 md:h-28 rounded-xl object-cover z-20 shadow-lg border-2 border-white/30"
            style={{
              ...pos,
              transform: `
                scale(${0.9 + (pulse - 1) * 2})
                translateY(${bounceY}px)
                translateX(${bounceX}px)
                rotate(${rotation}deg)
              `,
              transition: 'transform 0.05s ease-out',
            }}
          />
        )
      })}

      {/* Video gigante con pulso real */}
      <div
        className="relative z-10 flex items-center justify-center animate-epic-entrance"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Marco brillante pulsante */}
        <div
          className="absolute -inset-3 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 rounded-3xl blur-md"
          style={{ transform: `scale(${pulse})` }}
        />
        <div
          className="absolute -inset-2 bg-gradient-to-r from-purple-600 via-pink-500 to-yellow-400 rounded-3xl"
          style={{ transform: `scale(${pulse})` }}
        />

        {/* Video */}
        <video
          ref={videoRef}
          autoPlay
          loop
          playsInline
          className="relative max-h-[80vh] max-w-[85vw] rounded-2xl shadow-2xl"
          style={{ transform: `scale(${pulse})` }}
          src="/easter-egg/video.mp4"
        />

        {/* Decoraciones pulsantes */}
        <div className="absolute -top-8 -left-8 text-5xl animate-spin-slow" style={{ transform: `scale(${pulse})` }}>⭐</div>
        <div className="absolute -top-8 -right-8 text-5xl animate-spin-slow" style={{ animationDirection: 'reverse', transform: `scale(${pulse})` }}>🌟</div>
        <div className="absolute -bottom-8 -left-8 text-5xl" style={{ transform: `scale(${pulse})` }}>💖</div>
        <div className="absolute -bottom-8 -right-8 text-5xl" style={{ transform: `scale(${pulse})` }}>💖</div>
        <div className="absolute top-1/2 -left-10 text-4xl" style={{ transform: `scale(${pulse})` }}>🐱</div>
        <div className="absolute top-1/2 -right-10 text-4xl" style={{ transform: `scale(${pulse})` }}>🐱</div>
      </div>

      <style jsx>{`
        @keyframes epic-entrance {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(10deg);
          }
          75% {
            transform: scale(0.9) rotate(-5deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        .animate-epic-entrance {
          animation: epic-entrance 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes disco {
          0% { background-position: 0% 50%; filter: hue-rotate(0deg); }
          25% { background-position: 50% 100%; filter: hue-rotate(90deg); }
          50% { background-position: 100% 50%; filter: hue-rotate(180deg); }
          75% { background-position: 50% 0%; filter: hue-rotate(270deg); }
          100% { background-position: 0% 50%; filter: hue-rotate(360deg); }
        }
        .disco-bg {
          background: linear-gradient(-45deg, #ff006e, #8338ec, #3a86ff, #06ffa5, #ffbe0b, #fb5607, #ff006e);
          background-size: 600% 600%;
          animation: disco 2s ease infinite;
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .stars-bg {
          background-image:
            radial-gradient(2px 2px at 20px 30px, white, transparent),
            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
            radial-gradient(3px 3px at 50px 160px, white, transparent),
            radial-gradient(2px 2px at 90px 40px, rgba(255,255,255,0.9), transparent),
            radial-gradient(2px 2px at 130px 80px, white, transparent),
            radial-gradient(3px 3px at 160px 120px, rgba(255,255,255,0.7), transparent),
            radial-gradient(2px 2px at 200px 50px, white, transparent),
            radial-gradient(2px 2px at 250px 100px, rgba(255,255,255,0.8), transparent),
            radial-gradient(3px 3px at 300px 70px, white, transparent),
            radial-gradient(2px 2px at 350px 150px, rgba(255,255,255,0.9), transparent),
            radial-gradient(2px 2px at 400px 30px, white, transparent),
            radial-gradient(3px 3px at 450px 90px, rgba(255,255,255,0.7), transparent);
          background-size: 500px 200px;
          animation: twinkle 1.5s ease-in-out infinite alternate;
        }

        @keyframes waves {
          0% { transform: scale(1) rotate(0deg); opacity: 0.3; }
          50% { transform: scale(1.5) rotate(180deg); opacity: 0.1; }
          100% { transform: scale(1) rotate(360deg); opacity: 0.3; }
        }
        .color-waves {
          background:
            radial-gradient(ellipse at 20% 50%, rgba(255,0,110,0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 50%, rgba(131,56,236,0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 20%, rgba(58,134,255,0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(6,255,165,0.3) 0%, transparent 50%);
          animation: waves 4s ease-in-out infinite;
        }

        @keyframes light-rays {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .light-rays {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 200%;
          height: 200%;
          background: repeating-conic-gradient(
            from 0deg,
            transparent 0deg 10deg,
            rgba(255,255,255,0.1) 10deg 20deg
          );
          animation: light-rays 20s linear infinite;
          transform-origin: center;
        }

        @keyframes fall {
          0% {
            transform: translateY(-100px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear infinite;
        }

        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  )
}
