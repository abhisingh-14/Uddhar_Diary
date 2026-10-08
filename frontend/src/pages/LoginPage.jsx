import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import AuthBrandPanel from '../components/AuthBrandPanel'
import MobileAuthHeader from '../components/MobileAuthHeader'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setErrorMessage(error.message || 'Could not sign in.')
        return
      }
      navigate('/split', { replace: true })
    } catch (err) {
      setErrorMessage(err.message || 'Could not sign in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full min-h-screen bg-surface-container-lowest text-on-surface flex flex-col lg:flex-row antialiased selection:bg-primary-container selection:text-surface-container-lowest">
      {/* Desktop left panel */}
      <AuthBrandPanel />

      {/* Right panel: Authentication card */}
      <div className="w-full lg:w-5/12 flex items-start justify-center p-6 sm:p-12 lg:p-20 bg-surface-container-lowest pt-12">
        <div className="w-full max-w-md bg-surface-container-low rounded-2xl p-8 sm:p-10 shadow-2xl relative">
          {/* Mobile header */}
          <MobileAuthHeader />

          {/* Form heading */}
          <div className="mb-8 hidden lg:block">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-outline block">
              Welcome back
            </span>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">
              Sign in to diary
            </h2>
          </div>

          {/* Mobile form heading */}
          <div className="mb-6 lg:hidden">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold block">
              Welcome Back
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              Log in to your account
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block font-label-md text-label-md text-on-surface-variant">
                Email address
              </label>
              <div className="relative rounded-lg bg-surface-container focus-within:ring-1 focus-within:ring-primary">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent px-3.5 py-2.5 text-on-surface font-body-md text-body-md placeholder:text-outline outline-none min-h-[44px] lg:min-h-0"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="block font-label-md text-label-md text-on-surface-variant">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="font-label-sm text-label-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative flex items-center rounded-lg bg-surface-container focus-within:ring-1 focus-within:ring-primary">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent pl-3.5 pr-10 py-2.5 text-on-surface font-body-md text-body-md placeholder:text-outline outline-none min-h-[44px] lg:min-h-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-lg">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error message */}
            {errorMessage && (
              <div
                className="flex items-start gap-2.5 rounded-xl border border-error-container/50 bg-error-container/10 p-3 text-sm text-error"
                aria-live="polite"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[44px] lg:min-h-0 bg-primary-container hover:bg-secondary-container active:scale-[0.98] text-on-primary-container font-label-lg text-label-lg font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-150 shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Signing in…' : 'Sign in'}</span>
              {!isSubmitting && <span className="material-symbols-outlined text-base">arrow_forward</span>}
            </button>
          </form>

          {/* Bottom switch link */}
          <div className="pt-5 text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="font-label-sm text-label-sm text-primary hover:text-primary-fixed ml-1 font-semibold underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
