import { useRef, useState, useEffect } from 'react'
import { apiClient } from '../api/client.js'
import ReviewScreen from './ReviewScreen.jsx'
import SplitScreen from './SplitScreen.jsx'
import SuccessScreen from './SuccessScreen.jsx'
import QuickAmountForm from './QuickAmountForm.jsx'
import {
  ArrowUpRight,
  Check,
  FileImage,
  ImagePlus,
} from 'lucide-react'

export default function BillSplitWizard() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [step, setStep] = useState('upload')
  const [extractedData, setExtractedData] = useState(null)
  const [reviewedBill, setReviewedBill] = useState(null)
  const [saveResult, setSaveResult] = useState(null)
  const [entryMode, setEntryMode] = useState(() => {
    try {
      const saved = localStorage.getItem('billEntryMode')
      if (saved === 'amount' || saved === 'photo') {
        return saved
      }
    } catch (err) {
      // Fall back to default 'amount' if localStorage fails
    }
    return 'amount'
  })

  function handleEntryModeChange(mode) {
    setEntryMode(mode)
    try {
      localStorage.setItem('billEntryMode', mode)
    } catch (err) {
      // Silently fail if localStorage is unavailable
    }
  }

  function selectFile(nextFile) {
    if (nextFile && nextFile.type.startsWith('image/')) {
      setFile(nextFile)
      setErrorMsg('')
    }
  }

  async function handleExtractBill() {
    if (!file) return

    setIsLoading(true)
    setErrorMsg('')

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await apiClient('/api/bills/extract', { body: formData })
      console.log('Extraction success:', response)
      setExtractedData(response)
      setStep('review')
    } catch (err) {
      setErrorMsg(err.message || 'Failed to extract bill. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-5 md:p-8">
      {step === 'upload' && (
        <div className="w-full max-w-[760px]">
          <div className="mb-8">
            <div className="inline-flex rounded-xl bg-surface-container p-1">
              <button
                type="button"
                onClick={() => handleEntryModeChange('amount')}
                className={`px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors ${
                  entryMode === 'amount'
                    ? 'bg-primary-container text-on-primary-container shadow-md'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Enter amount
              </button>
              <button
                type="button"
                onClick={() => handleEntryModeChange('photo')}
                className={`px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors ${
                  entryMode === 'photo'
                    ? 'bg-primary-container text-on-primary-container shadow-md'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Bill photo
              </button>
            </div>
          </div>

          {entryMode === 'amount' ? (
            <QuickAmountForm
              onContinue={(draft) => {
                setReviewedBill(draft)
                setStep('split')
              }}
            />
          ) : (
            <>
              <div className="max-w-[500px]">
                <p className="mb-3 font-body text-label-sm font-semibold uppercase tracking-[0.18em] text-primary">Start with a photo</p>
                <h2 className="font-headline text-balance text-3xl font-semibold tracking-[-0.045em] text-on-surface md:text-[40px] md:leading-[1.05]">Turn a receipt into a fair split.</h2>
                <p className="mt-4 max-w-[430px] font-body text-sm leading-6 text-on-surface-variant">Upload a clear photo of your bill and we&apos;ll identify the items, totals, and taxes for you.</p>
              </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => { event.preventDefault(); setIsDragging(false); selectFile(event.dataTransfer.files[0]) }}
              className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center shadow-2xl transition-colors ${isDragging ? 'border-primary bg-primary-container/10' : 'border-outline-variant bg-surface-container-low hover:border-primary/50 hover:bg-surface-container'}`}
            >
              <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0])} />
              <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-container text-primary">
                <ImagePlus className="size-5" strokeWidth={1.8} />
              </div>
              <p className="mt-5 font-headline text-sm font-semibold text-on-surface">Drop your bill photo here</p>
              <p className="mt-1.5 font-body text-xs text-on-surface-variant">or <span className="font-medium text-primary">browse files</span></p>
              <p className="mt-5 font-body text-[11px] text-on-surface-variant">JPG, PNG or HEIC · up to 10 MB</p>
            </div>

            <div className="flex min-h-[280px] flex-col rounded-2xl border-0 bg-surface-container-low p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="font-body text-xs font-semibold uppercase tracking-[0.15em] text-on-surface-variant">Selected bill</p>
                {file && <Check className="size-4 text-primary" />}
              </div>
              <div className="mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-surface-container">
                {file ? (
                  <img src={URL.createObjectURL(file)} alt="Selected bill preview" className="h-full max-h-[210px] w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center text-on-surface-variant">
                    <FileImage className="size-7 opacity-50" strokeWidth={1.4} />
                    <p className="font-body text-xs">Your preview will appear here</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="truncate font-body text-xs text-on-surface-variant">{file ? file.name : 'No image selected'}</p>
                {file && <button type="button" onClick={() => setFile(null)} className="shrink-0 font-body text-xs font-medium text-on-surface-variant underline-offset-4 hover:text-on-surface hover:underline">Remove</button>}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-error-container/50 bg-error-container/10 p-3 font-body text-sm text-error">
              {errorMsg}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-outline-variant pt-5">
            <p className="max-w-[270px] font-body text-xs leading-5 text-on-surface-variant">We&apos;ll keep your bill private and only use it to read the details.</p>
            <button 
              type="button" 
              disabled={!file || isLoading} 
              onClick={handleExtractBill}
              className="group flex items-center gap-2 rounded-xl bg-primary-container px-4 py-2.5 font-body text-xs font-semibold text-on-primary-container transition-transform hover:-translate-y-0.5 hover:bg-secondary-container disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? 'Extracting...' : 'Extract Bill'}
              {!isLoading && <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
            </button>
          </div>
        </>
          )}
        </div>
      )}

      {step === 'review' && (
        <ReviewScreen
          data={extractedData?.extracted}
          onContinue={(finalData) => {
            setReviewedBill({ ...finalData, storagePath: extractedData?.storagePath })
            setStep('split')
          }}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'split' && (
        <SplitScreen
          bill={reviewedBill}
          onSaved={(result) => {
            setSaveResult({
              ...result,
              merchantName: reviewedBill?.merchantName,
              total: reviewedBill?.total,
            })
            setStep('success')
          }}
          onBack={() => {
            if (reviewedBill?.source === 'manual') {
              setStep('upload')
            } else {
              setStep('review')
            }
          }}
        />
      )}

      {step === 'success' && (
        <SuccessScreen
          result={saveResult}
          onStartOver={() => {
            setFile(null)
            setExtractedData(null)
            setReviewedBill(null)
            setSaveResult(null)
            setStep('upload')
          }}
        />
      )}
    </div>
  )
}
