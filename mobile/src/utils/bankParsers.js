/**
 * Unified Bank & UPI Notification Parser
 * 
 * Accurately parses:
 * 1. TMB (Tamilnad Mercantile Bank) SMS (Debit, Credit, VPA, Balances, Ref Numbers)
 * 2. Other Indian Bank SMS (SBI, HDFC, ICICI, Axis, Kotak, PNB)
 * 3. UPI Apps (Google Pay, PhonePe, Paytm, BHIM)
 */

export const parseNotification = (senderOrApp, bodyOrTitle, extraText) => {
  if (!senderOrApp && !bodyOrTitle) return null;

  const sender = String(senderOrApp || '');
  const title = String(bodyOrTitle || '');
  const extra = String(extraText || '');

  const combinedText = `${sender} ${title} ${extra}`.trim();
  const lowerText = combinedText.toLowerCase();
  const upperSender = `${sender} ${title}`.toUpperCase();

  // 1. Filter out non-transaction messages (OTPs, promotional spam)
  const ignoreKeywords = [
    'otp', 'verification code', 'secret code', 'promotional',
    'special offer', 'cashback reward', 'update your kyc',
    'win up to', 'exclusive offer', 'mandate set for'
  ];
  if (ignoreKeywords.some(kw => lowerText.includes(kw))) {
    return null;
  }

  // 2. Identify the bank or UPI source
  let bank = null;
  if (
    upperSender.includes('TMBANK') ||
    upperSender.includes('TMB') ||
    lowerText.includes('tamilnad') ||
    lowerText.includes('- tmb') ||
    lowerText.includes('tmbl')
  ) {
    bank = 'TMB';
  } else if (upperSender.includes('SBI') || lowerText.includes('state bank')) {
    bank = 'SBI';
  } else if (upperSender.includes('HDFC')) {
    bank = 'HDFC';
  } else if (upperSender.includes('ICICI')) {
    bank = 'ICICI';
  } else if (upperSender.includes('AXIS')) {
    bank = 'Axis Bank';
  } else if (upperSender.includes('KOTAK')) {
    bank = 'Kotak';
  } else if (upperSender.includes('PNB')) {
    bank = 'PNB';
  } else if (
    sender.includes('nbu.paisa') || // Google Pay
    sender.includes('phonepe') ||   // PhonePe
    sender.includes('paytm') ||     // Paytm
    lowerText.includes('gpay') ||
    lowerText.includes('google pay') ||
    lowerText.includes('phonepe') ||
    lowerText.includes('paytm')
  ) {
    bank = 'TMB'; // Default to linked bank for Phase 1
  }

  if (!bank) return null;

  // 3. Determine transaction type (Credit vs Debit)
  // TMB SMS often says: "Your A/c XXXX0086 is debited ... and TMBL A/c ... is credited"
  // So the first occurrence of debited vs credited determines the user's transaction type!
  let type = null;
  const debitPos = lowerText.search(/(?:debited|deducted|spent|paid|sent|payment to|paid to|payment of)/);
  const creditPos = lowerText.search(/(?:credited|deposited|received|you received|cashback credited)/);

  if (debitPos !== -1 && (creditPos === -1 || debitPos < creditPos)) {
    type = 'debit';
  } else if (creditPos !== -1) {
    type = 'credit';
  }

  if (!type) return null;

  // 4. Extract amount — matches "Rs.500.00", "Rs 500", "INR 500", "₹ 500", "₹500.00", "debited with Rs.1.00"
  let amount = null;
  const amountMatch = combinedText.match(/(?:(?:RS|INR|₹)\.?\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (amountMatch && amountMatch[1]) {
    amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  } else {
    const fallbackMatch = combinedText.match(/(?:amount|paid|sent|received|with)\s*(?:of|is|:)?\s*(?:(?:RS|INR|₹)\.?\s*)?([0-9,]+(?:\.[0-9]{1,2})?)/i);
    if (fallbackMatch && fallbackMatch[1]) {
      amount = parseFloat(fallbackMatch[1].replace(/,/g, ''));
    }
  }

  if (!amount || amount <= 0) return null;

  // 5. Extract reference number / UPI Ref No / UTR
  let refNo = null;
  const refMatch = combinedText.match(/(?:UPI\s*Ref\s*No\.?|Ref\s*No\.?|Ref\s*no\.?|UTR|Txn\s*ID)\s*[:\-]?\s*([A-Za-z0-9]{6,22})/i);
  if (refMatch && refMatch[1]) {
    refNo = refMatch[1];
  }

  // 6. Extract counterparty (Name or UPI VPA)
  let counterparty = null;
  let counterpartyType = null;

  // Check for UPI VPA (e.g. linked to 919677701144@tmb, to receiver@oksbi, from payer@ybl)
  const vpaMatch = combinedText.match(/(?:linked to|to|from|by)\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i);
  if (vpaMatch && vpaMatch[1]) {
    counterparty = vpaMatch[1];
    counterpartyType = 'vpa';
  } else {
    // Check for Name (e.g. by SENDER NAME on ..., to SENDER NAME on ...)
    const nameMatch = combinedText.match(/(?:by|from|to|payment to)\s+([A-Za-z0-9\s]+?)(?=\.|,|\s+(?:is|linked|on|Ref|UPI|Bal|Avl|-))/i);
    if (nameMatch && nameMatch[1]) {
      const cleanName = nameMatch[1].trim();
      if (!['a/c', 'account', 'tmbl', 'tmb'].includes(cleanName.toLowerCase())) {
        counterparty = cleanName;
        counterpartyType = 'name';
      }
    }
  }

  // 7. Extract remaining balance (e.g. "Current AVBL bal is Rs.1082.59", "Avl Bal Rs.1500.00")
  let balance = null;
  const balMatch = combinedText.match(/(?:current\s*avbl\s*bal|avl\s*bal|bal|balance)\s*(?:is|:)?\s*(?:rs|inr|₹)\.?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (balMatch && balMatch[1]) {
    balance = parseFloat(balMatch[1].replace(/,/g, ''));
  }

  // 8. Extract Account Number (Masked, e.g. "XXXX0086", "SB650086")
  let accountNo = null;
  const accMatch = combinedText.match(/(?:a\/c|acct|account)\s*(?:no\.?|number|sb)?\s*[:\-]?\s*([X\*A-Za-z0-9]+[0-9]{4})/i);
  if (accMatch && accMatch[1]) {
    accountNo = accMatch[1];
  }

  // 9. Extract transaction date/time (e.g. "on 22-09-2026 12:46 PM" or "on 22-09-2026")
  let txnDate = null;
  const dateMatch = combinedText.match(/on\s+(\d{2})[\/\-](\d{2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (dateMatch) {
    const day = dateMatch[1];
    const month = dateMatch[2];
    const year = dateMatch[3];
    let hours = parseInt(dateMatch[4] || '0', 10);
    const minutes = dateMatch[5] || '00';
    const seconds = dateMatch[6] || '00';
    const meridiem = dateMatch[7];

    if (meridiem) {
      if (meridiem.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (meridiem.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }
    const formattedHours = String(hours).padStart(2, '0');
    txnDate = new Date(`${year}-${month}-${day}T${formattedHours}:${minutes}:${seconds}`).toISOString();
  } else {
    txnDate = new Date().toISOString();
  }

  return {
    bank,
    type,
    amount,
    refNo,
    counterparty,
    counterpartyType,
    balance,
    accountNo,
    txnDate,
  };
};
