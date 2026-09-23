import React, { useState, useEffect } from 'react';
import { getSummary, getCurrency } from '../services/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { PieChart as PieChartIcon, BarChart2, TrendingUp, Activity } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

const AnalysisView = ({ refreshTrigger }) => {
  const [spendingSummary, setSpendingSummary] = useState(null);
  const [incomeSummary, setIncomeSummary] = useState(null);
  const [flowSummary, setFlowSummary] = useState(null);

  const [spendingLoading, setSpendingLoading] = useState(true);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [flowLoading, setFlowLoading] = useState(true);

  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const currentMonthString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentYearString = today.getFullYear().toString();

  const [spendingFilterType, setSpendingFilterType] = useState('month');
  const [spendingFilterValue, setSpendingFilterValue] = useState(currentMonthString);

  const [incomeFilterType, setIncomeFilterType] = useState('month');
  const [incomeFilterValue, setIncomeFilterValue] = useState(currentMonthString);

  const [flowFilterType, setFlowFilterType] = useState('month');
  const [flowFilterValue, setFlowFilterValue] = useState(currentMonthString);

  const handleFilterTypeChange = (newType, setType, setValue) => {
    setType(newType);
    if (newType === 'day') setValue(todayString);
    else if (newType === 'month') setValue(currentMonthString);
    else if (newType === 'year') setValue(currentYearString);
  };

  const [activeAnalysisTab, setActiveAnalysisTab] = useState('spending');

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

  const loadSpending = async () => {
    try {
      setSpendingLoading(true);
      const res = await getSummary(getFilterObj(spendingFilterType, spendingFilterValue));
      setSpendingSummary(res.data);
    } catch (e) { console.error(e); } finally { setSpendingLoading(false); }
  };

  const loadIncome = async () => {
    try {
      setIncomeLoading(true);
      const res = await getSummary(getFilterObj(incomeFilterType, incomeFilterValue));
      setIncomeSummary(res.data);
    } catch (e) { console.error(e); } finally { setIncomeLoading(false); }
  };

  const loadFlow = async () => {
    try {
      setFlowLoading(true);
      const res = await getSummary(getFilterObj(flowFilterType, flowFilterValue));
      setFlowSummary(res.data);
    } catch (e) { console.error(e); } finally { setFlowLoading(false); }
  };

  useEffect(() => { loadSpending(); }, [spendingFilterType, spendingFilterValue, refreshTrigger]);
  useEffect(() => { loadIncome(); }, [incomeFilterType, incomeFilterValue, refreshTrigger]);
  useEffect(() => { loadFlow(); }, [flowFilterType, flowFilterValue, refreshTrigger]);

  if (!spendingSummary && !incomeSummary && !flowSummary) {
    return (
      <div className="data-card glass">
        <div className="empty-state">Loading analysis...</div>
      </div>
    );
  }

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

  const monthlyFlowData = flowSummary?.monthlyFlow ? flowSummary.monthlyFlow.map(item => ({
    name: item._id,
    income: item.income,
    spend: item.spend
  })) : [];

  const hasSpendingData = categoryData.length > 0 || walletSpendingData.length > 0;
  const hasIncomeData = walletIncomeData.length > 0;
  const hasFlowData = monthlyFlowData.length > 0;

  const cashSpend = walletSpendingData.find(item => item.name === 'Cash')?.value || 0;
  const upiSpend = walletSpendingData.find(item => item.name === 'UPI')?.value || 0;
  const totalSpend = cashSpend + upiSpend;

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
        {spendingLoading && <div style={{ position: 'absolute', top: '1rem', left: '1rem', color: 'var(--text-secondary)' }}>Loading...</div>}
        <div className="data-header">
          <h3><PieChartIcon size={20} className="text-danger" /> Spending Analysis</h3>
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


        {!hasSpendingData ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No spending recorded for this period.</p>
          </div>
        ) : (
          <div className="charts-grid">
            <div className="chart-wrapper">
              <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Spend by Category
              </h4>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      formatter={(value) => `${getCurrency()}${value}`}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-wrapper">
              <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Cash vs UPI Spending
              </h4>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={walletSpendingData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip 
                      cursor={{ fill: 'var(--hover-bg)' }}
                      contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                      formatter={(value) => `${getCurrency()}${value}`}
                    />
                    <Bar dataKey="value" fill="var(--danger)">
                      {walletSpendingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Cash' ? '#f59e0b' : 'var(--danger)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--empty-state-bg)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <span style={{ marginRight: '0.5rem' }}>Total: <strong style={{ color: 'var(--text-primary)' }}>{getCurrency()}{totalSpend.toFixed(2)}</strong></span>
                <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>|</span>
                <span style={{ color: '#f59e0b', fontWeight: '500' }}>Cash: {getCurrency()}{cashSpend.toFixed(2)}</span>
                <span style={{ margin: '0 0.5rem', opacity: 0.5 }}>|</span>
                <span style={{ color: 'var(--danger)', fontWeight: '500' }}>UPI: {getCurrency()}{upiSpend.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* INCOME ANALYSIS */}
      {activeAnalysisTab === 'income' && (
      <div className="data-card glass animate-fade-in" style={{ position: 'relative' }}>
        {incomeLoading && <div style={{ position: 'absolute', top: '1rem', left: '1rem', color: 'var(--text-secondary)' }}>Loading...</div>}
        <div className="data-header">
          <h3><TrendingUp size={20} className="text-success" /> Income Analysis</h3>
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


        {!hasIncomeData ? (
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
        {flowLoading && <div style={{ position: 'absolute', top: '1rem', left: '1rem', color: 'var(--text-secondary)' }}>Loading...</div>}
        <div className="data-header">
          <h3><Activity size={20} className="text-accent-primary" /> Monthly Cash Flow</h3>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
        {!hasFlowData || monthlyFlowData.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No cash flow data for this period.</p>
          </div>
        ) : (
          <div className="chart-wrapper" style={{ padding: '1rem' }}>
            <h4 style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Income vs Spending Over Time
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
                    formatter={(value) => `${getCurrency()}${value}`}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="spend" name="Spend" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      )}
      
    </div>
  );
};

export default AnalysisView;
