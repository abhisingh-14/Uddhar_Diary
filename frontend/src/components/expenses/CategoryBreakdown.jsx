import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, Loader2 } from 'lucide-react';
import { getExpensesByCategory } from '../../api/client';
import { formatPaise } from '../../lib/money';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export default function CategoryBreakdown({ granularity, date }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const result = await getExpensesByCategory(granularity, date);
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load category breakdown.');
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
  }, [granularity, date]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 font-body text-sm text-on-surface-variant">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
        Loading breakdown…
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
        No expenses recorded for this period.
      </p>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="totalPaise"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              outerRadius={80}
              stroke="#1c1b1b"
              strokeWidth={2}
              label={({ categoryName }) => categoryName}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="rounded-xl border border-outline-variant/40 bg-surface-container p-3 shadow-xl">
                      <p className="mb-1 font-body text-xs font-medium text-on-surface-variant">{item.categoryName}</p>
                      <p className="font-body text-sm text-on-surface-variant">
                        Spent: <span className="font-semibold tabular-nums text-on-surface">{formatPaise(item.totalPaise)}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-6 w-full space-y-2">
        {data.map((entry, index) => (
          <li
            key={entry.categoryId || index}
            className="flex items-center justify-between rounded-xl bg-surface-container px-4 py-3 font-body text-sm transition-colors hover:bg-surface-container-high"
          >
            <div className="flex items-center gap-3">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="font-medium text-on-surface">{entry.categoryName}</span>
            </div>
            <span className="font-semibold tabular-nums text-on-surface">
              {formatPaise(entry.totalPaise)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
