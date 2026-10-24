import React from 'react';
import { ArrowLeft, ShieldCheck, Mail, Lock, Database, Trash2 } from 'lucide-react';

const PrivacyPolicy = ({ onBack }) => {
  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {onBack && (
        <button
          onClick={onBack}
          className="btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            marginBottom: '1.5rem',
            background: 'var(--empty-state-bg)',
            border: '1px solid var(--card-border)',
            color: 'var(--text-primary)',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem'
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      )}

      <div className="data-card glass" style={{ padding: '2.5rem', borderRadius: '16px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1rem' }}>
          <ShieldCheck size={14} /> Official Policy
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Privacy Policy
        </h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
          Last Updated: October 2026
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          Welcome to <strong>Cash & UPI Tracker</strong>. We respect your privacy and are committed to protecting your personal and financial data. This Privacy Policy outlines our transparent approach to data privacy.
        </p>

        <div style={{ background: 'rgba(16, 185, 129, 0.08)', borderLeft: '4px solid #10b981', padding: '1rem 1.25rem', borderRadius: '0 8px 8px 0', margin: '1.5rem 0' }}>
          <strong style={{ color: '#10b981', display: 'block', marginBottom: '0.3rem' }}>Core Privacy Guarantee</strong>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Cash & UPI Tracker does not sell, lease, or share your financial data or email contents with any third parties or advertisers. Your bank statements and transactions remain strictly confidential.
          </span>
        </div>

        <h2 style={{ fontSize: '1.25rem', color: '#38bdf8', marginTop: '1.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={18} /> 1. Information We Collect
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          We only collect information necessary to provide automated financial tracking:
        </p>
        <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
          <li><strong>Account Details:</strong> Email address and username when registering.</li>
          <li><strong>Transaction Records:</strong> Amount, transaction date, narration/note, reference number, and account balance derived from your official bank statements or manual entries.</li>
          <li><strong>Google Account Data (Optional):</strong> If you enable automated Gmail Bank Auto-Sync, we connect strictly via the <code>https://www.googleapis.com/auth/gmail.readonly</code> scope.</li>
        </ul>

        <h2 style={{ fontSize: '1.25rem', color: '#38bdf8', marginTop: '1.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={18} /> 2. Google User Data & Limited Use Disclosure
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
          Our app's use and transfer of information received from Google APIs strictly adheres to the <strong>Google API Services User Data Policy</strong>, including the Limited Use requirements:
        </p>
        <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: '1.25rem' }}>
          <li>We strictly scan only automated daily bank statement PDF attachments from your bank (e.g. Tamilnad Mercantile Bank - TMB).</li>
          <li>We do NOT read your personal emails, chat messages, or contacts.</li>
          <li>We do NOT use Google data to serve advertisements or train generalized AI models.</li>
          <li>OAuth tokens and credentials are securely stored solely to enable background statement fetching.</li>
        </ul>

        <h2 style={{ fontSize: '1.25rem', color: '#38bdf8', marginTop: '1.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trash2 size={18} /> 3. Data Retention & Deletion
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          You have full control over your data. You can disconnect your Gmail account or completely delete all auto-synced statements and transaction records from the application settings at any time with one click.
        </p>

        <h2 style={{ fontSize: '1.25rem', color: '#38bdf8', marginTop: '1.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Mail size={18} /> 4. Contact & Developer Information
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          If you have any questions, contact our support team at: <a href="mailto:lourdurajsebastin350@gmail.com" style={{ color: '#38bdf8' }}>lourdurajsebastin350@gmail.com</a>
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
