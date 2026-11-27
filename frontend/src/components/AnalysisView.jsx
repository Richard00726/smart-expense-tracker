import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getSummary, getCurrency } from '../services/api';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area, LineChart, Line, ReferenceLine, ReferenceDot
} from 'recharts';
import { 
  PieChart as PieChartIcon, BarChart2, TrendingUp, Activity, 
  ArrowDownLeft, ArrowUpRight, Wallet, Landmark, Coins, CreditCard,
  Calendar, Clock, Zap, Target
} from 'lucide-react';
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

// Pure helpers for Advanced Analysis Charts
const parseTxDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const parts = val.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        if (!isNaN(d.getTime())) return d;
      }
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
};

const buildTimelineData = (txList, filterType, filterValue) => {
  if (!Array.isArray(txList) || txList.length === 0) return [];

  let year, month;
  if (filterType === 'month' && filterValue && filterValue.includes('-')) {
    const parts = filterValue.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (filterType === 'year' && filterValue) {
    const y = parseInt(filterValue, 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const buckets = months.map((m) => ({
      key: m,
      label: m,
      fullDate: `${m} ${y}`,
      amount: 0,
      cash: 0,
      upi: 0,
      count: 0
    }));
    txList.forEach(t => {
      const d = parseTxDate(t.date || t.txnDate);
      if (!d) return;
      const mIdx = d.getMonth();
      if (mIdx >= 0 && mIdx < 12) {
        const amt = Number(t.amount || 0);
        buckets[mIdx].amount += amt;
        buckets[mIdx].count += 1;
        if (t.wallet === 'Cash') buckets[mIdx].cash += amt;
        else buckets[mIdx].upi += amt;
      }
    });
    return buckets;
  } else {
    const dates = txList
      .map(t => parseTxDate(t.date || t.txnDate))
      .filter(d => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length > 0) {
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      const diffDays = Math.round((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 35) {
        const map = new Map();
        txList.forEach(t => {
          const d = parseTxDate(t.date || t.txnDate);
          if (!d) return;
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          if (!map.has(k)) {
            map.set(k, { key: k, label, fullDate: label, amount: 0, cash: 0, upi: 0, count: 0 });
          }
          const item = map.get(k);
          const amt = Number(t.amount || 0);
          item.amount += amt;
          item.count += 1;
          if (t.wallet === 'Cash') item.cash += amt;
          else item.upi += amt;
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);
      } else {
        year = minDate.getFullYear();
        month = minDate.getMonth() + 1;
      }
    } else {
      year = new Date().getFullYear();
      month = new Date().getMonth() + 1;
    }
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = String(d).padStart(2, '0');
    days.push({
      key: dStr,
      label: dStr,
      fullDate: `${d} ${monthName}`,
      amount: 0,
      cash: 0,
      upi: 0,
      count: 0
    });
  }

  txList.forEach(t => {
    const dObj = parseTxDate(t.date || t.txnDate);
    if (!dObj) return;
    if (dObj.getFullYear() !== year || (dObj.getMonth() + 1) !== month) return;
    const dayNum = dObj.getDate();
    if (dayNum >= 1 && dayNum <= daysInMonth) {
      const amt = Number(t.amount || 0);
      days[dayNum - 1].amount += amt;
      days[dayNum - 1].count += 1;
      if (t.wallet === 'Cash') days[dayNum - 1].cash += amt;
      else days[dayNum - 1].upi += amt;
    }
  });

  return days;
};

const buildWeekdayData = (txList) => {
  const days = [
    { day: 'Mon', fullName: 'Monday', amount: 0, cash: 0, upi: 0, count: 0, isWeekend: false },
    { day: 'Tue', fullName: 'Tuesday', amount: 0, cash: 0, upi: 0, count: 0, isWeekend: false },
    { day: 'Wed', fullName: 'Wednesday', amount: 0, cash: 0, upi: 0, count: 0, isWeekend: false },
    { day: 'Thu', fullName: 'Thursday', amount: 0, cash: 0, upi: 0, count: 0, isWeekend: false },
    { day: 'Fri', fullName: 'Friday', amount: 0, cash: 0, upi: 0, count: 0, isWeekend: false },
    { day: 'Sat', fullName: 'Saturday', amount: 0, cash: 0, upi: 0, count: 0, isWeekend: true },
    { day: 'Sun', fullName: 'Sunday', amount: 0, cash: 0, upi: 0, count: 0, isWeekend: true }
  ];
  const dayIndexMap = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

  if (Array.isArray(txList)) {
    txList.forEach(t => {
      const d = parseTxDate(t.date || t.txnDate);
      if (!d) return;
      const dayOfWeek = d.getDay();
      const idx = dayIndexMap[dayOfWeek];
      if (idx !== undefined) {
        const amt = Number(t.amount || 0);
        days[idx].amount += amt;
        days[idx].count += 1;
        if (t.wallet === 'Cash') days[idx].cash += amt;
        else days[idx].upi += amt;
      }
    });
  }

  const total = days.reduce((sum, d) => sum + d.amount, 0);
  const enriched = days.map(d => ({
    ...d,
    pct: total > 0 ? ((d.amount / total) * 100).toFixed(1) : '0.0'
  }));

  const weekdayTotal = enriched.filter(d => !d.isWeekend).reduce((sum, d) => sum + d.amount, 0);
  const weekendTotal = enriched.filter(d => d.isWeekend).reduce((sum, d) => sum + d.amount, 0);
  const weekdayCash = enriched.filter(d => !d.isWeekend).reduce((sum, d) => sum + d.cash, 0);
  const weekdayUpi = enriched.filter(d => !d.isWeekend).reduce((sum, d) => sum + d.upi, 0);
  const weekendCash = enriched.filter(d => d.isWeekend).reduce((sum, d) => sum + d.cash, 0);
  const weekendUpi = enriched.filter(d => d.isWeekend).reduce((sum, d) => sum + d.upi, 0);
  const weekendPct = total > 0 ? ((weekendTotal / total) * 100).toFixed(0) : '0';
  const weekdayPct = total > 0 ? ((weekdayTotal / total) * 100).toFixed(0) : '0';
  
  const peakDay = enriched.reduce((max, d) => d.amount > max.amount ? d : max, enriched[0]);

  return {
    data: enriched,
    total,
    weekdayTotal,
    weekendTotal,
    weekdayCash,
    weekdayUpi,
    weekendCash,
    weekendUpi,
    weekendPct,
    weekdayPct,
    peakDay
  };
};

const buildCumulativeData = (timelineData) => {
  if (!Array.isArray(timelineData) || timelineData.length === 0) return [];
  const total = timelineData.reduce((sum, d) => sum + d.amount, 0);
  const n = timelineData.length;
  const uniformDailyPace = n > 0 ? (total / n) : 0;

  let runningTotal = 0;
  let runningCash = 0;
  let runningUpi = 0;
  return timelineData.map((d, index) => {
    runningTotal += d.amount;
    runningCash += (d.cash || 0);
    runningUpi += (d.upi || 0);
    const paceTarget = Math.round(uniformDailyPace * (index + 1));
    return {
      label: d.label,
      fullDate: d.fullDate,
      actual: runningTotal,
      actualCash: runningCash,
      actualUpi: runningUpi,
      dayAmount: d.amount,
      dayCash: d.cash || 0,
      dayUpi: d.upi || 0,
      pace: paceTarget,
      diff: runningTotal - paceTarget
    };
  });
};

const AnalysisView = ({ refreshTrigger, balances }) => {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const currentMonthString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentYearString = today.getFullYear().toString();

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Derive live verified balance matching Home dashboard
  const liveBalances = useMemo(() => {
    if (balances && (balances.total !== undefined || balances.upi !== undefined)) {
      return {
        cash: Number(balances.cash || 0),
        upi: Number(balances.upi || 0),
        total: Number(balances.total || (Number(balances.cash || 0) + Number(balances.upi || 0)))
      };
    }
    // Fallback: search refreshTrigger transactions for latest verified bank balance
    let upi = 0;
    if (Array.isArray(refreshTrigger) && refreshTrigger.length > 0) {
      const latestBankTx = refreshTrigger.find(t => t.wallet === 'UPI' && t.balance !== null && t.balance !== undefined && !isNaN(t.balance));
      if (latestBankTx) {
        upi = Number(latestBankTx.balance);
      }
    }
    let cash = 0;
    try {
      const cached = JSON.parse(localStorage.getItem('cached_balances') || '{}');
      cash = Number(cached.cash || 0);
      if (!upi && cached.upi !== undefined) upi = Number(cached.upi);
    } catch {}

    return {
      cash,
      upi,
      total: cash + upi
    };
  }, [balances, refreshTrigger]);

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

  const [spendingFilterType, setSpendingFilterType] = useState(() => {
    try {
      return sessionStorage.getItem('analysis_spending_filter_type') || 'all';
    } catch {
      return 'all';
    }
  });
  const [spendingFilterValue, setSpendingFilterValue] = useState(() => {
    try {
      return sessionStorage.getItem('analysis_spending_filter_value') || '';
    } catch {
      return '';
    }
  });

  const [incomeFilterType, setIncomeFilterType] = useState(() => {
    try {
      return sessionStorage.getItem('analysis_income_filter_type') || 'all';
    } catch {
      return 'all';
    }
  });
  const [incomeFilterValue, setIncomeFilterValue] = useState(() => {
    try {
      return sessionStorage.getItem('analysis_income_filter_value') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('analysis_spending_filter_type', spendingFilterType);
      sessionStorage.setItem('analysis_spending_filter_value', spendingFilterValue);
    } catch (e) {}
  }, [spendingFilterType, spendingFilterValue]);

  useEffect(() => {
    try {
      sessionStorage.setItem('analysis_income_filter_type', incomeFilterType);
      sessionStorage.setItem('analysis_income_filter_value', incomeFilterValue);
    } catch (e) {}
  }, [incomeFilterType, incomeFilterValue]);

  const [flowFilterType, setFlowFilterType] = useState('all');
  const [flowFilterValue, setFlowFilterValue] = useState('');
  const [flowWalletFilter, setFlowWalletFilter] = useState('all'); // 'all' (Combined - Default), 'Cash', 'UPI'
  const [categoryWalletFilter, setCategoryWalletFilter] = useState('all'); // 'all' (Both), 'UPI', 'Cash'
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [incomeCategoryWalletFilter, setIncomeCategoryWalletFilter] = useState('all'); // 'all' (Both), 'UPI', 'Cash'
  const [hoveredIncomeCategory, setHoveredIncomeCategory] = useState(null);
  const [spendingTimelineHover, setSpendingTimelineHover] = useState(null);
  const [incomeTimelineHover, setIncomeTimelineHover] = useState(null);

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

  const loadSpending = async (force = false) => {
    try {
      // Only show spinner if no data is currently cached/visible
      if (!spendingSummary) setSpendingLoading(true);
      const data = await fetchSummaryCached(spendingFilterType, spendingFilterValue, force);
      setSpendingSummary(data);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setSpendingLoading(false); 
    }
  };

  const loadIncome = async (force = false) => {
    try {
      if (!incomeSummary) setIncomeLoading(true);
      const data = await fetchSummaryCached(incomeFilterType, incomeFilterValue, force);
      setIncomeSummary(data);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIncomeLoading(false); 
    }
  };

  const loadFlow = async (force = false) => {
    try {
      if (!flowSummary) setFlowLoading(true);
      const data = await fetchSummaryCached(flowFilterType, flowFilterValue, force);
      setFlowSummary(data);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setFlowLoading(false); 
    }
  };

  useEffect(() => { 
    globalSummaryCache.clear();
    loadSpending(true); 
  }, [spendingFilterType, spendingFilterValue, refreshTrigger]);

  useEffect(() => { 
    globalSummaryCache.clear();
    loadIncome(true); 
  }, [incomeFilterType, incomeFilterValue, refreshTrigger]);

  useEffect(() => { 
    globalSummaryCache.clear();
    loadFlow(true); 
  }, [flowFilterType, flowFilterValue, refreshTrigger]);

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
      let cat = t.category || 'Uncategorized';
      if (cat === 'Credit Card Bill') cat = 'Credit Card Bill Amount';
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
    const rawCategories = (spendingSummary?.categorySpending || []).map(item => ({
      ...item,
      _id: item._id === 'Credit Card Bill' ? 'Credit Card Bill Amount' : item._id
    }));
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

  // Live wallet totals directly from transactions array for instant zero-latency updates
  const spendingWalletTotalsFromTx = useMemo(() => {
    if (!Array.isArray(allTx) || allTx.length === 0) return { cash: 0, upi: 0 };
    const filterObj = getFilterObj(spendingFilterType, spendingFilterValue);
    const start = filterObj.startDate ? new Date(filterObj.startDate).getTime() : null;
    const end = filterObj.endDate ? new Date(filterObj.endDate).getTime() : null;

    let cash = 0, upi = 0;
    allTx.forEach(t => {
      const isDebit = t.type === 'debit' || t.type === 'expense';
      if (!isDebit) return;
      const d = parseTxDate(t.date || t.txnDate);
      if (d && (start || end)) {
        const time = d.getTime();
        if (start && time < start) return;
        if (end && time > end) return;
      }
      const amt = Number(t.amount || 0);
      if (t.wallet === 'Cash') cash += amt;
      else if (t.wallet === 'UPI') upi += amt;
    });
    return { cash, upi };
  }, [allTx, spendingFilterType, spendingFilterValue]);

  const incomeWalletTotalsFromTx = useMemo(() => {
    if (!Array.isArray(allTx) || allTx.length === 0) return { cash: 0, upi: 0 };
    const filterObj = getFilterObj(incomeFilterType, incomeFilterValue);
    const start = filterObj.startDate ? new Date(filterObj.startDate).getTime() : null;
    const end = filterObj.endDate ? new Date(filterObj.endDate).getTime() : null;

    let cash = 0, upi = 0;
    allTx.forEach(t => {
      const isCredit = t.type === 'credit' || t.type === 'income';
      if (!isCredit) return;
      const d = parseTxDate(t.date || t.txnDate);
      if (d && (start || end)) {
        const time = d.getTime();
        if (start && time < start) return;
        if (end && time > end) return;
      }
      const amt = Number(t.amount || 0);
      if (t.wallet === 'Cash') cash += amt;
      else if (t.wallet === 'UPI') upi += amt;
    });
    return { cash, upi };
  }, [allTx, incomeFilterType, incomeFilterValue]);

  const rawWalletSpending = spendingSummary?.walletSpending || [];
  const rawCashSpend = spendingWalletTotalsFromTx.cash > 0 
    ? spendingWalletTotalsFromTx.cash 
    : (rawWalletSpending.find(w => w._id === 'Cash')?.total || 0);
  const rawUpiSpend = spendingWalletTotalsFromTx.upi > 0 
    ? spendingWalletTotalsFromTx.upi 
    : (rawWalletSpending.find(w => w._id === 'UPI')?.total || 0);
  const walletSpendingData = [
    { name: 'Cash', value: rawCashSpend },
    { name: 'UPI', value: rawUpiSpend }
  ];

  const rawWalletIncome = incomeSummary?.walletIncome || [];
  const rawCashIncome = incomeWalletTotalsFromTx.cash > 0 
    ? incomeWalletTotalsFromTx.cash 
    : (rawWalletIncome.find(w => w._id === 'Cash')?.total || 0);
  const rawUpiIncome = incomeWalletTotalsFromTx.upi > 0 
    ? incomeWalletTotalsFromTx.upi 
    : (rawWalletIncome.find(w => w._id === 'UPI')?.total || 0);
  const walletIncomeData = [
    { name: 'Cash', value: rawCashIncome },
    { name: 'UPI', value: rawUpiIncome }
  ];

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
      let cat = t.category || 'Income';
      if (cat === 'Daily Expense' || cat === 'UPI Transfer') cat = 'UPI Received';
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

  const CustomFlowTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const incomeItem = payload.find(p => p.dataKey === 'income');
      const spendItem = payload.find(p => p.dataKey === 'spend');
      const income = Number(incomeItem?.value || 0);
      const spend = Number(spendItem?.value || 0);
      const diff = income - spend;
      return (
        <div style={{
          backgroundColor: 'var(--card-bg, #fff)',
          border: '1px solid var(--card-border, #e2e8f0)',
          borderRadius: '10px',
          padding: '0.65rem 0.85rem',
          boxShadow: 'var(--card-shadow, 0 4px 12px rgba(0,0,0,0.1))',
          fontSize: '0.85rem'
        }}>
          <p style={{ margin: '0 0 0.4rem 0', fontWeight: 700, color: 'var(--text-primary)' }}>{label}</p>
          <p style={{ margin: '0 0 0.25rem 0', color: '#10b981', display: 'flex', justifyContent: 'space-between', gap: '1.25rem' }}>
            <span>Income :</span>
            <span style={{ fontWeight: 600 }}>{getCurrency()}{formatAmt(income)}</span>
          </p>
          <p style={{ margin: '0 0 0.4rem 0', color: '#ef4444', display: 'flex', justifyContent: 'space-between', gap: '1.25rem' }}>
            <span>Spend :</span>
            <span style={{ fontWeight: 600 }}>{getCurrency()}{formatAmt(spend)}</span>
          </p>
          <div style={{
            borderTop: '1px solid var(--card-border, #e2e8f0)',
            paddingTop: '0.35rem',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1.25rem',
            fontWeight: 700,
            color: diff >= 0 ? '#10b981' : '#ef4444'
          }}>
            <span>{diff >= 0 ? 'Net Saved :' : 'Net Spend :'}</span>
            <span>{diff >= 0 ? '+' : '-'}{getCurrency()}{formatAmt(Math.abs(diff))}</span>
          </div>
        </div>
      );
    }
    return null;
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

  const liveAvailableBalance = useMemo(() => {
    if (flowWalletFilter === 'Cash') return liveBalances.cash;
    if (flowWalletFilter === 'UPI') return liveBalances.upi;
    return liveBalances.total;
  }, [flowWalletFilter, liveBalances]);

  const displayClosingBalance = useMemo(() => {
    // When viewing "All Time", ALWAYS synchronize with Home dashboard's live verified balance!
    if (flowFilterType === 'all') {
      return liveAvailableBalance;
    }
    return Number(activeLedger.closing ?? liveAvailableBalance);
  }, [flowFilterType, liveAvailableBalance, activeLedger.closing]);

  const displayOpeningBalance = useMemo(() => {
    // When viewing "All Time" or the initial statement month (July 2026),
    // use the official verified statement opening balance of ₹208.47
    if (flowFilterType === 'all') {
      return 208.47;
    }
    if (flowFilterType === 'month' && flowFilterValue === '2026-07') {
      return 208.47;
    }
    return Number(activeLedger.opening ?? 208.47);
  }, [flowFilterType, flowFilterValue, activeLedger.opening]);

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

  // Filter transactions for spending analysis
  const filteredSpendingTx = useMemo(() => {
    if (!Array.isArray(allTx) || allTx.length === 0) return [];
    const filterObj = getFilterObj(spendingFilterType, spendingFilterValue);
    const start = filterObj.startDate ? new Date(filterObj.startDate).getTime() : null;
    const end = filterObj.endDate ? new Date(filterObj.endDate).getTime() : null;

    return allTx.filter(t => {
      const isDebit = t.type === 'debit' || t.type === 'expense';
      if (!isDebit) return false;
      const d = parseTxDate(t.date || t.txnDate);
      if (d && (start || end)) {
        const time = d.getTime();
        if (start && time < start) return false;
        if (end && time > end) return false;
      }
      return true;
    });
  }, [allTx, spendingFilterType, spendingFilterValue]);

  // Filter transactions for income analysis
  const filteredIncomeTx = useMemo(() => {
    if (!Array.isArray(allTx) || allTx.length === 0) return [];
    const filterObj = getFilterObj(incomeFilterType, incomeFilterValue);
    const start = filterObj.startDate ? new Date(filterObj.startDate).getTime() : null;
    const end = filterObj.endDate ? new Date(filterObj.endDate).getTime() : null;

    return allTx.filter(t => {
      const isCredit = t.type === 'credit' || t.type === 'income';
      if (!isCredit) return false;
      const d = parseTxDate(t.date || t.txnDate);
      if (d && (start || end)) {
        const time = d.getTime();
        if (start && time < start) return false;
        if (end && time > end) return false;
      }
      return true;
    });
  }, [allTx, incomeFilterType, incomeFilterValue]);

  // Spending 3 Trend Data Sets
  const spendingTimelineData = useMemo(() => {
    return buildTimelineData(filteredSpendingTx, spendingFilterType, spendingFilterValue);
  }, [filteredSpendingTx, spendingFilterType, spendingFilterValue]);

  const spendingTimelineStats = useMemo(() => {
    const total = spendingTimelineData.reduce((sum, d) => sum + d.amount, 0);
    const totalCash = spendingTimelineData.reduce((sum, d) => sum + (d.cash || 0), 0);
    const totalUpi = spendingTimelineData.reduce((sum, d) => sum + (d.upi || 0), 0);
    const count = spendingTimelineData.length;
    const avg = count > 0 ? (total / count) : 0;
    const peak = spendingTimelineData.reduce((max, d) => d.amount > max.amount ? d : max, { amount: 0, label: '-' });
    const activeDays = spendingTimelineData.filter(d => d.amount > 0).length;
    return { total, totalCash, totalUpi, avg, peak, activeDays };
  }, [spendingTimelineData]);

  const spendingWeekdayData = useMemo(() => {
    return buildWeekdayData(filteredSpendingTx);
  }, [filteredSpendingTx]);

  const spendingCumulativeData = useMemo(() => {
    return buildCumulativeData(spendingTimelineData);
  }, [spendingTimelineData]);

  // Income 3 Trend Data Sets
  const incomeTimelineData = useMemo(() => {
    return buildTimelineData(filteredIncomeTx, incomeFilterType, incomeFilterValue);
  }, [filteredIncomeTx, incomeFilterType, incomeFilterValue]);

  const incomeTimelineStats = useMemo(() => {
    const total = incomeTimelineData.reduce((sum, d) => sum + d.amount, 0);
    const totalCash = incomeTimelineData.reduce((sum, d) => sum + (d.cash || 0), 0);
    const totalUpi = incomeTimelineData.reduce((sum, d) => sum + (d.upi || 0), 0);
    const count = incomeTimelineData.length;
    const avg = count > 0 ? (total / count) : 0;
    const peak = incomeTimelineData.reduce((max, d) => d.amount > max.amount ? d : max, { amount: 0, label: '-' });
    const activeDays = incomeTimelineData.filter(d => d.amount > 0).length;
    return { total, totalCash, totalUpi, avg, peak, activeDays };
  }, [incomeTimelineData]);

  const incomeWeekdayData = useMemo(() => {
    return buildWeekdayData(filteredIncomeTx);
  }, [filteredIncomeTx]);

  const incomeCumulativeData = useMemo(() => {
    return buildCumulativeData(incomeTimelineData);
  }, [incomeTimelineData]);

  // Live Animated Peak Dot Marker with subtle live pulse (Strictly zero emojis)
  const PeakDotMarker = (props) => {
    const { cx, cy, amount, label, isSpend } = props;
    if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
    const color = isSpend ? '#ef4444' : '#10b981';
    const labelY = cy < 30 ? cy + 18 : cy - 14;
    const text = `Peak ${getCurrency()}${formatCompactAmt(amount)} (${label})`;

    return (
      <g className="peak-live-marker" style={{ pointerEvents: 'none' }}>
        {/* Subtle, small delicate live ping ripple - non-intrusive */}
        <circle cx={cx} cy={cy} r="3.5" fill="none" stroke={color} strokeWidth="1">
          <animate attributeName="r" from="3.5" to="9" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.75" to="0" dur="1.8s" repeatCount="indefinite" />
        </circle>

        {/* Small Solid Core Dot */}
        <circle cx={cx} cy={cy} r="3.5" fill={color} stroke="#ffffff" strokeWidth="1.5" />

        {/* Peak Text Label sitting clearly above curve point with no overlap */}
        <text
          x={cx}
          y={labelY}
          textAnchor="middle"
          fill={color}
          fontSize="10.5"
          fontWeight="700"
          style={{
            letterSpacing: '-0.2px',
            textShadow: '0 1px 2px rgba(0,0,0,0.35)'
          }}
        >
          {text}
        </text>
      </g>
    );
  };

  // Custom Chart Tooltips (Strictly zero emojis)
  const CustomTimelineTooltip = ({ active, payload, isSpend, avg }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalAmount = Number(data.amount || 0);
      const cashAmount = Number(data.cash || 0);
      const upiAmount = Number(data.upi || 0);
      const diff = avg > 0 ? (totalAmount - avg) : 0;
      const isAbove = diff > 0;
      const cashPct = totalAmount > 0 ? Math.round((cashAmount / totalAmount) * 100) : 0;
      const upiPct = totalAmount > 0 ? Math.round((upiAmount / totalAmount) * 100) : 0;

      return (
        <div style={{
          backgroundColor: 'var(--card-bg, #fff)',
          border: '1px solid var(--card-border, #e2e8f0)',
          borderRadius: '12px',
          padding: '0.75rem 0.95rem',
          boxShadow: 'var(--card-shadow, 0 8px 24px rgba(0,0,0,0.12))',
          fontSize: '0.82rem',
          minWidth: '200px',
          animation: 'tooltipPop 0.15s ease-out'
        }}>
          {/* Header: Date + Txn count */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.45rem',
            paddingBottom: '0.35rem',
            borderBottom: '1px solid var(--card-border)'
          }}>
            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
              {data.fullDate || data.label}
            </span>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '10px',
              background: 'var(--empty-state-bg)',
              color: 'var(--text-muted)'
            }}>
              {data.count || 0} {data.count === 1 ? 'txn' : 'txns'}
            </span>
          </div>

          {/* 1. TOTAL SPEND / RECEIVED */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.45rem',
            padding: '0.3rem 0.5rem',
            borderRadius: '6px',
            background: isSpend ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'
          }}>
            <span style={{ fontWeight: 700, color: isSpend ? 'var(--danger)' : 'var(--success)' }}>
              {isSpend ? 'Total Spend :' : 'Total Income :'}
            </span>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isSpend ? 'var(--danger)' : 'var(--success)' }}>
              {getCurrency()}{formatAmt(totalAmount)}
            </span>
          </div>

          {/* 2. CASH SPEND / RECEIVED */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.25rem',
            padding: '0.15rem 0.4rem',
            fontSize: '0.78rem'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
              Cash {isSpend ? 'Spend :' : 'Income :'}
            </span>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>
              {getCurrency()}{formatAmt(cashAmount)}
              {totalAmount > 0 && <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: '4px' }}>({cashPct}%)</span>}
            </span>
          </div>

          {/* 3. UPI SPEND / RECEIVED */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.35rem',
            padding: '0.15rem 0.4rem',
            fontSize: '0.78rem'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSpend ? 'var(--danger)' : '#3b82f6', display: 'inline-block' }} />
              UPI {isSpend ? 'Spend :' : 'Income :'}
            </span>
            <span style={{ fontWeight: 700, color: isSpend ? 'var(--danger)' : '#3b82f6' }}>
              {getCurrency()}{formatAmt(upiAmount)}
              {totalAmount > 0 && <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: '4px' }}>({upiPct}%)</span>}
            </span>
          </div>

          {/* 4. vs Daily Avg */}
          {avg > 0 && totalAmount > 0 && (
            <div style={{
              borderTop: '1px solid var(--card-border, #e2e8f0)',
              paddingTop: '0.35rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.74rem',
              color: isAbove ? (isSpend ? 'var(--danger)' : 'var(--success)') : 'var(--text-muted)'
            }}>
              <span>vs Daily Avg :</span>
              <span style={{ fontWeight: 700 }}>
                {isAbove ? '+' : '-'}{getCurrency()}{formatAmt(Math.abs(diff))}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomWeekdayTooltip = ({ active, payload, isSpend }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalAmt = Number(data.amount || 0);
      const cashAmt = Number(data.cash || 0);
      const upiAmt = Number(data.upi || 0);
      return (
        <div style={{
          backgroundColor: 'var(--card-bg, #fff)',
          border: '1px solid var(--card-border, #e2e8f0)',
          borderRadius: '12px',
          padding: '0.75rem 0.95rem',
          boxShadow: 'var(--card-shadow, 0 8px 24px rgba(0,0,0,0.12))',
          fontSize: '0.82rem',
          minWidth: '190px',
          animation: 'tooltipPop 0.15s ease-out'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.45rem',
            paddingBottom: '0.35rem',
            borderBottom: '1px solid var(--card-border)'
          }}>
            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
              {data.fullName || data.day}
            </span>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '10px',
              background: data.isWeekend ? 'rgba(239, 68, 68, 0.1)' : 'var(--empty-state-bg)',
              color: data.isWeekend ? 'var(--danger)' : 'var(--text-muted)'
            }}>
              {data.isWeekend ? 'Weekend' : 'Weekday'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.45rem',
            padding: '0.3rem 0.5rem',
            borderRadius: '6px',
            background: isSpend ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'
          }}>
            <span style={{ fontWeight: 700, color: isSpend ? 'var(--danger)' : 'var(--success)' }}>
              {isSpend ? 'Total Spend :' : 'Total Income :'}
            </span>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isSpend ? 'var(--danger)' : 'var(--success)' }}>
              {getCurrency()}{formatAmt(totalAmt)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', padding: '0.15rem 0.4rem', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
              Cash {isSpend ? 'Spend :' : 'Income :'}
            </span>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>
              {getCurrency()}{formatAmt(cashAmt)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', padding: '0.15rem 0.4rem', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSpend ? 'var(--danger)' : '#3b82f6', display: 'inline-block' }} />
              UPI {isSpend ? 'Spend :' : 'Income :'}
            </span>
            <span style={{ fontWeight: 700, color: isSpend ? 'var(--danger)' : '#3b82f6' }}>
              {getCurrency()}{formatAmt(upiAmt)}
            </span>
          </div>

          <div style={{
            borderTop: '1px solid var(--card-border, #e2e8f0)',
            paddingTop: '0.35rem',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1.25rem',
            fontSize: '0.74rem',
            color: 'var(--text-secondary)'
          }}>
            <span>Share & Count :</span>
            <span style={{ fontWeight: 600 }}>{data.pct}% ({data.count} txns)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomCumulativeTooltip = ({ active, payload, isSpend }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const totalActual = Number(data.actual || 0);
      const cashActual = Number(data.actualCash || 0);
      const upiActual = Number(data.actualUpi || 0);
      const diff = data.diff || 0;
      const isAhead = diff > 0;
      return (
        <div style={{
          backgroundColor: 'var(--card-bg, #fff)',
          border: '1px solid var(--card-border, #e2e8f0)',
          borderRadius: '12px',
          padding: '0.75rem 0.95rem',
          boxShadow: 'var(--card-shadow, 0 8px 24px rgba(0,0,0,0.12))',
          fontSize: '0.82rem',
          minWidth: '200px',
          animation: 'tooltipPop 0.15s ease-out'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.45rem',
            paddingBottom: '0.35rem',
            borderBottom: '1px solid var(--card-border)'
          }}>
            <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
              {data.fullDate || data.label}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Cumulative
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.45rem',
            padding: '0.3rem 0.5rem',
            borderRadius: '6px',
            background: isSpend ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)'
          }}>
            <span style={{ fontWeight: 700, color: isSpend ? 'var(--danger)' : 'var(--success)' }}>
              {isSpend ? 'Total Spent :' : 'Total Income :'}
            </span>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isSpend ? 'var(--danger)' : 'var(--success)' }}>
              {getCurrency()}{formatAmt(totalActual)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', padding: '0.15rem 0.4rem', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
              Cash Cumulative :
            </span>
            <span style={{ fontWeight: 700, color: '#f59e0b' }}>
              {getCurrency()}{formatAmt(cashActual)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', padding: '0.15rem 0.4rem', fontSize: '0.78rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSpend ? 'var(--danger)' : '#3b82f6', display: 'inline-block' }} />
              UPI Cumulative :
            </span>
            <span style={{ fontWeight: 700, color: isSpend ? 'var(--danger)' : '#3b82f6' }}>
              {getCurrency()}{formatAmt(upiActual)}
            </span>
          </div>

          <div style={{
            borderTop: '1px solid var(--card-border, #e2e8f0)',
            paddingTop: '0.35rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.74rem',
            color: 'var(--text-muted)'
          }}>
            <span>Steady Pace Target :</span>
            <span style={{ fontWeight: 600 }}>{getCurrency()}{formatAmt(data.pace)}</span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.74rem',
            color: isAhead ? (isSpend ? 'var(--danger)' : 'var(--success)') : 'var(--text-muted)',
            marginTop: '2px'
          }}>
            <span>Variance :</span>
            <span style={{ fontWeight: 700 }}>{isAhead ? '+' : '-'}{getCurrency()}{formatAmt(Math.abs(diff))}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Global empty state check removed to ensure filter controls remain accessible

  return (
    <div className="analysis-view-container" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '1rem' : '1.5rem', width: '100%' }}>
      
      {/* Sub-Navigation Pills */}
      <div className="analysis-sub-nav" style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          className={`btn analysis-nav-btn ${activeAnalysisTab === 'spending' ? 'btn-danger' : ''}`}
          style={{ 
            flex: 1,
            background: activeAnalysisTab === 'spending' ? 'var(--danger)' : 'var(--empty-state-bg)',
            color: activeAnalysisTab === 'spending' ? '#fff' : 'var(--text-primary)',
            border: activeAnalysisTab === 'spending' ? 'none' : '1px solid var(--card-border)'
          }}
          onClick={() => setActiveAnalysisTab('spending')}
        >
          <PieChartIcon size={18} /> Spending
        </button>
        <button
          className={`btn analysis-nav-btn ${activeAnalysisTab === 'income' ? 'btn-success' : ''}`}
          style={{ 
            flex: 1,
            background: activeAnalysisTab === 'income' ? 'var(--success)' : 'var(--empty-state-bg)',
            color: activeAnalysisTab === 'income' ? '#fff' : 'var(--text-primary)',
            border: activeAnalysisTab === 'income' ? 'none' : '1px solid var(--card-border)'
          }}
          onClick={() => setActiveAnalysisTab('income')}
        >
          <TrendingUp size={18} /> Income
        </button>
        <button
          className={`btn analysis-nav-btn ${activeAnalysisTab === 'cashflow' ? 'btn-primary' : ''}`}
          style={{ 
            flex: 1,
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
      <div className="data-card analysis-data-card glass animate-fade-in" style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
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
          <div className="filter-wrapper" style={{ width: isMobile ? '100%' : 'auto' }}>
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
          <div className="analysis-charts-container" style={{ padding: isMobile ? '0.75rem 0.85rem' : '1.5rem', width: '100%', boxSizing: 'border-box' }}>
            <div
              className="charts-grid analysis-charts-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: isMobile ? '16px' : '20px',
                alignItems: 'stretch',
                margin: 0,
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              {/* 1. DAILY SPENDING PULSE - FULL WIDTH HERO CARD (ROW 1: 100%) */}
              <div
                className="chart-wrapper analysis-hero-card"
                style={{
                  gridColumn: isMobile ? 'span 1' : '1 / -1',
                  width: '100%',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '290px',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={18} style={{ color: 'var(--danger)' }} />
                    <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                      Daily Spending Pulse
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {/* Live Hover Stat or Peak Badge */}
                    {spendingTimelineHover ? (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: 'var(--danger)',
                        animation: 'tooltipPop 0.15s ease-out',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>{spendingTimelineHover.fullDate || spendingTimelineHover.label}:</span>
                        <span>Total {getCurrency()}{formatCompactAmt(spendingTimelineHover.amount)}</span>
                        <span style={{ color: '#f59e0b' }}>Cash {getCurrency()}{formatCompactAmt(spendingTimelineHover.cash || 0)}</span>
                        <span style={{ color: 'var(--danger)' }}>UPI {getCurrency()}{formatCompactAmt(spendingTimelineHover.upi || 0)}</span>
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'var(--empty-state-bg)',
                        border: '1px solid var(--card-border)',
                        color: 'var(--text-muted)'
                      }}>
                        Avg: {getCurrency()}{formatCompactAmt(spendingTimelineStats.avg)}/day
                      </span>
                    )}
                  </div>
                </div>

                {/* AreaChart */}
                <div style={{ height: isMobile ? '205px' : '235px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      key={`spend-pulse-${spendingTimelineData.length}-${spendingFilterType}-${spendingFilterValue}`}
                      data={spendingTimelineData} 
                      margin={{ top: 24, right: 15, left: -5, bottom: 0 }}
                      onMouseMove={(e) => {
                        if (e && e.activePayload && e.activePayload.length) {
                          setSpendingTimelineHover(e.activePayload[0].payload);
                        }
                      }}
                      onMouseLeave={() => setSpendingTimelineHover(null)}
                    >
                      <defs>
                        <linearGradient id="spendPulseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="spendCashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="spendUpiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" opacity={0.6} />
                      <XAxis 
                        dataKey="label" 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        interval={isMobile ? 'preserveStartEnd' : Math.max(0, Math.ceil(spendingTimelineData.length / 15))}
                      />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        width={42}
                        tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                      />
                      <Tooltip 
                        content={<CustomTimelineTooltip isSpend={true} avg={spendingTimelineStats.avg} />} 
                        cursor={{ stroke: 'rgba(239, 68, 68, 0.4)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      />
                      {spendingTimelineStats.avg > 0 && (
                        <ReferenceLine 
                          y={spendingTimelineStats.avg} 
                          stroke="#ef4444" 
                          strokeDasharray="3 3" 
                          strokeWidth={1.5}
                          opacity={0.65} 
                        />
                      )}
                      {spendingTimelineStats.peak?.amount > 0 && (
                        <ReferenceDot 
                          x={spendingTimelineStats.peak.label} 
                          y={spendingTimelineStats.peak.amount} 
                          isFront={true}
                          ifOverflow="extendDomain"
                          shape={(props) => (
                            <PeakDotMarker 
                              {...props} 
                              amount={spendingTimelineStats.peak.amount} 
                              label={spendingTimelineStats.peak.fullDate || spendingTimelineStats.peak.label} 
                              isSpend={true} 
                            />
                          )} 
                        />
                      )}
                      <Area 
                        type="monotone" 
                        dataKey="cash" 
                        stackId="spendStack"
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#spendCashGrad)" 
                        name="Cash Spend"
                        isAnimationActive={true}
                        animationDuration={600}
                        animationEasing="ease-out"
                        activeDot={{ r: 5, stroke: 'var(--card-bg)', strokeWidth: 2, fill: '#f59e0b' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="upi" 
                        stackId="spendStack"
                        stroke="#ef4444" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#spendUpiGrad)" 
                        name="UPI Spend"
                        isAnimationActive={true}
                        animationDuration={600}
                        animationEasing="ease-out"
                        activeDot={{ r: 5, stroke: 'var(--card-bg)', strokeWidth: 2, fill: '#ef4444' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. CASH VS UPI SPENDING - ROW 2 LEFT CARD (50%) */}
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
                  minHeight: '290px',
                  boxSizing: 'border-box'
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

              {/* 3. SPEND BY CATEGORY - ROW 2 RIGHT CARD (50%) */}
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
                  minHeight: '290px',
                  boxSizing: 'border-box'
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
                <div className="donut-category-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minHeight: '220px' }}>
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
                      flex: isMobile ? 'none' : 1,
                      width: '100%',
                      minWidth: 0,
                      height: isMobile ? '230px' : '220px',
                      maxHeight: isMobile ? '230px' : '220px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      WebkitOverflowScrolling: 'touch',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      paddingRight: '6px'
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

              {/* 4. DAY-OF-WEEK RHYTHM - ROW 3 LEFT CARD (50%) */}
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
                  minHeight: '290px',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} style={{ color: 'var(--danger)' }} />
                    <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                      Day-of-Week Rhythm
                    </h4>
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
                    Peak: {spendingWeekdayData.peakDay?.day || '-'}
                  </span>
                </div>

                <div style={{ height: '175px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spendingWeekdayData.data} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" opacity={0.6} />
                      <XAxis dataKey="day" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        width={42}
                        tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                      />
                      <Tooltip content={<CustomWeekdayTooltip isSpend={true} />} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={38}>
                        {spendingWeekdayData.data.map((entry, index) => {
                          const isWeekend = entry.isWeekend;
                          const isPeak = entry.day === spendingWeekdayData.peakDay?.day && entry.amount > 0;
                          const fill = isPeak ? '#ef4444' : isWeekend ? '#f87171' : '#fca5a5';
                          return <Cell key={`spend-weekday-bar-${index}`} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Bottom Summary Pill */}
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
                  <span>Weekdays: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{formatCompactAmt(spendingWeekdayData.weekdayTotal)} ({spendingWeekdayData.weekdayPct}%)</strong></span>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span>Weekend: <strong style={{ color: '#ef4444' }}>{getCurrency()}{formatCompactAmt(spendingWeekdayData.weekendTotal)} ({spendingWeekdayData.weekendPct}%)</strong></span>
                </div>
              </div>

              {/* 5. CUMULATIVE SPEND PACE - ROW 3 RIGHT CARD (50%) */}
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
                  minHeight: '290px',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Target size={18} style={{ color: 'var(--danger)' }} />
                    <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                      Cumulative Spend Pace
                    </h4>
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
                    Actual vs Steady Pace
                  </span>
                </div>

                <div style={{ height: '175px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={spendingCumulativeData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" opacity={0.6} />
                      <XAxis 
                        dataKey="label" 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        interval={isMobile ? 'preserveStartEnd' : Math.max(0, Math.ceil(spendingCumulativeData.length / 10))}
                      />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        width={42}
                        tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                      />
                      <Tooltip content={<CustomCumulativeTooltip isSpend={true} />} />
                      <Line 
                        type="monotone" 
                        dataKey="actual" 
                        name="Actual"
                        stroke="var(--danger)" 
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="linear" 
                        dataKey="pace" 
                        name="Steady Pace"
                        stroke="var(--text-muted)" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.8}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Bottom Summary Pill */}
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
                  <span>Cumulative: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{formatAmt(spendingCumulativeData[spendingCumulativeData.length - 1]?.actual || 0)}</strong></span>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '2px', background: 'var(--danger)', display: 'inline-block' }} /> Actual
                  </span>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '0px', borderTop: '2px dashed var(--text-muted)', display: 'inline-block' }} /> Steady Pace
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* INCOME ANALYSIS */}
      {activeAnalysisTab === 'income' && (
      <div className="data-card analysis-data-card glass animate-fade-in" style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
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
          <div className="filter-wrapper" style={{ width: isMobile ? '100%' : 'auto' }}>
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
          <div className="analysis-charts-container" style={{ padding: isMobile ? '0.75rem 0.85rem' : '1.5rem', width: '100%', boxSizing: 'border-box' }}>
            <div
              className="charts-grid analysis-charts-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                gap: isMobile ? '16px' : '20px',
                alignItems: 'stretch',
                margin: 0,
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              {/* 1. DAILY INCOME PULSE - FULL WIDTH HERO CARD (ROW 1: 100%) */}
              <div
                className="chart-wrapper analysis-hero-card"
                style={{
                  gridColumn: isMobile ? 'span 1' : '1 / -1',
                  width: '100%',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '290px',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={18} style={{ color: 'var(--success)' }} />
                    <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                      Daily Income Pulse
                    </h4>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {/* Live Hover Stat or Peak Badge */}
                    {incomeTimelineHover ? (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: 'var(--success)',
                        animation: 'tooltipPop 0.15s ease-out',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>{incomeTimelineHover.fullDate || incomeTimelineHover.label}:</span>
                        <span>Total {getCurrency()}{formatCompactAmt(incomeTimelineHover.amount)}</span>
                        <span style={{ color: '#f59e0b' }}>Cash {getCurrency()}{formatCompactAmt(incomeTimelineHover.cash || 0)}</span>
                        <span style={{ color: '#10b981' }}>UPI {getCurrency()}{formatCompactAmt(incomeTimelineHover.upi || 0)}</span>
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'var(--empty-state-bg)',
                        border: '1px solid var(--card-border)',
                        color: 'var(--text-muted)'
                      }}>
                        Avg: {getCurrency()}{formatCompactAmt(incomeTimelineStats.avg)}/day
                      </span>
                    )}
                  </div>
                </div>

                {/* AreaChart */}
                <div style={{ height: isMobile ? '205px' : '235px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      key={`income-pulse-${incomeTimelineData.length}-${incomeFilterType}-${incomeFilterValue}`}
                      data={incomeTimelineData} 
                      margin={{ top: 24, right: 15, left: -5, bottom: 0 }}
                      onMouseMove={(e) => {
                        if (e && e.activePayload && e.activePayload.length) {
                          setIncomeTimelineHover(e.activePayload[0].payload);
                        }
                      }}
                      onMouseLeave={() => setIncomeTimelineHover(null)}
                    >
                      <defs>
                        <linearGradient id="incomePulseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="incomeCashGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="incomeUpiGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" opacity={0.6} />
                      <XAxis 
                        dataKey="label" 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        interval={isMobile ? 'preserveStartEnd' : Math.max(0, Math.ceil(incomeTimelineData.length / 15))}
                      />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        width={42}
                        tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                      />
                      <Tooltip 
                        content={<CustomTimelineTooltip isSpend={false} avg={incomeTimelineStats.avg} />} 
                        cursor={{ stroke: 'rgba(16, 185, 129, 0.4)', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                      />
                      {incomeTimelineStats.avg > 0 && (
                        <ReferenceLine 
                          y={incomeTimelineStats.avg} 
                          stroke="#10b981" 
                          strokeDasharray="3 3" 
                          strokeWidth={1.5}
                          opacity={0.65} 
                        />
                      )}
                      {incomeTimelineStats.peak?.amount > 0 && (
                        <ReferenceDot 
                          x={incomeTimelineStats.peak.label} 
                          y={incomeTimelineStats.peak.amount} 
                          isFront={true}
                          ifOverflow="extendDomain"
                          shape={(props) => (
                            <PeakDotMarker 
                              {...props} 
                              amount={incomeTimelineStats.peak.amount} 
                              label={incomeTimelineStats.peak.fullDate || incomeTimelineStats.peak.label} 
                              isSpend={false} 
                            />
                          )} 
                        />
                      )}
                      <Area 
                        type="monotone" 
                        dataKey="cash" 
                        stackId="incomeStack"
                        stroke="#f59e0b" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#incomeCashGrad)" 
                        name="Cash Income"
                        isAnimationActive={true}
                        animationDuration={600}
                        animationEasing="ease-out"
                        activeDot={{ r: 5, stroke: 'var(--card-bg)', strokeWidth: 2, fill: '#f59e0b' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="upi" 
                        stackId="incomeStack"
                        stroke="#10b981" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#incomeUpiGrad)" 
                        name="UPI Income"
                        isAnimationActive={true}
                        animationDuration={600}
                        animationEasing="ease-out"
                        activeDot={{ r: 5, stroke: 'var(--card-bg)', strokeWidth: 2, fill: '#10b981' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. CASH VS UPI INCOME - ROW 2 LEFT CARD (50%) */}
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
                  minHeight: '290px',
                  boxSizing: 'border-box'
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
                          <Cell key={`income-cell-${index}`} fill={entry.name === 'Cash' ? '#10b981' : '#3b82f6'} />
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

              {/* 3. INCOME BY CATEGORY - ROW 2 RIGHT CARD (50%) */}
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
                  minHeight: '290px',
                  boxSizing: 'border-box'
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
                <div className="donut-category-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minHeight: '220px' }}>
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
                                key={`income-pie-cell-${index}`}
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
                      flex: isMobile ? 'none' : 1,
                      width: '100%',
                      minWidth: 0,
                      height: isMobile ? '230px' : '220px',
                      maxHeight: isMobile ? '230px' : '220px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      WebkitOverflowScrolling: 'touch',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      paddingRight: '6px'
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

              {/* 4. DAY-OF-WEEK RHYTHM - ROW 3 LEFT CARD (50%) */}
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
                  minHeight: '290px',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={18} style={{ color: 'var(--success)' }} />
                    <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                      Day-of-Week Rhythm
                    </h4>
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
                    Peak: {incomeWeekdayData.peakDay?.day || '-'}
                  </span>
                </div>

                <div style={{ height: '175px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={incomeWeekdayData.data} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" opacity={0.6} />
                      <XAxis dataKey="day" stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        width={42}
                        tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                      />
                      <Tooltip content={<CustomWeekdayTooltip isSpend={false} />} />
                      <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={38}>
                        {incomeWeekdayData.data.map((entry, index) => {
                          const isWeekend = entry.isWeekend;
                          const isPeak = entry.day === incomeWeekdayData.peakDay?.day && entry.amount > 0;
                          const fill = isPeak ? '#10b981' : isWeekend ? '#34d399' : '#6ee7b7';
                          return <Cell key={`income-weekday-bar-${index}`} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Bottom Summary Pill */}
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
                  <span>Weekdays: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{formatCompactAmt(incomeWeekdayData.weekdayTotal)} ({incomeWeekdayData.weekdayPct}%)</strong></span>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span>Weekend: <strong style={{ color: '#10b981' }}>{getCurrency()}{formatCompactAmt(incomeWeekdayData.weekendTotal)} ({incomeWeekdayData.weekendPct}%)</strong></span>
                </div>
              </div>

              {/* 5. CUMULATIVE INCOME PACE - ROW 3 RIGHT CARD (50%) */}
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
                  minHeight: '290px',
                  boxSizing: 'border-box'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', minHeight: '26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Target size={18} style={{ color: 'var(--success)' }} />
                    <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.02rem', fontWeight: 600 }}>
                      Cumulative Income Pace
                    </h4>
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
                    Actual vs Steady Pace
                  </span>
                </div>

                <div style={{ height: '175px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={incomeCumulativeData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" opacity={0.6} />
                      <XAxis 
                        dataKey="label" 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        interval={isMobile ? 'preserveStartEnd' : Math.max(0, Math.ceil(incomeCumulativeData.length / 10))}
                      />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        tick={{ fontSize: 11 }}
                        width={42}
                        tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                      />
                      <Tooltip content={<CustomCumulativeTooltip isSpend={false} />} />
                      <Line 
                        type="monotone" 
                        dataKey="actual" 
                        name="Actual"
                        stroke="var(--success)" 
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line 
                        type="linear" 
                        dataKey="pace" 
                        name="Steady Pace"
                        stroke="var(--text-muted)" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.8}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Bottom Summary Pill */}
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
                  <span>Cumulative: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{formatAmt(incomeCumulativeData[incomeCumulativeData.length - 1]?.actual || 0)}</strong></span>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '2px', background: 'var(--success)', display: 'inline-block' }} /> Actual
                  </span>
                  <span style={{ opacity: 0.4 }}>|</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '8px', height: '0px', borderTop: '2px dashed var(--text-muted)', display: 'inline-block' }} /> Steady Pace
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* MONTHLY CASH FLOW */}
      {activeAnalysisTab === 'cashflow' && (
      <div className="data-card analysis-data-card glass animate-fade-in" style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
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

          <div className="flow-filter-controls" style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? '0.5rem' : '0.45rem',
            alignItems: isMobile ? 'stretch' : 'center',
            flexWrap: 'wrap',
            width: isMobile ? '100%' : 'auto'
          }}>
            <div className="filter-wrapper" style={{ width: isMobile ? '100%' : 'auto' }}>
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

            {/* Wallet Flow Mode Filter Dropdown */}
            <select
              className="form-control"
              style={{
                width: isMobile ? '100%' : 'auto',
                flex: isMobile ? '1 1 100%' : 'none',
                padding: '0.35rem 1.6rem 0.35rem 0.65rem',
                fontSize: isMobile ? '0.78rem' : '0.85rem',
                fontWeight: 600,
                background: 'var(--empty-state-bg)',
                color: 'var(--text-primary)',
                borderColor: 'var(--card-border)',
                borderRadius: '8px',
                cursor: 'pointer',
                height: '34px',
                boxSizing: 'border-box'
              }}
              value={flowWalletFilter}
              onChange={(e) => setFlowWalletFilter(e.target.value)}
              title="Filter Cash Flow by Wallet Mode"
            >
              <option value="all">Combined Flow (Cash + UPI)</option>
              <option value="Cash">Cash Flow (Cash Only)</option>
              <option value="UPI">UPI Flow (UPI Only)</option>
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
          <div className="analysis-charts-container" style={{ padding: isMobile ? '0.75rem 0.85rem' : '1.5rem', width: '100%', boxSizing: 'border-box' }}>
            {/* Chart Wrapper Card */}
            <div className="chart-wrapper" style={{
              width: '100%',
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--card-border)',
              borderRadius: '14px',
              padding: isMobile ? '0.85rem 0.65rem' : '1.25rem',
              boxSizing: 'border-box'
            }}>
              <h4 style={{ textAlign: 'center', marginBottom: '0.85rem', color: 'var(--text-secondary)', fontSize: isMobile ? '0.92rem' : '1.02rem', fontWeight: 600 }}>
                {flowWalletFilter === 'all' && 'Combined Income vs Spending Over Time'}
                {flowWalletFilter === 'Cash' && 'Cash Inflow vs Outflow Over Time'}
                {flowWalletFilter === 'UPI' && 'UPI & Bank Inflow vs Outflow Over Time'}
              </h4>
              <div className="chart-container" style={{ height: isMobile ? '260px' : '330px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyFlowData}
                    margin={{
                      top: 15,
                      right: isMobile ? 8 : 20,
                      left: isMobile ? -18 : 10,
                      bottom: 5
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis
                      dataKey="name"
                      stroke="var(--text-secondary)"
                      tick={{ fontSize: isMobile ? 10 : 12 }}
                    />
                    <YAxis
                      stroke="var(--text-secondary)"
                      tick={{ fontSize: isMobile ? 10 : 11 }}
                      width={isMobile ? 38 : 45}
                      tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : v}
                    />
                    <Tooltip 
                      cursor={{ fill: 'var(--hover-bg)' }}
                      content={<CustomFlowTooltip />}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: isMobile ? '0.75rem' : '0.85rem',
                        paddingTop: '6px'
                      }}
                    />
                    <Bar
                      dataKey="income"
                      name={flowWalletFilter === 'Cash' ? 'Cash Inflow' : flowWalletFilter === 'UPI' ? 'UPI Inflow' : 'Income'}
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={isMobile ? 30 : 45}
                    />
                    <Bar
                      dataKey="spend"
                      name={flowWalletFilter === 'Cash' ? 'Cash Outflow' : flowWalletFilter === 'UPI' ? 'UPI Outflow' : 'Spend'}
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={isMobile ? 30 : 45}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 4-Card Complete Ledger Flow */}
            <div className="cashflow-ledger-grid" style={{ marginTop: '1.25rem' }}>
              {/* Card 1: Opening Balance */}
              <div className="flow-ledger-card flow-card-opening" style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '12px',
                padding: isMobile ? '0.85rem 0.95rem' : '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                minWidth: 0
              }}>
                <div style={{
                  width: isMobile ? 36 : 40,
                  height: isMobile ? 36 : 40,
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Landmark size={isMobile ? 18 : 20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: isMobile ? '0.72rem' : '0.78rem', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {flowWalletFilter === 'all' && 'Opening Balance (Combined)'}
                    {flowWalletFilter === 'Cash' && 'Cash Opening Balance'}
                    {flowWalletFilter === 'UPI' && 'Bank Opening Balance'}
                  </span>
                  <strong style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', color: '#6366f1', display: 'block', whiteSpace: 'nowrap' }}>
                    {getCurrency()}{formatAmt(displayOpeningBalance)}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    Start of selected period
                  </span>
                </div>
              </div>

              {/* Card 2: Total Inflow (+) */}
              <div className="flow-ledger-card flow-card-inflow" style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '12px',
                padding: isMobile ? '0.85rem 0.95rem' : '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                minWidth: 0
              }}>
                <div style={{
                  width: isMobile ? 36 : 40,
                  height: isMobile ? 36 : 40,
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ArrowDownLeft size={isMobile ? 18 : 20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: isMobile ? '0.72rem' : '0.78rem', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {flowWalletFilter === 'all' && 'Total Inflow (Combined)'}
                    {flowWalletFilter === 'Cash' && 'Cash Inflow'}
                    {flowWalletFilter === 'UPI' && 'UPI Inflow'}
                  </span>
                  <strong style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', color: '#10b981', display: 'block', whiteSpace: 'nowrap' }}>
                    +{getCurrency()}{formatAmt(activeLedger.inflow)}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    Deposits & incoming funds
                  </span>
                </div>
              </div>

              {/* Card 3: Total Outflow (-) */}
              <div className="flow-ledger-card flow-card-outflow" style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '12px',
                padding: isMobile ? '0.85rem 0.95rem' : '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                minWidth: 0
              }}>
                <div style={{
                  width: isMobile ? 36 : 40,
                  height: isMobile ? 36 : 40,
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ArrowUpRight size={isMobile ? 18 : 20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: isMobile ? '0.72rem' : '0.78rem', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {flowWalletFilter === 'all' && 'Total Outflow (Combined)'}
                    {flowWalletFilter === 'Cash' && 'Cash Outflow'}
                    {flowWalletFilter === 'UPI' && 'UPI Outflow'}
                  </span>
                  <strong style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', color: '#ef4444', display: 'block', whiteSpace: 'nowrap' }}>
                    -{getCurrency()}{formatAmt(activeLedger.outflow)}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    Payments & spent money
                  </span>
                </div>
              </div>

              {/* Card 4: Ending / Available Balance */}
              <div className="flow-ledger-card flow-card-balance" style={{
                background: displayClosingBalance >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${displayClosingBalance >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                borderRadius: '12px',
                padding: isMobile ? '0.85rem 0.95rem' : '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                minWidth: 0
              }}>
                <div style={{
                  width: isMobile ? 36 : 40,
                  height: isMobile ? 36 : 40,
                  borderRadius: '10px',
                  background: displayClosingBalance >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: displayClosingBalance >= 0 ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Wallet size={isMobile ? 18 : 20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: isMobile ? '0.72rem' : '0.78rem', color: 'var(--text-secondary)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {flowWalletFilter === 'all' && (flowFilterType === 'all' ? 'Current Available Balance' : 'Ending Balance (Combined)')}
                    {flowWalletFilter === 'Cash' && (flowFilterType === 'all' ? 'Cash Available Balance' : 'Cash Ending Balance')}
                    {flowWalletFilter === 'UPI' && (flowFilterType === 'all' ? 'Current Bank Balance' : 'Bank Ending Balance')}
                  </span>
                  <strong style={{ fontSize: isMobile ? '1.15rem' : '1.25rem', color: displayClosingBalance >= 0 ? '#10b981' : '#ef4444', display: 'block', whiteSpace: 'nowrap' }}>
                    {getCurrency()}{formatAmt(displayClosingBalance)}
                  </strong>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginTop: '2px', whiteSpace: 'nowrap' }}>
                    {flowFilterType === 'all' ? 'Present account balance' : 'End of selected period'}
                  </span>
                </div>
              </div>
            </div>

            {/* Period Cash Flow & Net Performance Bar */}
            <div style={{
              marginTop: '1rem',
              padding: isMobile ? '0.75rem 0.85rem' : '0.85rem 1.25rem',
              borderRadius: '12px',
              background: 'var(--empty-state-bg)',
              border: '1px solid var(--card-border)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: isMobile ? '0.45rem' : '0.65rem',
              fontSize: isMobile ? '0.82rem' : '0.88rem',
              textAlign: 'center',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Period Net Cash Flow:</span>
              <strong style={{ color: (activeLedger.inflow - activeLedger.outflow) >= 0 ? '#10b981' : '#ef4444', fontSize: isMobile ? '0.98rem' : '1.05rem', whiteSpace: 'nowrap' }}>
                {(activeLedger.inflow - activeLedger.outflow) >= 0 ? '+' : '-'}{getCurrency()}{formatAmt(Math.abs(activeLedger.inflow - activeLedger.outflow))}
              </strong>
              <span style={{
                color: (activeLedger.inflow - activeLedger.outflow) >= 0 ? '#10b981' : '#ef4444',
                background: (activeLedger.inflow - activeLedger.outflow) >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${(activeLedger.inflow - activeLedger.outflow) >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: isMobile ? '0.75rem' : '0.8rem'
              }}>
                {(activeLedger.inflow - activeLedger.outflow) >= 0 ? 'Net Saved' : 'Net Spend'}
              </span>
            </div>

            {/* Wallet Sub-breakdown Banner when Combined Flow is active */}
            {flowWalletFilter === 'all' && (
              <div style={{
                marginTop: '0.85rem',
                padding: isMobile ? '0.75rem 0.85rem' : '0.75rem 1.25rem',
                borderRadius: '10px',
                background: 'var(--empty-state-bg)',
                border: '1px solid var(--card-border)',
                fontSize: isMobile ? '0.78rem' : '0.85rem',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: isMobile ? 'center' : 'space-around',
                alignItems: 'center',
                gap: isMobile ? '0.5rem' : '1rem',
                color: 'var(--text-secondary)',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Coins size={15} className="text-accent-primary" />
                  <strong style={{ color: 'var(--text-primary)' }}>Cash Flow:</strong> In <span style={{ color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>+{getCurrency()}{flowTotals.cashIn.toFixed(2)}</span> | Out <span style={{ color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>-{getCurrency()}{flowTotals.cashOut.toFixed(2)}</span>
                </div>
                {!isMobile && (
                  <div style={{ height: '16px', width: '1px', background: 'var(--card-border)' }} />
                )}
                {isMobile && (
                  <div style={{ width: '100%', height: '1px', background: 'var(--card-border)', opacity: 0.5 }} />
                )}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <CreditCard size={15} className="text-accent-primary" />
                  <strong style={{ color: 'var(--text-primary)' }}>UPI Flow:</strong> In <span style={{ color: '#10b981', fontWeight: 600, whiteSpace: 'nowrap' }}>+{getCurrency()}{flowTotals.upiIn.toFixed(2)}</span> | Out <span style={{ color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>-{getCurrency()}{flowTotals.upiOut.toFixed(2)}</span>
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
