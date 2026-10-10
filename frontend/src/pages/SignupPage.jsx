import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, ArrowRight, Check } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'
import AuthBrandPanel from '../components/AuthBrandPanel'
import MobileAuthHeader from '../components/MobileAuthHeader'

export default function SignupPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [termsError, setTermsError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Password strength calculation (simplified 3-segment logic based on length)
  const getPasswordStrength = (pwd) => {
    if (pwd.length === 0) return { level: 0, label: 'Minimum 8 characters', tag: 'Empty', color: 'text-outline' }
    if (pwd.length < 6) return { level: 1, label: 'Too short', tag: 'Weak', color: 'text-tertiary' }
    if (pwd.length < 10) return { level: 2, label: 'Add symbols or numbers', tag: 'Good', color: 'text-secondary' }
    return { level: 3, label: 'High defense ledger key', tag: 'Strong', color: 'text-primary' }
  }

  const passwordStrength = getPasswordStrength(password)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setTermsError('')
    setIsSubmitting(true)

    // Custom validation for terms checkbox
    if (!agreeToTerms) {
      setTermsError('You must agree to the Terms of Service and Privacy Policy')
      setIsSubmitting(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setErrorMessage(error.message || 'Could not create an account.')
        return
      }
      navigate('/split', { replace: true })
    } catch (err) {
      setErrorMessage(err.message || 'Could not create an account.')
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
            <span className="font-body text-label-sm uppercase tracking-widest text-outline block">
              Start splitting bills
            </span>
            <h2 className="font-headline text-headline-lg font-bold text-on-surface mt-1">
              Create your account
            </h2>
          </div>

          {/* Mobile form heading */}
          <div className="mb-6 lg:hidden">
            <span className="font-body text-label-sm uppercase tracking-wider text-primary font-bold block mb-1">
              CREATE AN ACCOUNT
            </span>
            <h2 className="font-headline text-headline-sm text-on-surface font-semibold tracking-tight">
              Sign up for diary
            </h2>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name field */}
            <div className="space-y-1.5">
              <label htmlFor="signup-fullname" className="block font-body text-label-md text-on-surface-variant">
                Full name
              </label>
              <div className="relative rounded-lg bg-surface-container focus-within:ring-1 focus-within:ring-primary">
                <input
                  id="signup-fullname"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Alex Morgan"
                  className="w-full bg-transparent px-3.5 py-2.5 text-on-surface font-body text-body-md placeholder:text-outline outline-none min-h-[44px] lg:min-h-0"
                />
              </div>
            </div>

            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="signup-email" className="block font-body text-label-md text-on-surface-variant">
                Email address
              </label>
              <div className="relative rounded-lg bg-surface-container focus-within:ring-1 focus-within:ring-primary">
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="alex@example.com"
                  className="w-full bg-transparent px-3.5 py-2.5 text-on-surface font-body text-body-md placeholder:text-outline outline-none min-h-[44px] lg:min-h-0"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label htmlFor="signup-password" className="block font-body text-label-md text-on-surface-variant">
                Password
              </label>
              <div className="relative flex items-center rounded-lg bg-surface-container focus-within:ring-1 focus-within:ring-primary">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a secure password"
                  className="w-full bg-transparent pl-3.5 pr-10 py-2.5 text-on-surface font-body text-body-md placeholder:text-outline outline-none min-h-[44px] lg:min-h-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-0 h-full w-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* 3-segment password strength indicator */}
              <div className="mt-1 flex flex-col gap-1.5">
                <div className="grid grid-cols-3 gap-1.5 h-1 w-full bg-surface-container-lowest rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      passwordStrength.level >= 1
                        ? passwordStrength.level === 1
                          ? 'bg-tertiary-container'
                          : passwordStrength.level === 2
                          ? 'bg-secondary'
                          : 'bg-primary'
                        : 'bg-surface-container-highest'
                    }`}
                  />
                  <div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      passwordStrength.level >= 2
                        ? passwordStrength.level === 2
                          ? 'bg-secondary'
                          : 'bg-primary'
                        : 'bg-surface-container-highest'
                    }`}
                  />
                  <div
                    className={`h-full rounded-full transition-colors duration-300 ${
                      passwordStrength.level >= 3 ? 'bg-primary' : 'bg-surface-container-highest'
                    }`}
                  ></div>
                </div>
                <div className="flex justify-between items-center px-0.5">
                  <span className="font-body text-label-sm text-outline">{passwordStrength.label}</span>
                  <span className={`font-body text-label-sm font-semibold ${passwordStrength.color}`}>
                    {passwordStrength.tag}
                  </span>
                </div>
              </div>
            </div>

            {/* Terms & Privacy checkbox */}
            <div className="flex flex-col gap-1.5 mt-1">
              <label className="flex items-start gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  id="signup-terms"
                  checked={agreeToTerms}
                  onChange={(e) => {
                    setAgreeToTerms(e.target.checked)
                    if (e.target.checked) setTermsError('')
                  }}
                  className="peer sr-only"
                />
                <div className="w-5 h-5 min-w-[20px] rounded bg-surface-container-lowest flex items-center justify-center mt-0.5 transition-all peer-checked:bg-primary peer-checked:text-on-primary text-transparent group-hover:bg-surface-container">
                  <Check size={14} strokeWidth={3} />
                </div>
                <span className="font-body text-body-sm text-on-surface-variant leading-tight">
                  I agree to the{' '}
                  <Link to="/terms" className="text-on-surface underline hover:text-primary">
                    Terms of Service
                  </Link>{' '}
                  &{' '}
                  <Link to="/privacy" className="text-on-surface underline hover:text-primary">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {termsError && (
                <p className="text-sm text-error flex items-center gap-1.5 ml-8" aria-live="polite">
                  <AlertCircle className="size-3.5 shrink-0" strokeWidth={1.8} />
                  {termsError}
                </p>
              )}
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
              className="w-full min-h-[44px] lg:min-h-0 bg-primary-container hover:bg-secondary-container active:scale-[0.98] text-on-primary-container rounded-xl font-body text-label-lg font-bold flex items-center justify-center gap-2 transition-all mt-2 shadow-lg shadow-primary-container/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Creating account…' : 'Create account'}</span>
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Bottom switch link */}
          <div className="mt-5 text-center">
            <p className="font-body text-body-sm text-on-surface-variant">
              Already have an account?{' '}
              <Link to="/login" className="font-body text-label-md text-primary font-semibold hover:underline ml-1">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
