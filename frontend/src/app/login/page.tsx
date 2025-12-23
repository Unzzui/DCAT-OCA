'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Eye, EyeOff } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'La contrasena es requerida'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('')
      await login(data)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesion')
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Form */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/logoOcaHorizontal.svg"
              alt="OCA Global"
              width={200}
              height={100}
              className="h-12 w-auto"
            />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Bienvenido</h1>
            <p className="mt-2 text-gray-600">
              Ingresa tus credenciales para acceder
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-oca-red-light p-4 text-sm text-oca-red">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Contrasena"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <Button type="submit" className="w-full" isLoading={isSubmitting}>
              Iniciar sesion
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>Servicio para</span>
            <Image
              src="/logo-enel.png"
              alt="Enel"
              width={60}
              height={20}
              className="h-5 w-auto"
            />
          </div>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden bg-oca-blue lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center lg:p-12">
        <div className="max-w-md text-center">
          <h2 className="text-3xl font-bold text-white">
            Dashboard de Control y Analisis Tecnico
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Monitorea y analiza los servicios de Informe NNCC, Lecturas,
            Corte y Reposicion, y Control de Perdidas en un solo lugar.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <div className="rounded-lg bg-white/10 p-4 text-center">
              <p className="text-2xl font-bold text-white">4</p>
              <p className="text-sm text-white/70">Servicios</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 text-center">
              <p className="text-2xl font-bold text-white">10K+</p>
              <p className="text-sm text-white/70">Registros</p>
            </div>
            <div className="rounded-lg bg-white/10 p-4 text-center">
              <p className="text-2xl font-bold text-white">24/7</p>
              <p className="text-sm text-white/70">Monitoreo</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
