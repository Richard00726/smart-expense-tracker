import React, { useState } from 'react';
import { loginUser, registerUser, sendOTP, forgotPassword, resetPassword } from '../services/api';
import { 
  Mail, Eye, EyeOff, ArrowRight, User, KeyRound, 
  Zap, BarChart2, Smartphone, Coins, Target, PieChart 
} from 'lucide-react';
import IntroSplash from './IntroSplash';
import './AuthScreen.css';

const AuthScreen = ({ onAuthSuccess }) => {
  const [showSplash, setShowSplash] = useState(true);
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1); // 1: Form details, 2: OTP / Password
  
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
  const [rememberMe, setRememberMe] = useState(true);
  const [mathChallenge, setMathChallenge] = useState({ num1: 5, num2: 3, answer: '' });

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
      setError(err.response?.data?.error || 'Authentication failed');
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
    if (parseInt(mathChallenge.answer) !== mathChallenge.num1 + mathChallenge.num2) {
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

  // Show animated splash first (1s intro)
  if (showSplash) {
    return <IntroSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className="split-page-wrapper">
      
      {/* ====================================================================
          LEFT PANEL (58%): Edge-to-Edge Constellation & Dotted Map Hub
          ==================================================================== */}
      <div className="split-left-panel">
        
        {/* Dotted World Map Grid */}
        <div className="map-pattern" />
        <div className="left-ambient-glow" />

        {/* Top Brand Logo (Clean In-Flow, Never Overlapping Tracker) */}
        <div 
          className="split-logo-block"
          onClick={() => setShowSplash(true)}
          title="Click to replay intro animation"
          style={{ cursor: 'pointer' }}
        >
          <h2 className="split-logo-title">Smart Expense</h2>
          <div className="split-logo-swoosh">
            <svg viewBox="0 0 460 48" fill="none" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              <path d="M 12 22 C 145 42, 315 42, 438 12" stroke="#00e5ff" strokeWidth="5.5" strokeLinecap="round" />
              <circle cx="441" cy="11" r="6.5" fill="#00e5ff" />
            </svg>
          </div>
          <div className="split-logo-tracker">
            <span>T</span><span>R</span><span>A</span><span>C</span><span>K</span><span>E</span><span>R</span>
          </div>
        </div>

        {/* Center Content Flow */}
        <div className="split-left-center-flow">

          {/* Hero Value Proposition: Clean headline without extra added sentences */}
          <div className="split-hero-block">
            <h1 className="split-hero-title">
              Know where every rupee goes, <span className="hero-cyan-accent">automatically.</span>
            </h1>
            <p className="split-hero-desc">
              The unified expense manager that brings your Cash wallet and Bank statement sync together.
            </p>
          </div>

          {/* ==================================================================
              CONSTELLATION ARCHITECTURE STAGE (100% Preserved)
              ================================================================== */}
          <div className="constellation-stage">
            
            {/* Ambient center radial glow */}
            <div className="hub-ambient" />

            {/* Geometry Lines, Rings & Ellipse (680 x 360 coordinate space) */}
            <svg className="constellation-svg" viewBox="0 0 680 360" fill="none">
              <defs>
                <linearGradient id="cyanLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
                </linearGradient>
                <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#00e5ff" floodOpacity="0.6" />
                </filter>
              </defs>

              {/* 1. Large Outer Faint Ellipse (Spanning 580px wide) */}
              <ellipse cx="340" cy="180" rx="290" ry="135" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="1.2" fill="none" />

              {/* 2. Mid Dashed Cyan Orbit Ring */}
              <circle cx="340" cy="180" r="76" stroke="#00e5ff" strokeWidth="1.4" strokeDasharray="5 7" className="orbit-cw" />

              {/* 3. Inner Solid Cyan Ring */}
              <circle cx="340" cy="180" r="64" stroke="#00e5ff" strokeWidth="1.6" filter="url(#glowCyan)" />

              {/* 4. Symmetrical Radiating Connecting Lines to the 6 Pills */}
              {/* Top Left -> Bank Sync */}
              <line x1="340" y1="180" x2="160" y2="63" stroke="url(#cyanLineGrad)" strokeWidth="1.6" className="flow-line-rev" />
              {/* Top Right -> Reconciliation */}
              <line x1="340" y1="180" x2="520" y2="63" stroke="url(#cyanLineGrad)" strokeWidth="1.6" className="flow-line" />
              {/* Middle Right -> UPI Payments */}
              <line x1="340" y1="180" x2="535" y2="180" stroke="url(#cyanLineGrad)" strokeWidth="1.6" className="flow-line" />
              {/* Bottom Right -> Cash Wallet */}
              <line x1="340" y1="180" x2="520" y2="297" stroke="url(#cyanLineGrad)" strokeWidth="1.6" className="flow-line-rev" />
              {/* Bottom Left -> Budget Goals */}
              <line x1="340" y1="180" x2="160" y2="297" stroke="url(#cyanLineGrad)" strokeWidth="1.6" className="flow-line" />
              {/* Middle Left -> Spend Insights */}
              <line x1="340" y1="180" x2="145" y2="180" stroke="url(#cyanLineGrad)" strokeWidth="1.6" className="flow-line-rev" />
            </svg>

            {/* Central Circular Hub with Space in "Smart Expense" (Prominent 110px Diameter) */}
            <div className="hub-center-container">
              <div className="hub-center-circle">
                <span className="hub-center-title">Smart Expense</span>
                <span className="hub-center-subtitle">TRACKER</span>
              </div>
            </div>

            {/* 6 Connected Feature Pills */}
            {/* 1. Top Left: Bank Sync */}
            <div className="stage-pill pill-pos-1 bob-1">
              <div className="pill-content">
                <Zap size={14} color="#00e5ff" strokeWidth={2.4} />
                <span className="pill-text">Bank Sync</span>
              </div>
            </div>

            {/* 2. Top Right: Reconciliation */}
            <div className="stage-pill pill-pos-2 bob-2">
              <div className="pill-content">
                <BarChart2 size={14} color="#00e5ff" strokeWidth={2.4} />
                <span className="pill-text">Reconciliation</span>
              </div>
            </div>

            {/* 3. Middle Right: UPI Payments */}
            <div className="stage-pill pill-pos-3 bob-3">
              <div className="pill-content">
                <Smartphone size={14} color="#00e5ff" strokeWidth={2.4} />
                <span className="pill-text">UPI Payments</span>
              </div>
            </div>

            {/* 4. Bottom Right: Cash Wallet */}
            <div className="stage-pill pill-pos-4 bob-4">
              <div className="pill-content">
                <Coins size={14} color="#00e5ff" strokeWidth={2.4} />
                <span className="pill-text">Cash Wallet</span>
              </div>
            </div>

            {/* 5. Bottom Left: Budget Goals */}
            <div className="stage-pill pill-pos-5 bob-5">
              <div className="pill-content">
                <Target size={14} color="#00e5ff" strokeWidth={2.4} />
                <span className="pill-text">Budget Goals</span>
              </div>
            </div>

            {/* 6. Middle Left: Spend Insights */}
            <div className="stage-pill pill-pos-6 bob-6">
              <div className="pill-content">
                <PieChart size={14} color="#00e5ff" strokeWidth={2.4} />
                <span className="pill-text">Spend Insights</span>
              </div>
            </div>

          </div>

        </div>

        {/* Left Footer */}
        <div className="split-left-footer">
          Smart Expense Tracker • Next-Gen Automated Finance
        </div>

      </div>

      {/* ====================================================================
          RIGHT PANEL (42%): Pure White Full-Height Authentication Form
          ==================================================================== */}
      <div className="split-right-panel">
        
        <div className="split-form-inner">
          
          {/* Header */}
          <div className="auth-header-block">
            <h2 className="auth-header-title">
              {isForgotPassword 
                ? 'Reset Password' 
                : (isLogin ? 'Welcome back' : 'Create an account')}
            </h2>
            <p className="auth-header-subtitle">
              {isForgotPassword 
                ? 'Enter your email to receive a recovery code' 
                : (isLogin ? 'Sign in to continue to your account.' : 'Join Smart Expense Tracker in seconds.')}
            </p>
          </div>

          {/* Alert Notifications */}
          {error && (
            <div className="auth-alert auth-alert-error">
              {error}
            </div>
          )}
          
          {successMsg && (
            <div className="auth-alert auth-alert-success">
              {successMsg}
            </div>
          )}

          {/* -------------------------------------------------------------
              1. LOGIN FORM
              ------------------------------------------------------------- */}
          {isLogin && !isForgotPassword && (
            <form onSubmit={handleLogin} className="auth-form">
              
              {/* Email Address */}
              <div className="auth-field-group">
                <label className="auth-field-label">Email or mobile number</label>
                <div className="auth-input-container">
                  <span className="auth-input-icon">
                    <Mail size={20} />
                  </span>
                  <input
                    type="email"
                    name="email"
                    className="auth-input has-left-icon"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field-group">
                <label className="auth-field-label">Password</label>
                <div className="auth-input-container">
                  <span className="auth-input-icon">
                    <KeyRound size={20} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="auth-input has-left-icon has-right-icon"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  {formData.password.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="auth-eye-btn"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Options: Remember Me & Forgot Password */}
              <div className="auth-options-row">
                <label className="auth-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="auth-checkbox" 
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setStep(1);
                    generateMathChallenge();
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="auth-link-btn"
                >
                  Forgot password?
                </button>
              </div>

              {/* Gradient Submit Button */}
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={loading}
              >
                <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                <ArrowRight size={19} strokeWidth={2.5} />
              </button>

            </form>
          )}

          {/* -------------------------------------------------------------
              2. FORGOT PASSWORD FLOW
              ------------------------------------------------------------- */}
          {isForgotPassword && (
            <form onSubmit={step === 1 ? handleForgotPasswordOTP : handleResetPassword} className="auth-form">
              {step === 1 && (
                <>
                  <div className="auth-field-group">
                    <label className="auth-field-label">Registered Email</label>
                    <div className="auth-input-container">
                      <span className="auth-input-icon">
                        <Mail size={20} />
                      </span>
                      <input
                        type="email"
                        name="email"
                        className="auth-input has-left-icon"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-field-label">
                      Human Check: What is {mathChallenge.num1} + {mathChallenge.num2}?
                    </label>
                    <input
                      type="number"
                      className="auth-input"
                      placeholder="Your answer"
                      value={mathChallenge.answer}
                      onChange={(e) => setMathChallenge({ ...mathChallenge, answer: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    <span>{loading ? 'Sending Code...' : 'Send Recovery Code'}</span>
                    <ArrowRight size={19} strokeWidth={2.5} />
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '0.4rem' }}>
                    <button 
                      type="button" 
                      onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
                      className="auth-link-btn"
                    >
                      ← Back to Sign in
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', color: '#64748b' }}>
                    <span>Sending code to: <strong>{formData.email}</strong></span>
                    <button 
                      type="button" 
                      onClick={() => { setStep(1); generateMathChallenge(); }}
                      className="auth-link-btn"
                    >
                      Change
                    </button>
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-field-label">6-Digit Verification Code</label>
                    <input
                      type="text"
                      name="otp"
                      className="auth-input"
                      placeholder="••••••"
                      maxLength={6}
                      value={formData.otp}
                      onChange={handleChange}
                      style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.35rem', fontWeight: 'bold' }}
                      required
                    />
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-field-label">New Password</label>
                    <input
                      type="password"
                      name="password"
                      className="auth-input"
                      placeholder="At least 6 characters"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-field-label">Confirm New Password</label>
                    <input
                      type="password"
                      className="auth-input"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    <span>{loading ? 'Updating...' : 'Reset Password'}</span>
                    <ArrowRight size={19} strokeWidth={2.5} />
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '0.4rem' }}>
                    <button 
                      type="button" 
                      onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
                      className="auth-link-btn"
                    >
                      ← Back to Sign in
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* -------------------------------------------------------------
              3. REGISTRATION FLOW
              ------------------------------------------------------------- */}
          {!isLogin && !isForgotPassword && (
            <form onSubmit={step === 1 ? handleSendOTP : handleRegister} className="auth-form">
              
              {step === 1 && (
                <>
                  <div className="auth-field-group">
                    <label className="auth-field-label">Your Name</label>
                    <div className="auth-input-container">
                      <span className="auth-input-icon">
                        <User size={20} />
                      </span>
                      <input
                        type="text"
                        name="username"
                        className="auth-input has-left-icon"
                        placeholder="John Doe"
                        value={formData.username}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-field-label">Email Address</label>
                    <div className="auth-input-container">
                      <span className="auth-input-icon">
                        <Mail size={20} />
                      </span>
                      <input
                        type="email"
                        name="email"
                        className="auth-input has-left-icon"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    <span>{loading ? 'Sending Code...' : 'Continue'}</span>
                    <ArrowRight size={19} strokeWidth={2.5} />
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', color: '#64748b' }}>
                    <span>Code sent to: <strong>{formData.email}</strong></span>
                    <button 
                      type="button" 
                      onClick={() => setStep(1)}
                      className="auth-link-btn"
                    >
                      Change
                    </button>
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-field-label">6-Digit Verification Code</label>
                    <input
                      type="text"
                      name="otp"
                      className="auth-input"
                      placeholder="••••••"
                      maxLength={6}
                      value={formData.otp}
                      onChange={handleChange}
                      style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.35rem', fontWeight: 'bold' }}
                      required
                    />
                  </div>

                  <div className="auth-field-group">
                    <label className="auth-field-label">Create a Strong Password</label>
                    <div className="auth-input-container">
                      <span className="auth-input-icon">
                        <KeyRound size={20} />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        className="auth-input has-left-icon has-right-icon"
                        placeholder="At least 6 characters"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={6}
                      />
                      {formData.password.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="auth-eye-btn"
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <button type="submit" className="auth-submit-btn" disabled={loading}>
                    <span>{loading ? 'Creating...' : 'Create Account'}</span>
                    <ArrowRight size={19} strokeWidth={2.5} />
                  </button>
                </>
              )}

            </form>
          )}

          {/* Mode Switcher */}
          <div className="auth-footer">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={resetForm}
              className="auth-switch-btn"
            >
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </div>

          {/* Copyright */}
          <div className="auth-copyright">
            © 2026 Smart Expense Tracker
          </div>

        </div>

      </div>

    </div>
  );
};

export default AuthScreen;
