import React, { useState, useEffect } from 'react';
import { Wrench, Sparkles, RefreshCw, Download, X } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../services/api';

const CURRENT_APP_VERSION = '1.0.0';

export default function SystemStatusOverlay() {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const checkStatus = async () => {
    try {
      setChecking(true);
      const res = await axios.get(`${API_URL}/system/status?version=${CURRENT_APP_VERSION}`);
      if (res.data) {
        setStatus(res.data);
      }
    } catch (err) {
      console.warn('System status check skipped (offline or unreachable):', err.message);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll system status every 2 minutes
    const interval = setInterval(checkStatus, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  // 1. FULLSCREEN MAINTENANCE MODE
  if (status.maintenance) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        backgroundColor: 'rgba(11, 15, 25, 0.96)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#f8fafc'
      }}>
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.2))',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
          boxShadow: '0 0 35px rgba(245, 158, 11, 0.25)',
          animation: 'pulse 2s infinite'
        }}>
          <Wrench size={42} color="#f59e0b" style={{ animation: 'spin 12s linear infinite' }} />
        </div>

        <h1 style={{
          fontSize: '26px',
          fontWeight: 800,
          letterSpacing: '-0.5px',
          marginBottom: '12px',
          background: 'linear-gradient(135deg, #ffffff, #cbd5e1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Under Scheduled Maintenance
        </h1>

        <p style={{
          fontSize: '15px',
          color: '#94a3b8',
          maxWidth: '420px',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          {status.maintenanceMessage || "We are upgrading servers and adding new features. We will be back online shortly!"}
        </p>

        <button
          onClick={checkStatus}
          disabled={checking}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
            color: '#ffffff',
            border: 'none',
            padding: '12px 28px',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: checking ? 'not-allowed' : 'pointer',
            boxShadow: '0 8px 24px rgba(79, 70, 229, 0.35)',
            transition: 'all 0.2s ease'
          }}
        >
          <RefreshCw size={18} style={{ animation: checking ? 'spin 1s linear infinite' : 'none' }} />
          {checking ? 'Checking Status...' : 'Check Server Status'}
        </button>

        <span style={{ marginTop: '24px', fontSize: '12px', color: '#64748b' }}>
          Cash & UPI Tracker v{CURRENT_APP_VERSION}
        </span>
      </div>
    );
  }

  // 2. GAME-STYLE UPDATE AVAILABLE MODAL
  const isMandatory = status.minSupportedVersion && status.minSupportedVersion > CURRENT_APP_VERSION;
  const showUpdate = status.updateAvailable && (!dismissedUpdate || isMandatory);

  if (showUpdate) {
    return (
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        left: '24px',
        maxWidth: '440px',
        margin: '0 auto',
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '18px',
        padding: '20px',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 25px rgba(99, 102, 241, 0.25)',
        color: '#f8fafc',
        animation: 'slideUp 0.3s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4f46e5, #ec4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
            }}>
              <Sparkles size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>New Update Ready!</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Version {status.appVersion || 'Latest'} is available</div>
            </div>
          </div>
          {!isMandatory && (
            <button
              onClick={() => setDismissedUpdate(true)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {status.changelog && (
          <p style={{
            fontSize: '13px',
            color: '#cbd5e1',
            lineHeight: '1.5',
            margin: '10px 0 16px 0',
            background: 'rgba(30, 41, 59, 0.6)',
            padding: '10px 12px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            {status.changelog}
          </p>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <a
            href={status.downloadUrl || 'https://github.com/Richard00726/smart-expense-tracker/releases/latest'}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '14px',
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Download size={16} />
            Update Now
          </a>
          {!isMandatory && (
            <button
              onClick={() => setDismissedUpdate(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#94a3b8',
                border: 'none',
                padding: '10px 16px',
                borderRadius: '10px',
                fontWeight: 500,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Later
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
