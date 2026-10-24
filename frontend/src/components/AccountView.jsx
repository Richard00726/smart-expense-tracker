import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Lock, AlertTriangle, Save, Check, X, Sun, Moon, Trash2, ArrowLeft, ChevronRight, Smartphone, RefreshCw, ShieldCheck } from 'lucide-react';
import { getUser, updateProfile, changePassword, deleteAccount, deleteBankSyncConfig } from '../services/api';
import profileIllustration from '../assets/profile_illustration.jpg';
import preferencesIllustration from '../assets/preferences_illustration.jpg';
import securityIllustration from '../assets/security_illustration.jpg';
import dangerIllustration from '../assets/danger_illustration.jpg';

const ToggleSwitch = ({ checked, onChange }) => (
  <div 
    onClick={() => onChange(!checked)}
    style={{
      width: '44px', height: '24px', borderRadius: '12px',
      background: checked ? 'var(--accent-primary)' : 'var(--card-border)',
      position: 'relative', cursor: 'pointer', transition: 'background 0.3s'
    }}
  >
    <div style={{
      width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
      position: 'absolute', top: '2px', left: checked ? '22px' : '2px',
      transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }} />
  </div>
);

const AccountView = ({ theme, toggleTheme, onLogout }) => {
  const [activeSetting, setActiveSetting] = useState(null);
  const [profile, setProfile] = useState({ username: '', email: '', currency: '₹', createdAt: '', profileImage: '' });
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [toast, setToast] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteSyncConfirm, setShowDeleteSyncConfirm] = useState(false);
  const [deletingSync, setDeletingSync] = useState(false);
  
  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('privacyMode') === 'true');
  const [emailNotifs, setEmailNotifs] = useState(true);

  const handleTogglePrivacy = (val) => {
    setPrivacyMode(val);
    localStorage.setItem('privacyMode', val);
    window.dispatchEvent(new Event('privacy_mode_changed'));
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await getUser();
      setProfile({
        username: res.data.username,
        email: res.data.email,
        currency: res.data.currency || '₹',
        createdAt: res.data.createdAt,
        profileImage: res.data.profileImage || ''
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await updateProfile({ username: profile.username, currency: profile.currency, profileImage: profile.profileImage });
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const u = JSON.parse(userStr);
        u.username = res.data.username;
        u.currency = res.data.currency;
        u.profileImage = res.data.profileImage;
        localStorage.setItem('user', JSON.stringify(u));
        window.dispatchEvent(new Event('user_updated'));
      }
      showToast('Profile updated successfully');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update profile', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword({ 
        currentPassword: passwords.currentPassword, 
        newPassword: passwords.newPassword 
      });
      showToast('Password changed successfully');
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to change password', 'error');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      onLogout();
    } catch (err) {
      showToast('Failed to delete account', 'error');
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteSyncConfig = async () => {
    setDeletingSync(true);
    try {
      // Never delete transactions - keep all transaction history safe
      await deleteBankSyncConfig({ deleteTransactions: false });
      localStorage.removeItem('tmb_wizard_step');
      showToast('Bank sync configuration deleted successfully');
      setShowDeleteSyncConfirm(false);
      window.dispatchEvent(new Event('bank_sync_updated'));
      window.dispatchEvent(new Event('transactions_updated'));
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete bank sync configuration', 'error');
    } finally {
      setDeletingSync(false);
    }
  };

  if (loading) {
    return <div className="data-card glass"><div className="empty-state">Loading account details...</div></div>;
  }

  const renderBackButton = () => (
    <button 
      onClick={() => setActiveSetting(null)}
      className="btn"
      style={{ background: 'transparent', padding: '0.5rem 0', marginBottom: '1rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <ArrowLeft size={18} /> Back to Settings
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '2rem' }}>
      
      {/* SETTINGS MENU */}
      {!activeSetting && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div 
            className="data-card glass animate-fade-in" 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', transition: 'all 0.2s ease' }}
            onClick={() => setActiveSetting('profile')}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '50%', color: 'var(--accent-primary)' }}>
              <User size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Profile Settings</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Update your username, email, and currency</p>
            </div>
            <ChevronRight size={20} color="var(--text-secondary)" />
          </div>

          <div 
            className="data-card glass animate-fade-in" 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', transition: 'all 0.2s ease', animationDelay: '0.1s' }}
            onClick={() => setActiveSetting('preferences')}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '50%', color: 'var(--success)' }}>
              <Sun size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>App Preferences</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Customize your app experience and themes</p>
            </div>
            <ChevronRight size={20} color="var(--text-secondary)" />
          </div>

          <div 
            className="data-card glass animate-fade-in" 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', transition: 'all 0.2s ease', animationDelay: '0.2s' }}
            onClick={() => setActiveSetting('security')}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '50%', color: '#f59e0b' }}>
              <Lock size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Security</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Update your password and secure your account</p>
            </div>
            <ChevronRight size={20} color="var(--text-secondary)" />
          </div>

          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="data-card glass animate-fade-in"
            style={{ textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', transition: 'all 0.2s ease', animationDelay: '0.3s' }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '50%', color: '#818cf8' }}>
              <ShieldCheck size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Privacy Policy</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Read our data protection and Google Limited Use policy</p>
            </div>
            <ChevronRight size={20} color="var(--text-secondary)" />
          </a>


          <div
            className="data-card glass animate-fade-in"
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)', transition: 'all 0.2s ease', animationDelay: '0.4s' }}
            onClick={() => setActiveSetting('danger')}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%', color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.25rem', color: 'var(--danger)' }}>Danger Zone</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Permanently delete your account and data</p>
            </div>
            <ChevronRight size={20} color="var(--text-secondary)" />
          </div>

        </div>
      )}

      {/* DETAIL VIEWS */}

      {/* Profile Section */}
      {activeSetting === 'profile' && (
        <div className="animate-fade-in">
          {renderBackButton()}
          <div className="data-card glass" style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'center' }}>
            <div style={{ flex: '1 1 400px' }}>
              <div className="data-header">
                <h3><User size={20} className="text-accent-primary" /> Profile Settings</h3>
              </div>
              <form onSubmit={handleProfileUpdate} style={{ maxWidth: '500px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '50%', overflow: 'hidden', background: 'var(--empty-state-bg)', border: '2px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {profile.profileImage ? (
                      <img src={profile.profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={40} color="var(--text-secondary)" />
                    )}
                  </div>
                  <div>
                    <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-block', margin: 0 }}>
                      Change Photo
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            if (file.size > 1024 * 1024) {
                              showToast('Image must be less than 1MB', 'error');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setProfile(prev => ({ ...prev, profileImage: reader.result }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>JPG, GIF or PNG. Max 1MB.</p>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address (Read Only)</label>
                  <input type="email" className="form-control" value={profile.email} disabled style={{ opacity: 0.7 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={profile.username} 
                    onChange={e => setProfile({...profile, username: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Default Currency</label>
                  <select 
                    className="form-control" 
                    value={profile.currency}
                    onChange={e => setProfile({...profile, currency: e.target.value})}
                  >
                    <option value="₹">₹ (INR)</option>
                    <option value="$">$ (USD)</option>
                    <option value="€">€ (EUR)</option>
                    <option value="£">£ (GBP)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Member since {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                  <button type="submit" className="btn btn-primary" disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                  </button>
                </div>
              </form>
            </div>
            <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
              <img src={profileIllustration} alt="Profile Settings" style={{ width: '100%', maxWidth: '350px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--card-border)' }} />
            </div>
          </div>
        </div>
      )}

      {/* App Preferences */}
      {activeSetting === 'preferences' && (
        <div className="animate-fade-in">
          {renderBackButton()}
          <div className="data-card glass" style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'center' }}>
            <div style={{ flex: '1 1 400px' }}>
              <div className="data-header">
                <h3><Sun size={20} className="text-success" /> App Preferences</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--empty-state-bg)', borderRadius: '8px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Theme Preference</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Toggle between dark and light mode.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={toggleTheme}
                    className="action-btn"
                    style={{ background: 'var(--card-bg)', padding: '0.75rem', borderRadius: '50%', color: 'var(--text-primary)' }}
                  >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--empty-state-bg)', borderRadius: '8px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Privacy Mode</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Hide sensitive balances on dashboard.</p>
                  </div>
                  <ToggleSwitch checked={privacyMode} onChange={handleTogglePrivacy} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--empty-state-bg)', borderRadius: '8px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Email Notifications</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Receive weekly spending digests.</p>
                  </div>
                  <ToggleSwitch checked={emailNotifs} onChange={setEmailNotifs} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--empty-state-bg)', borderRadius: '8px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Data Export</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Download all your transactions as CSV.</p>
                  </div>
                  <button 
                    type="button"
                    className="btn"
                    style={{ background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
                    onClick={() => showToast('Data export started. Check your downloads.', 'success')}
                  >
                    Export
                  </button>
                </div>
              </div>
            </div>
            <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
              <img src={preferencesIllustration} alt="App Preferences" style={{ width: '100%', maxWidth: '350px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--card-border)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Security Section */}
      {activeSetting === 'security' && (
        <div className="animate-fade-in">
          {renderBackButton()}
          <div className="data-card glass" style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'center' }}>
            <div style={{ flex: '1 1 400px' }}>
              <div className="data-header">
                <h3><Lock size={20} className="text-warning" style={{ color: '#f59e0b' }} /> Security</h3>
              </div>
              <form onSubmit={handlePasswordChange} style={{ maxWidth: '500px' }}>
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={passwords.currentPassword}
                    onChange={e => setPasswords({...passwords, currentPassword: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={passwords.newPassword}
                    onChange={e => setPasswords({...passwords, newPassword: e.target.value})}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={passwords.confirmPassword}
                    onChange={e => setPasswords({...passwords, confirmPassword: e.target.value})}
                    required
                    minLength={6}
                  />
                </div>
                <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                  <button type="submit" className="btn" style={{ background: 'var(--empty-state-bg)', color: 'var(--text-primary)' }} disabled={passwordSaving}>
                    {passwordSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
            <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
              <img src={securityIllustration} alt="Security" style={{ width: '100%', maxWidth: '350px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--card-border)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      {activeSetting === 'danger' && (
        <div className="animate-fade-in">
          {renderBackButton()}
          <div className="data-card glass" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', flexWrap: 'wrap', gap: '3rem', alignItems: 'center' }}>
            <div style={{ flex: '1 1 400px' }}>
              <div className="data-header">
                <h3 style={{ color: 'var(--danger)' }}><AlertTriangle size={20} /> Danger Zone</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* 1. Delete Bank Sync Configuration */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--card-border)' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={17} style={{ color: 'var(--accent-primary)' }} />
                      Delete Bank Sync Configuration
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: '1.45' }}>
                      Disconnect linked Gmail account, wipe saved statement password, and delete Google Cloud auto-sync credentials. Daily sync will be deleted.
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowDeleteSyncConfirm(true)}
                    className="btn"
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: 'var(--danger)',
                      padding: '0.55rem 1.1rem',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Trash2 size={16} /> Delete Sync Config
                  </button>
                </div>

                {/* 2. Delete Account */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-primary)' }}>Delete Account</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.45' }}>
                      Once you delete your account, there is no going back. All your wallets, transactions, and personal data will be permanently erased.
                    </p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn btn-danger"
                  >
                    <Trash2 size={18} /> Delete Account
                  </button>
                </div>
              </div>
            </div>
            <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
              <img src={dangerIllustration} alt="Danger Zone" style={{ width: '100%', maxWidth: '350px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--card-border)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Modals & Toasts */}
      {/* 1. Delete Bank Sync Modal */}
      {showDeleteSyncConfirm && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass animate-fade-in" style={{ maxWidth: '480px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--danger)', fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={22} /> Delete Bank Sync Configuration?
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: '1.6', fontSize: '0.9rem' }}>
              Are you sure you want to delete your bank sync configuration? This will disconnect your Gmail account, clear your statement password, and turn off background auto-sync.
            </p>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(16, 185, 129, 0.25)'
            }}>
              <ShieldCheck size={20} style={{ flexShrink: 0 }} />
              <span><strong>Note:</strong> All your transactions, ledger history, and balances will stay 100% safe. Only the sync connection is deleted.</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                className="btn" 
                style={{ background: 'var(--empty-state-bg)', color: 'var(--text-primary)' }} 
                onClick={() => setShowDeleteSyncConfirm(false)}
                disabled={deletingSync}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-danger" 
                onClick={handleDeleteSyncConfig}
                disabled={deletingSync}
              >
                {deletingSync ? 'Deleting...' : 'Yes, Delete Configuration'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 2. Delete Account Modal */}
      {showDeleteConfirm && createPortal(
        <div className="modal-overlay">
          <div className="modal-content glass animate-fade-in">
            <h3 style={{ marginBottom: '1rem', color: 'var(--danger)', fontSize: '1.25rem', fontWeight: '600' }}>
              Delete Account?
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
              Are you absolutely sure you want to delete your account? This action cannot be undone and you will lose all your data.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                className="btn" 
                style={{ background: 'var(--empty-state-bg)', color: 'var(--text-primary)' }} 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-danger" 
                onClick={handleDeleteAccount}
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(
        <>
          <div className={`toast-overlay ${toast.type}`}></div>
          <div className={`toast-notification ${toast.type}`}>
            {toast.type === 'success' ? <Check size={20} /> : <X size={20} />}
            <span style={{ whiteSpace: 'nowrap' }}>{toast.message}</span>
          </div>
        </>,
        document.body
      )}

    </div>
  );
};

export default AccountView;
