import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, Plus, UserPlus, Users } from 'lucide-react'
import { apiClient } from '../api/client.js'
import { calculateEvenSplit } from '../lib/splitPreview.js'

export default function SplitScreen({ userId, bill, onSaved, onBack }) {
  const [people, setPeople] = useState([])
  const [peopleError, setPeopleError] = useState('')
  const [isLoadingPeople, setIsLoadingPeople] = useState(true)

  const [selectedIds, setSelectedIds] = useState([])
  const [amountsPaid, setAmountsPaid] = useState({})

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function fetchPeople() {
      try {
        const data = await apiClient(`/api/people?userId=${encodeURIComponent(userId)}`)
        if (!cancelled) setPeople(data)
      } catch (err) {
        if (!cancelled) setPeopleError(err.message || 'Failed to load people')
      } finally {
        if (!cancelled) setIsLoadingPeople(false)
      }
    }

    fetchPeople()
    return () => {
      cancelled = true
    }
  }, [userId])

  const total = Number(bill?.total || 0)
  const preview = calculateEvenSplit(total, selectedIds, amountsPaid)
  const previewByPerson = Object.fromEntries(preview.map((entry) => [entry.personId, entry]))
  const perPersonShare = selectedIds.length ? total / selectedIds.length : 0

  function togglePerson(personId) {
    setSelectedIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    )
  }

  function setAmountPaid(personId, value) {
    setAmountsPaid((current) => ({ ...current, [personId]: value }))
  }

  async function handleAddPerson(event) {
    event.preventDefault()
    if (!newName.trim()) {
      setAddError('Name is required')
      return
    }

    setIsAdding(true)
    setAddError('')

    try {
      const body = { userId, name: newName.trim() }
      if (newEmail.trim()) body.email = newEmail.trim()

      const person = await apiClient('/api/people', { body })
      setPeople((current) => [...current, person])
      setSelectedIds((current) => [...current, person.id])
      setNewName('')
      setNewEmail('')
      setShowAddForm(false)
    } catch (err) {
      setAddError(err.message || 'Failed to add person')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setSaveError('')

    try {
      const response = await apiClient('/api/bills', {
        body: {
          userId,
          storagePath: bill.storagePath,
          merchantName: bill.merchantName,
          total,
          categoryId: bill.categoryId,
          billDate: bill.billDate || null,
          items: bill.items,
          people: selectedIds.map((personId) => ({
            personId,
            amountPaid: Number(amountsPaid[personId] || 0),
          })),
        },
      })
      
      const enrichedDebts = response.debts?.map(debt => {
        const person = people.find(p => p.id === debt.personId)
        return {
          ...debt,
          personName: debt.personName || person?.name || 'Unknown person'
        }
      })
      
      onSaved({ ...response, debts: enrichedDebts || [] })
    } catch (err) {
      setSaveError(err.message || 'Failed to save bill')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-[760px] animate-in fade-in duration-500">
      <div className="mb-8">
        <button
          type="button"
          onClick={onBack}
          className="group mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to review
        </button>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Split the bill</p>
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">
          Who was in on this?
        </h2>
        <p className="mt-4 max-w-[430px] text-sm leading-6 text-muted-foreground">
          Pick everyone sharing {bill?.merchantName ? `the ${bill.merchantName} bill` : 'this bill'} and note anything they&apos;ve already paid.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">People</h3>
            <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
          </div>

          {isLoadingPeople && <p className="mt-5 text-xs text-muted-foreground">Loading people…</p>}

          {peopleError && (
            <div className="mt-5 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {peopleError}
            </div>
          )}

          {!isLoadingPeople && !peopleError && people.length === 0 && (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-6 text-center text-muted-foreground">
              <Users className="size-6 opacity-50" strokeWidth={1.5} />
              <p className="text-xs">No people yet — add someone to split with.</p>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {people.map((person) => {
              const isSelected = selectedIds.includes(person.id)
              return (
                <div
                  key={person.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                    isSelected ? 'border-primary/60 bg-accent/50' : 'border-border bg-background'
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePerson(person.id)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{person.name}</span>
                      {person.email && (
                        <span className="block truncate text-[11px] text-muted-foreground">{person.email}</span>
                      )}
                    </span>
                  </label>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Paid ₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountsPaid[person.id] ?? 0}
                      disabled={!isSelected}
                      onChange={(event) => setAmountPaid(person.id, event.target.value)}
                      aria-label={`Amount already paid by ${person.name}`}
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40"
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {showAddForm ? (
            <form onSubmit={handleAddPerson} className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Name"
                  aria-label="New person name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="Email (optional)"
                  aria-label="New person email"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {addError && <p className="text-xs text-destructive">{addError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <UserPlus className="size-3.5" />
                  {isAdding ? 'Adding…' : 'Add person'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setAddError('')
                  }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              <Plus className="size-3.5" />
              Add new person
            </button>
          )}
        </div>

        <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Split preview</h3>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Bill total</span>
            <span className="text-lg font-semibold">₹{total.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Even share each</span>
            <span className="text-sm font-medium">
              {selectedIds.length ? `₹${perPersonShare.toFixed(2)}` : '—'}
            </span>
          </div>

          <div className="mt-5 space-y-2 border-t border-border pt-5">
            {selectedIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">Select at least one person to see the split.</p>
            ) : (
              selectedIds.map((personId) => {
                const person = people.find((candidate) => candidate.id === personId)
                const entry = previewByPerson[personId]
                return (
                  <div key={personId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-foreground">{person?.name ?? 'Unknown'}</span>
                    <span
                      className={`shrink-0 text-xs font-medium ${
                        entry.settled
                          ? 'text-muted-foreground'
                          : entry.direction === 'they_owe_you'
                            ? 'text-foreground'
                            : 'text-destructive'
                      }`}
                    >
                      {entry.settled
                        ? 'Settled up'
                        : entry.direction === 'they_owe_you'
                          ? `Owes you ₹${entry.owedAmount.toFixed(2)}`
                          : `You owe ₹${entry.owedAmount.toFixed(2)}`}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {saveError && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{saveError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || selectedIds.length === 0}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="size-4" />
            {isSaving ? 'Saving…' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
