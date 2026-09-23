const http = require("http");

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 5000,
      path: path,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", (e) => reject(e));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log("Starting backend tests...\n");

  try {
    // 1. Get initial wallets
    let res = await request("GET", "/api/wallets");
    console.log("GET /api/wallets:", res.data);

    // 2. Add money to Cash
    res = await request("POST", "/api/transaction", {
      wallet: "Cash",
      type: "credit",
      amount: 1000,
      note: "Salary",
    });
    console.log("\nPOST /api/transaction (Credit Cash 1000):", res.data);

    // 3. Add money to UPI
    res = await request("POST", "/api/transaction", {
      wallet: "UPI",
      type: "credit",
      amount: 500,
      note: "From friend",
    });
    console.log("\nPOST /api/transaction (Credit UPI 500):", res.data);

    // 4. Spend money from Cash
    res = await request("POST", "/api/transaction", {
      wallet: "Cash",
      type: "debit",
      amount: 200,
      category: "Food",
      note: "Lunch",
    });
    console.log("\nPOST /api/transaction (Debit Cash 200):", res.data);

    // 5. Try spending more than balance
    res = await request("POST", "/api/transaction", {
      wallet: "UPI",
      type: "debit",
      amount: 1000, // Balance is only 500
      category: "Shopping",
    });
    console.log("\nPOST /api/transaction (Debit UPI 1000 - should fail):", res.status, res.data);

    // 6. Get wallets again
    res = await request("GET", "/api/wallets");
    console.log("\nGET /api/wallets (After transactions):", res.data);

    // 7. Get transactions
    res = await request("GET", "/api/transactions");
    console.log("\nGET /api/transactions (All):", res.data.length, "transactions found");

    // 8. Get summary
    res = await request("GET", "/api/summary");
    console.log("\nGET /api/summary:", JSON.stringify(res.data, null, 2));

  } catch (err) {
    console.error("Test failed:", err);
  }
}

runTests();
