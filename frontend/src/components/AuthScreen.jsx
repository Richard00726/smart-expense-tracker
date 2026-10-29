import React, { useState } from 'react';
import { loginUser, registerUser, sendOTP, forgotPassword, resetPassword } from '../services/api';
import { LogIn, UserPlus, Mail, ArrowLeft, Eye, EyeOff, Zap, PieChart, ShieldCheck } from 'lucide-react';
import IntroSplash from './IntroSplash';
import './AuthScreen.css';

const AuthScreen = ({ onAuthSuccess }) => {
  const [showSplash, setShowSplash] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1); // 1: Email/Username, 2: OTP/Password
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    otp: '',
  });
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mathChallenge, setMathChallenge] = useState({ num1: 5, num2: 3, answer: '' });
  const [rememberMe, setRememberMe] = useState(true);

  const generateMathChallenge = () => {
    setMathChallenge({
      num1: Math.floor(Math.random() * 10) + 1,
      num2: Math.floor(Math.random() * 10) + 1,
      answer: ''
    });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { data } = await sendOTP({ email: formData.email });
      setSuccessMsg(data.message || 'Verification code sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await loginUser({
        email: formData.email,
        password: formData.password,
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      window.dispatchEvent(new Event('user_updated'));
      onAuthSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await registerUser(formData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      window.dispatchEvent(new Event('user_updated'));
      onAuthSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordOTP = async (e) => {
    e.preventDefault();
    if (parseInt(mathChallenge.answer, 10) !== mathChallenge.num1 + mathChallenge.num2) {
      setError('Incorrect math answer. Please verify you are human.');
      generateMathChallenge();
      return;
    }
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { data } = await forgotPassword({ email: formData.email });
      setSuccessMsg(data.message || 'Verification code sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (formData.password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    setError('');
    setLoading(true);

    try {
      const { data } = await resetPassword({
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.password
      });
      setSuccessMsg(data.message || 'Password reset successful! Please log in.');
      setIsForgotPassword(false);
      setStep(1);
      setFormData({ ...formData, password: '', otp: '' });
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setIsLogin(!isLogin);
    setStep(1);
    setError('');
    setSuccessMsg('');
    setFormData({ username: '', email: '', password: '', otp: '' });
    setShowPassword(false);
    setIsForgotPassword(false);
    setConfirmPassword('');
  };

  if (showSplash) {
    return <IntroSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className="auth-split-fullscreen">
      
      {/* ==========================================================================
          LEFT SIDE: Brand Showcase & Content
          ========================================================================== */}
      <div className="auth-split-left">
        
        {/* Top Brand Logo */}
        <div className="auth-left-brand">
          <h2 className="auth-left-logo-text">Smart Expense</h2>
          <div className="auth-left-swoosh">
            <svg viewBox="0 0 460 48" fill="none" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              <path d="M 12 22 C 145 42, 315 42, 438 12" stroke="#00d68f" strokeWidth="5.5" strokeLinecap="round" />
              <circle cx="441" cy="11" r="6.5" fill="#00d68f" />
            </svg>
          </div>
          <div className="auth-left-tracker-text">
            <span>T</span><span>R</span><span>A</span><span>C</span><span>K</span><span>E</span><span>R</span>
          </div>
        </div>

        {/* Hero Copy & Value Propositions */}
        <div className="auth-left-content">
          <h1 className="auth-left-headline">
            Know where every rupee goes, <span>automatically.</span>
          </h1>
          <p className="auth-left-subtext">
            The unified expense manager that brings your manual cash wallet and automated bank sync together in real time.
          </p>

          <div className="auth-feature-list">
            
            {/* Feature 1: Bank Instance Sync (no specific bank named) */}
            <div className="auth-feature-card">
              <div className="auth-feature-icon">
                <Zap size={22} />
              </div>
              <div className="auth-feature-text">
                <h4>Smart Bank Sync</h4>
                <p>Automated daily statement reconciliation directly from your connected bank emails.</p>
              </div>
            </div>

            {/* Feature 2: Smart Analytics */}
            <div className="auth-feature-card">
              <div className="auth-feature-icon">
                <PieChart size={22} />
              </div>
              <div className="auth-feature-text">
                <h4>Cash Flow & Visual Analytics</h4>
                <p>Visual category spending breakdowns and real-time cash vs digital tracking.</p>
              </div>
            </div>

            {/* Feature 3: Privacy & Security (Changed from bank-grade as requested) */}
            <div className="auth-feature-card">
              <div className="auth-feature-icon">
                <ShieldCheck size={22} />
              </div>
              <div className="auth-feature-text">
                <h4>100% Private & Encrypted</h4>
                <p>Your financial records stay secure, confidential, and completely under your control.</p>
              </div>
            </div>

          </div>
        </div>

        {/* Left Footer Guarantee */}
        <div className="auth-left-footer">
          <span>🔒 Privacy-first architecture · Local data ownership · Zero third-party tracking</span>
        </div>

      </div>

      {/* ==========================================================================
          RIGHT SIDE: Clean Minimal White Auth Form
          ========================================================================== */}
      <div className="auth-split-right">
        <div className="auth-form-card">
          
          {/* Mobile-Only Brand Header */}
          <div className="auth-mobile-brand-header">
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.03em', margin: 0, color: '#0f172a' }}>
              Smart Expense
            </h2>
            <div style={{ width: '180px', marginTop: '0.2rem', marginBottom: '0.4rem' }}>
              <svg viewBox="0 0 460 48" fill="none" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                <path d="M 12 22 C 145 42, 315 42, 438 12" stroke="#00d68f" strokeWidth="5.5" strokeLinecap="round" />
                <circle cx="441" cy="11" r="6.5" fill="#00d68f" />
              </svg>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.45em', color: '#64748b' }}>
              <span>T</span><span>R</span><span>A</span><span>C</span><span>K</span><span>E</span><span>R</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="auth-form-header">
            <h3 className="auth-form-title">
              {isForgotPassword 
                ? 'Reset Password' 
                : (isLogin ? 'Welcome back' : 'Create an account')}
            </h3>
            <p className="auth-form-subtitle">
              {isForgotPassword 
                ? 'Enter your email to receive a verification code' 
                : (isLogin ? 'Sign in to access your financial dashboard' : 'Join Smart Expense Tracker in a few clicks')}
            </p>
          </div>

          {/* Alerts */}
          {error && <div className="auth-alert-error">{error}</div>}
          {successMsg && <div className="auth-alert-success">{successMsg}</div>}

          {/* 1. LOGIN FORM */}
          {isLogin && !isForgotPassword && (
            <form onSubmit={handleLogin}>
              <div className="auth-input-group">
                <label className="auth-input-label">Email Address</label>
                <div className="auth-input-wrapper">
                  <input
                    type="email"
                    name="email"
                    className="auth-input"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label className="auth-input-label">Password</label>
                <div className="auth-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="auth-input"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    style={{ paddingRight: '2.5rem' }}
                  />
                  {formData.password.length > 0 && (
                    <button
                      type="button"
                      className="auth-input-eye-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="auth-actions-bar">
                <label className="auth-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)} 
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setStep(1);
                    generateMathChallenge();
                    setError('');
                    setSuccessMsg('');
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                <LogIn size={18} />
                <span>{loading ? 'Signing In...' : 'Sign In →'}</span>
              </button>
            </form>
          )}

          {/* 2. FORGOT PASSWORD FORM */}
          {isForgotPassword && (
            <form onSubmit={step === 1 ? handleForgotPasswordOTP : handleResetPassword}>
              {step === 1 && (
                <div>
                  <div className="auth-input-group">
                    <label className="auth-input-label">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      className="auth-input"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-input-label">Human Check: What is {mathChallenge.num1} + {mathChallenge.num2}?</label>
                    <input
                      type="number"
                      className="auth-input"
                      placeholder="Answer"
                      value={mathChallenge.answer}
                      onChange={(e) => setMathChallenge({ ...mathChallenge, answer: e.target.value })}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    <Mail size={18} />
                    <span>{loading ? 'Sending Code...' : 'Send Reset Code'}</span>
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
                    >
                      ← Back to Login
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      Sent to: <strong>{formData.email}</strong>
                    </span>
                    <button 
                      type="button"
                      onClick={() => { setStep(1); setError(''); setSuccessMsg(''); generateMathChallenge(); }}
                      className="auth-forgot-link"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-input-label">Verification Code (OTP)</label>
                    <input
                      type="text"
                      name="otp"
                      className="auth-input"
                      placeholder="000000"
                      value={formData.otp}
                      onChange={handleChange}
                      required
                      maxLength={6}
                      style={{ letterSpacing: '0.25em', textAlign: 'center', fontSize: '1.25rem', fontWeight: '700' }}
                    />
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-input-label">New Password</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      className="auth-input"
                      placeholder="Minimum 6 characters"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-input-label">Confirm New Password</label>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="auth-input"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    <span>{loading ? 'Resetting...' : 'Reset Password & Log In'}</span>
                  </button>
                </div>
              )}
            </form>
          )}

          {/* 3. REGISTRATION FORM */}
          {!isLogin && !isForgotPassword && (
            <form onSubmit={step === 1 ? handleSendOTP : handleRegister}>
              {step === 1 && (
                <div>
                  <div className="auth-input-group">
                    <label className="auth-input-label">Full Name / Username</label>
                    <input
                      type="text"
                      name="username"
                      className="auth-input"
                      placeholder="e.g. John Doe"
                      value={formData.username}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-input-label">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      className="auth-input"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    <Mail size={18} />
                    <span>{loading ? 'Sending Code...' : 'Send Verification Code'}</span>
                  </button>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      Sending to: <strong>{formData.email}</strong>
                    </span>
                    <button 
                      type="button"
                      onClick={() => { setStep(1); setError(''); setSuccessMsg(''); }}
                      className="auth-forgot-link"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <ArrowLeft size={14} /> Change Email
                    </button>
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-input-label">Verification Code (OTP)</label>
                    <input
                      type="text"
                      name="otp"
                      className="auth-input"
                      placeholder="000000"
                      value={formData.otp}
                      onChange={handleChange}
                      required
                      maxLength={6}
                      style={{ letterSpacing: '0.25em', textAlign: 'center', fontSize: '1.25rem', fontWeight: '700' }}
                    />
                  </div>

                  <div className="auth-input-group">
                    <label className="auth-input-label">Create a Password</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      className="auth-input"
                      placeholder="Minimum 6 characters"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                    />
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    disabled={loading}
                  >
                    <UserPlus size={18} />
                    <span>{loading ? 'Verifying...' : 'Create Account'}</span>
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Bottom Switcher */}
          <div className="auth-switch-prompt">
            <span>{isLogin ? "Don't have an account?" : "Already have an account?"}</span>
            <button
              type="button"
              className="auth-switch-btn"
              onClick={resetForm}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};

export default AuthScreen;
