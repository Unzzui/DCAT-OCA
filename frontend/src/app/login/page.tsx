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
              height={150}
              className="h-14 w-auto"
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
  
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center relative overflow-hidden bg-gradient-to-br from-oca-blue via-oca-blue to-blue-900">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          <Image
            src="/logoOcaHorizontal.svg"
            alt="OCA Global"
            width={280}
            height={100}
            className="brightness-0 invert opacity-90"
          />
          <div className="mt-8 h-px w-24 bg-white/30" />
          <p className="mt-4 text-white/50 text-xs tracking-widest uppercase">
            Servicio para
          </p>
          <Image
            src="/logo-enel.png"
            alt="Enel"
            width={120}
            height={40}
            className="mt-3 brightness-0 invert opacity-80"
          />
        </div>
      </div>
    </div>
  )
}
