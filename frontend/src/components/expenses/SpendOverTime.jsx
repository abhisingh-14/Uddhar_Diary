import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getExpensesOverTime } from '../../api/client';
import { formatPaise } from '../../lib/money';

export default function SpendOverTime({ granularity }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const result = await getExpensesOverTime(granularity);
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load spending over time.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [granularity]);

  const formatPeriodLabel = (periodStart) => {
    const date = new Date(periodStart);
    if (granularity === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading spending data...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (data.length === 0) {
    return <div className="text-gray-500 italic">No expenses recorded for this range.</div>;
  }

  return (
    <div className="w-full">
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="periodStart" 
              tickFormatter={formatPeriodLabel}
            />
            <YAxis 
              tickFormatter={formatPaise}
            />
            <Tooltip 
              labelFormatter={formatPeriodLabel}
              formatter={(value) => formatPaise(value)}
            />
            <Line 
              type="monotone" 
              dataKey="totalPaise" 
              stroke="#8884d8" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
