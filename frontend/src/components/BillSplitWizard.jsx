import { useRef, useState } from 'react'
import { apiClient } from '../api/client.js'
import ReviewScreen from './ReviewScreen.jsx'
import SplitScreen from './SplitScreen.jsx'
import SuccessScreen from './SuccessScreen.jsx'
import {
  ArrowUpRight,
  Check,
  FileImage,
  ImagePlus,
} from 'lucide-react'

const USER_ID = '999af4e5-6e7b-4512-9202-95c1a29dfff0'

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
      formData.append('userId', USER_ID)

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
    <div className="flex flex-1 items-start justify-center px-5 py-10 md:px-12 md:py-16 lg:py-24">
      {step === 'upload' && (
        <div className="w-full max-w-[760px]">
          <div className="max-w-[500px]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Start with a photo</p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">Turn a receipt into a fair split.</h2>
            <p className="mt-4 max-w-[430px] text-sm leading-6 text-muted-foreground">Upload a clear photo of your bill and we&apos;ll identify the items, totals, and taxes for you.</p>
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
              className={`flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center transition-colors ${isDragging ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/50 hover:bg-accent/40'}`}
            >
              <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0])} />
              <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-primary">
                <ImagePlus className="size-5" strokeWidth={1.8} />
              </div>
              <p className="mt-5 text-sm font-semibold">Drop your bill photo here</p>
              <p className="mt-1.5 text-xs text-muted-foreground">or <span className="font-medium text-primary">browse files</span></p>
              <p className="mt-5 text-[11px] text-muted-foreground">JPG, PNG or HEIC · up to 10 MB</p>
            </div>

            <div className="flex min-h-[280px] flex-col rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Selected bill</p>
                {file && <Check className="size-4 text-primary" />}
              </div>
              <div className="mt-4 flex flex-1 items-center justify-center overflow-hidden rounded-xl bg-muted/60">
                {file ? (
                  <img src={URL.createObjectURL(file)} alt="Selected bill preview" className="h-full max-h-[210px] w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                    <FileImage className="size-7 opacity-50" strokeWidth={1.4} />
                    <p className="text-xs">Your preview will appear here</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="truncate text-xs text-muted-foreground">{file ? file.name : 'No image selected'}</p>
                {file && <button type="button" onClick={() => setFile(null)} className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Remove</button>}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMsg}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
            <p className="max-w-[270px] text-xs leading-5 text-muted-foreground">We&apos;ll keep your bill private and only use it to read the details.</p>
            <button 
              type="button" 
              disabled={!file || isLoading} 
              onClick={handleExtractBill}
              className="group flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? 'Extracting...' : 'Extract Bill'}
              {!isLoading && <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
            </button>
          </div>
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
          userId={USER_ID}
          bill={reviewedBill}
          onSaved={(result) => {
            setSaveResult({
              ...result,
              merchantName: reviewedBill?.merchantName,
              total: reviewedBill?.total,
            })
            setStep('success')
          }}
          onBack={() => setStep('review')}
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
