import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AlertCircle, Loader2, X } from 'lucide-react'
import { deleteAccount } from '../../api/client.js'
import { supabase } from '../../lib/supabaseClient.js'

export default function DeleteAccountModal({ isOpen, onClose, userEmail }) {
  const navigate = useNavigate()
  const [typedEmail, setTypedEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDeleting, onClose])

  if (!isOpen) return null

  const normalizedUserEmail = (userEmail || '').trim().toLowerCase()
  const isMatch =
    normalizedUserEmail.length > 0 &&
    typedEmail.trim().toLowerCase() === normalizedUserEmail
  const canConfirm = isMatch && !isDeleting

  const handleDelete = async (e) => {
    e.preventDefault()
    if (!canConfirm) return

    setIsDeleting(true)
    setErrorMessage('')

    try {
      await deleteAccount()

      // The server-side auth user no longer exists; clear local session safely
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // Swallow any local sign-out failure per specification
      }

      navigate('/login', { replace: true, state: { accountDeleted: true } })
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete account. Please try again.')
      setIsDeleting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-surface-container-low p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          aria-label="Close modal"
          className="absolute right-5 top-5 rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="size-4" strokeWidth={2} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
            <AlertTriangle className="size-5" strokeWidth={2} />
          </div>
          <div>
            <h3 id="delete-modal-title" className="font-headline text-lg font-bold text-on-surface">
              Delete account
            </h3>
            <p className="mt-1 font-body text-xs text-error font-medium">
              This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Warning text */}
        <div className="mt-4 rounded-xl bg-surface-container/60 p-3.5 font-body text-xs leading-5 text-on-surface-variant">
          Permanently deletes:
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-on-surface">
            <li>All your bills and split history</li>
            <li>All recorded debts and payments</li>
            <li>All tracked people and contacts</li>
            <li>All uploaded bill images</li>
          </ul>
        </div>

        {/* Form */}
        <form onSubmit={handleDelete} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="confirm-email-input"
              className="mb-1.5 block font-body text-xs font-medium text-on-surface-variant"
            >
              Type your account email{' '}
              <span className="font-semibold text-on-surface">{userEmail || 'your email'}</span>{' '}
              to confirm:
            </label>
            <input
              id="confirm-email-input"
              type="email"
              autoComplete="off"
              disabled={isDeleting}
              value={typedEmail}
              onChange={(e) => {
                setTypedEmail(e.target.value)
                if (errorMessage) setErrorMessage('')
              }}
              placeholder={userEmail || 'name@example.com'}
              className="w-full rounded-lg bg-surface-container px-3.5 py-2.5 font-body text-sm text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-error disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-error-container/50 bg-error-container/10 p-3 font-body text-xs text-error"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="rounded-xl px-4 py-2.5 font-body text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!canConfirm}
              className="flex items-center gap-2 rounded-xl bg-error px-5 py-2.5 font-body text-sm font-semibold text-white shadow-md transition-all hover:bg-error/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  Deleting account…
                </>
              ) : (
                'Delete account'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
