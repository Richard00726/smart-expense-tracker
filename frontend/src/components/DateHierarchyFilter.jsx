import React, { useMemo } from 'react';

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
 * Drill-down hierarchical filter matching exact 3-4 pill design:
 * 1. Primary Mode: [Today ∨] / [All Time ∨] / [By Year ∨]
 * 2. Year (if By Year): [2026 ∨]
 * 3. Month (if By Year): [All Months ∨] or [November 2026 ∨]
 * 4. Day (if specific Month): [All Days ∨] or [03 Nov (Today) ∨]
 */
const DateHierarchyFilter = ({
  filterType = 'today', // 'today' | 'all' | 'year' | 'month' | 'day'
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

  // 1. Available Years extracted from data + current calendar year
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

  // Determine current active mode
  const primaryMode = useMemo(() => {
    if (filterType === 'today') return 'today';
    if (filterType === 'all') return 'all';
    return 'year';
  }, [filterType]);

  // Determine current selected Year
  const selectedYear = useMemo(() => {
    if (filterType === 'year' && filterValue) return String(filterValue);
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
    if (filterType === 'year') return 'all';
    if (filterType === 'month' && filterValue) return String(filterValue);
    if (filterType === 'day' && filterValue) return String(filterValue).slice(0, 7);
    if (primaryMode === 'year') {
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

  // 2. Month Options for the selected Year
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

  // 3. Day Options for the selected Month
  const dayOptions = useMemo(() => {
    if (selectedMonth === 'all') return [];

    const options = [{ value: 'all', label: 'All Days' }];
    const [yStr, mStr] = selectedMonth.split('-');
    const y = parseInt(yStr, 10);
    const mIndex = parseInt(mStr, 10) - 1; // 0-indexed
    const daysInMonth = new Date(y, mIndex + 1, 0).getDate();
    const isCurrentMonth = (y === currentYearNum && mIndex === currentMonthIndex);

    // List days in descending order
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
    } else if (newMode === 'year') {
      const y = selectedYear || availableYears[0] || curYStr;
      onFilterChange('year', y);
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

  return (
    <div className="date-hierarchy-filter animate-fade-in">
      {/* Pill 1: Primary Mode (Today / All Time / By Year) */}
      <select
        className="filter-pill-select"
        value={primaryMode}
        onChange={e => handleModeChange(e.target.value)}
        aria-label="Filter Mode"
      >
        <option value="today">Today</option>
        <option value="all">All Time</option>
        <option value="year">By Year</option>
      </select>

      {/* Pill 2: Year Selector (Visible when By Year is active) */}
      {primaryMode === 'year' && (
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

      {/* Pill 3: Month Selector (Visible when By Year is active) */}
      {primaryMode === 'year' && (
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

      {/* Pill 4: Day Selector (Visible when a specific Month is selected) */}
      {primaryMode === 'year' && selectedMonth !== 'all' && (
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
    </div>
  );
};

export default DateHierarchyFilter;
