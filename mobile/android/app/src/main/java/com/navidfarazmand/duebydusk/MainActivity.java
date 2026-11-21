package com.navidfarazmand.duebydusk;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // No EdgeToEdge.enable() here (v0.11.3): called before super.onCreate it set up the window before the
        // no-title theme applied, and Android drew a title bar ("Due by Dusk") across the top of the game. The game
        // already draws under the system bars on every version (setDecorFitsSystemWindows(false) + immersive below).
        // 0.15.2: the report's email opens in its own task (ExternalLinksPlugin).
        registerPlugin(ExternalLinksPlugin.class);
        super.onCreate(savedInstanceState);
        lockTextSize();
        keepOwnColours();
        if (getBridge() != null) {
            getBridge().addWebViewListener(new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    syncNight();
                }
            });
        }
        enterImmersiveMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        lockTextSize();
        syncNight();
        // Apply after the bridge's lifecycle tasks, without resizing the game.
        getWindow().getDecorView().post(this::enterImmersiveMode);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // the phone's dark mode switched while the game is open (uiMode is in the activity's configChanges)
        syncNight();
    }

    /**
     * 0.16.2 (Navid, 20 Nov: "on my xiaomi i can play with dark theme which is very cool! but the issue is that some
     * text now doesn't show!"): in the phone's dark mode the WebView repainted the game (algorithmic darkening): dark
     * text went light on the game's light signs and cards. The game keeps its own colours; it dims itself evenly
     * instead (html.dbd-night, shell.css).
     */
    private void keepOwnColours() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            WebView webView = getBridge().getWebView();
            WebSettings settings = webView.getSettings();
            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings, false);
            }
            if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                // older WebViews (Android 10 to 12 phones that have not updated it)
                WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_OFF);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) webView.setForceDarkAllowed(false);
        } catch (Exception ignored) {
            // the game still runs
        }
    }

    /** Tells the game whether the phone is in dark mode: the game dims itself then. */
    private void syncNight() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
            boolean night = mode == Configuration.UI_MODE_NIGHT_YES;
            getBridge().getWebView().evaluateJavascript(
                "document.documentElement.classList.toggle('dbd-night', " + night + ")", null);
        } catch (Exception ignored) {
            // no dimming
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersiveMode();
    }

    /**
     * Android's WebView scales every font with the phone's system font size, which pushed text out of the game's
     * fixed cards on Navid's phone (workshop titles, the Pay button, the sundown card). The game draws its own
     * large, readable text, so it keeps its own size.
     */
    private void lockTextSize() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            WebSettings settings = getBridge().getWebView().getSettings();
            settings.setTextZoom(100);
            settings.setSupportZoom(false);
            // v0.11.4 (Navid, 4 Nov): the music and sounds start with the game, not at the first tap. Without this the
            // WebView holds all media until a gesture.
            settings.setMediaPlaybackRequiresUserGesture(false);
        } catch (Exception ignored) {
            // the game still runs with the system text size
        }
    }

    private void enterImmersiveMode() {
        Window window = getWindow();
        View decor = window.getDecorView();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        // Into the camera cutout: ALWAYS from Android 11 (SHORT_EDGES is deprecated in Android 15), SHORT_EDGES before.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attributes = window.getAttributes();
            int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            if (attributes.layoutInDisplayCutoutMode != mode) {
                attributes.layoutInDisplayCutoutMode = mode;
                window.setAttributes(attributes);
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decor);
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        // Leave Capacitor's insets listener intact: it forwards cutout-safe insets
        // to the WebView/CSS, including on Samsung devices with older WebViews.
    }
}
