import React, { useState } from 'react';
import { loginUser, registerUser, sendOTP, forgotPassword, resetPassword } from '../services/api';
import { Wallet, LogIn, UserPlus, Mail, ArrowRight, ArrowLeft, Building2, Eye, EyeOff } from 'lucide-react';

const AuthScreen = ({ onAuthSuccess }) => {
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

  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1rem',
      background: 'radial-gradient(circle at 50% 0%, #1a365d 0%, #0f172a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-5%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
      
      <div className="data-card glass animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', position: 'relative', zIndex: 1, borderRadius: '24px', border: '1px solid var(--card-border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>
            <Building2 size={56} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', letterSpacing: '-0.5px' }}>Smart Expense Tracker</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', fontSize: '0.95rem' }}>
            {isForgotPassword ? 'Reset your password' : (isLogin ? 'Securely access your accounts' : 'Open a new digital account')}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}
        
        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
            {successMsg}
          </div>
        )}

        {/* LOGIN FORM */}
        {isLogin && !isForgotPassword && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="form-control"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  style={{ paddingRight: formData.password ? '2.5rem' : '1rem' }}
                />
                {formData.password.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.2s'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => { setIsForgotPassword(true); setStep(1); generateMathChallenge(); setError(''); setSuccessMsg(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                  Forgot Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
              disabled={loading}
            >
              <LogIn size={20} />
              {loading ? 'Processing...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {isForgotPassword && (
          <form onSubmit={step === 1 ? handleForgotPasswordOTP : handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {step === 1 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    className="form-control"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Verify you are human: What is {mathChallenge.num1} + {mathChallenge.num2}?</label>
                  <input
                    type="number"
                    className="form-control"
                    value={mathChallenge.answer}
                    onChange={(e) => setMathChallenge({ ...mathChallenge, answer: e.target.value })}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                  disabled={loading}
                >
                  <Mail size={20} />
                  {loading ? 'Sending Code...' : 'Send Reset Code'}
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Sending to: <strong>{formData.email}</strong>
                  </span>
                  <button 
                    type="button"
                    onClick={() => { setStep(1); setError(''); setSuccessMsg(''); generateMathChallenge(); }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Verification Code</label>
                  <input
                    type="text"
                    name="otp"
                    className="form-control"
                    value={formData.otp}
                    onChange={handleChange}
                    required
                    maxLength={6}
                    style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '1.2rem' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      className="form-control"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                      style={{ paddingRight: formData.password ? '2.5rem' : '1rem' }}
                    />
                    {formData.password.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.2s'
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      style={{ paddingRight: confirmPassword ? '2.5rem' : '1rem' }}
                    />
                    {confirmPassword.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.2s'
                        }}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                  disabled={loading}
                >
                  <LogIn size={20} />
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            )}
          </form>
        )}

        {/* REGISTRATION FORM */}
        {!isLogin && !isForgotPassword && (
          <form onSubmit={step === 1 ? handleSendOTP : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Step 1: User details */}
            {step === 1 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    name="username"
                    className="form-control"
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    className="form-control"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                  disabled={loading}
                >
                  <Mail size={20} />
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </div>
            )}

            {/* Step 2: Verification and Password */}
            {step === 2 && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Sending to: <strong>{formData.email}</strong>
                  </span>
                  <button 
                    type="button"
                    onClick={() => { setStep(1); setError(''); setSuccessMsg(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <ArrowLeft size={14} /> Change Email
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Verification Code</label>
                  <input
                    type="text"
                    name="otp"
                    className="form-control"
                    value={formData.otp}
                    onChange={handleChange}
                    required
                    maxLength={6}
                    style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '1.2rem' }}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Create a Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      className="form-control"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={6}
                      style={{ paddingRight: formData.password ? '2.5rem' : '1rem' }}
                    />
                    {formData.password.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.2s'
                        }}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                  disabled={loading}
                >
                  <UserPlus size={20} />
                  {loading ? 'Verifying...' : 'Create Account'}
                </button>
              </div>
            )}

          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={resetForm}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontWeight: '500',
                cursor: 'pointer',
                padding: 0,
                fontSize: '0.9rem'
              }}
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
};

export default AuthScreen;
