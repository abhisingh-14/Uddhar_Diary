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
          className="group mb-6 flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to upload
        </button>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Review Details</p>
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.045em] md:text-[40px] md:leading-[1.05]">
          Is everything correct?
        </h2>
        <p className="mt-4 max-w-[430px] text-sm leading-6 text-muted-foreground">
          Review the extracted details and make any necessary corrections before splitting the bill.
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Merchant Name</label>
            <input 
              type="text" 
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Date</label>
            <input 
              type="date" 
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Category</label>
            <select 
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
            >
              <option value="" disabled>Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Items</h3>
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <input 
                  type="text" 
                  value={item.name}
                  onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                  placeholder="Item name"
                  className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
                <input 
                  type="number" 
                  value={item.price}
                  onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                  placeholder="Price"
                  step="0.01"
                  className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
                <input 
                  type="number" 
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  placeholder="Qty"
                  min="1"
                  className="w-16 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
                />
                <button 
                  type="button" 
                  onClick={() => removeItem(index)}
                  className="shrink-0 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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
            className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="size-3.5" />
            Add Item
          </button>
        </div>

        <div className="pt-6 border-t border-border flex flex-col md:flex-row gap-6 md:items-end md:justify-between">
          <div className="flex gap-6 items-end">
             <div className="space-y-2">
               <label className="text-xs font-medium text-muted-foreground">Running Total</label>
               <div className={`text-lg font-semibold ${isMismatch ? 'text-destructive' : 'text-foreground'}`}>
                 ₹{runningTotal.toFixed(2)}
               </div>
             </div>
             <div className="space-y-2">
               <label className="text-xs font-medium text-foreground">Bill Total</label>
               <input 
                 type="number" 
                 value={total}
                 onChange={(e) => setTotal(e.target.value)}
                 step="0.01"
                 className="w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
               />
             </div>
          </div>
          
          <button 
            type="button" 
            onClick={handleContinue}
            className="group flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Continue to split
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {isMismatch && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
             <AlertCircle className="size-5 shrink-0 mt-0.5" />
             <p>The running total of items (₹{runningTotal.toFixed(2)}) doesn't match the bill total (₹{parseFloat(total || 0).toFixed(2)}). You can continue, but make sure taxes or discounts are accounted for.</p>
          </div>
        )}
      </div>
    </div>
  );
}
