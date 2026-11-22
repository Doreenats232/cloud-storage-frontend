package com.mldapps.cloudstorage;

import android.view.WindowManager;

import androidx.appcompat.app.AppCompatActivity;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Fingerprint / face unlock for the app lock, plus hiding the app in the recent-apps screen. */
@CapacitorPlugin(name = "Biometric")
public class BiometricPlugin extends Plugin {

    @PluginMethod
    public void available(PluginCall call) {
        int r = BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
        JSObject o = new JSObject();
        o.put("available", r == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(o);
    }

    @PluginMethod
    public void authenticate(final PluginCall call) {
        final AppCompatActivity act = getActivity();
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(call.getString("title", "Unlock Vault"))
                        .setNegativeButtonText("Use PIN")
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                        .build();
                    BiometricPrompt bp = new BiometricPrompt(act, ContextCompat.getMainExecutor(act), new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            JSObject o = new JSObject();
                            o.put("ok", true);
                            call.resolve(o);
                        }

                        @Override
                        public void onAuthenticationError(int code, CharSequence msg) {
                            JSObject o = new JSObject();
                            o.put("ok", false);
                            o.put("error", String.valueOf(msg));
                            call.resolve(o);
                        }
                    });
                    bp.authenticate(info);
                } catch (Exception e) {
                    call.reject(String.valueOf(e.getMessage()));
                }
            }
        });
    }

    @PluginMethod
    public void setSecure(final PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (on) getActivity().getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
                else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                call.resolve();
            }
        });
    }
}
