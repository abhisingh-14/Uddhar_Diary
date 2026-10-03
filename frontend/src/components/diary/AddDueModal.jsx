import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Plus, UserPlus, X } from 'lucide-react'
import { getPeople, createPerson, addManualDebt } from '../../api/client.js'
import { rupeesToPaise } from '../../lib/money.js'

export default function AddDueModal({ open, onClose, onAdded, presetPersonId = null }) {
  const [people, setPeople] = useState([])
  const [isLoadingPeople, setIsLoadingPeople] = useState(false)
  const [peopleError, setPeopleError] = useState('')

  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [isAddingPerson, setIsAddingPerson] = useState(false)
  const [addPersonError, setAddPersonError] = useState('')

  const [direction, setDirection] = useState('')
  const [kind, setKind] = useState('loan')
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const amountInputRef = useRef(null)
  const modalRef = useRef(null)

  const getLocalToday = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    if (open) {
      async function loadPeople() {
        setIsLoadingPeople(true)
        setPeopleError('')
        try {
          const data = await getPeople()
          setPeople(data)
          if (presetPersonId) {
            setSelectedPersonId(presetPersonId)
          }
        } catch (err) {
          setPeopleError(err.message || 'Failed to load people')
        } finally {
          setIsLoadingPeople(false)
        }
      }
      loadPeople()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedPersonId(presetPersonId || '')
       
      setShowAddPerson(false)
       
      setNewPersonName('')
       
      setAddPersonError('')
       
      setDirection('')
       
      setKind('loan')
       
      setDate('')
       
      setAmount('')
       
      setNote('')
       
      setSubmitError('')
    }
     
  }, [open, presetPersonId])

  useEffect(() => {
    if (open && amountInputRef.current) {
      amountInputRef.current.focus()
    }
  }, [open])

  async function handleAddPerson(event) {
    event.preventDefault()
    if (!newPersonName.trim()) {
      setAddPersonError('Name is required')
      return
    }

    setIsAddingPerson(true)
    setAddPersonError('')

    try {
      const person = await createPerson({ name: newPersonName.trim() })
      setPeople((current) => [...current, person])
      setSelectedPersonId(person.id)
      setNewPersonName('')
      setShowAddPerson(false)
    } catch (err) {
      setAddPersonError(err.message || 'Failed to add person')
    } finally {
      setIsAddingPerson(false)
    }
  }

  function getAmountError() {
    const paise = rupeesToPaise(amount)
    if (paise === null) {
      return 'Enter a valid amount, up to 2 decimal places'
    }
    return ''
  }

  const canSubmit = selectedPersonId && direction && !getAmountError() && !isSubmitting

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    setSubmitError('')

    try {
      const paise = rupeesToPaise(amount)
      const body = {
        personId: selectedPersonId,
        direction,
        amountPaise: paise,
        kind,
        incurredOn: kind === 'old_due' ? date : getLocalToday(),
      }

      if (note.trim()) {
        body.note = note.trim()
      }

      const createdDebt = await addManualDebt(body)
      onAdded(createdDebt)
      onClose()
    } catch (err) {
      setSubmitError(err.message || 'Failed to add debt')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose()
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !isSubmitting) {
      onClose()
    }
  }

  if (!open) return null

  const amountError = getAmountError()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Add loan / due</h2>
          <button
            type="button"
            onClick={() => !isSubmitting && onClose()}
            disabled={isSubmitting}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {submitError && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
              <p>{submitError}</p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium text-foreground">Person</label>
            {isLoadingPeople ? (
              <p className="text-xs text-muted-foreground">Loading people…</p>
            ) : peopleError ? (
              <p className="text-xs text-destructive">{peopleError}</p>
            ) : showAddPerson ? (
              <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                <input
                  type="text"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Name"
                  disabled={isAddingPerson}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                />
                {addPersonError && <p className="text-xs text-destructive">{addPersonError}</p>}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAddPerson}
                    disabled={isAddingPerson}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <UserPlus className="size-3.5" />
                    {isAddingPerson ? 'Adding…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPerson(false)
                      setAddPersonError('')
                      setNewPersonName('')
                    }}
                    disabled={isAddingPerson}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedPersonId}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') {
                      setShowAddPerson(true)
                    } else {
                      setSelectedPersonId(e.target.value)
                    }
                  }}
                  disabled={presetPersonId !== null}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                >
                  <option value="">Select a person</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                  <option value="__add_new__">+ Add new person</option>
                </select>
                {!presetPersonId && (
                  <button
                    type="button"
                    onClick={() => setShowAddPerson(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    <Plus className="size-3.5" />
                    Add new person
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-foreground">Direction</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('they_owe_you')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  direction === 'they_owe_you'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/40'
                }`}
              >
                They owe me
              </button>
              <button
                type="button"
                onClick={() => setDirection('you_owe_them')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  direction === 'you_owe_them'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/40'
                }`}
              >
                I owe them
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-foreground">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setKind('loan')
                  setDate('')
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  kind === 'loan'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/40'
                }`}
              >
                New loan
              </button>
              <button
                type="button"
                onClick={() => {
                  setKind('old_due')
                  setDate(getLocalToday())
                }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  kind === 'old_due'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:border-primary/40'
                }`}
              >
                Old due
              </button>
            </div>
          </div>

          {kind === 'old_due' && (
            <div>
              <label className="mb-2 block text-xs font-medium text-foreground">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={getLocalToday()}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium text-foreground">Amount (₹)</label>
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {amountError && <p className="mt-1 text-xs text-destructive">{amountError}</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-foreground">
              Note <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Add a note..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            <p className="mt-1 text-xs text-muted-foreground text-right">
              {note.length} / 200
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => !isSubmitting && onClose()}
              disabled={isSubmitting}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
