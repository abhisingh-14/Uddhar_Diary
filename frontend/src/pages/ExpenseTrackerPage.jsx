import React, { useState } from 'react';
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
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">Expense Tracker</h1>
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30">
          <button
            onClick={() => handleGranularityChange('week')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              granularity === 'week'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => handleGranularityChange('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              granularity === 'month'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Spending Over Time</h2>
          <SpendOverTime 
            granularity={granularity} 
            selectedBucket={selectedBucket}
            setSelectedBucket={setSelectedBucket}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">
              Category Breakdown — {formatPeriodHeading()}
            </h2>
            {selectedBucket && (
              <button 
                onClick={() => setSelectedBucket(null)}
                className="text-sm text-primary hover:underline"
              >
                Back to current period
              </button>
            )}
          </div>
          <CategoryBreakdown granularity={granularity} date={selectedBucket} />
        </div>
      </div>
    </div>
  );
}
