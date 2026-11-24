package com.richart.cashupitracker;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean doubleBackToExitPressedOnce = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().eval("window.__handleHardwareBack ? window.__handleHardwareBack() : 'FALLBACK'", value -> {
                        if ("\"HANDLED\"".equals(value) || "HANDLED".equals(value)) {
                            return;
                        }

                        if ("\"EXIT\"".equals(value) || "EXIT".equals(value) || doubleBackToExitPressedOnce) {
                            finishAffinity();
                            return;
                        }

                        doubleBackToExitPressedOnce = true;
                        Toast.makeText(MainActivity.this, "Press back again to exit Smart Expense", Toast.LENGTH_SHORT).show();

                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            doubleBackToExitPressedOnce = false;
                        }, 2500);
                    });
                } else {
                    finish();
                }
            }
        });
    }
}
