import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getExpensesByCategory } from '../../api/client';
import { formatPaise } from '../../lib/money';
import { CURRENT_USER_ID } from '../../lib/currentUser';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export default function CategoryBreakdown({ granularity }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const result = await getExpensesByCategory(granularity, CURRENT_USER_ID);
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
  }, [granularity]);

  if (loading) {
    return <div className="text-gray-500">Loading breakdown...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (data.length === 0) {
    return <div className="text-gray-500 italic">No expenses recorded for this period</div>;
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
              label={({ categoryName }) => categoryName}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => formatPaise(value)}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-4 w-full space-y-1">
        {data.map((entry, index) => (
          <li key={entry.categoryId || index} className="text-gray-700">
            {entry.categoryName} &rarr; {formatPaise(entry.totalPaise)}
          </li>
        ))}
      </ul>
    </div>
  );
}
