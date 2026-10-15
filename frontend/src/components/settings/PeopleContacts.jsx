import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Loader2, Bell, Pencil, UserPlus } from 'lucide-react'
import { createPerson, getBalances, getPeople, sendReminder, updatePerson, updatePersonEmail } from '../../api/client.js'

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

  // Inline name edit (one row at a time)
  const [editingNameId, setEditingNameId] = useState(null)
  const [nameDraft, setNameDraft] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [nameError, setNameError] = useState({ personId: null, message: '' })
  // Set when Escape cancels, so the blur that follows the unmount doesn't save.
  const nameEditCancelled = useRef(false)

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

  const startNameEdit = (person) => {
    nameEditCancelled.current = false
    setEditingNameId(person.id)
    setNameDraft(person.name)
    setNameError({ personId: null, message: '' })
  }

  const cancelNameEdit = () => {
    nameEditCancelled.current = true
    setEditingNameId(null)
    setNameDraft('')
    setNameError({ personId: null, message: '' })
  }

  const saveNameEdit = async (personId) => {
    // Blur also fires when Escape unmounts the input and when the field is
    // disabled mid-save; neither of those should trigger a write.
    if (nameEditCancelled.current) {
      nameEditCancelled.current = false
      return
    }
    if (isSavingName) return

    const person = people.find(p => p.id === personId)
    if (!person) return

    const trimmedName = nameDraft.trim()

    // Nothing to do when unchanged, and an empty name is blocked rather than
    // saved as a blank — the server rejects it anyway.
    if (trimmedName === '' || trimmedName === person.name) {
      cancelNameEdit()
      return
    }

    setIsSavingName(true)
    setNameError({ personId: null, message: '' })

    try {
      const updatedPerson = await updatePerson(personId, { name: trimmedName })
      setPeople(prev => prev.map(p => p.id === personId ? updatedPerson : p))
      cancelNameEdit()
    } catch (err) {
      // Same messages the Add-person form shows: a duplicate or invalid name is
      // the same problem wherever it is typed. Keep the draft so it can be fixed.
      setNameError({ personId, message: err.message || 'That name cannot be used.' })
    } finally {
      setIsSavingName(false)
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
        <p className="max-w-[430px] font-body text-sm leading-6 text-on-surface-variant">
          Manage names and email addresses for people you track with. An email enables reminders.
        </p>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary-container px-4 py-2 font-body text-sm font-semibold text-on-primary-container transition-transform hover:-translate-y-0.5 hover:bg-secondary-container"
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
          className="mt-6 rounded-2xl bg-surface-container-low p-6 shadow-2xl"
        >
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-person-name" className="font-body text-xs font-medium text-on-surface-variant">
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
                className="mt-1 w-full rounded-lg bg-surface-container px-3.5 py-2.5 font-body text-sm text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
              />
              {addErrors.name && (
                <p className="mt-1 font-body text-xs text-error">{addErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="new-person-email" className="font-body text-xs font-medium text-on-surface-variant">
                Email
              </label>
              <input
                id="new-person-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Add email"
                className="mt-1 w-full rounded-lg bg-surface-container px-3.5 py-2.5 font-body text-sm text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                Optional. Add it now or later to enable reminders.
              </p>
              {addErrors.email && (
                <p className="mt-1 font-body text-xs text-error">{addErrors.email}</p>
              )}
            </div>

            {addErrors.form && (
              <div className="flex items-start gap-2.5 rounded-xl border border-error-container/50 bg-error-container/10 p-3 font-body text-sm text-error">
                <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
                <p>{addErrors.form}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={!newName.trim() || isAdding}
                className="flex items-center gap-1.5 rounded-xl bg-primary-container px-4 py-2 font-body text-sm font-semibold text-on-primary-container transition-transform hover:-translate-y-0.5 hover:bg-secondary-container disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-xl bg-surface-container px-4 py-2 font-body text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-6 rounded-2xl bg-surface-container-low p-6 shadow-2xl">
        {globalMessage.type && (
          <div className={`mb-4 flex items-start gap-2.5 rounded-xl border p-3 font-body text-sm ${
            globalMessage.type === 'success'
              ? 'border-green-500/50 bg-green-500/10 text-green-500'
              : 'border-error-container/50 bg-error-container/10 text-error'
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
          <div className="flex items-center justify-center gap-2 py-12 font-body text-sm text-on-surface-variant">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
            Loading people…
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex items-start gap-2.5 rounded-xl border border-error-container/50 bg-error-container/10 p-4 font-body text-sm text-error">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={loadPeople}
              className="rounded-xl bg-primary-container px-4 py-2 font-body text-sm font-semibold text-on-primary-container transition-transform hover:-translate-y-0.5 hover:bg-secondary-container"
            >
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && people.length === 0 && (
          <div className="py-12 text-center font-body text-sm text-on-surface-variant">
            No people yet. Add someone with the button above, or they'll appear here when you split a bill.
          </div>
        )}

        {status === 'ready' && people.length > 0 && (
          <div className="space-y-4">
            {peopleWithBalances.map(person => (
              <div
                key={person.id}
                className="flex items-center gap-4 rounded-xl bg-surface-container p-4"
              >
                <div className="flex-1">
                  {editingNameId === person.id ? (
                    <div>
                      <input
                        type="text"
                        value={nameDraft}
                        onChange={(e) => {
                          setNameDraft(e.target.value)
                          if (nameError.personId === person.id) {
                            setNameError({ personId: null, message: '' })
                          }
                        }}
                        onBlur={() => saveNameEdit(person.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            e.target.blur()
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            cancelNameEdit()
                          }
                        }}
                        maxLength={60}
                        autoFocus
                        aria-label={`Name for ${person.name}`}
                        className="w-full rounded-lg bg-surface-container-lowest px-3 py-1.5 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                        disabled={isSavingName}
                      />
                      {nameError.personId === person.id && nameError.message && (
                        <p className="mt-1 font-body text-xs text-error">{nameError.message}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="font-body font-medium text-on-surface">{person.name}</p>
                      <button
                        type="button"
                        onClick={() => startNameEdit(person)}
                        aria-label={`Edit name for ${person.name}`}
                        className="text-on-surface-variant transition-colors hover:text-on-surface"
                      >
                        <Pencil className="size-3.5" strokeWidth={1.8} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="email"
                    defaultValue={person.email || ''}
                    onBlur={(e) => handleEmailBlur(person.id, e.target.value)}
                    placeholder="Add email"
                    className="w-full rounded-lg bg-surface-container-lowest px-3 py-1.5 font-body text-sm text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
                    disabled={saveStatus[person.id] === 'saving'}
                  />
                </div>
                <div className="flex w-[120px] shrink-0 items-center justify-end gap-2">
                  {person.theyOweYouPaise > 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemind(person.id)}
                      disabled={remindStatus[person.id] === 'sending'}
                      aria-label="Remind"
                      className="group flex h-8 items-center justify-center rounded-lg bg-primary-container px-2.5 font-body text-xs font-semibold text-on-primary-container transition-all hover:-translate-y-0.5 hover:bg-secondary-container disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {remindStatus[person.id] === 'sending' ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin" strokeWidth={1.8} />
                      ) : (
                        <Bell className="size-3.5 shrink-0" strokeWidth={2} />
                      )}
                      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-in-out group-hover:ml-1.5 group-hover:max-w-[70px] group-hover:opacity-100">
                        {remindStatus[person.id] === 'sending' ? 'Sending…' : 'Remind'}
                      </span>
                    </button>
                  )}
                  {saveStatus[person.id] === 'saving' && (
                    <Loader2 className="size-4 shrink-0 animate-spin text-on-surface-variant" strokeWidth={1.8} />
                  )}
                  {saveStatus[person.id] === 'success' && (
                    <Check className="size-4 shrink-0 text-green-500" strokeWidth={2.5} />
                  )}
                  {saveStatus[person.id] === 'error' && (
                    <span className="shrink-0 font-body text-xs text-error">Failed</span>
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
