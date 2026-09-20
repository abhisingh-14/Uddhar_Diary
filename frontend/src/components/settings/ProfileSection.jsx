import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { getProfile, updateProfile } from '../../api/client.js'

const CARD_CLASS = 'rounded-2xl border border-border bg-card p-6 shadow-sm'
const INPUT_CLASS = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50'

export default function ProfileSection() {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [errorMessage, setErrorMessage] = useState('')
  const [savedName, setSavedName] = useState('') // last value confirmed by the server ('' when null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'success' | 'error'
  const [saveError, setSaveError] = useState('')
  const savedTimerRef = useRef(null)

  const loadProfile = useCallback(async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const data = await getProfile()
      const profile = data?.profile ?? {}
      setSavedName(profile.fullName ?? '')
      setFullName(profile.fullName ?? '')
      setEmail(profile.email ?? '')
      setSaveStatus('idle')
      setSaveError('')
      setStatus('ready')
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load profile.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Clear the "Saved" timer if the section unmounts (tab switch) mid-countdown.
  useEffect(() => () => clearTimeout(savedTimerRef.current), [])

  const trimmedName = fullName.trim()
  const canSave = trimmedName.length > 0 && trimmedName !== savedName && saveStatus !== 'saving'
  const avatarLetter = (savedName || email).trim().charAt(0).toUpperCase()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSave) return

    setSaveStatus('saving')
    setSaveError('')

    try {
      const data = await updateProfile({ fullName: trimmedName })
      const updatedName = data?.profile?.fullName ?? trimmedName

      setSavedName(updatedName)
      setFullName(updatedName)
      setSaveStatus('success')

      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      // Keep the typed value so the user can retry without losing their edit.
      setSaveError(err.message || 'Failed to save your name.')
      setSaveStatus('error')
    }
  }

  if (status === 'loading') {
    return (
      <div className={`mt-10 ${CARD_CLASS}`} aria-busy="true">
        <div className="flex items-center gap-4">
          <div className="size-14 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
          <div className="h-10 w-24 animate-pulse rounded-xl bg-muted" />
        </div>
        <span className="sr-only">Loading profile…</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={`mt-10 ${CARD_CLASS}`}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <p>{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={loadProfile}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`mt-10 ${CARD_CLASS}`}>
      <div className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground shadow-sm">
          {avatarLetter || '?'}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{savedName || 'No name yet'}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="profile-full-name" className="mb-1.5 block text-sm font-medium text-foreground">
            Full name
          </label>
          <input
            id="profile-full-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={60}
            placeholder="Your name"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="mb-1.5 block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            disabled
            aria-describedby="profile-email-help"
            className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:opacity-60`}
          />
          <p id="profile-email-help" className="mt-2 text-sm leading-6 text-muted-foreground">
            Email can&apos;t be changed yet.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSave}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </button>

          {saveStatus === 'success' && (
            <span className="flex items-center gap-1.5 text-sm text-green-500">
              <Check className="size-4" strokeWidth={2.5} />
              Saved
            </span>
          )}

          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" strokeWidth={1.8} />
              {saveError}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
