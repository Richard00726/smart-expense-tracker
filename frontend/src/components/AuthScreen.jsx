import React, { useState } from 'react';
import { loginUser, registerUser, sendOTP, forgotPassword, resetPassword } from '../services/api';
import { Mail, Eye, EyeOff, Zap, BarChart2, ShieldCheck, ArrowRight, ArrowLeft, User, KeyRound } from 'lucide-react';
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

  // Show animated splash first
  if (showSplash) {
    return <IntroSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <div className="split-auth-container">
      
      {/* ====================================================================
          LEFT SIDE: Brand Showcase & Value Proposition (Exact match to reference)
          ==================================================================== */}
      <div className="split-auth-left">
        
        {/* Ambient mint glow blobs */}
        <div className="split-mint-blob blob-1" />
        <div className="split-mint-blob blob-2" />
        <div className="split-mint-blob blob-3" />

        {/* Top Left Brand Logo */}
        <div 
          className="split-logo-wrapper"
          onClick={() => setShowSplash(true)}
          title="Click to replay animation"
          style={{ cursor: 'pointer' }}
        >
          <h2 className="split-logo-title">Smart Expense</h2>
          <div className="split-logo-swoosh">
            <svg viewBox="0 0 460 48" fill="none" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              <path d="M 12 22 C 145 42, 315 42, 438 12" stroke="#00d68f" strokeWidth="5.5" strokeLinecap="round" />
              <circle cx="441" cy="11" r="6.5" fill="#00d68f" />
            </svg>
          </div>
          <div className="split-logo-tracker">
            <span>T</span><span>R</span><span>A</span><span>C</span><span>K</span><span>E</span><span>R</span>
          </div>
        </div>

        {/* Center Hero Proposition */}
        <div className="split-hero-content">
          <h1 className="split-hero-headline">
            Know where every rupee goes, automatically.
          </h1>
          <p className="split-hero-subtitle">
            The unified expense manager that brings your Cash wallet and Bank statement sync together.
          </p>

          {/* 3 Frosted Feature Cards */}
          <div className="split-feature-stack">
            
            {/* Card 1: Live Bank Sync */}
            <div className="split-feature-card">
              <div className="split-feature-icon-box">
                <Zap size={22} strokeWidth={2.2} />
              </div>
              <div className="split-feature-text">
                <strong>Live Bank Sync</strong> <span>— Automated TMB daily statement reconciliation</span>
              </div>
            </div>

            {/* Card 2: Smart Analytics */}
            <div className="split-feature-card">
              <div className="split-feature-icon-box">
                <BarChart2 size={22} strokeWidth={2.2} />
              </div>
              <div className="split-feature-text">
                <strong>Smart Analytics</strong> <span>— Real-time cash flow & spending breakdown</span>
              </div>
            </div>

            {/* Card 3: Bank-grade Encryption */}
            <div className="split-feature-card">
              <div className="split-feature-icon-box">
                <ShieldCheck size={22} strokeWidth={2.2} />
              </div>
              <div className="split-feature-text">
                <strong>Bank-grade 256-bit Encryption</strong> <span>& Local Privacy</span>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Left Footer */}
        <div className="split-left-footer">
          Smart Expense Tracker • Next-Gen Automated Finance
        </div>

      </div>

      {/* ====================================================================
          RIGHT SIDE: Clean Authentication Form (Exact match to reference)
          ==================================================================== */}
      <div className="split-auth-right">
        
        {/* Soft mint glow reflected on right side */}
        <div className="blob-right-1" />
        <div className="blob-right-2" />
        
        <div className="split-form-card">
          
          {/* Header */}
          <div className="split-form-header">
            <h2 className="split-form-title">
              {isForgotPassword 
                ? 'Reset Password' 
                : (isLogin ? 'Welcome back' : 'Create an account')}
            </h2>
            <p className="split-form-desc">
              {isForgotPassword 
                ? 'Enter your email to receive a recovery code' 
                : (isLogin ? 'Sign in to access your dashboard' : 'Join Smart Expense Tracker in seconds')}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="split-alert split-alert-error">
              {error}
            </div>
          )}
          
          {successMsg && (
            <div className="split-alert split-alert-success">
              {successMsg}
            </div>
          )}

          {/* ---------------------------------------------------------------
              1. LOGIN FORM (Matches Reference Image)
              --------------------------------------------------------------- */}
          {isLogin && !isForgotPassword && (
            <form onSubmit={handleLogin} className="split-form">
              
              {/* Email Address */}
              <div className="split-input-group">
                <label className="split-label">Email Address</label>
                <div className="split-input-wrapper">
                  <span className="split-input-icon">
                    <Mail size={18} />
                  </span>
                  <input
                    type="email"
                    name="email"
                    className="split-input with-left-icon"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="split-input-group">
                <label className="split-label">Password</label>
                <div className="split-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="split-input with-right-icon"
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  {formData.password.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="split-input-eye-btn"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Options Row: Remember Me & Forgot Password */}
              <div className="split-options-row">
                <label className="split-checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="split-checkbox" 
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
                  className="split-forgot-link"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="split-submit-btn"
                disabled={loading}
              >
                <span>{loading ? 'Signing In...' : 'Sign In'}</span>
                <ArrowRight size={18} />
              </button>

            </form>
          )}

          {/* ---------------------------------------------------------------
              2. FORGOT PASSWORD FLOW
              --------------------------------------------------------------- */}
          {isForgotPassword && (
            <form onSubmit={step === 1 ? handleForgotPasswordOTP : handleResetPassword} className="split-form">
              {step === 1 && (
                <>
                  <div className="split-input-group">
                    <label className="split-label">Registered Email</label>
                    <div className="split-input-wrapper">
                      <span className="split-input-icon">
                        <Mail size={18} />
                      </span>
                      <input
                        type="email"
                        name="email"
                        className="split-input with-left-icon"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="split-input-group">
                    <label className="split-label">Human Check: What is {mathChallenge.num1} + {mathChallenge.num2}?</label>
                    <input
                      type="number"
                      className="split-input"
                      placeholder="Your answer"
                      value={mathChallenge.answer}
                      onChange={(e) => setMathChallenge({ ...mathChallenge, answer: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="split-submit-btn" disabled={loading}>
                    <span>{loading ? 'Sending Code...' : 'Send Recovery Code'}</span>
                    <ArrowRight size={18} />
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => { setIsForgotPassword(false); setError(''); setSuccessMsg(''); }}
                      className="split-forgot-link"
                    >
                      ← Back to Login
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                    <span>Sending code to: <strong>{formData.email}</strong></span>
                    <button 
                      type="button" 
                      onClick={() => { setStep(1); generateMathChallenge(); }}
                      className="split-forgot-link"
                    >
                      Change
                    </button>
                  </div>

                  <div className="split-input-group">
                    <label className="split-label">6-Digit Verification Code</label>
                    <input
                      type="text"
                      name="otp"
                      className="split-input"
                      placeholder="••••••"
                      maxLength={6}
                      value={formData.otp}
                      onChange={handleChange}
                      style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.25rem' }}
                      required
                    />
                  </div>

                  <div className="split-input-group">
                    <label className="split-label">New Password</label>
                    <input
                      type="password"
                      name="password"
                      className="split-input"
                      placeholder="At least 6 characters"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="split-input-group">
                    <label className="split-label">Confirm New Password</label>
                    <input
                      type="password"
                      className="split-input"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  <button type="submit" className="split-submit-btn" disabled={loading}>
                    <span>{loading ? 'Updating...' : 'Reset Password'}</span>
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
            </form>
          )}

          {/* ---------------------------------------------------------------
              3. REGISTRATION FLOW
              --------------------------------------------------------------- */}
          {!isLogin && !isForgotPassword && (
            <form onSubmit={step === 1 ? handleSendOTP : handleRegister} className="split-form">
              
              {step === 1 && (
                <>
                  <div className="split-input-group">
                    <label className="split-label">Your Name</label>
                    <div className="split-input-wrapper">
                      <span className="split-input-icon">
                        <User size={18} />
                      </span>
                      <input
                        type="text"
                        name="username"
                        className="split-input with-left-icon"
                        placeholder="John Doe"
                        value={formData.username}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="split-input-group">
                    <label className="split-label">Email Address</label>
                    <div className="split-input-wrapper">
                      <span className="split-input-icon">
                        <Mail size={18} />
                      </span>
                      <input
                        type="email"
                        name="email"
                        className="split-input with-left-icon"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <button type="submit" className="split-submit-btn" disabled={loading}>
                    <span>{loading ? 'Sending Code...' : 'Continue'}</span>
                    <ArrowRight size={18} />
                  </button>
                </>
              )}

              {step === 2 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                    <span>Code sent to: <strong>{formData.email}</strong></span>
                    <button 
                      type="button" 
                      onClick={() => setStep(1)}
                      className="split-forgot-link"
                    >
                      Change
                    </button>
                  </div>

                  <div className="split-input-group">
                    <label className="split-label">6-Digit Verification Code</label>
                    <input
                      type="text"
                      name="otp"
                      className="split-input"
                      placeholder="••••••"
                      maxLength={6}
                      value={formData.otp}
                      onChange={handleChange}
                      style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.25rem' }}
                      required
                    />
                  </div>

                  <div className="split-input-group">
                    <label className="split-label">Create a Strong Password</label>
                    <div className="split-input-wrapper">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        className="split-input with-right-icon"
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
                          className="split-input-eye-btn"
                          aria-label="Toggle password visibility"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <button type="submit" className="split-submit-btn" disabled={loading}>
                    <span>{loading ? 'Creating...' : 'Create Account'}</span>
                    <ArrowRight size={18} />
                  </button>
                </>
              )}

            </form>
          )}

          {/* Switch Mode Footer (Matches "Don't have an account? Create an account") */}
          <div className="split-footer">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button
              type="button"
              onClick={resetForm}
              className="split-switch-btn"
            >
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};

export default AuthScreen;
