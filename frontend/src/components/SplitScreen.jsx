import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, Check, Plus, UserPlus, Users } from 'lucide-react'
import { apiClient } from '../api/client.js'
import { calculateSplit } from '../lib/splitPreview.js'

export default function SplitScreen({ bill, onSaved, onBack }) {
  const [people, setPeople] = useState([])
  const [peopleError, setPeopleError] = useState('')
  const [isLoadingPeople, setIsLoadingPeople] = useState(true)

  const [selectedIds, setSelectedIds] = useState([])
  const [amountsPaid, setAmountsPaid] = useState({})
  const [payer, setPayer] = useState('you')

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
        const data = await apiClient('/api/people')
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
  }, [])

  const total = Number(bill?.total || 0)
  const preview = calculateSplit({ totalAmount: total, participantIds: selectedIds, payer, alreadyPaid: amountsPaid })

  function togglePerson(personId) {
    setSelectedIds((current) => {
      const newSelection = current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId]

      if (payer !== 'you' && !newSelection.includes(payer)) {
        setPayer('you')
      }

      return newSelection
    })
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
      const body = { name: newName.trim() }
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
      const requestBody = {
        merchantName: bill.merchantName,
        total,
        categoryId: bill.categoryId,
        billDate: bill.billDate || null,
        paidBy: payer,
        participantIds: selectedIds,
        source: bill.source ?? 'photo',
      }

      // Only include storagePath and items for photo uploads
      if (bill.source !== 'manual') {
        requestBody.storagePath = bill.storagePath
        requestBody.items = bill.items
      }

      // Only include alreadyPaid when payer is 'you'
      if (payer === 'you') {
        const alreadyPaidObj = {}
        for (const personId of selectedIds) {
          const amount = Number(amountsPaid[personId] || 0)
          if (amount > 0) {
            alreadyPaidObj[personId] = amount
          }
        }
        if (Object.keys(alreadyPaidObj).length > 0) {
          requestBody.alreadyPaid = alreadyPaidObj
        }
      }

      const response = await apiClient('/api/bills', {
        body: requestBody,
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
          className="group mb-6 flex items-center gap-2 font-body text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          {bill?.source === 'manual' ? 'Back' : 'Back to review'}
        </button>
        <p className="mb-3 font-body text-label-sm font-semibold uppercase tracking-[0.18em] text-primary">Split the bill</p>
        <h2 className="font-headline text-balance text-3xl font-semibold tracking-[-0.045em] text-on-surface md:text-[40px] md:leading-[1.05]">
          Who was in on this?
        </h2>
        <p className="mt-4 max-w-[430px] font-body text-sm leading-6 text-on-surface-variant">
          Pick everyone sharing {bill?.merchantName ? `the ${bill.merchantName} bill` : bill?.source === 'manual' ? 'this quick split' : 'this bill'} and note anything they&apos;ve already paid.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-surface-container-low p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <h3 className="font-headline text-sm font-semibold text-on-surface">People</h3>
            <span className="font-body text-xs text-on-surface-variant">{selectedIds.length} selected</span>
          </div>

          {selectedIds.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <label className="font-body text-xs font-medium text-on-surface-variant">Paid by</label>
              <select
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                className="rounded-lg bg-surface-container px-3 py-1.5 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="you" className="bg-surface-container text-on-surface">You</option>
                {selectedIds.map((personId) => {
                  const person = people.find((p) => p.id === personId)
                  return (
                    <option key={personId} value={personId} className="bg-surface-container text-on-surface">
                      {person?.name ?? 'Unknown'}
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {isLoadingPeople && <p className="mt-5 font-body text-xs text-on-surface-variant">Loading people…</p>}

          {peopleError && (
            <div className="mt-5 rounded-xl border border-error-container/50 bg-error-container/10 p-3 font-body text-sm text-error">
              {peopleError}
            </div>
          )}

          {!isLoadingPeople && !peopleError && people.length === 0 && (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-surface-container p-6 text-center font-body text-on-surface-variant">
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
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                    isSelected ? 'bg-primary-container/15 ring-1 ring-primary/60' : 'bg-surface-container'
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
                      <span className="block truncate font-body text-sm font-medium text-on-surface">{person.name}</span>
                      {person.email && (
                        <span className="block truncate font-body text-[11px] text-on-surface-variant">{person.email}</span>
                      )}
                    </span>
                  </label>
                  {payer === 'you' && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="font-body text-[11px] text-on-surface-variant">Paid ₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={amountsPaid[person.id] ?? 0}
                        disabled={!isSelected}
                        onChange={(event) => setAmountPaid(person.id, event.target.value)}
                        aria-label={`Amount already paid by ${person.name}`}
                        className="w-20 rounded-lg bg-surface-container px-2 py-1.5 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary disabled:opacity-40"
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {showAddForm ? (
            <form onSubmit={handleAddPerson} className="mt-4 space-y-3 rounded-xl bg-surface-container p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Name"
                  aria-label="New person name"
                  className="w-full rounded-lg bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="Email (optional)"
                  aria-label="New person email"
                  className="w-full rounded-lg bg-surface-container-lowest px-3 py-2 font-body text-sm text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
                />
              </div>
              {addError && <p className="font-body text-xs text-error">{addError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-2 font-body text-xs font-semibold text-on-primary-container hover:bg-secondary-container disabled:opacity-50"
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
                  className="font-body text-xs font-medium text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-4 flex items-center gap-1.5 font-body text-xs font-medium text-primary transition-colors hover:text-primary-fixed"
            >
              <Plus className="size-3.5" />
              Add new person
            </button>
          )}
        </div>

        <div className="flex flex-col rounded-2xl bg-surface-container-low p-6 shadow-2xl">
          <h3 className="font-headline text-sm font-semibold text-on-surface">Split preview</h3>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-body text-xs text-on-surface-variant">Bill total</span>
            <span className="text-lg font-semibold text-on-surface">₹{total.toFixed(2)}</span>
          </div>

          <div className="mt-5 space-y-2 border-t border-outline-variant pt-5">
            {selectedIds.length === 0 ? (
              <p className="font-body text-xs text-on-surface-variant">Select at least one person to see the split.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 font-body text-sm">
                  <span className="min-w-0 truncate text-on-surface">Your share</span>
                  <span className="shrink-0 text-xs font-medium text-on-surface">
                    ₹{preview.userShare.toFixed(2)}
                  </span>
                </div>
                {preview.debts.map((debt) => {
                  const person = people.find((candidate) => candidate.id === debt.personId)
                  return (
                    <div key={debt.personId} className="flex items-center justify-between gap-3 font-body text-sm">
                      <span className="min-w-0 truncate text-on-surface">{person?.name ?? 'Unknown'}</span>
                      <span
                        className={`shrink-0 text-xs font-medium ${
                          debt.direction === 'they_owe_you'
                            ? 'text-on-surface'
                            : 'text-error'
                        }`}
                      >
                        {debt.direction === 'they_owe_you'
                          ? `Owes you ₹${debt.amount.toFixed(2)}`
                          : `You owe ₹${debt.amount.toFixed(2)}`}
                      </span>
                    </div>
                  )
                })}
                {preview.debts.length === 0 && (
                  <p className="font-body text-xs text-on-surface-variant">Everyone is settled up.</p>
                )}
              </>
            )}
          </div>

          {saveError && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-error-container/50 bg-error-container/10 p-3 font-body text-sm text-error">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{saveError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || selectedIds.length === 0}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-primary-container px-5 py-2.5 font-body text-sm font-semibold text-on-primary-container transition-transform hover:-translate-y-0.5 hover:bg-secondary-container disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="size-4" />
            {isSaving ? 'Saving…' : 'Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
