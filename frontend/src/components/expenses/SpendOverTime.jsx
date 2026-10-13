import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { AlertCircle, Loader2 } from 'lucide-react';
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
    return (
      <div className="flex items-center justify-center gap-2 py-12 font-body text-sm text-on-surface-variant">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
        Loading spending data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-error-container/50 bg-error-container/10 p-4 font-body text-sm text-error">
        <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
        <p>Error: {error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container/40 px-4 py-8 text-center font-body text-sm text-on-surface-variant">
        No expenses recorded for this range.
      </p>
    );
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
            <CartesianGrid strokeDasharray="3 3" stroke="#353534" strokeOpacity={0.6} />
            <XAxis 
              dataKey="periodStart" 
              tickFormatter={formatPeriodLabel}
              stroke="#86948a"
              tick={{ fill: '#bbcabf', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
              tickLine={{ stroke: '#3c4a42' }}
            />
            <YAxis 
              tickFormatter={formatPaise}
              stroke="#86948a"
              tick={{ fill: '#bbcabf', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
              tickLine={{ stroke: '#3c4a42' }}
            />
            <Tooltip 
              cursor={{ stroke: '#3c4a42', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-3 shadow-xl">
                      <p className="mb-1 font-body text-xs font-medium text-on-surface-variant">{formatPeriodLabel(label)}</p>
                      <p className="font-body text-sm text-on-surface-variant">
                        Spent: <span className="font-semibold tabular-nums text-on-surface">{formatPaise(payload[0].value)}</span>
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
