import { useState } from 'react';
import SpendOverTime from '../components/expenses/SpendOverTime';
import CategoryBreakdown from '../components/expenses/CategoryBreakdown';

export default function ExpenseTrackerPage() {
  const [granularity, setGranularity] = useState('month');
  const [selectedBucket, setSelectedBucket] = useState(null);

  const handleGranularityChange = (newGran) => {
    setGranularity(newGran);
    setSelectedBucket(null);
  };

  const formatPeriodHeading = () => {
    if (!selectedBucket) {
      return granularity === 'month' ? 'This month' : 'This week';
    }
    // Need to parse date treating it as local to avoid off-by-one errors due to timezones
    const parts = selectedBucket.split('-');
    if (parts.length !== 3) return selectedBucket;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);

    if (granularity === 'month') {
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      const startStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${startStr} – ${endStr}`;
    }
  };

  return (
    <div className="flex flex-1 items-start justify-center px-5 py-10 md:px-12 md:py-16 lg:py-24">
      <div className="w-full max-w-[760px] animate-in fade-in duration-500">
        <div className="max-w-[500px]">
          <p className="mb-3 font-body text-label-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Overview / Analytics
          </p>
          <h1 className="font-headline text-balance text-3xl font-semibold tracking-[-0.045em] text-on-surface md:text-[40px] md:leading-[1.05]">
            Expense Tracker
          </h1>
          <p className="mt-4 max-w-[430px] font-body text-sm leading-6 text-on-surface-variant">
            Track your spending trends and category distribution over time.
          </p>
        </div>

        <div className="mt-8 mb-8 inline-flex rounded-xl bg-surface-container p-1">
          <button
            type="button"
            onClick={() => handleGranularityChange('week')}
            className={`rounded-lg px-4 py-2 font-body text-sm font-medium transition-colors ${
              granularity === 'week'
                ? 'bg-primary-container text-on-primary-container shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => handleGranularityChange('month')}
            className={`rounded-lg px-4 py-2 font-body text-sm font-medium transition-colors ${
              granularity === 'month'
                ? 'bg-primary-container text-on-primary-container shadow-md'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Month
          </button>
        </div>

        <div className="space-y-8">
          <div className="rounded-2xl bg-surface-container-low p-6 shadow-2xl">
            <h2 className="mb-4 font-headline text-lg font-semibold text-on-surface">
              Spending Over Time
            </h2>
            <SpendOverTime 
              granularity={granularity} 
              selectedBucket={selectedBucket}
              setSelectedBucket={setSelectedBucket}
            />
          </div>

          <div className="rounded-2xl bg-surface-container-low p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-headline text-lg font-semibold text-on-surface">
                Category Breakdown — {formatPeriodHeading()}
              </h2>
              {selectedBucket && (
                <button 
                  type="button"
                  onClick={() => setSelectedBucket(null)}
                  className="font-body text-xs font-semibold text-primary transition-colors hover:underline"
                >
                  Back to current period
                </button>
              )}
            </div>
            <CategoryBreakdown granularity={granularity} date={selectedBucket} />
          </div>
        </div>
      </div>
    </div>
  );
}
