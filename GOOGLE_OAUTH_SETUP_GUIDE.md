# 📖 Google Cloud OAuth & Bank Sync Setup Guide

This guide details the exact steps to configure Google Cloud Console OAuth 2.0 credentials for automated Gmail statement reading in **Cash & UPI Tracker**.

---

## 🚀 Step-by-Step Configuration

### Step 1: App Information (Google Auth Platform)
In [Google Cloud Console](https://console.cloud.google.com):
1. Navigate to **Google Auth Platform → Overview / Branding**.
2. Fill in:
   - **App name:** `Cash & UPI Tracker`
   - **User support email:** Select your personal email address.
3. Click **Next**.

---

### Step 2: Audience
1. Under **User type**, select: **External**.
2. Click **Next**.

---

### Step 3: Contact Information
1. **Developer contact email:** Enter your personal email address.
2. Click **Next**, review the summary, and click **Finish / Create**.

---

### Step 4: Enable Gmail API
1. In the top search bar, type **Gmail API** (or navigate to **APIs & Services → Library**).
2. Click on **Gmail API** and click the blue **ENABLE** button.

---

### Step 5: Create Credentials (OAuth Client ID)
1. Go to **Clients** (or **Credentials**) in the left menu.
2. Click **+ CREATE CREDENTIALS → OAuth client ID**.
3. **Application type:** Select **Web application**.
4. **Name:** `Cash UPI Web App`.

#### 📋 Authorized JavaScript origins:
Click **+ ADD URI** and paste:
```text
http://localhost:5173
```

#### 📋 Authorized redirect URIs:
Click **+ ADD URI** and paste:
```text
http://localhost:5173/google-callback
```

5. Click **CREATE**.
6. Copy the **Client ID** and **Client Secret** into your **Cash & UPI Tracker** app.

---

## 🌐 Deploying to Production Later (Vercel / Render / Custom Domain)

You do **NOT** need to create a new Google Cloud app or regenerate credentials when deploying live!

1. Open this same client in Google Cloud Console (**Clients → Cash UPI Web App**).
2. Under **Authorized redirect URIs**, click **+ ADD URI** and add your live production URL:
   ```text
   https://your-domain.vercel.app/google-callback
   ```
3. Under **Authorized JavaScript origins**, click **+ ADD URI** and add:
   ```text
   https://your-domain.vercel.app
   ```
4. Click **Save**. The exact same Client ID and Secret will now work seamlessly in both localhost and production!
