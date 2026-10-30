import React, { useState, useEffect, useRef } from 'react';
import { getSummary, getCurrency } from '../services/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { PieChart as PieChartIcon, BarChart2, TrendingUp, Activity, ArrowDownLeft, ArrowUpRight, Wallet, Landmark } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const CATEGORY_COLORS = {
  // Living & Essentials
  'Daily Expense': '#2563eb',          // Electric Blue (High Visibility)
  'ATM': '#f59e0b',                    // Amber Gold
  'Bills & Recharge': '#06b6d4',       // Vibrant Cyan
  'Bank Transfer': '#8b5cf6',          // Royal Purple
  'Food & Groceries': '#ea580c',       // Flame Orange
  'Shopping and orders': '#db2777',    // Rose Pink
  'Shopping & Orders': '#db2777',      // Alias
  'Credit Card Bill': '#0d9488',       // Teal
  'Rent & Housing': '#6366f1',         // Indigo
  'Fuel & Vehicle': '#3b82f6',         // Vivid Blue
  
  // Wealth & Subscriptions
  'Investments & SIP': '#10b981',      // Emerald Green
  'Subscriptions & OTT': '#a855f7',    // Violet
  'Education & Learning': '#0284c7',   // Sky Blue
  'Personal Care & Fitness': '#f97316',// Tangerine
  'Gifts & Donations': '#f43f5e',      // Rose Red
  
  // High-Value & Leisure
  'Jewellery': '#eab308',              // Gold
  'Travel': '#7c3aed',                 // Deep Purple
  'Healthcare': '#ef4444',             // Bright Crimson
  'Entertainment': '#d946ef',          // Fuchsia
  
  // Transfers & General
  'UPI Transfer': '#14b8a6',           // Bright Teal
  'Salary': '#22c55e',                 // Fresh Green
  'Reimbursement': '#0284c7',          // Ocean Blue
  'Self Transfer': '#64748b',          // Steel Gray
  'Other': '#78716c'                   // Warm Stone
};

const FALLBACK_PALETTE = [
  '#2563eb', '#f59e0b', '#06b6d4', '#8b5cf6', '#ea580c',
  '#db2777', '#0d9488', '#6366f1', '#10b981', '#a855f7',
  '#0284c7', '#f97316', '#f43f5e', '#eab308', '#7c3aed',
  '#ef4444', '#d946ef', '#14b8a6', '#22c55e', '#64748b'
];

const getCategoryColor = (name, index = 0) => {
  if (!name) return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
  if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
  
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (lower === key.toLowerCase() || lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return color;
    }
  }
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
};

// Module-level persistent cache across tab switches
const globalSummaryCache = new Map();

const getInitialSummary = (key) => {
  if (globalSummaryCache.has(key)) {
    const val = globalSummaryCache.get(key);
    if (val && typeof val.then !== 'function') return val;
  }
  try {
    const saved = sessionStorage.getItem(`summary_${key}`);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return null;
};

const AnalysisView = ({ refreshTrigger }) => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const currentMonthString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentYearString = today.getFullYear().toString();

  const defaultKey = `month_${currentMonthString}`;
  const initialData = getInitialSummary(defaultKey);

  const [spendingSummary, setSpendingSummary] = useState(() => initialData);
  const [incomeSummary, setIncomeSummary] = useState(() => initialData);
  const [flowSummary, setFlowSummary] = useState(() => initialData);

  const [spendingLoading, setSpendingLoading] = useState(!initialData);
  const [incomeLoading, setIncomeLoading] = useState(!initialData);
  const [flowLoading, setFlowLoading] = useState(!initialData);

  const [spendingFilterType, setSpendingFilterType] = useState('month');
  const [spendingFilterValue, setSpendingFilterValue] = useState(currentMonthString);

  const [incomeFilterType, setIncomeFilterType] = useState('month');
  const [incomeFilterValue, setIncomeFilterValue] = useState(currentMonthString);

  const [flowFilterType, setFlowFilterType] = useState('month');
  const [flowFilterValue, setFlowFilterValue] = useState(currentMonthString);
  const [flowWalletFilter, setFlowWalletFilter] = useState('all'); // 'all' (Combined - Default), 'Cash', 'UPI'

  const handleFilterTypeChange = (newType, setType, setValue) => {
    setType(newType);
    if (newType === 'day') setValue(todayString);
    else if (newType === 'month') setValue(currentMonthString);
    else if (newType === 'year') setValue(currentYearString);
  };

  const [activeAnalysisTab, setActiveAnalysisTab] = useState(() => {
    if (window.location.hash === '#cashflow') return 'cashflow';
    if (window.location.hash === '#income') return 'income';
    return 'spending';
  });

  const getFilterObj = (type, value) => {
    let filters = {};
    if (type === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      filters = { startDate: start.toISOString(), endDate: end.toISOString() };
    } else if (value) {
      if (type === 'day') {
        const start = new Date(value);
        start.setHours(0, 0, 0, 0);
        const end = new Date(value);
        end.setHours(23, 59, 59, 999);
        filters = { startDate: start.toISOString(), endDate: end.toISOString() };
      } else if (type === 'month') {
        const [year, month] = value.split('-');
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0, 23, 59, 59, 999);
        filters = { startDate: start.toISOString(), endDate: end.toISOString() };
      } else if (type === 'year') {
        const start = new Date(value, 0, 1);
        const end = new Date(value, 11, 31, 23, 59, 59, 999);
        filters = { startDate: start.toISOString(), endDate: end.toISOString() };
      }
    }
    return filters;
  };

  useEffect(() => {
    globalSummaryCache.clear();
  }, [refreshTrigger]);

  const fetchSummaryCached = (type, value, force = false) => {
    const key = `${type}_${value}`;
    if (!force && globalSummaryCache.has(key)) {
      const existing = globalSummaryCache.get(key);
      if (existing && typeof existing.then === 'function') {
        return existing; // Share in-flight network request
      }
      return Promise.resolve(existing);
    }

    const promise = getSummary(getFilterObj(type, value))
      .then(res => {
        globalSummaryCache.set(key, res.data);
        try {
          sessionStorage.setItem(`summary_${key}`, JSON.stringify(res.data));
        } catch (e) {}
        return res.data;
      })
      .catch(err => {
        globalSummaryCache.delete(key);
        throw err;
      });

    globalSummaryCache.set(key, promise);
    return promise;
  };

  const loadSpending = async () => {
    try {
      // Only show spinner if no data is currently cached/visible
      if (!spendingSummary) setSpendingLoading(true);
      const data = await fetchSummaryCached(spendingFilterType, spendingFilterValue);
      setSpendingSummary(data);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setSpendingLoading(false); 
    }
  };

  const loadIncome = async () => {
    try {
      if (!incomeSummary) setIncomeLoading(true);
      const data = await fetchSummaryCached(incomeFilterType, incomeFilterValue);
      setIncomeSummary(data);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIncomeLoading(false); 
    }
  };

  const loadFlow = async () => {
    try {
      if (!flowSummary) setFlowLoading(true);
      const data = await fetchSummaryCached(flowFilterType, flowFilterValue);
      setFlowSummary(data);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setFlowLoading(false); 
    }
  };

  useEffect(() => { loadSpending(); }, [spendingFilterType, spendingFilterValue, refreshTrigger]);
  useEffect(() => { loadIncome(); }, [incomeFilterType, incomeFilterValue, refreshTrigger]);
  useEffect(() => { loadFlow(); }, [flowFilterType, flowFilterValue, refreshTrigger]);

  // Format data for Recharts
  const categoryData = spendingSummary?.categorySpending ? spendingSummary.categorySpending.map(item => ({
    name: item._id,
    value: item.total
  })) : [];

  const walletSpendingData = spendingSummary?.walletSpending ? spendingSummary.walletSpending.map(item => ({
    name: item._id,
    value: item.total
  })) : [];

  const walletIncomeData = incomeSummary?.walletIncome ? incomeSummary.walletIncome.map(item => ({
    name: item._id,
    value: item.total
  })) : [];

  const filteredMonthlyFlow = (flowSummary?.monthlyFlow || []).filter(item => {
    if (flowFilterType === 'month' && flowFilterValue) {
      return item._id === flowFilterValue;
    }
    if (flowFilterType === 'year' && flowFilterValue) {
      return item._id.startsWith(flowFilterValue);
    }
    return true;
  });

  const monthlyFlowData = filteredMonthlyFlow.map(item => {
    const cashIn = item.cashIncome ?? 0;
    const cashOut = item.cashSpend ?? 0;
    const upiIn = item.upiIncome ?? 0;
    const upiOut = item.upiSpend ?? 0;

    let activeIncome = item.income ?? 0;
    let activeSpend = item.spend ?? 0;

    if (flowWalletFilter === 'Cash') {
      activeIncome = cashIn;
      activeSpend = cashOut;
    } else if (flowWalletFilter === 'UPI') {
      activeIncome = upiIn;
      activeSpend = upiOut;
    }

    return {
      name: item._id,
      income: activeIncome,
      spend: activeSpend,
      net: activeIncome - activeSpend,
      combinedIncome: item.income ?? 0,
      combinedSpend: item.spend ?? 0,
      cashIncome: cashIn,
      cashSpend: cashOut,
      upiIncome: upiIn,
      upiSpend: upiOut
    };
  });

  let inTotal = 0;
  let outTotal = 0;
  let cashInTotal = 0;
  let cashOutTotal = 0;
  let upiInTotal = 0;
  let upiOutTotal = 0;

  filteredMonthlyFlow.forEach(item => {
    inTotal += item.income || 0;
    outTotal += item.spend || 0;
    cashInTotal += item.cashIncome || 0;
    cashOutTotal += item.cashSpend || 0;
    upiInTotal += item.upiIncome || 0;
    upiOutTotal += item.upiSpend || 0;
  });

  let activeIn = inTotal;
  let activeOut = outTotal;
  if (flowWalletFilter === 'Cash') {
    activeIn = cashInTotal;
    activeOut = cashOutTotal;
  } else if (flowWalletFilter === 'UPI') {
    activeIn = upiInTotal;
    activeOut = upiOutTotal;
  }

  const flowTotals = {
    income: activeIn,
    spend: activeOut,
    net: activeIn - activeOut,
    totalIn: inTotal,
    totalOut: outTotal,
    cashIn: cashInTotal,
    cashOut: cashOutTotal,
    upiIn: upiInTotal,
    upiOut: upiOutTotal
  };

  const formatAmt = (val) => {
    const num = Number(val ?? 0);
    return isNaN(num) ? '0.00' : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fallbackLedger = {
    opening: 0,
    inflow: Number(activeIn || 0),
    outflow: Number(activeOut || 0),
    closing: Number((activeIn || 0) - (activeOut || 0))
  };

  let activeLedger = fallbackLedger;
  if (flowSummary?.flowLedger) {
    let target = flowSummary.flowLedger.combined;
    if (flowWalletFilter === 'Cash') target = flowSummary.flowLedger.cash;
    else if (flowWalletFilter === 'UPI') target = flowSummary.flowLedger.upi;

    if (target) {
      activeLedger = {
        opening: Number(target.opening ?? 0),
        inflow: Number(target.inflow ?? activeIn ?? 0),
        outflow: Number(target.outflow ?? activeOut ?? 0),
        closing: Number(target.closing ?? ((target.opening ?? 0) + (target.inflow ?? 0) - (target.outflow ?? 0)))
      };
    }
  }

  const hasSpendingData = categoryData.length > 0 || walletSpendingData.length > 0;
  const hasIncomeData = walletIncomeData.length > 0;
  const hasFlowData = monthlyFlowData.length > 0;

  const cashSpend = walletSpendingData.find(item => item.name === 'Cash')?.value || 0;
  const upiSpend = walletSpendingData.find(item => item.name === 'UPI')?.value || 0;
  const totalSpend = cashSpend + upiSpend;
  const totalCategorySpend = categoryData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  const cashIncome = walletIncomeData.find(item => item.name === 'Cash')?.value || 0;
  const upiIncome = walletIncomeData.find(item => item.name === 'UPI')?.value || 0;
  const totalIncome = cashIncome + upiIncome;

  // Global empty state check removed to ensure filter controls remain accessible

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Sub-Navigation Pills */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          className={`btn ${activeAnalysisTab === 'spending' ? 'btn-danger' : ''}`}
          style={{ 
            flex: 1, minWidth: '150px', 
            background: activeAnalysisTab === 'spending' ? 'var(--danger)' : 'var(--empty-state-bg)',
            color: activeAnalysisTab === 'spending' ? '#fff' : 'var(--text-primary)',
            border: activeAnalysisTab === 'spending' ? 'none' : '1px solid var(--card-border)'
          }}
          onClick={() => setActiveAnalysisTab('spending')}
        >
          <PieChartIcon size={18} /> Spending
        </button>
        <button
          className={`btn ${activeAnalysisTab === 'income' ? 'btn-success' : ''}`}
          style={{ 
            flex: 1, minWidth: '150px', 
            background: activeAnalysisTab === 'income' ? 'var(--success)' : 'var(--empty-state-bg)',
            color: activeAnalysisTab === 'income' ? '#fff' : 'var(--text-primary)',
            border: activeAnalysisTab === 'income' ? 'none' : '1px solid var(--card-border)'
          }}
          onClick={() => setActiveAnalysisTab('income')}
        >
          <TrendingUp size={18} /> Income
        </button>
        <button
          className={`btn ${activeAnalysisTab === 'cashflow' ? 'btn-primary' : ''}`}
          style={{ 
            flex: 1, minWidth: '150px', 
            background: activeAnalysisTab === 'cashflow' ? 'var(--accent-primary)' : 'var(--empty-state-bg)',
            color: activeAnalysisTab === 'cashflow' ? '#fff' : 'var(--text-primary)',
            border: activeAnalysisTab === 'cashflow' ? 'none' : '1px solid var(--card-border)'
          }}
          onClick={() => setActiveAnalysisTab('cashflow')}
        >
          <Activity size={18} /> Cash Flow
        </button>
      </div>

      {/* SPENDING ANALYSIS */}
      {activeAnalysisTab === 'spending' && (
      <div className="data-card glass animate-fade-in" style={{ position: 'relative' }}>
        <div className="data-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <PieChartIcon size={20} className="text-danger" />
            <span>Spending Analysis</span>
            {spendingLoading && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span className="spinner" style={{ width: '10px', height: '10px', border: '2px solid rgba(239, 68, 68, 0.3)', borderTopColor: 'var(--danger)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Loading...
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {spendingFilterType === 'day' && (
              <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={spendingFilterValue} onChange={e => setSpendingFilterValue(e.target.value)} />
            )}
            {spendingFilterType === 'month' && (
              <input type="month" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={spendingFilterValue} onChange={e => setSpendingFilterValue(e.target.value)} />
            )}
            {spendingFilterType === 'year' && (
              <input type="number" min="2000" max="2100" placeholder="YYYY" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={spendingFilterValue} onChange={e => setSpendingFilterValue(e.target.value)} />
            )}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
              value={spendingFilterType}
              onChange={(e) => handleFilterTypeChange(e.target.value, setSpendingFilterType, setSpendingFilterValue)}
            >
              <option value="today">Today</option>
              <option value="day">By Day</option>
              <option value="month">By Month</option>
              <option value="year">By Year</option>
            </select>
          </div>
        </div>


        {spendingLoading && !spendingSummary ? (
          <div className="empty-state" style={{ padding: '3.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--danger)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading spending analysis...</p>
          </div>
        ) : !hasSpendingData ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No spending recorded for this period.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* 1. SPEND BY CATEGORY - PROFESSIONAL FINTECH CARD */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  paddingBottom: '0.85rem',
                  borderBottom: '1px solid var(--card-border)',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <PieChartIcon size={20} className="text-danger" />
                  <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 700 }}>
                    Spend by Category
                  </h4>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: '100px',
                      background: 'var(--empty-state-bg)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {categoryData.length} {categoryData.length === 1 ? 'category' : 'categories'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '100px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--danger)',
                      border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    Total: {getCurrency()}{formatAmt(totalCategorySpend)}
                  </span>
                </div>
              </div>

              {/* Card Body: 2-Column Side-by-Side (Left Donut, Right Categories List) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '2rem',
                  alignItems: 'center'
                }}
              >
                {/* Left: Donut Chart with Center Metric Overlay */}
                <div style={{ position: 'relative', width: '100%', height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={72}
                        outerRadius={104}
                        paddingAngle={3}
                        minAngle={4}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getCategoryColor(entry.name, index)}
                            stroke="var(--card-bg)"
                            strokeWidth={2.5}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                        formatter={(value) => [`${getCurrency()}${formatAmt(value)}`, 'Spent']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '130px'
                    }}
                  >
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      TOTAL SPENT
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '3px 0', lineHeight: 1.2 }}>
                      {getCurrency()}{formatAmt(totalCategorySpend)}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                      100% of Spend
                    </span>
                  </div>
                </div>

                {/* Right: Category Breakdown Ranking List with Professional UPI-style Scroll */}
                <div
                  className="custom-scrollbar"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    maxHeight: '310px',
                    overflowY: 'auto',
                    paddingRight: '6px'
                  }}
                >
                  {categoryData.map((cat, idx) => {
                    const pct = totalCategorySpend > 0 ? ((cat.value / totalCategorySpend) * 100).toFixed(1) : '0.0';
                    const catColor = getCategoryColor(cat.name, idx);
                    return (
                      <div
                        key={cat.name || idx}
                        style={{
                          background: 'var(--empty-state-bg)',
                          border: '1px solid var(--card-border)',
                          borderRadius: '12px',
                          padding: '0.7rem 0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'transform 0.15s ease, border-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                            <span
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: catColor,
                                boxShadow: `0 0 0 2px var(--card-bg), 0 0 6px ${catColor}55`,
                                flexShrink: 0
                              }}
                            />
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: '0.88rem',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {cat.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: '6px',
                                background: 'var(--card-bg)',
                                border: '1px solid var(--card-border)',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              {pct}%
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {getCurrency()}{formatAmt(cat.value)}
                            </span>
                          </div>
                        </div>
                        {/* Micro Progress Bar with Min Width so Small Spends Stay Fully Visible */}
                        <div style={{ width: '100%', height: '4px', background: 'rgba(148, 163, 184, 0.18)', borderRadius: '9999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(3.5, Math.min(100, Number(pct)))}%`,
                              height: '100%',
                              backgroundColor: catColor,
                              borderRadius: '9999px'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. CASH VS UPI SPENDING - DEDICATED SEPARATE CARD */}
            <div
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  paddingBottom: '0.85rem',
                  borderBottom: '1px solid var(--card-border)',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <BarChart2 size={20} className="text-danger" />
                  <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 700 }}>
                    Cash vs UPI Spending
                  </h4>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: '#f59e0b',
                      fontWeight: 600,
                      background: 'rgba(245, 158, 11, 0.1)',
                      padding: '3px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.25)'
                    }}
                  >
                    Cash: {getCurrency()}{formatAmt(cashSpend)}
                  </span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--danger)',
                      fontWeight: 600,
                      background: 'rgba(239, 68, 68, 0.1)',
                      padding: '3px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.25)'
                    }}
                  >
                    UPI: {getCurrency()}{formatAmt(upiSpend)}
                  </span>
                </div>
              </div>

              <div style={{ height: '240px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={walletSpendingData} margin={{ top: 15, right: 25, left: 25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                    <YAxis stroke="var(--text-secondary)" tick={{ fill: 'var(--text-secondary)' }} />
                    <Tooltip
                      cursor={{ fill: 'var(--hover-bg)' }}
                      contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      formatter={(value) => [`${getCurrency()}${formatAmt(value)}`, 'Spent']}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {walletSpendingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Cash' ? '#f59e0b' : 'var(--danger)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div
                style={{
                  marginTop: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem',
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--empty-state-bg)',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--card-border)',
                  flexWrap: 'wrap'
                }}
              >
                <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{formatAmt(totalSpend)}</strong></span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Cash: {getCurrency()}{formatAmt(cashSpend)}</span>
                <span style={{ opacity: 0.4 }}>•</span>
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>UPI: {getCurrency()}{formatAmt(upiSpend)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* INCOME ANALYSIS */}
      {activeAnalysisTab === 'income' && (
      <div className="data-card glass animate-fade-in" style={{ position: 'relative' }}>
        <div className="data-header">
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <TrendingUp size={20} className="text-success" />
            <span>Income Analysis</span>
            {incomeLoading && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--success)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <span className="spinner" style={{ width: '10px', height: '10px', border: '2px solid rgba(16, 185, 129, 0.3)', borderTopColor: 'var(--success)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Loading...
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {incomeFilterType === 'day' && (
              <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={incomeFilterValue} onChange={e => setIncomeFilterValue(e.target.value)} />
            )}
            {incomeFilterType === 'month' && (
              <input type="month" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={incomeFilterValue} onChange={e => setIncomeFilterValue(e.target.value)} />
            )}
            {incomeFilterType === 'year' && (
              <input type="number" min="2000" max="2100" placeholder="YYYY" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={incomeFilterValue} onChange={e => setIncomeFilterValue(e.target.value)} />
            )}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
              value={incomeFilterType}
              onChange={(e) => handleFilterTypeChange(e.target.value, setIncomeFilterType, setIncomeFilterValue)}
            >
              <option value="today">Today</option>
              <option value="day">By Day</option>
              <option value="month">By Month</option>
              <option value="year">By Year</option>
            </select>
          </div>
        </div>


        {incomeLoading && !incomeSummary ? (
          <div className="empty-state" style={{ padding: '3.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--success)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading income analysis...</p>
          </div>
        ) : !hasIncomeData ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No income recorded for this period.</p>
          </div>
        ) : (
          <div className="charts-grid">
            <div className="chart-wrapper" style={{ gridColumn: '1 / -1', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
              <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Cash vs UPI Income
              </h4>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={walletIncomeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip 
                      cursor={{ fill: 'var(--hover-bg)' }}
                      contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      formatter={(value) => `${getCurrency()}${value}`}
                    />
                    <Bar dataKey="value" fill="var(--success)">
                      {walletIncomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Cash' ? '#10b981' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--empty-state-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <span style={{ marginRight: '0.5rem' }}>Total: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{totalIncome.toFixed(2)}</strong></span>
                <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>|</span>
                <span style={{ color: '#10b981', fontWeight: '500' }}>Cash: {getCurrency()}{cashIncome.toFixed(2)}</span>
                <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>|</span>
                <span style={{ color: '#3b82f6', fontWeight: '500' }}>UPI: {getCurrency()}{upiIncome.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* MONTHLY CASH FLOW */}
      {activeAnalysisTab === 'cashflow' && (
      <div className="data-card glass animate-fade-in" style={{ position: 'relative' }}>
        <div className="data-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Activity size={20} className="text-accent-primary" />
              <span>
                {flowWalletFilter === 'all' && 'Monthly Cash & UPI Flow'}
                {flowWalletFilter === 'Cash' && 'Monthly Cash Flow (Cash Only)'}
                {flowWalletFilter === 'UPI' && 'Monthly UPI Flow (Bank & UPI Only)'}
              </span>
              {flowLoading && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--accent-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span className="spinner" style={{ width: '10px', height: '10px', border: '2px solid rgba(59, 130, 246, 0.3)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Loading...
                </span>
              )}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {flowWalletFilter === 'all' && 'Aggregated income vs spending across all payment modes'}
              {flowWalletFilter === 'Cash' && 'Physical cash in-hand inflow vs outflow'}
              {flowWalletFilter === 'UPI' && 'Digital UPI & Bank account inflow vs outflow'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Wallet Flow Mode Filter Dropdown */}
            <select
              className="form-control"
              style={{
                width: 'auto',
                padding: '0.3rem 0.75rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                background: 'var(--empty-state-bg)',
                color: 'var(--text-primary)',
                borderColor: 'var(--accent-primary)',
                cursor: 'pointer'
              }}
              value={flowWalletFilter}
              onChange={(e) => setFlowWalletFilter(e.target.value)}
              title="Filter Cash Flow by Wallet Mode"
            >
              <option value="all">⚡ Combined Flow (Cash + UPI)</option>
              <option value="Cash">💵 Cash Flow (Cash Only)</option>
              <option value="UPI">💳 UPI Flow (UPI Only)</option>
            </select>

            {flowFilterType === 'day' && (
              <input type="date" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={flowFilterValue} onChange={e => setFlowFilterValue(e.target.value)} />
            )}
            {flowFilterType === 'month' && (
              <input type="month" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={flowFilterValue} onChange={e => setFlowFilterValue(e.target.value)} />
            )}
            {flowFilterType === 'year' && (
              <input type="number" min="2000" max="2100" placeholder="YYYY" className="form-control" style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} value={flowFilterValue} onChange={e => setFlowFilterValue(e.target.value)} />
            )}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
              value={flowFilterType}
              onChange={(e) => handleFilterTypeChange(e.target.value, setFlowFilterType, setFlowFilterValue)}
            >
              <option value="today">Today</option>
              <option value="day">By Day</option>
              <option value="month">By Month</option>
              <option value="year">By Year</option>
            </select>
          </div>
        </div>

        {flowLoading && !flowSummary ? (
          <div className="empty-state" style={{ padding: '3.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading cash flow analysis...</p>
          </div>
        ) : !hasFlowData || monthlyFlowData.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No cash flow data for this period.</p>
          </div>
        ) : (
          <div className="chart-wrapper" style={{ padding: '1rem' }}>
            <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              {flowWalletFilter === 'all' && 'Combined Income vs Spending Over Time'}
              {flowWalletFilter === 'Cash' && 'Cash Inflow vs Outflow Over Time'}
              {flowWalletFilter === 'UPI' && 'UPI & Bank Inflow vs Outflow Over Time'}
            </h4>
            <div className="chart-container" style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyFlowData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="name" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip 
                    cursor={{ fill: 'var(--hover-bg)' }}
                    contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    formatter={(value) => `${getCurrency()}${Number(value).toFixed(2)}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="income"
                    name={flowWalletFilter === 'Cash' ? 'Cash Inflow' : flowWalletFilter === 'UPI' ? 'UPI Inflow' : 'Income'}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="spend"
                    name={flowWalletFilter === 'Cash' ? 'Cash Outflow' : flowWalletFilter === 'UPI' ? 'UPI Outflow' : 'Spend'}
                    fill="#ef4444"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 4-Card Complete Ledger Flow */}
            <div style={{
              marginTop: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              {/* Card 1: Opening Balance */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem'
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Landmark size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                    {flowWalletFilter === 'all' && 'Opening Balance (Combined)'}
                    {flowWalletFilter === 'Cash' && 'Cash Opening Balance'}
                    {flowWalletFilter === 'UPI' && 'Bank Opening Balance'}
                  </span>
                  <strong style={{ fontSize: '1.2rem', color: '#6366f1' }}>
                    {getCurrency()}{formatAmt(activeLedger.opening)}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Start of selected period
                  </span>
                </div>
              </div>

              {/* Card 2: Total Inflow (+) */}
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem'
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ArrowDownLeft size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                    {flowWalletFilter === 'all' && 'Total Inflow (Combined)'}
                    {flowWalletFilter === 'Cash' && 'Cash Inflow'}
                    {flowWalletFilter === 'UPI' && 'UPI Inflow'}
                  </span>
                  <strong style={{ fontSize: '1.2rem', color: '#10b981', whiteSpace: 'nowrap' }}>
                    +{getCurrency()}{formatAmt(activeLedger.inflow)}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Deposits & incoming funds
                  </span>
                </div>
              </div>

              {/* Card 3: Total Outflow (-) */}
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem'
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                    {flowWalletFilter === 'all' && 'Total Outflow (Combined)'}
                    {flowWalletFilter === 'Cash' && 'Cash Outflow'}
                    {flowWalletFilter === 'UPI' && 'UPI Outflow'}
                  </span>
                  <strong style={{ fontSize: '1.2rem', color: '#ef4444', whiteSpace: 'nowrap' }}>
                    -{getCurrency()}{formatAmt(activeLedger.outflow)}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Payments & spent money
                  </span>
                </div>
              </div>

              {/* Card 4: Ending / Available Balance */}
              <div style={{
                background: activeLedger.closing >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${activeLedger.closing >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem'
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  background: activeLedger.closing >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: activeLedger.closing >= 0 ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Wallet size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                    {flowWalletFilter === 'all' && 'Current Available Balance'}
                    {flowWalletFilter === 'Cash' && 'Cash Available Balance'}
                    {flowWalletFilter === 'UPI' && 'Current Bank Balance'}
                  </span>
                  <strong style={{ fontSize: '1.25rem', color: activeLedger.closing >= 0 ? '#10b981' : '#ef4444' }}>
                    {getCurrency()}{formatAmt(activeLedger.closing)}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'block', marginTop: '2px', fontWeight: 600 }}>
                    Active & verified in account
                  </span>
                </div>
              </div>
            </div>

            {/* Complete Balance Reconciliation Equation */}
            <div style={{
              marginTop: '1rem',
              padding: '0.85rem 1.25rem',
              borderRadius: '12px',
              background: 'var(--empty-state-bg)',
              border: '1px solid var(--card-border)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              fontSize: '0.88rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Ledger Reconciliation:</span>
                <span style={{ fontWeight: 600, color: '#6366f1' }}>
                  {getCurrency()}{formatAmt(activeLedger.opening)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>+</span>
                <span style={{ fontWeight: 600, color: '#10b981' }}>
                  {getCurrency()}{formatAmt(activeLedger.inflow)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>-</span>
                <span style={{ fontWeight: 600, color: '#ef4444' }}>
                  {getCurrency()}{formatAmt(activeLedger.outflow)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>=</span>
                <span style={{
                  fontWeight: 700,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  {getCurrency()}{formatAmt(activeLedger.closing)}
                </span>
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Period Net Change: <strong style={{ color: (activeLedger.inflow - activeLedger.outflow) >= 0 ? '#10b981' : '#f97316', whiteSpace: 'nowrap' }}>
                  {(activeLedger.inflow - activeLedger.outflow) >= 0 ? '+' : '-'}{getCurrency()}{formatAmt(Math.abs(activeLedger.inflow - activeLedger.outflow))}
                </strong>
                <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                  {(activeLedger.inflow - activeLedger.outflow) >= 0 ? '(Saved)' : '(Drawn from balance)'}
                </span>
              </div>
            </div>

            {/* Wallet Sub-breakdown Banner when Combined Flow is active */}
            {flowWalletFilter === 'all' && (
              <div style={{
                marginTop: '1rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '10px',
                background: 'var(--empty-state-bg)',
                border: '1px solid var(--card-border)',
                fontSize: '0.85rem',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                color: 'var(--text-secondary)'
              }}>
                <div>
                  💵 <strong style={{ color: 'var(--text-primary)' }}>Cash Flow:</strong> In <span style={{ color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>+{getCurrency()}{flowTotals.cashIn.toFixed(2)}</span> | Out <span style={{ color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>-{getCurrency()}{flowTotals.cashOut.toFixed(2)}</span>
                </div>
                <div style={{ height: '16px', width: '1px', background: 'var(--card-border)' }} />
                <div>
                  💳 <strong style={{ color: 'var(--text-primary)' }}>UPI Flow:</strong> In <span style={{ color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>+{getCurrency()}{flowTotals.upiIn.toFixed(2)}</span> | Out <span style={{ color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>-{getCurrency()}{flowTotals.upiOut.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}
      
    </div>
  );
};

export default AnalysisView;
