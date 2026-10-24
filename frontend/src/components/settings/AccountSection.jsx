import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Check, Eye, EyeOff, Loader2, LogOut, Trash2 } from 'lucide-react'
import { changePassword } from '../../api/client.js'
import { useAuth } from '../../context/AuthContext.jsx'
import DeleteAccountModal from './DeleteAccountModal.jsx'

const CARD_CLASS = 'rounded-2xl bg-surface-container-low p-6 shadow-2xl'
const INPUT_CLASS = 'w-full rounded-lg bg-surface-container px-3.5 py-2.5 font-body text-sm text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary'

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
      <label htmlFor={id} className="mb-1.5 block font-body text-xs font-medium text-on-surface-variant">
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
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-on-surface-variant transition-colors hover:text-on-surface"
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
          className={`mt-2 font-body text-xs leading-5 ${error ? 'text-error' : 'text-on-surface-variant'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}

export default function AccountSection() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  // Change password state
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

  // Sign out state
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  // Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

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

  const handleSignOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    setSignOutError('')

    try {
      await signOut()
      navigate('/login')
    } catch (err) {
      setSignOutError(err.message || 'Failed to sign out. Please try again.')
      setIsSigningOut(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* 1. Change password card (unchanged) */}
      <div className={`mt-10 ${CARD_CLASS}`}>
        <h2 className="font-headline text-base font-semibold text-on-surface">Change password</h2>
        <p className="mt-1.5 font-body text-sm leading-6 text-on-surface-variant">Use at least 8 characters.</p>

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
            <div className="flex items-start gap-2.5 rounded-xl border border-error-container/50 bg-error-container/10 p-4 font-body text-sm text-error">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>{formError}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-primary-container px-5 py-2.5 font-body text-sm font-semibold text-on-primary-container transition-transform hover:-translate-y-0.5 hover:bg-secondary-container disabled:cursor-not-allowed disabled:opacity-40"
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
              <span className="flex items-center gap-1.5 font-body text-sm font-medium text-green-500">
                <Check className="size-4" strokeWidth={2.5} />
                Password updated
              </span>
            )}
          </div>
        </form>
      </div>

      {/* 2. Sign out card */}
      <div className={CARD_CLASS}>
        <h2 className="font-headline text-base font-semibold text-on-surface">Sign out</h2>
        <p className="mt-1.5 font-body text-sm leading-6 text-on-surface-variant">
          Sign out of this device
        </p>

        {signOutError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-error-container/50 bg-error-container/10 p-4 font-body text-sm text-error">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <p>{signOutError}</p>
          </div>
        )}

        <div className="mt-5">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="flex items-center gap-2 rounded-xl bg-surface-container px-5 py-2.5 font-body text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSigningOut ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                Signing out…
              </>
            ) : (
              <>
                <LogOut className="size-4" strokeWidth={1.8} />
                Sign out
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Danger zone card */}
      <div className="rounded-2xl border border-red-500/30 bg-surface-container-low p-6 shadow-2xl">
        <h2 className="font-headline text-base font-semibold text-error">Danger zone</h2>
        <p className="mt-1.5 font-body text-sm leading-6 text-on-surface-variant">
          Permanently delete your account and all associated bills, debts, split history, and contacts.
        </p>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-error/50 bg-error/10 px-5 py-2.5 font-body text-sm font-semibold text-error transition-all hover:bg-error/20 active:scale-[0.98]"
          >
            <Trash2 className="size-4" strokeWidth={1.8} />
            Delete account
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {isDeleteModalOpen && (
        <DeleteAccountModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          userEmail={user?.email}
        />
      )}
    </div>
  )
}
