import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient.js'

const MIN_LENGTH = 8
const MAX_LENGTH = 72

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  show,
  onToggleShow,
  error,
  hint,
}) {
  const messageId = `${id}-message`
  const message = error || hint

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring pr-11"
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={`${show ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? (
            <EyeOff className="size-4" strokeWidth={1.8} />
          ) : (
            <Eye className="size-4" strokeWidth={1.8} />
          )}
        </button>
      </div>

      {message && (
        <p
          id={messageId}
          className={`mt-2 text-sm leading-6 ${error ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState('idle') // 'idle' | 'submitting' | 'success'
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')

  // Check for recovery session on mount
  useEffect(() => {
    let mounted = true
    let hasReceivedPasswordRecovery = false

    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY') {
        hasReceivedPasswordRecovery = true
        setHasRecoverySession(true)
        setIsLoadingSession(false)
      } else if (event === 'SIGNED_OUT') {
        setHasRecoverySession(false)
      }
    })

    // Also check current session (in case the event already fired)
    async function checkCurrentSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted) return

      // If we already received PASSWORD_RECOVERY event, trust that
      if (hasReceivedPasswordRecovery) {
        return
      }

      // Otherwise, check if we have a session (recovery sessions are still sessions)
      // This handles the case where the user arrives with a valid recovery link
      if (session) {
        setHasRecoverySession(true)
      }
      setIsLoadingSession(false)
    }

    checkCurrentSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Validation rules matching SecuritySection
  const passwordHint =
    password.length > 0 && (password.length < MIN_LENGTH || password.length > MAX_LENGTH)
      ? `Must be ${MIN_LENGTH}–${MAX_LENGTH} characters`
      : ''

  const confirmHint =
    confirmPassword.length > 0 && confirmPassword !== password
      ? "Passwords don't match"
      : ''

  const isValid =
    password.length >= MIN_LENGTH &&
    password.length <= MAX_LENGTH &&
    confirmPassword === password

  const clearFeedback = () => {
    setPasswordError('')
    setFormError('')
    setSubmitStatus((status) => (status === 'success' ? 'idle' : status))
  }

  const handlePasswordChange = (event) => {
    setPassword(event.target.value)
    clearFeedback()
  }

  const handleConfirmChange = (event) => {
    setConfirmPassword(event.target.value)
    clearFeedback()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isValid || isSubmitting) return

    setSubmitStatus('submitting')
    setPasswordError('')
    setFormError('')

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        // Map specific errors to friendly messages
        const errorMessage = error.message?.toLowerCase() || ''
        if (errorMessage.includes('same') || errorMessage.includes('different')) {
          setPasswordError('New password must be different from your current one.')
        } else {
          setPasswordError('Could not reset password. Please try again.')
        }
        return
      }

      // Success: sign out of the recovery session and redirect
      await supabase.auth.signOut()
      setSubmitStatus('success')

      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 2000)
    } catch (err) {
      setFormError('Could not reset password. Please try again.')
    } finally {
      setSubmitStatus('idle')
    }
  }

  // Show loading state while checking for recovery session
  if (isLoadingSession) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px] animate-in fade-in duration-500">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" strokeWidth={1.8} />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  // Show error if no recovery session (invalid/expired link)
  if (!hasRecoverySession) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px] animate-in fade-in duration-500">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Reset password
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em]">Invalid link</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This link is invalid or has expired.
          </p>

          <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <p>Please request a new password reset link.</p>
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link to="/forgot-password" className="font-medium text-primary hover:text-primary/80">
              Request new reset link
            </Link>
          </p>
        </div>
      </div>
    )
  }

  // Show password reset form
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] animate-in fade-in duration-500">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Reset password
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.045em]">Set new password</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Enter your new password below.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <PasswordField
            id="reset-password"
            label="New password"
            value={password}
            onChange={handlePasswordChange}
            autoComplete="new-password"
            show={showPassword}
            onToggleShow={() => setShowPassword((value) => !value)}
            error={passwordError}
            hint={passwordHint}
          />

          <PasswordField
            id="reset-confirm-password"
            label="Confirm new password"
            value={confirmPassword}
            onChange={handleConfirmChange}
            autoComplete="new-password"
            show={showConfirm}
            onToggleShow={() => setShowConfirm((value) => !value)}
            hint={confirmHint}
          />

          {formError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>{formError}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                  Resetting…
                </>
              ) : (
                'Reset password'
              )}
            </button>

            {submitStatus === 'success' && (
              <span className="flex items-center gap-1.5 text-sm text-green-500">
                <Check className="size-4" strokeWidth={2.5} />
                Password reset
              </span>
            )}
          </div>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-medium text-primary hover:text-primary/80">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  )
}
