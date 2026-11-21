package com.mldapps.cloudstorage;

import android.Manifest;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.concurrent.TimeUnit;

@CapacitorPlugin(
    name = "Backup",
    permissions = {
        @Permission(alias = "media33", strings = {Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO}),
        @Permission(alias = "media", strings = {Manifest.permission.READ_EXTERNAL_STORAGE})
    }
)
public class BackupPlugin extends Plugin {

    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "media33" : "media";
    }

    @PluginMethod
    public void ensurePermission(PluginCall call) {
        if (getPermissionState(alias()) == PermissionState.GRANTED) {
            JSObject o = new JSObject();
            o.put("granted", true);
            call.resolve(o);
        } else {
            requestPermissionForAlias(alias(), call, "permDone");
        }
    }

    @PermissionCallback
    private void permDone(PluginCall call) {
        JSObject o = new JSObject();
        o.put("granted", getPermissionState(alias()) == PermissionState.GRANTED);
        call.resolve(o);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        SharedPreferences p = BackupEngine.prefs(getContext());
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        boolean wifiOnly = Boolean.TRUE.equals(call.getBoolean("wifiOnly", true));
        boolean cameraOnly = Boolean.TRUE.equals(call.getBoolean("cameraOnly", true));
        SharedPreferences.Editor e = p.edit();
        e.putBoolean("enabled", enabled);
        e.putBoolean("wifiOnly", wifiOnly);
        e.putBoolean("cameraOnly", cameraOnly);
        e.putString("baseUrl", call.getString("baseUrl", ""));
        e.putString("apiKey", call.getString("apiKey", ""));
        e.putString("dir", call.getString("dir", "/Photos"));
        // First time on: only photos taken from now on (the "back up everything" button covers old ones).
        if (enabled && !p.contains("since")) e.putLong("since", System.currentTimeMillis() / 1000);
        e.apply();

        WorkManager wm = WorkManager.getInstance(getContext());
        if (enabled) {
            Constraints cons = new Constraints.Builder()
                .setRequiredNetworkType(wifiOnly ? NetworkType.UNMETERED : NetworkType.CONNECTED)
                .build();
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(BackupWorker.class, 30, TimeUnit.MINUTES)
                .setConstraints(cons)
                .build();
            wm.enqueueUniquePeriodicWork("vault-backup", ExistingPeriodicWorkPolicy.UPDATE, req);
        } else {
            wm.cancelUniqueWork("vault-backup");
        }
        call.resolve();
    }

    @PluginMethod
    public void runNow(final PluginCall call) {
        final boolean force = Boolean.TRUE.equals(call.getBoolean("force", false));
        final boolean all = Boolean.TRUE.equals(call.getBoolean("all", false));
        if (all) BackupEngine.prefs(getContext()).edit().putLong("since", 0).apply();
        final android.content.Context ctx = getContext().getApplicationContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                BackupEngine.run(ctx, force);
            }
        }).start();
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        SharedPreferences p = BackupEngine.prefs(getContext());
        JSObject o = new JSObject();
        boolean perm = BackupEngine.hasPermission(getContext());
        boolean running = BackupEngine.running.get();
        o.put("enabled", p.getBoolean("enabled", false));
        o.put("permission", perm);
        o.put("running", running);
        o.put("current", BackupEngine.currentName);
        o.put("done", BackupEngine.runDone);
        o.put("total", BackupEngine.runTotal);
        o.put("uploaded", p.getInt("uploaded", 0));
        o.put("failed", p.getInt("failed", 0));
        o.put("lastRun", p.getLong("lastRun", 0));
        o.put("lastError", BackupEngine.lastError);
        o.put("pending", (!running && perm) ? BackupEngine.pending(getContext()).size() : 0);
        call.resolve(o);
    }
}
