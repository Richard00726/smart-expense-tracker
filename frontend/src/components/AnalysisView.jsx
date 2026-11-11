import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getSummary, getCurrency } from '../services/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { PieChart as PieChartIcon, BarChart2, TrendingUp, Activity, ArrowDownLeft, ArrowUpRight, Wallet, Landmark } from 'lucide-react';
import DateHierarchyFilter from './DateHierarchyFilter';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

// 24 maximally separated, vibrant, distinct fin-tech colors (no duplicate or similar shades)
const DISTINCT_PALETTE = [
  '#2563eb', // 0: Electric Blue
  '#f59e0b', // 1: Amber Gold
  '#06b6d4', // 2: Vibrant Cyan
  '#8b5cf6', // 3: Royal Purple
  '#ea580c', // 4: Flame Orange
  '#db2777', // 5: Magenta Pink
  '#10b981', // 6: Emerald Green
  '#eab308', // 7: Bright Gold
  '#ef4444', // 8: Crimson Red
  '#6366f1', // 9: Indigo
  '#14b8a6', // 10: Teal Green
  '#d946ef', // 11: Fuchsia Pink
  '#0284c7', // 12: Sky Blue
  '#84cc16', // 13: Lime Green
  '#f43f5e', // 14: Rose Red
  '#f97316', // 15: Tangerine
  '#a855f7', // 16: Violet
  '#0d9488', // 17: Dark Teal
  '#ec4899', // 18: Hot Pink
  '#22c55e', // 19: Vivid Green
  '#e11d48', // 20: Ruby Red
  '#3b82f6', // 21: Royal Blue
  '#475569', // 22: Slate Navy
  '#78716c'  // 23: Warm Stone
];

const getCategoryColor = (name, index = 0) => {
  return DISTINCT_PALETTE[index % DISTINCT_PALETTE.length];
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

  const availableMonths = React.useMemo(() => {
    const monthsMap = new Map();

    // Ensure current calendar month is always present
    const [cy, cm] = currentMonthString.split('-');
    const curDate = new Date(parseInt(cy, 10), parseInt(cm, 10) - 1, 1);
    const curLabel = curDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    monthsMap.set(currentMonthString, { key: currentMonthString, label: curLabel });

    const addMonthKey = (mKey) => {
      if (mKey && !monthsMap.has(mKey)) {
        const [y, m] = mKey.split('-');
        const sDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const label = sDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        monthsMap.set(mKey, { key: mKey, label });
      }
    };

    const txList = Array.isArray(refreshTrigger) ? refreshTrigger : [];
    txList.forEach(t => {
      const d = t.date || t.txnDate;
      if (d) addMonthKey(new Date(d).toISOString().slice(0, 7));
    });

    try {
      const cached = localStorage.getItem('cached_transactions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed.forEach(t => {
            const d = t.date || t.txnDate;
            if (d) addMonthKey(new Date(d).toISOString().slice(0, 7));
          });
        }
      }
    } catch (e) {}

    try {
      const bankCache = localStorage.getItem('bank_overview_cache');
      if (bankCache) {
        const parsed = JSON.parse(bankCache);
        if (Array.isArray(parsed?.dailySummaries)) {
          parsed.dailySummaries.forEach(s => {
            const dateStr = s.statementDate || s.period || '';
            const parts = dateStr.split('-');
            if (parts.length >= 3) {
              addMonthKey(`${parts[2].slice(0, 4)}-${parts[1].padStart(2, '0')}`);
            }
          });
        }
      }
    } catch (e) {}

    return Array.from(monthsMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [refreshTrigger, currentMonthString]);

  // All transactions available for analysis & breakdowns
  const allTx = useMemo(() => {
    let list = Array.isArray(refreshTrigger) && refreshTrigger.length > 0 ? refreshTrigger : [];
    if (list.length === 0) {
      try {
        const cached = localStorage.getItem('cached_transactions');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) list = parsed;
        }
      } catch (e) {}
    }
    return list;
  }, [refreshTrigger]);

  // Find latest month with real transactions so analysis isn't blank on 1st of month
  const latestMonthWithData = React.useMemo(() => {
    if (allTx.length === 0) {
      try {
        const bankCache = localStorage.getItem('bank_overview_cache');
        if (bankCache) {
          const parsed = JSON.parse(bankCache);
          if (Array.isArray(parsed?.dailySummaries) && parsed.dailySummaries.length > 0) {
            for (const s of parsed.dailySummaries) {
              const dateStr = s.statementDate || s.period || '';
              const parts = dateStr.split('-');
              if (parts.length >= 3) {
                return `${parts[2].slice(0, 4)}-${parts[1].padStart(2, '0')}`;
              }
            }
          }
        }
      } catch (e) {}
      return currentMonthString;
    }

    const hasCurrent = allTx.some(t => {
      const d = t.date || t.txnDate;
      return d && new Date(d).toISOString().slice(0, 7) === currentMonthString;
    });
    if (hasCurrent) return currentMonthString;

    for (const m of availableMonths) {
      if (m.key === currentMonthString) continue;
      const hasTx = allTx.some(t => {
        const d = t.date || t.txnDate;
        return d && new Date(d).toISOString().slice(0, 7) === m.key;
      });
      if (hasTx) return m.key;
    }
    return availableMonths[0]?.key || currentMonthString;
  }, [availableMonths, currentMonthString, allTx]);

  const defaultMonth = latestMonthWithData || currentMonthString;
  const defaultKey = 'all_';
  const initialData = getInitialSummary(defaultKey);

  const [spendingSummary, setSpendingSummary] = useState(() => initialData);
  const [incomeSummary, setIncomeSummary] = useState(() => initialData);
  const [flowSummary, setFlowSummary] = useState(() => initialData);

  const [spendingLoading, setSpendingLoading] = useState(!initialData);
  const [incomeLoading, setIncomeLoading] = useState(!initialData);
  const [flowLoading, setFlowLoading] = useState(!initialData);

  const [spendingFilterType, setSpendingFilterType] = useState('all');
  const [spendingFilterValue, setSpendingFilterValue] = useState('');

  const [incomeFilterType, setIncomeFilterType] = useState('all');
  const [incomeFilterValue, setIncomeFilterValue] = useState('');

  const [flowFilterType, setFlowFilterType] = useState('all');
  const [flowFilterValue, setFlowFilterValue] = useState('');
  const [flowWalletFilter, setFlowWalletFilter] = useState('all'); // 'all' (Combined - Default), 'Cash', 'UPI'
  const [categoryWalletFilter, setCategoryWalletFilter] = useState('all'); // 'all' (Both), 'UPI', 'Cash'
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [incomeCategoryWalletFilter, setIncomeCategoryWalletFilter] = useState('all'); // 'all' (Both), 'UPI', 'Cash'
  const [hoveredIncomeCategory, setHoveredIncomeCategory] = useState(null);

  const [userChangedSpendingMonth, setUserChangedSpendingMonth] = useState(false);
  const [userChangedIncomeMonth, setUserChangedIncomeMonth] = useState(false);
  const [userChangedFlowMonth, setUserChangedFlowMonth] = useState(false);

  // Sync to latest month with data if user selects month
  useEffect(() => {
    if (latestMonthWithData && !userChangedSpendingMonth && spendingFilterType === 'month' && !spendingFilterValue) {
      setSpendingFilterValue(latestMonthWithData);
    }
  }, [latestMonthWithData, userChangedSpendingMonth, spendingFilterType, spendingFilterValue]);

  useEffect(() => {
    if (latestMonthWithData && !userChangedIncomeMonth && incomeFilterType === 'month' && !incomeFilterValue) {
      setIncomeFilterValue(latestMonthWithData);
    }
  }, [latestMonthWithData, userChangedIncomeMonth, incomeFilterType, incomeFilterValue]);

  useEffect(() => {
    if (latestMonthWithData && !userChangedFlowMonth && flowFilterType === 'month' && !flowFilterValue) {
      setFlowFilterValue(latestMonthWithData);
    }
  }, [latestMonthWithData, userChangedFlowMonth, flowFilterType, flowFilterValue]);

  const handleFilterTypeChange = (newType, setType, setValue) => {
    setType(newType);
    if (newType === 'all') setValue('');
    else if (newType === 'day') setValue(todayString);
    else if (newType === 'month') setValue(latestMonthWithData || currentMonthString);
    else if (newType === 'year') setValue(currentYearString);
  };

  const [activeAnalysisTab, setActiveAnalysisTab] = useState(() => {
    if (window.location.hash === '#cashflow') return 'cashflow';
    if (window.location.hash === '#income') return 'income';
    return 'spending';
  });

  const getFilterObj = (type, value) => {
    let filters = {};
    if (type === 'all') {
      return {};
    }
    if (type === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      filters = { startDate: start.toISOString(), endDate: end.toISOString() };
    } else if (type === 'custom' && value) {
      const [fromDate, toDate] = value.split(':');
      if (fromDate && toDate) {
        const start = new Date(fromDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filters = { startDate: start.toISOString(), endDate: end.toISOString() };
      }
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
      } else if (type === 'year' || type === 'period') {
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

  // Calculate Cash vs UPI breakdown for categories from transactions if not present in summary payload
  const categoryWalletBreakdownFromTx = useMemo(() => {
    if (!Array.isArray(allTx) || allTx.length === 0) return new Map();
    const filterObj = getFilterObj(spendingFilterType, spendingFilterValue);
    const start = filterObj.startDate ? new Date(filterObj.startDate).getTime() : null;
    const end = filterObj.endDate ? new Date(filterObj.endDate).getTime() : null;

    const map = new Map();
    allTx.forEach(t => {
      if (t.type !== 'debit') return;
      const d = t.date || t.txnDate;
      if (d) {
        const time = new Date(d).getTime();
        if (start && time < start) return;
        if (end && time > end) return;
      }
      const cat = t.category || 'Uncategorized';
      if (!map.has(cat)) {
        map.set(cat, { cash: 0, upi: 0 });
      }
      const entry = map.get(cat);
      const amt = Number(t.amount || 0);
      if (t.wallet === 'Cash') entry.cash += amt;
      else if (t.wallet === 'UPI') entry.upi += amt;
    });
    return map;
  }, [allTx, spendingFilterType, spendingFilterValue]);

  // Format data for Recharts filtered by selected wallet mode (Both / UPI / Cash)
  const categoryData = useMemo(() => {
    const rawCategories = spendingSummary?.categorySpending || [];
    const enriched = rawCategories.map(item => {
      const fromTx = categoryWalletBreakdownFromTx.get(item._id);
      const cash = item.cash !== undefined ? Number(item.cash) : (fromTx?.cash || 0);
      const upi = item.upi !== undefined ? Number(item.upi) : (fromTx?.upi || 0);
      const total = Number(item.total) || 0;
      return {
        name: item._id,
        total,
        cash,
        upi
      };
    });

    if (categoryWalletFilter === 'UPI') {
      return enriched
        .filter(c => c.upi > 0)
        .map(c => ({ name: c.name, value: c.upi }))
        .sort((a, b) => b.value - a.value);
    }
    if (categoryWalletFilter === 'Cash') {
      return enriched
        .filter(c => c.cash > 0)
        .map(c => ({ name: c.name, value: c.cash }))
        .sort((a, b) => b.value - a.value);
    }
    // 'all' -> Both (combined)
    return enriched
      .filter(c => c.total > 0)
      .map(c => ({ name: c.name, value: c.total }))
      .sort((a, b) => b.value - a.value);
  }, [spendingSummary?.categorySpending, categoryWalletFilter, categoryWalletBreakdownFromTx]);

  const rawWalletSpending = spendingSummary?.walletSpending || [];
  const rawCashSpend = rawWalletSpending.find(w => w._id === 'Cash')?.total || 0;
  const rawUpiSpend = rawWalletSpending.find(w => w._id === 'UPI')?.total || 0;
  const walletSpendingData = (rawCashSpend > 0 || rawUpiSpend > 0)
    ? [
        { name: 'Cash', value: rawCashSpend },
        { name: 'UPI', value: rawUpiSpend }
      ]
    : rawWalletSpending.map(item => ({ name: item._id, value: item.total }));

  const rawWalletIncome = incomeSummary?.walletIncome || [];
  const rawCashIncome = rawWalletIncome.find(w => w._id === 'Cash')?.total || 0;
  const rawUpiIncome = rawWalletIncome.find(w => w._id === 'UPI')?.total || 0;
  const walletIncomeData = (rawCashIncome > 0 || rawUpiIncome > 0)
    ? [
        { name: 'Cash', value: rawCashIncome },
        { name: 'UPI', value: rawUpiIncome }
      ]
    : rawWalletIncome.map(item => ({ name: item._id, value: item.total }));

  // Calculate Cash vs UPI breakdown for income categories from transactions if not present in summary payload
  const incomeCategoryWalletBreakdownFromTx = useMemo(() => {
    if (!Array.isArray(allTx) || allTx.length === 0) return new Map();
    const filterObj = getFilterObj(incomeFilterType, incomeFilterValue);
    const start = filterObj.startDate ? new Date(filterObj.startDate).getTime() : null;
    const end = filterObj.endDate ? new Date(filterObj.endDate).getTime() : null;

    const map = new Map();
    allTx.forEach(t => {
      if (t.type !== 'credit') return;
      const d = t.date || t.txnDate;
      if (d) {
        const time = new Date(d).getTime();
        if (start && time < start) return;
        if (end && time > end) return;
      }
      const cat = t.category || 'Income';
      if (!map.has(cat)) {
        map.set(cat, { cash: 0, upi: 0 });
      }
      const entry = map.get(cat);
      const amt = Number(t.amount || 0);
      if (t.wallet === 'Cash') entry.cash += amt;
      else if (t.wallet === 'UPI') entry.upi += amt;
    });
    return map;
  }, [allTx, incomeFilterType, incomeFilterValue]);

  // Format income category data for Recharts filtered by selected wallet mode (Both / UPI / Cash)
  const incomeCategoryData = useMemo(() => {
    const rawCategories = incomeSummary?.categoryIncome || [];
    let enriched = [];
    if (rawCategories.length > 0) {
      enriched = rawCategories.map(item => {
        const fromTx = incomeCategoryWalletBreakdownFromTx.get(item._id);
        const cash = item.cash !== undefined ? Number(item.cash) : (fromTx?.cash || 0);
        const upi = item.upi !== undefined ? Number(item.upi) : (fromTx?.upi || 0);
        const total = Number(item.total) || (cash + upi);
        return { name: item._id, total, cash, upi };
      });
    } else {
      incomeCategoryWalletBreakdownFromTx.forEach((val, catName) => {
        enriched.push({
          name: catName,
          total: val.cash + val.upi,
          cash: val.cash,
          upi: val.upi
        });
      });
    }

    if (incomeCategoryWalletFilter === 'UPI') {
      return enriched
        .filter(c => c.upi > 0)
        .map(c => ({ name: c.name, value: c.upi }))
        .sort((a, b) => b.value - a.value);
    }
    if (incomeCategoryWalletFilter === 'Cash') {
      return enriched
        .filter(c => c.cash > 0)
        .map(c => ({ name: c.name, value: c.cash }))
        .sort((a, b) => b.value - a.value);
    }
    // 'all' -> Both (combined)
    return enriched
      .filter(c => c.total > 0)
      .map(c => ({ name: c.name, value: c.total }))
      .sort((a, b) => b.value - a.value);
  }, [incomeSummary?.categoryIncome, incomeCategoryWalletFilter, incomeCategoryWalletBreakdownFromTx]);

  const filteredMonthlyFlow = (flowSummary?.monthlyFlow || []).filter(item => {
    if (flowFilterType === 'month' && flowFilterValue) {
      return item._id === flowFilterValue;
    }
    if ((flowFilterType === 'year' || flowFilterType === 'period') && flowFilterValue) {
      return item._id.startsWith(flowFilterValue);
    }
    if (flowFilterType === 'custom' && flowFilterValue) {
      const [fromStr, toStr] = flowFilterValue.split(':');
      const mFrom = (fromStr || '').slice(0, 7);
      const mTo = (toStr || '').slice(0, 7);
      return item._id >= mFrom && item._id <= mTo;
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

  const formatCompactAmt = (val) => {
    const num = Number(val ?? 0);
    if (isNaN(num) || num === 0) return '0.00';
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const totalIncomeCategory = incomeCategoryData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  const hasIncomeData = walletIncomeData.length > 0 || incomeCategoryData.length > 0;
  const hasFlowData = monthlyFlowData.length > 0;

  const cashSpend = walletSpendingData.find(item => item.name === 'Cash')?.value || 0;
  const upiSpend = walletSpendingData.find(item => item.name === 'UPI')?.value || 0;
  const totalSpend = cashSpend + upiSpend;
  const totalCategorySpend = categoryData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  const totalSpendNum = Number(totalSpend) || 0;
  const cashPct = totalSpendNum > 0 ? ((cashSpend / totalSpendNum) * 100).toFixed(1) : '0.0';
  const upiPct = totalSpendNum > 0 ? ((upiSpend / totalSpendNum) * 100).toFixed(1) : '0.0';

  const cashIncome = walletIncomeData.find(item => item.name === 'Cash')?.value || 0;
  const upiIncome = walletIncomeData.find(item => item.name === 'UPI')?.value || 0;
  const totalIncome = cashIncome + upiIncome;
  const totalIncomeNum = Number(totalIncome) || 0;
  const cashIncomePct = totalIncomeNum > 0 ? ((cashIncome / totalIncomeNum) * 100).toFixed(1) : '0.0';
  const upiIncomePct = totalIncomeNum > 0 ? ((upiIncome / totalIncomeNum) * 100).toFixed(1) : '0.0';

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
          <DateHierarchyFilter
            filterType={spendingFilterType}
            filterValue={spendingFilterValue}
            onFilterChange={(newType, newValue) => {
              setUserChangedSpendingMonth(true);
              setSpendingFilterType(newType);
              setSpendingFilterValue(newValue);
            }}
            transactions={refreshTrigger}
            defaultMonthWithData={latestMonthWithData}
          />
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
          <div style={{ padding: '24px' }}>
            <div
              className="charts-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '24px',
                alignItems: 'stretch',
                margin: 0
              }}
            >
              {/* 1. CASH VS UPI SPENDING - LEFT CARD (16px internal padding) */}
              <div
                className="chart-wrapper"
                style={{
                  width: '100%',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '290px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                    Cash vs UPI Spending
                  </h4>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'var(--empty-state-bg)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--text-muted)'
                  }}>
                    Wallets
                  </span>
                </div>

                {/* Bar chart area */}
                <div style={{ height: '175px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={walletSpendingData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        width={42}
                        tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                      />
                      <Tooltip 
                        cursor={{ fill: 'var(--hover-bg)' }}
                        contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                        formatter={(value) => [`${getCurrency()}${formatAmt(value)}`, 'Spent']}
                      />
                      <Bar dataKey="value" fill="var(--danger)" barSize={68} maxBarSize={75} radius={[6, 6, 0, 0]}>
                        {walletSpendingData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'Cash' ? '#f59e0b' : 'var(--danger)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Total | Cash | UPI pill */}
                <div style={{
                  marginTop: '0.85rem',
                  textAlign: 'center',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--card-bg)',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--card-border)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.45rem',
                  width: '100%'
                }}>
                  <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{formatAmt(totalSpend)}</strong></span>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span style={{ color: '#f59e0b', fontWeight: '600' }}>Cash: {getCurrency()}{formatAmt(cashSpend)} ({cashPct}%)</span>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span style={{ color: 'var(--danger)', fontWeight: '600' }}>UPI: {getCurrency()}{formatAmt(upiSpend)} ({upiPct}%)</span>
                </div>
              </div>

              {/* 2. SPEND BY CATEGORY - RIGHT CARD (16px internal padding) */}
              <div
                className="chart-wrapper"
                style={{
                  width: '100%',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '290px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                    Spend by Category
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    {/* Wallet Filter Toggle: Both | UPI | Cash (No emojis) */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '20px',
                      padding: '2px',
                      gap: '2px'
                    }}>
                      <button
                        type="button"
                        onClick={() => setCategoryWalletFilter('all')}
                        style={{
                          border: 'none',
                          outline: 'none',
                          cursor: 'pointer',
                          padding: '2px 8px',
                          borderRadius: '16px',
                          fontSize: '0.72rem',
                          fontWeight: categoryWalletFilter === 'all' ? 700 : 500,
                          background: categoryWalletFilter === 'all' ? 'var(--text-primary)' : 'transparent',
                          color: categoryWalletFilter === 'all' ? 'var(--bg-main, #fff)' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Both
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryWalletFilter('UPI')}
                        style={{
                          border: 'none',
                          outline: 'none',
                          cursor: 'pointer',
                          padding: '2px 8px',
                          borderRadius: '16px',
                          fontSize: '0.72rem',
                          fontWeight: categoryWalletFilter === 'UPI' ? 700 : 500,
                          background: categoryWalletFilter === 'UPI' ? 'var(--accent-primary, #3b82f6)' : 'transparent',
                          color: categoryWalletFilter === 'UPI' ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        UPI
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryWalletFilter('Cash')}
                        style={{
                          border: 'none',
                          outline: 'none',
                          cursor: 'pointer',
                          padding: '2px 8px',
                          borderRadius: '16px',
                          fontSize: '0.72rem',
                          fontWeight: categoryWalletFilter === 'Cash' ? 700 : 500,
                          background: categoryWalletFilter === 'Cash' ? '#f59e0b' : 'transparent',
                          color: categoryWalletFilter === 'Cash' ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Cash
                      </button>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'var(--empty-state-bg)',
                      border: '1px solid var(--card-border)',
                      color: 'var(--text-muted)'
                    }}>
                      {categoryData.length}
                    </span>
                  </div>
                </div>

                {/* Side-by-side Donut & Category List Container */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minHeight: '220px' }}>
                  {/* Donut Chart */}
                  <div style={{ position: 'relative', width: '135px', height: '135px', flexShrink: 0, margin: '0 auto' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart style={{ outline: 'none' }}>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={38}
                          outerRadius={56}
                          paddingAngle={3}
                          minAngle={4}
                          dataKey="value"
                          tabIndex={-1}
                          style={{ outline: 'none' }}
                          onMouseEnter={(_, index) => {
                            const cat = categoryData[index];
                            if (cat) {
                              setHoveredCategory(cat);
                              const el = document.getElementById(`cat-row-${index}`);
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                              }
                            }
                          }}
                          onMouseLeave={() => setHoveredCategory(null)}
                        >
                          {categoryData.map((entry, index) => {
                            const isHovered = hoveredCategory && hoveredCategory.name === entry.name;
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={getCategoryColor(entry.name, index)}
                                stroke="var(--card-bg)"
                                strokeWidth={isHovered ? 2.5 : 1.5}
                                tabIndex={-1}
                                style={{ cursor: 'pointer', transition: 'all 0.15s ease', outline: 'none' }}
                                onMouseEnter={() => {
                                  setHoveredCategory(entry);
                                  const el = document.getElementById(`cat-row-${index}`);
                                  if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                  }
                                }}
                                onMouseLeave={() => setHoveredCategory(null)}
                              />
                            );
                          })}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center Hub: Clean TOTAL SPENT */}
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
                        width: '70px'
                      }}
                    >
                      <span style={{ fontSize: '0.52rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {categoryWalletFilter === 'UPI' ? 'UPI' : categoryWalletFilter === 'Cash' ? 'CASH' : 'TOTAL'}
                      </span>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', margin: '1px 0', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                        {getCurrency()}{formatCompactAmt(totalCategorySpend)}
                      </span>
                    </div>
                  </div>

                  {/* Category Breakdown Ranking List */}
                  <div
                    className="custom-scrollbar"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '220px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      paddingRight: '4px'
                    }}
                  >
                    {categoryData.length === 0 ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                        textAlign: 'center',
                        padding: '1rem'
                      }}>
                        No {categoryWalletFilter === 'all' ? '' : `${categoryWalletFilter} `}expenses in this period
                      </div>
                    ) : (
                      categoryData.map((cat, idx) => {
                        const pct = totalCategorySpend > 0 ? ((cat.value / totalCategorySpend) * 100).toFixed(0) : '0';
                        const catColor = getCategoryColor(cat.name, idx);
                        const isHovered = hoveredCategory && hoveredCategory.name === cat.name;
                        return (
                          <div
                            id={`cat-row-${idx}`}
                            key={cat.name || idx}
                            onMouseEnter={() => setHoveredCategory(cat)}
                            onMouseLeave={() => setHoveredCategory(null)}
                            style={{
                              background: isHovered ? 'var(--hover-bg)' : 'var(--card-bg)',
                              border: isHovered ? `1.5px solid ${catColor}` : '1px solid var(--card-border)',
                              borderRadius: '8px',
                              padding: '0.4rem 0.65rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              transform: isHovered ? 'scale(1.01)' : 'scale(1)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                                <span
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: catColor,
                                    boxShadow: `0 0 0 1.5px var(--card-bg), 0 0 4px ${catColor}66`,
                                    flexShrink: 0
                                  }}
                                />
                                <span
                                  style={{
                                    fontWeight: isHovered ? 700 : 600,
                                    fontSize: '0.78rem',
                                    color: isHovered ? catColor : 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  {cat.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: 'var(--text-secondary)'
                                  }}
                                >
                                  {pct}%
                                </span>
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {getCurrency()}{formatAmt(cat.value)}
                                </span>
                              </div>
                            </div>
                            <div style={{ width: '100%', height: '3px', background: 'var(--card-border)', borderRadius: '9999px', overflow: 'hidden' }}>
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
                      })
                    )}
                  </div>
                </div>
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
          <DateHierarchyFilter
            filterType={incomeFilterType}
            filterValue={incomeFilterValue}
            onFilterChange={(newType, newValue) => {
              setUserChangedIncomeMonth(true);
              setIncomeFilterType(newType);
              setIncomeFilterValue(newValue);
            }}
            transactions={refreshTrigger}
            defaultMonthWithData={latestMonthWithData}
          />
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
            {/* 1. CASH VS UPI INCOME - LEFT CARD (16px internal padding) */}
            <div
              className="chart-wrapper"
              style={{
                width: '100%',
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--card-border)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '290px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px' }}>
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                  Cash vs UPI Income
                </h4>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'var(--empty-state-bg)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-muted)'
                }}>
                  Wallets
                </span>
              </div>

              {/* Bar chart area */}
              <div style={{ height: '175px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={walletIncomeData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
                    <YAxis 
                      stroke="var(--text-secondary)" 
                      tick={{ fontSize: 11 }}
                      width={42}
                      tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                    />
                    <Tooltip 
                      cursor={{ fill: 'var(--hover-bg)' }}
                      contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      formatter={(value) => [`${getCurrency()}${formatAmt(value)}`, 'Income']}
                    />
                    <Bar dataKey="value" fill="var(--success)" barSize={68} maxBarSize={75} radius={[6, 6, 0, 0]}>
                      {walletIncomeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Cash' ? '#10b981' : '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Total | Cash | UPI pill */}
              <div style={{
                marginTop: '0.85rem',
                textAlign: 'center',
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                background: 'var(--card-bg)',
                padding: '0.55rem 0.75rem',
                borderRadius: '10px',
                border: '1px solid var(--card-border)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.45rem',
                width: '100%'
              }}>
                <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{formatAmt(totalIncome)}</strong></span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span style={{ color: '#10b981', fontWeight: '600' }}>Cash: {getCurrency()}{formatAmt(cashIncome)} ({cashIncomePct}%)</span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span style={{ color: '#3b82f6', fontWeight: '600' }}>UPI: {getCurrency()}{formatAmt(upiIncome)} ({upiIncomePct}%)</span>
              </div>
            </div>

            {/* 2. INCOME BY CATEGORY - RIGHT CARD (16px internal padding) */}
            <div
              className="chart-wrapper"
              style={{
                width: '100%',
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--card-border)',
                borderRadius: '14px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '290px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                  Income by Category
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  {/* Wallet Filter Toggle: Both | UPI | Cash (No emojis) */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '20px',
                    padding: '2px',
                    gap: '2px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setIncomeCategoryWalletFilter('all')}
                      style={{
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                        padding: '2px 8px',
                        borderRadius: '16px',
                        fontSize: '0.72rem',
                        fontWeight: incomeCategoryWalletFilter === 'all' ? 700 : 500,
                        background: incomeCategoryWalletFilter === 'all' ? 'var(--text-primary)' : 'transparent',
                        color: incomeCategoryWalletFilter === 'all' ? 'var(--bg-main, #fff)' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Both
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncomeCategoryWalletFilter('UPI')}
                      style={{
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                        padding: '2px 8px',
                        borderRadius: '16px',
                        fontSize: '0.72rem',
                        fontWeight: incomeCategoryWalletFilter === 'UPI' ? 700 : 500,
                        background: incomeCategoryWalletFilter === 'UPI' ? 'var(--accent-primary, #3b82f6)' : 'transparent',
                        color: incomeCategoryWalletFilter === 'UPI' ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncomeCategoryWalletFilter('Cash')}
                      style={{
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                        padding: '2px 8px',
                        borderRadius: '16px',
                        fontSize: '0.72rem',
                        fontWeight: incomeCategoryWalletFilter === 'Cash' ? 700 : 500,
                        background: incomeCategoryWalletFilter === 'Cash' ? '#10b981' : 'transparent',
                        color: incomeCategoryWalletFilter === 'Cash' ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Cash
                    </button>
                  </div>

                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'var(--empty-state-bg)',
                    border: '1px solid var(--card-border)',
                    color: 'var(--text-muted)'
                  }}>
                    {incomeCategoryData.length}
                  </span>
                </div>
              </div>

              {/* Side-by-side Donut & Category List Container */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minHeight: '220px' }}>
                {/* Donut Chart */}
                <div style={{ position: 'relative', width: '135px', height: '135px', flexShrink: 0, margin: '0 auto' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart style={{ outline: 'none' }}>
                      <Pie
                        data={incomeCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={56}
                        paddingAngle={3}
                        minAngle={4}
                        dataKey="value"
                        tabIndex={-1}
                        style={{ outline: 'none' }}
                        onMouseEnter={(_, index) => {
                          const cat = incomeCategoryData[index];
                          if (cat) {
                            setHoveredIncomeCategory(cat);
                            const el = document.getElementById(`income-cat-row-${index}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            }
                          }
                        }}
                        onMouseLeave={() => setHoveredIncomeCategory(null)}
                      >
                        {incomeCategoryData.map((entry, index) => {
                          const isHovered = hoveredIncomeCategory && hoveredIncomeCategory.name === entry.name;
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={getCategoryColor(entry.name, index)}
                              stroke="var(--card-bg)"
                              strokeWidth={isHovered ? 2.5 : 1.5}
                              tabIndex={-1}
                              style={{ cursor: 'pointer', transition: 'all 0.15s ease', outline: 'none' }}
                              onMouseEnter={() => {
                                setHoveredIncomeCategory(entry);
                                const el = document.getElementById(`income-cat-row-${index}`);
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }
                              }}
                              onMouseLeave={() => setHoveredIncomeCategory(null)}
                            />
                          );
                        })}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Hub: Clean TOTAL INCOME */}
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
                      width: '70px'
                    }}
                  >
                    <span style={{ fontSize: '0.52rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {incomeCategoryWalletFilter === 'UPI' ? 'UPI' : incomeCategoryWalletFilter === 'Cash' ? 'CASH' : 'TOTAL'}
                    </span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)', margin: '1px 0', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                      {getCurrency()}{formatCompactAmt(totalIncomeCategory)}
                    </span>
                  </div>
                </div>

                {/* Category Breakdown Ranking List */}
                <div
                  className="custom-scrollbar"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '220px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    paddingRight: '4px'
                  }}
                >
                  {incomeCategoryData.length === 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                      textAlign: 'center',
                      padding: '1rem'
                    }}>
                      No {incomeCategoryWalletFilter === 'all' ? '' : `${incomeCategoryWalletFilter} `}income in this period
                    </div>
                  ) : (
                    incomeCategoryData.map((cat, idx) => {
                      const pct = totalIncomeCategory > 0 ? ((cat.value / totalIncomeCategory) * 100).toFixed(0) : '0';
                      const catColor = getCategoryColor(cat.name, idx);
                      const isHovered = hoveredIncomeCategory && hoveredIncomeCategory.name === cat.name;
                      return (
                        <div
                          id={`income-cat-row-${idx}`}
                          key={cat.name || idx}
                          onMouseEnter={() => setHoveredIncomeCategory(cat)}
                          onMouseLeave={() => setHoveredIncomeCategory(null)}
                          style={{
                            background: isHovered ? 'var(--hover-bg)' : 'var(--card-bg)',
                            border: isHovered ? `1.5px solid ${catColor}` : '1px solid var(--card-border)',
                            borderRadius: '8px',
                            padding: '0.4rem 0.65rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            transform: isHovered ? 'scale(1.01)' : 'scale(1)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  backgroundColor: catColor,
                                  boxShadow: `0 0 0 1.5px var(--card-bg), 0 0 4px ${catColor}66`,
                                  flexShrink: 0
                                }}
                              />
                              <span
                                style={{
                                  fontWeight: isHovered ? 700 : 600,
                                  fontSize: '0.78rem',
                                  color: isHovered ? catColor : 'var(--text-primary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {cat.name}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: 'var(--text-secondary)'
                                }}
                              >
                                {pct}%
                              </span>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {getCurrency()}{formatAmt(cat.value)}
                              </span>
                            </div>
                          </div>
                          <div style={{ width: '100%', height: '3px', background: 'var(--card-border)', borderRadius: '9999px', overflow: 'hidden' }}>
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
                    })
                  )}
                </div>
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

            <DateHierarchyFilter
              filterType={flowFilterType}
              filterValue={flowFilterValue}
              onFilterChange={(newType, newValue) => {
                setUserChangedFlowMonth(true);
                setFlowFilterType(newType);
                setFlowFilterValue(newValue);
              }}
              transactions={refreshTrigger}
              defaultMonthWithData={latestMonthWithData}
            />
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
