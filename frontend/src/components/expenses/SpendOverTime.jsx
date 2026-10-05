import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { getExpensesOverTime } from '../../api/client';
import { formatPaise } from '../../lib/money';

export default function SpendOverTime({ granularity, selectedBucket, setSelectedBucket }) {
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
    return <div className="text-muted-foreground">Loading spending data...</div>;
  }

  if (error) {
    return <div className="text-destructive">Error: {error}</div>;
  }

  if (data.length === 0) {
    return <div className="text-muted-foreground italic">No expenses recorded for this range.</div>;
  }

  return (
    <div className="w-full">
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data}
            onClick={(e) => {
              if (e && e.activeLabel) {
                setSelectedBucket(e.activeLabel);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="periodStart" 
              tickFormatter={formatPeriodLabel}
            />
            <YAxis 
              tickFormatter={formatPaise}
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <p className="mb-1 text-sm font-medium text-foreground">{formatPeriodLabel(label)}</p>
                      <p className="text-sm text-muted-foreground">
                        Spent: <span className="font-semibold text-foreground">{formatPaise(payload[0].value)}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            {selectedBucket && <ReferenceLine x={selectedBucket} stroke="#8884d8" strokeDasharray="3 3" />}
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
