package com.richart.cashupitracker;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.WindowInsetsController;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean doubleBackToExitPressedOnce = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // Guarantee pure white native window background immediately on launch
        if (getWindow() != null) {
            getWindow().getDecorView().setBackgroundColor(Color.WHITE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    controller.setSystemBarsAppearance(
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                        WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                    );
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                }
                getWindow().getDecorView().setSystemUiVisibility(flags);
            }
        }

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
