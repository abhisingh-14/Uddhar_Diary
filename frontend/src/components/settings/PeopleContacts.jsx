import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, Bell, UserPlus } from 'lucide-react'
import { createPerson, getBalances, getPeople, sendReminder, updatePersonEmail } from '../../api/client.js'

export default function PeopleContacts() {
  const [status, setStatus] = useState('loading')
  const [people, setPeople] = useState([])
  const [balances, setBalances] = useState([])
  const [errorMessage, setErrorMessage] = useState('')
  const [saveStatus, setSaveStatus] = useState({}) // { personId: 'saving' | 'success' | 'error' }
  const [remindStatus, setRemindStatus] = useState({}) // { personId: 'sending' | 'success' | 'error' }
  const [globalMessage, setGlobalMessage] = useState({ type: null, text: '' }) // { type: 'success' | 'error', text: string }

  // Inline "Add person" form
  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addErrors, setAddErrors] = useState({ name: '', email: '', form: '' })

  const loadPeople = useCallback(async () => {
    setStatus('loading')
    setErrorMessage('')

    try {
      const [peopleData, balancesData] = await Promise.all([
        getPeople(),
        getBalances(),
      ])
      setPeople(peopleData ?? [])
      setBalances(balancesData.balances ?? [])
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

  const handleRemind = async (personId) => {
    setRemindStatus(prev => ({ ...prev, [personId]: 'sending' }))

    try {
      await sendReminder(personId)
      setRemindStatus(prev => ({ ...prev, [personId]: 'success' }))
      setGlobalMessage({ type: 'success', text: 'Reminder sent successfully' })

      // Fade success indicator after 2 seconds
      setTimeout(() => {
        setRemindStatus(prev => ({ ...prev, [personId]: null }))
      }, 2000)

      // Fade global message after 3 seconds
      setTimeout(() => {
        setGlobalMessage({ type: null, text: '' })
      }, 3000)
    } catch (err) {
      setRemindStatus(prev => ({ ...prev, [personId]: 'error' }))
      setGlobalMessage({ type: 'error', text: err.message || 'Failed to send reminder' })

      // Fade error indicator after 2 seconds
      setTimeout(() => {
        setRemindStatus(prev => ({ ...prev, [personId]: null }))
      }, 2000)

      // Fade global message after 3 seconds
      setTimeout(() => {
        setGlobalMessage({ type: null, text: '' })
      }, 3000)
    }
  }

  const closeAddForm = () => {
    setShowAddForm(false)
    setNewName('')
    setNewEmail('')
    setAddErrors({ name: '', email: '', form: '' })
  }

  const handleAddPerson = async (event) => {
    event.preventDefault()
    if (!newName.trim() || isAdding) return

    setIsAdding(true)
    setAddErrors({ name: '', email: '', form: '' })

    try {
      const createdPerson = await createPerson({ name: newName.trim(), email: newEmail.trim() })

      // Append the created person so it appears right away. It has no balance row
      // yet, so the merge below gives it 0 and no Remind button — same as anyone
      // who owes nothing.
      setPeople(prev => [...prev, createdPerson])
      setShowAddForm(false)
      setNewName('')
      setNewEmail('')
    } catch (err) {
      // Keep whatever was typed so the user can fix it without retyping.
      if (err.code === 'PERSON_EXISTS' || err.code === 'INVALID_NAME') {
        setAddErrors({ name: err.message || 'That name cannot be used.', email: '', form: '' })
      } else if (err.code === 'INVALID_EMAIL') {
        setAddErrors({ name: '', email: err.message || 'Enter a valid email address.', form: '' })
      } else {
        setAddErrors({ name: '', email: '', form: err.message || 'Failed to add person.' })
      }
    } finally {
      setIsAdding(false)
    }
  }

  // Merge people with their balances
  const peopleWithBalances = people.map(person => {
    const balance = balances.find(b => b.personId === person.id)
    return {
      ...person,
      theyOweYouPaise: balance?.theyOweYouPaise ?? 0,
    }
  })

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-[430px] text-sm leading-6 text-muted-foreground">
          Manage email addresses for people you track with. This enables reminders.
        </p>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            <UserPlus className="size-4" strokeWidth={2} />
            Add person
          </button>
        )}
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddPerson}
          onKeyDown={(e) => { if (e.key === 'Escape') closeAddForm() }}
          className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-person-name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <input
                id="new-person-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={60}
                autoFocus
                placeholder="Person's name"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {addErrors.name && (
                <p className="mt-1 text-xs text-destructive">{addErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="new-person-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                id="new-person-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Add email"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional. Add it now or later to enable reminders.
              </p>
              {addErrors.email && (
                <p className="mt-1 text-xs text-destructive">{addErrors.email}</p>
              )}
            </div>

            {addErrors.form && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
                <p>{addErrors.form}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!newName.trim() || isAdding}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
                    Adding…
                  </>
                ) : (
                  'Add'
                )}
              </button>
              <button
                type="button"
                onClick={closeAddForm}
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        {globalMessage.type && (
          <div className={`mb-4 flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
            globalMessage.type === 'success'
              ? 'border-green-500/50 bg-green-500/10 text-green-600'
              : 'border-destructive/50 bg-destructive/10 text-destructive'
          }`}>
            {globalMessage.type === 'success' ? (
              <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            )}
            <p>{globalMessage.text}</p>
          </div>
        )}

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
            No people yet. Add someone with the button above, or they'll appear here when you split a bill.
          </div>
        )}

        {status === 'ready' && people.length > 0 && (
          <div className="space-y-4">
            {peopleWithBalances.map(person => (
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
                  {person.theyOweYouPaise > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemind(person.id)}
                      disabled={remindStatus[person.id] === 'sending'}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {remindStatus[person.id] === 'sending' ? (
                        <>
                          <Loader2 className="size-3 animate-spin" strokeWidth={1.8} />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Bell className="size-3" strokeWidth={2} />
                          Remind
                        </>
                      )}
                    </button>
                  )}
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
  )
}
