import { useState, useEffect } from 'react';
import { Trash2, Plus, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { apiClient } from '../api/client.js';

export default function ReviewScreen({ data, onContinue, onBack }) {
  const [categories, setCategories] = useState([]);
  
  const [merchantName, setMerchantName] = useState(data?.merchantName || '');
  const [billDate, setBillDate] = useState(data?.billDate || new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [total, setTotal] = useState(data?.total || 0);
  const [items, setItems] = useState(data?.items || []);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const cats = await apiClient('/api/categories');
        setCategories(cats);
        
        if (data?.category && cats.length > 0) {
          const match = cats.find(c => c.name.toLowerCase() === data.category.toLowerCase());
          if (match) {
            setCategoryId(match.id);
          } else if (!categoryId) {
            setCategoryId(cats[0].id);
          }
        } else if (cats.length > 0 && !categoryId) {
          setCategoryId(cats[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
      }
    }
    fetchCategories();
  }, [data?.category]);

  const runningTotal = items.reduce((sum, item) => sum + (parseFloat(item.price || 0) * parseInt(item.quantity || 1, 10)), 0);
  const isMismatch = Math.abs(runningTotal - parseFloat(total || 0)) > 0.01;

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { name: '', price: 0, quantity: 1 }]);
  };

  const handleContinue = () => {
    const finalData = {
      ...data,
      merchantName,
      billDate,
      categoryId,
      total: parseFloat(total || 0),
      items: items.map(i => ({ ...i, price: parseFloat(i.price || 0), quantity: parseInt(i.quantity || 1, 10) }))
    };
    onContinue(finalData);
  };

  return (
    <div className="w-full max-w-[760px] animate-in fade-in duration-500">
      <div className="mb-8">
        <button 
          onClick={onBack}
          className="group mb-6 flex items-center gap-2 font-body text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to upload
        </button>
        <p className="mb-3 font-body text-label-sm font-semibold uppercase tracking-[0.18em] text-primary">Review Details</p>
        <h2 className="font-headline text-balance text-3xl font-semibold tracking-[-0.045em] text-on-surface md:text-[40px] md:leading-[1.05]">
          Is everything correct?
        </h2>
        <p className="mt-4 max-w-[430px] font-body text-sm leading-6 text-on-surface-variant">
          Review the extracted details and make any necessary corrections before splitting the bill.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl bg-surface-container-low p-6 shadow-2xl md:p-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="font-body text-xs font-medium text-on-surface-variant">Merchant Name</label>
            <input 
              type="text" 
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="w-full rounded-lg bg-surface-container px-3 py-2 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="font-body text-xs font-medium text-on-surface-variant">Date</label>
            <input 
              type="date" 
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full rounded-lg bg-surface-container px-3 py-2 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="font-body text-xs font-medium text-on-surface-variant">Category</label>
            <select 
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg bg-surface-container px-3 py-2 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled className="bg-surface-container text-on-surface">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id} className="bg-surface-container text-on-surface">{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-outline-variant pt-4">
          <h3 className="mb-4 font-headline text-sm font-semibold text-on-surface">Items</h3>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={item.name}
                  onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                  placeholder="Item name"
                  className="min-w-0 flex-1 rounded-lg bg-surface-container px-3 py-2 font-body text-sm text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
                />
                <input 
                  type="number" 
                  value={item.price}
                  onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                  placeholder="Price"
                  step="0.01"
                  className="w-24 rounded-lg bg-surface-container px-3 py-2 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
                <input 
                  type="number" 
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  placeholder="Qty"
                  min="1"
                  className="w-16 rounded-lg bg-surface-container px-3 py-2 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                />
                <button 
                  type="button" 
                  onClick={() => removeItem(index)}
                  className="shrink-0 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container/10 hover:text-error"
                  aria-label="Remove item"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <button 
            type="button" 
            onClick={addItem}
            className="mt-4 flex items-center gap-1.5 font-body text-xs font-medium text-primary transition-colors hover:text-primary-fixed"
          >
            <Plus className="size-3.5" />
            Add Item
          </button>
        </div>

        <div className="flex flex-col gap-6 border-t border-outline-variant pt-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-end gap-6">
             <div className="space-y-2">
               <label className="font-body text-xs font-medium text-on-surface-variant">Running Total</label>
               <div className={`text-lg font-semibold ${isMismatch ? 'text-error' : 'text-on-surface'}`}>
                 ₹{runningTotal.toFixed(2)}
               </div>
             </div>
             <div className="space-y-2">
               <label className="font-body text-xs font-medium text-on-surface-variant">Bill Total</label>
               <input 
                 type="number" 
                 value={total}
                 onChange={(e) => setTotal(e.target.value)}
                 step="0.01"
                 className="w-32 rounded-lg bg-surface-container px-3 py-2 font-body text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
               />
             </div>
          </div>
          
          <button 
            type="button" 
            onClick={handleContinue}
            className="group flex items-center justify-center gap-2 rounded-xl bg-primary-container px-5 py-2.5 font-body text-sm font-semibold text-on-primary-container transition-transform hover:-translate-y-0.5 hover:bg-secondary-container"
          >
            Continue to split
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {isMismatch && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-error-container/50 bg-error-container/10 p-4 font-body text-sm text-error">
             <AlertCircle className="size-5 shrink-0 mt-0.5" />
             <p>The running total of items (₹{runningTotal.toFixed(2)}) doesn't match the bill total (₹{parseFloat(total || 0).toFixed(2)}). You can continue, but make sure taxes or discounts are accounted for.</p>
          </div>
        )}
      </div>
    </div>
  );
}
