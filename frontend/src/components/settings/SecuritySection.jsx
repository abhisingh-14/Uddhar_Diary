import { useState } from 'react'
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from 'lucide-react'
import { changePassword } from '../../api/client.js'

const CARD_CLASS = 'rounded-2xl border border-border bg-card p-6 shadow-sm'
const INPUT_CLASS = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'

const MIN_LENGTH = 8
const MAX_LENGTH = 72
const RATE_LIMIT_MESSAGE = 'Too many attempts, please try again later'

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  show,
  onToggleShow,
  error,
  hint,
}) {
  const messageId = `${id}-message`
  const message = error || hint

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`${INPUT_CLASS} pr-11`}
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

export default function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [submitStatus, setSubmitStatus] = useState('idle') // 'idle' | 'submitting' | 'success'
  const [currentError, setCurrentError] = useState('')
  const [newError, setNewError] = useState('')
  const [formError, setFormError] = useState('')

  // Client-side checks mirror the server's validation order (length, then sameness).
  let newPasswordHint = ''
  if (newPassword.length > 0) {
    if (newPassword.length < MIN_LENGTH || newPassword.length > MAX_LENGTH) {
      newPasswordHint = `Must be ${MIN_LENGTH}–${MAX_LENGTH} characters`
    } else if (newPassword === currentPassword) {
      newPasswordHint = 'Must be different from your current password'
    }
  }

  const confirmHint =
    confirmPassword.length > 0 && confirmPassword !== newPassword ? "Passwords don't match" : ''

  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_LENGTH &&
    newPassword.length <= MAX_LENGTH &&
    newPassword !== currentPassword &&
    confirmPassword === newPassword

  const isSubmitting = submitStatus === 'submitting'

  const clearFeedback = () => {
    setCurrentError('')
    setNewError('')
    setFormError('')
    // Keep an in-flight request's pending state intact so the button can't be re-enabled mid-submit.
    setSubmitStatus((status) => (status === 'success' ? 'idle' : status))
  }

  const handleCurrentChange = (event) => {
    setCurrentPassword(event.target.value)
    clearFeedback()
  }

  const handleNewChange = (event) => {
    setNewPassword(event.target.value)
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
    setCurrentError('')
    setNewError('')
    setFormError('')

    try {
      await changePassword({ currentPassword, newPassword })

      // Deliberately no signOut here: the session on this device stays valid.
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrent(false)
      setShowNew(false)
      setShowConfirm(false)
      setSubmitStatus('success')
    } catch (err) {
      setSubmitStatus('idle')

      if (err.code === 'RATE_LIMITED' || err.status === 429) {
        setFormError(RATE_LIMIT_MESSAGE)
      } else if (err.code === 'INVALID_CURRENT_PASSWORD') {
        setCurrentError(err.message || 'Current password is incorrect')
      } else if (err.code === 'WEAK_PASSWORD' || err.code === 'SAME_PASSWORD') {
        setNewError(err.message || 'New password is not valid')
      } else {
        setFormError(err.message || 'Failed to change password')
      }
    }
  }

  return (
    <div className={`mt-10 ${CARD_CLASS}`}>
      <h2 className="text-base font-semibold text-foreground">Change password</h2>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Use at least 8 characters.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <PasswordField
          id="current-password"
          label="Current password"
          value={currentPassword}
          onChange={handleCurrentChange}
          autoComplete="current-password"
          placeholder="Your current password"
          show={showCurrent}
          onToggleShow={() => setShowCurrent((value) => !value)}
          error={currentError}
        />

        <PasswordField
          id="new-password"
          label="New password"
          value={newPassword}
          onChange={handleNewChange}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          show={showNew}
          onToggleShow={() => setShowNew((value) => !value)}
          error={newError}
          hint={newPasswordHint}
        />

        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={handleConfirmChange}
          autoComplete="new-password"
          placeholder="Repeat your new password"
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
                Updating…
              </>
            ) : (
              'Update password'
            )}
          </button>

          {submitStatus === 'success' && (
            <span className="flex items-center gap-1.5 text-sm text-green-500">
              <Check className="size-4" strokeWidth={2.5} />
              Password updated
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
