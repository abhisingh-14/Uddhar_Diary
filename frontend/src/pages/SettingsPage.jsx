import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { getPeople, updatePersonEmail } from '../api/client.js'

export default function SettingsPage() {
  const [status, setStatus] = useState('loading')
  const [people, setPeople] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [saveStatus, setSaveStatus] = useState({}) // { personId: 'saving' | 'success' | 'error' }

  const loadPeople = useCallback(async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const data = await getPeople()
      setPeople(data ?? [])
      setStatus('ready')
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load people.')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    loadPeople()
  }, [loadPeople])

  const handleEmailBlur = async (personId, newEmail) => {
    const person = people.find(p => p.id === personId)
    if (!person) return

    // Only save if email changed
    const currentEmail = person.email || ''
    if (newEmail === currentEmail) return

    // Handle empty input as null
    const emailToSend = newEmail.trim() === '' ? null : newEmail.trim()

    setSaveStatus(prev => ({ ...prev, [personId]: 'saving' }))

    try {
      const updatedPerson = await updatePersonEmail(personId, emailToSend)
      setPeople(prev => prev.map(p => p.id === personId ? updatedPerson : p))
      setSaveStatus(prev => ({ ...prev, [personId]: 'success' }))

      // Fade success indicator after 2 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [personId]: null }))
      }, 2000)
    } catch (err) {
      setSaveStatus(prev => ({ ...prev, [personId]: 'error' }))

      // Fade error indicator after 2 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [personId]: null }))
      }, 2000)
    }
  }

  return (
    <div className="flex flex-1 items-start justify-center px-5 py-10 md:px-12 md:py-16 lg:py-24">
      <div className="w-full max-w-[760px] animate-in fade-in duration-500">
        <div className="max-w-[500px]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Settings
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">
            People & contacts
          </h2>
          <p className="mt-4 max-w-[430px] text-sm leading-6 text-muted-foreground">
            Manage email addresses for people you track with. This enables reminders.
          </p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
              Loading people…
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
                <p>{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={loadPeople}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Try again
              </button>
            </div>
          )}

          {status === 'ready' && people.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No people yet. Add someone from the diary to get started.
            </div>
          )}

          {status === 'ready' && people.length > 0 && (
            <div className="space-y-4">
              {people.map(person => (
                <div
                  key={person.id}
                  className="flex items-center gap-4 rounded-xl border border-border bg-muted/30 p-4"
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{person.name}</p>
                  </div>
                  <div className="flex-1">
                    <input
                      type="email"
                      defaultValue={person.email || ''}
                      onBlur={(e) => handleEmailBlur(person.id, e.target.value)}
                      placeholder="Add email"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      disabled={saveStatus[person.id] === 'saving'}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Placeholder for Remind button - B6 will wire this in */}
                    <div className="w-24" />
                    {saveStatus[person.id] === 'saving' && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" strokeWidth={1.8} />
                    )}
                    {saveStatus[person.id] === 'success' && (
                      <Check className="size-4 text-green-500" strokeWidth={2.5} />
                    )}
                    {saveStatus[person.id] === 'error' && (
                      <span className="text-xs text-destructive">Failed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
