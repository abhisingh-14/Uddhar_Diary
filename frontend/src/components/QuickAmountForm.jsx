import { useState, useEffect } from 'react'
import { ArrowRight, AlertCircle } from 'lucide-react'
import { apiClient } from '../api/client.js'

export default function QuickAmountForm({ onContinue }) {
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState('')
  const [categories, setCategories] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [merchantName, setMerchantName] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const cats = await apiClient('/api/categories')
        setCategories(cats)
        
        // Preselect "Other" category by name
        const otherCategory = cats.find(c => c.name.toLowerCase() === 'other')
        if (otherCategory) {
          setSelectedCategoryId(otherCategory.id)
        } else if (cats.length > 0) {
          setSelectedCategoryId(cats[0].id)
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      } finally {
        setIsLoadingCategories(false)
      }
    }
    fetchCategories()
  }, [])

  function validateAmount(value) {
    if (!value) {
      setAmountError('Amount is required')
      return false
    }
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) {
      setAmountError('Amount must be positive')
      return false
    }
    // Check for max 2 decimal places
    if (value.includes('.')) {
      const decimalPlaces = value.split('.')[1].length
      if (decimalPlaces > 2) {
        setAmountError('Maximum 2 decimal places')
        return false
      }
    }
    setAmountError('')
    return true
  }

  function handleAmountChange(value) {
    setAmount(value)
    if (value) {
      validateAmount(value)
    } else {
      setAmountError('')
    }
  }

  function handleContinue() {
    if (!validateAmount(amount)) return
    if (!selectedCategoryId) {
      setAmountError('Please select a category')
      return
    }

    const draft = {
      total: parseFloat(amount),
      categoryId: selectedCategoryId,
      merchantName: merchantName.trim() || null,
      billDate: billDate || null,
      items: [],
      source: 'manual',
      storagePath: null
    }

    onContinue(draft)
  }

  return (
    <div className="w-full max-w-[760px] animate-in fade-in duration-500">
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quick split</p>
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">
          Enter the total amount
        </h2>
        <p className="mt-4 max-w-[430px] text-sm leading-6 text-muted-foreground">
          Skip the photo upload and directly enter the bill amount to split with your group.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground">₹</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-border bg-background pl-10 pr-4 py-3 text-lg font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
            />
          </div>
          {amountError && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="size-3.5" />
              {amountError}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Category</label>
          {isLoadingCategories ? (
            <p className="text-xs text-muted-foreground">Loading categories…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategoryId === category.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Label (optional)</label>
            <input
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="e.g., Dinner at Cafe"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Date</label>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!amount || !selectedCategoryId || !!amountError}
            className="group flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
