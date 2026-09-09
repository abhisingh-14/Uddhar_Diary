import React, { useState } from 'react';
import SpendOverTime from '../components/expenses/SpendOverTime';
import CategoryBreakdown from '../components/expenses/CategoryBreakdown';

export default function ExpenseTrackerPage() {
  const [granularity, setGranularity] = useState('month');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Expense Tracker</h1>
        <div className="inline-flex rounded-lg border border-gray-300 p-1">
          <button
            onClick={() => setGranularity('week')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              granularity === 'week'
                ? 'bg-blue-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setGranularity('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              granularity === 'month'
                ? 'bg-blue-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Spending Over Time</h2>
          <SpendOverTime granularity={granularity} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Category Breakdown</h2>
          <CategoryBreakdown granularity={granularity} />
        </div>
      </div>
    </div>
  );
}
