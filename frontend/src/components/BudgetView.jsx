import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, AlertCircle, Edit2, Check, Filter, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getCurrency, updateProfile, getTransactions } from '../services/api';

const BudgetView = ({ transactions: initialTransactions }) => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [timeframe, setTimeframe] = useState('monthly');
  const [budgetTransactions, setBudgetTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  
  const getLimitForTimeframe = (tf, userData) => {
    switch (tf) {
      case 'daily': return userData.dailyLimit || 0;
      case 'weekly': return userData.weeklyLimit || 0;
      case 'yearly': return userData.yearlyLimit || 0;
      case 'monthly':
      default: return userData.monthlyLimit || 0;
    }
  };

  const [limit, setLimit] = useState(getLimitForTimeframe(timeframe, user));
  const [excludedCategories, setExcludedCategories] = useState(user.excludedCategories || []);
  const [isEditing, setIsEditing] = useState(false);
  const [tempLimit, setTempLimit] = useState(limit);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLimit(getLimitForTimeframe(timeframe, user));
    setTempLimit(getLimitForTimeframe(timeframe, user));
    fetchTransactionsForTimeframe(timeframe);
  }, [timeframe, user]);

  const fetchTransactionsForTimeframe = async (tf) => {
    setLoadingTx(true);
    try {
      const now = new Date();
      let startDate, endDate;

      if (tf === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (tf === 'weekly') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else if (tf === 'monthly') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (tf === 'yearly') {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      }

      const res = await getTransactions({ startDate: startDate.toISOString(), endDate: endDate.toISOString() });
      setBudgetTransactions(res.data);
    } catch (err) {
      console.error("Failed to fetch budget transactions:", err);
    } finally {
      setLoadingTx(false);
    }
  };

  const availableCategories = Array.from(new Set(
    budgetTransactions.filter(tx => tx.type === 'debit' && tx.category).map(tx => tx.category)
  ));

  const currentExpenses = budgetTransactions
    .filter(tx => tx.type === 'debit' && !excludedCategories.includes(tx.category))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalUnfilteredExpenses = budgetTransactions
    .filter(tx => tx.type === 'debit')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const handleSaveLimit = async () => {
    if (tempLimit < 0) return;
    setLoading(true);
    try {
      let payload = {};
      if (timeframe === 'daily') payload.dailyLimit = tempLimit;
      else if (timeframe === 'weekly') payload.weeklyLimit = tempLimit;
      else if (timeframe === 'yearly') payload.yearlyLimit = tempLimit;
      else payload.monthlyLimit = tempLimit;

      const res = await updateProfile(payload);
      
      const updatedUser = { ...user, ...payload };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update limit:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExcludeCategory = async (category) => {
    const newExcluded = excludedCategories.includes(category)
      ? excludedCategories.filter(c => c !== category)
      : [...excludedCategories, category];
    
    setExcludedCategories(newExcluded);
    
    try {
      const res = await updateProfile({ excludedCategories: newExcluded });
      const updatedUser = { ...user, excludedCategories: newExcluded };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {
      console.error("Failed to update excluded categories:", error);
      setExcludedCategories(excludedCategories); 
    }
  };

  const isOverBudget = limit > 0 && currentExpenses > limit;
  const progressPercentage = limit > 0 ? Math.min((currentExpenses / limit) * 100, 100) : 0;
  const savedAmount = limit > 0 && !isOverBudget ? limit - currentExpenses : 0;
  const overspentAmount = isOverBudget ? currentExpenses - limit : 0;
  const currency = getCurrency();

  const pieChartData = availableCategories.map(category => {
    const amount = budgetTransactions
      .filter(tx => tx.type === 'debit' && tx.category === category)
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { name: category, value: amount, excluded: excludedCategories.includes(category) };
  }).filter(item => item.value > 0).sort((a, b) => b.value - a.value);

  const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#F97316', '#64748B'];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '0.75rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-primary)' }}>{data.name} {data.excluded ? '(Excluded)' : ''}</p>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{currency}{data.value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  const getTitle = () => {
    switch (timeframe) {
      case 'daily': return 'Daily Budget';
      case 'weekly': return 'Weekly Budget';
      case 'yearly': return 'Yearly Budget';
      case 'monthly':
      default: return 'Monthly Budget';
    }
  };

  const getSubtitle = () => {
    switch (timeframe) {
      case 'daily': return "Track your spending limit for today";
      case 'weekly': return "Track your spending limit for this week";
      case 'yearly': return "Track your spending limit for this year";
      case 'monthly':
      default: return "Track your spending limit for this month";
    }
  };

  return (
    <div className="budget-view animate-fade-in">
      <div className="data-card glass" style={{ padding: '2.5rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: isOverBudget ? 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
                  <Target className="text-accent-primary" size={28} />
                  {getTitle()}
                </h2>
                
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: 'var(--input-bg)' }}
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <p style={{ color: 'var(--text-secondary)' }}>{getSubtitle()}</p>
            </div>

            {limit > 0 && (
              <div style={{ background: 'var(--empty-state-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--card-border)', minWidth: '200px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'capitalize' }}>{timeframe} Limit</div>
                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>{currency}</span>
                    <input
                      type="number"
                      value={tempLimit || ''}
                      onChange={(e) => setTempLimit(Number(e.target.value))}
                      className="form-control"
                      style={{ padding: '0.25rem 0.5rem', width: '100px', fontSize: '1.25rem', fontWeight: '600' }}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveLimit()}
                    />
                    <button onClick={handleSaveLimit} disabled={loading} className="action-btn text-success" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                      <Check size={18} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {currency}{(limit || 0).toLocaleString()}
                    </div>
                    <button onClick={() => setIsEditing(true)} className="action-btn text-accent-primary" style={{ padding: '0.4rem' }}>
                      <Edit2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {loadingTx ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
              Loading budget data...
            </div>
          ) : limit === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 2rem' }}>
              <Target size={48} className="text-accent-primary" style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem', textTransform: 'capitalize' }}>Set your {timeframe} limit</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', textAlign: 'center', marginBottom: '1.5rem' }}>
                Setting a budget limit helps you track how much you are saving and warns you if you overspend.
              </p>

              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--accent-primary)', margin: '0 auto', width: 'max-content' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>{currency}</span>
                  <input
                    type="number"
                    value={tempLimit || ''}
                    onChange={(e) => setTempLimit(Number(e.target.value))}
                    className="form-control"
                    style={{ padding: '0.5rem', width: '150px', fontSize: '1.5rem', fontWeight: '600', border: 'none', background: 'transparent', outline: 'none' }}
                    autoFocus
                    placeholder="e.g. 1000"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveLimit()}
                  />
                  <button onClick={handleSaveLimit} disabled={loading} className="btn btn-primary" style={{ padding: '0.5rem 1.5rem' }}>
                    Save
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsEditing(true)}
                  style={{ margin: '0 auto', display: 'block' }}
                >
                  Set Limit Now
                </button>
              )}
            </div>
          ) : (
            <div>
              
              <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--empty-state-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowFilters(!showFilters)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                    <Filter size={18} className="text-accent-primary" />
                    Negotiate Budget (Exclude Categories)
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {excludedCategories.length > 0 ? `${excludedCategories.length} excluded` : 'None excluded'}
                  </div>
                </div>
                
                {showFilters && (
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {availableCategories.length === 0 ? (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No expenses recorded.</span>
                    ) : (
                      availableCategories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => toggleExcludeCategory(cat)}
                          className={`badge ${excludedCategories.includes(cat) ? 'badge-danger' : 'badge-success'}`}
                          style={{ cursor: 'pointer', transition: 'all 0.2s ease', opacity: excludedCategories.includes(cat) ? 0.7 : 1, padding: '0.4rem 0.8rem', borderRadius: '100px', border: 'none' }}
                        >
                          {cat} {excludedCategories.includes(cat) ? '(Excluded)' : ''}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {excludedCategories.length > 0 && (
                  <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Excluded expenses ({currency}{(totalUnfilteredExpenses - currentExpenses).toLocaleString()}) are not counted towards your budget progress.
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontWeight: '600' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Current Budget Usage</span>
                  <span style={{ color: isOverBudget ? 'var(--danger)' : 'var(--text-primary)' }}>
                    {currency}{currentExpenses.toLocaleString()} <span style={{ color: 'var(--text-secondary)', fontWeight: '400', fontSize: '0.9em' }}>/ {currency}{(limit || 0).toLocaleString()}</span>
                  </span>
                </div>

                <div style={{ width: '100%', height: '24px', background: 'var(--empty-state-bg)', borderRadius: '100px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progressPercentage}%`,
                      background: isOverBudget ? 'var(--danger)' : 'var(--success)',
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease',
                      borderRadius: '100px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <div style={{
                  background: isOverBudget ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                  border: `1px solid ${isOverBudget ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                  padding: '1.5rem',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '45px', height: '45px', borderRadius: '50%',
                    background: isOverBudget ? 'var(--danger)' : 'var(--success)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0,
                    boxShadow: `0 4px 15px ${isOverBudget ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    {isOverBudget ? <AlertCircle size={20} /> : <TrendingUp size={20} />}
                  </div>
                  <div>
                    <p style={{ color: isOverBudget ? 'var(--danger)' : 'var(--success)', fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {isOverBudget ? 'Overspent By' : `Saved This ${timeframe.charAt(0).toUpperCase() + timeframe.slice(1, -2)}`}
                    </p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                      {currency}{isOverBudget ? overspentAmount.toLocaleString() : savedAmount.toLocaleString()}
                    </h3>
                  </div>
                </div>
              </div>

              {pieChartData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                  
                  <div style={{ background: 'var(--empty-state-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-primary)', textAlign: 'center' }}>Expenses by Category</h3>
                    <div style={{ height: '250px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={entry.excluded ? 0.3 : 1} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                      {pieChartData.map((entry, index) => (
                        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[index % COLORS.length], opacity: entry.excluded ? 0.3 : 1 }} />
                          {entry.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: 'var(--empty-state-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--text-primary)', textAlign: 'center' }}>Budget Overview</h3>
                    <div style={{ height: '250px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Budget', Budget: limit, fill: 'var(--accent-primary)' },
                            { name: 'Used', Used: currentExpenses, fill: isOverBudget ? 'var(--danger)' : 'var(--success)' },
                            ...(totalUnfilteredExpenses > currentExpenses ? [{ name: 'Excluded', Excluded: totalUnfilteredExpenses - currentExpenses, fill: '#64748B' }] : [])
                          ]}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} style={{ fill: 'var(--text-secondary)', fontSize: '0.85rem' }} width={70} />
                          <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '8px' }} />
                          <Bar dataKey="Budget" radius={[0, 4, 4, 0]} barSize={24} />
                          <Bar dataKey="Used" radius={[0, 4, 4, 0]} barSize={24} />
                          {totalUnfilteredExpenses > currentExpenses && (
                             <Bar dataKey="Excluded" radius={[0, 4, 4, 0]} barSize={24} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetView;
