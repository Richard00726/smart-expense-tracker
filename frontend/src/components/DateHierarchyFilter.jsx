import React, { useMemo, useState, useEffect } from 'react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const getTodayISTString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/**
 * DateHierarchyFilter
 * 
 * Drill-down hierarchical filter with 4 modes:
 * 1. Today: [Today ∨]
 * 2. All Time: [All Time ∨]
 * 3. Select Period (Year + Month + Day dropdowns):
 *    [Select Period ∨]  [2026 ∨]  [All Months ∨] (or [November 2026 ∨]  [03 Nov (Today) ∨])
 * 4. Custom Range (From and To date pickers):
 *    [Custom Range ∨]  From: [YYYY-MM-DD]  To: [YYYY-MM-DD]
 */
const DateHierarchyFilter = ({
  filterType = 'today', // 'today' | 'all' | 'period' | 'year' | 'month' | 'day' | 'custom'
  filterValue = '',
  onFilterChange,
  transactions = [],
  dailySummaries = [],
  defaultMonthWithData
}) => {
  const todayIST = getTodayISTString();
  const [curYStr, curMStr, curDStr] = todayIST.split('-');
  const currentYearNum = parseInt(curYStr, 10);
  const currentMonthNum = parseInt(curMStr, 10); // 1-12
  const currentMonthIndex = currentMonthNum - 1; // 0-11
  const currentDayNum = parseInt(curDStr, 10);

  // Available Years extracted from data + current calendar year
  const availableYears = useMemo(() => {
    const yearSet = new Set();
    yearSet.add(curYStr);

    const checkDate = (d) => {
      if (!d) return;
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) {
        yearSet.add(parsed.getFullYear().toString());
      }
    };

    if (Array.isArray(transactions)) {
      transactions.forEach(t => checkDate(t.date || t.txnDate));
    }

    if (Array.isArray(dailySummaries)) {
      dailySummaries.forEach(s => {
        const dateStr = s.statementDate || s.period || '';
        const parts = dateStr.split('-');
        if (parts.length >= 3) {
          const y = parts[2].slice(0, 4);
          if (y && y.length === 4) yearSet.add(y);
        }
      });
    }

    try {
      const cached = localStorage.getItem('cached_transactions');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) parsed.forEach(t => checkDate(t.date || t.txnDate));
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
              const y = parts[2].slice(0, 4);
              if (y && y.length === 4) yearSet.add(y);
            }
          });
        }
      }
    } catch (e) {}

    return Array.from(yearSet).sort((a, b) => b.localeCompare(a));
  }, [transactions, dailySummaries, curYStr]);

  // Determine current active primary mode
  const primaryMode = useMemo(() => {
    if (filterType === 'today') return 'today';
    if (filterType === 'all') return 'all';
    if (filterType === 'custom') return 'custom';
    return 'period'; // 'period', 'year', 'month', 'day'
  }, [filterType]);

  // Determine current selected Year
  const selectedYear = useMemo(() => {
    if ((filterType === 'year' || filterType === 'period') && filterValue) return String(filterValue);
    if ((filterType === 'month' || filterType === 'day') && filterValue) {
      return String(filterValue).split('-')[0];
    }
    if (defaultMonthWithData) {
      return String(defaultMonthWithData).split('-')[0];
    }
    return availableYears[0] || curYStr;
  }, [filterType, filterValue, defaultMonthWithData, availableYears, curYStr]);

  // Determine current selected Month ('all' or 'YYYY-MM')
  const selectedMonth = useMemo(() => {
    if (filterType === 'year' || filterType === 'period') return 'all';
    if (filterType === 'month' && filterValue) return String(filterValue);
    if (filterType === 'day' && filterValue) return String(filterValue).slice(0, 7);
    if (primaryMode === 'period') {
      if (defaultMonthWithData && defaultMonthWithData.startsWith(selectedYear)) {
        return defaultMonthWithData;
      }
      return 'all';
    }
    return 'all';
  }, [filterType, filterValue, primaryMode, defaultMonthWithData, selectedYear]);

  // Determine current selected Day ('all' or 'YYYY-MM-DD')
  const selectedDay = useMemo(() => {
    if (filterType === 'day' && filterValue) return String(filterValue);
    return 'all';
  }, [filterType, filterValue]);

  // Custom Range State
  const initialFrom = useMemo(() => {
    if (filterType === 'custom' && filterValue && filterValue.includes(':')) {
      return filterValue.split(':')[0];
    }
    if (defaultMonthWithData) {
      return `${defaultMonthWithData}-01`;
    }
    return `${curYStr}-${curMStr}-01`;
  }, [filterType, filterValue, defaultMonthWithData, curYStr, curMStr]);

  const initialTo = useMemo(() => {
    if (filterType === 'custom' && filterValue && filterValue.includes(':')) {
      return filterValue.split(':')[1];
    }
    return todayIST;
  }, [filterType, filterValue, todayIST]);

  const [customFrom, setCustomFrom] = useState(initialFrom);
  const [customTo, setCustomTo] = useState(initialTo);

  useEffect(() => {
    if (filterType === 'custom' && filterValue && filterValue.includes(':')) {
      const [f, t] = filterValue.split(':');
      if (f) setCustomFrom(f);
      if (t) setCustomTo(t);
    }
  }, [filterType, filterValue]);

  // Month Options for the selected Year
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Months' }];
    const yearNum = parseInt(selectedYear, 10);
    const maxMonthIndex = (yearNum === currentYearNum) ? currentMonthIndex : 11;

    for (let m = maxMonthIndex; m >= 0; m--) {
      const mStr = String(m + 1).padStart(2, '0');
      const val = `${selectedYear}-${mStr}`;
      options.push({
        value: val,
        label: `${MONTH_NAMES[m]} ${selectedYear}`
      });
    }

    return options;
  }, [selectedYear, currentYearNum, currentMonthIndex]);

  // Day Options for the selected Month
  const dayOptions = useMemo(() => {
    if (selectedMonth === 'all') return [];

    const options = [{ value: 'all', label: 'All Days' }];
    const [yStr, mStr] = selectedMonth.split('-');
    const y = parseInt(yStr, 10);
    const mIndex = parseInt(mStr, 10) - 1; // 0-indexed
    const daysInMonth = new Date(y, mIndex + 1, 0).getDate();
    const isCurrentMonth = (y === currentYearNum && mIndex === currentMonthIndex);

    const startDay = isCurrentMonth ? currentDayNum : daysInMonth;

    for (let d = startDay; d >= 1; d--) {
      const dStr = String(d).padStart(2, '0');
      const val = `${yStr}-${mStr}-${dStr}`;
      const isToday = isCurrentMonth && (d === currentDayNum);
      const label = isToday
        ? `${dStr} ${MONTH_SHORT[mIndex]} (Today)`
        : `${dStr} ${MONTH_SHORT[mIndex]}`;
      options.push({ value: val, label });
    }

    return options;
  }, [selectedMonth, currentYearNum, currentMonthIndex, currentDayNum]);

  // Event handlers
  const handleModeChange = (newMode) => {
    if (!onFilterChange) return;
    if (newMode === 'today') {
      onFilterChange('today', todayIST);
    } else if (newMode === 'all') {
      onFilterChange('all', '');
    } else if (newMode === 'period') {
      const y = selectedYear || availableYears[0] || curYStr;
      if (selectedMonth && selectedMonth !== 'all') {
        if (selectedDay && selectedDay !== 'all') {
          onFilterChange('day', selectedDay);
        } else {
          onFilterChange('month', selectedMonth);
        }
      } else {
        onFilterChange('year', y);
      }
    } else if (newMode === 'custom') {
      const from = customFrom || (defaultMonthWithData ? `${defaultMonthWithData}-01` : `${curYStr}-01-01`);
      const to = customTo || todayIST;
      onFilterChange('custom', `${from}:${to}`);
    }
  };

  const handleYearChange = (newYear) => {
    if (!onFilterChange) return;
    onFilterChange('year', newYear);
  };

  const handleMonthChange = (newMonth) => {
    if (!onFilterChange) return;
    if (newMonth === 'all') {
      onFilterChange('year', selectedYear);
    } else {
      onFilterChange('month', newMonth);
    }
  };

  const handleDayChange = (newDay) => {
    if (!onFilterChange) return;
    if (newDay === 'all') {
      onFilterChange('month', selectedMonth);
    } else {
      onFilterChange('day', newDay);
    }
  };

  const handleCustomDateChange = (from, to) => {
    setCustomFrom(from);
    setCustomTo(to);
    if (!onFilterChange) return;
    if (from && to) {
      onFilterChange('custom', `${from}:${to}`);
    }
  };

  return (
    <div className="date-hierarchy-filter animate-fade-in">
      {/* Pill 1: Primary Mode (Today / All Time / Select Period / Custom Range) */}
      <select
        className="filter-pill-select"
        value={primaryMode}
        onChange={e => handleModeChange(e.target.value)}
        aria-label="Filter Mode"
      >
        <option value="today">Today</option>
        <option value="all">All Time</option>
        <option value="period">Select Period</option>
        <option value="custom">Custom Range</option>
      </select>

      {/* Pill 2: Year Selector (Visible when Select Period is active) */}
      {primaryMode === 'period' && (
        <select
          className="filter-pill-select animate-fade-in"
          value={selectedYear}
          onChange={e => handleYearChange(e.target.value)}
          aria-label="Select Year"
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}

      {/* Pill 3: Month Selector (Visible when Select Period is active) */}
      {primaryMode === 'period' && (
        <select
          className="filter-pill-select animate-fade-in"
          value={selectedMonth}
          onChange={e => handleMonthChange(e.target.value)}
          aria-label="Select Month"
        >
          {monthOptions.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}

      {/* Pill 4: Day Selector (Visible when Select Period is active AND a specific Month is selected) */}
      {primaryMode === 'period' && selectedMonth !== 'all' && (
        <select
          className="filter-pill-select animate-fade-in"
          value={selectedDay}
          onChange={e => handleDayChange(e.target.value)}
          aria-label="Select Day"
        >
          {dayOptions.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      )}

      {/* Custom Range: From and To Date Pickers */}
      {primaryMode === 'custom' && (
        <>
          <div className="filter-date-pill animate-fade-in" title="From Date">
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>From</span>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={e => handleCustomDateChange(e.target.value, customTo)}
            />
          </div>
          <div className="filter-date-pill animate-fade-in" title="To Date">
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>To</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={e => handleCustomDateChange(customFrom, e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default DateHierarchyFilter;
