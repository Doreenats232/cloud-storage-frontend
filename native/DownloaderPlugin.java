package com.mldapps.cloudstorage;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Saves files to the public Downloads folder with Android's own progress notification. */
@CapacitorPlugin(name = "Downloader")
public class DownloaderPlugin extends Plugin {

    private DownloadManager dm() {
        return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    @PluginMethod
    public void start(PluginCall call) {
        String url = call.getString("url");
        String name = call.getString("name", "download");
        if (url == null) {
            call.reject("url required");
            return;
        }
        try {
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setTitle(name);
            r.setDescription("Vault");
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            r.setAllowedOverMetered(true);
            r.setAllowedOverRoaming(true);
            long id = dm().enqueue(r);
            JSObject o = new JSObject();
            o.put("id", id);
            call.resolve(o);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        Long id = call.getLong("id");
        if (id == null) {
            call.reject("id required");
            return;
        }
        JSObject o = new JSObject();
        Cursor c = null;
        try {
            c = dm().query(new DownloadManager.Query().setFilterById(id));
            if (c != null && c.moveToFirst()) {
                int st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long got = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long total = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                String s = "unknown";
                if (st == DownloadManager.STATUS_PENDING) s = "pending";
                else if (st == DownloadManager.STATUS_RUNNING) s = "running";
                else if (st == DownloadManager.STATUS_PAUSED) s = "paused";
                else if (st == DownloadManager.STATUS_SUCCESSFUL) s = "successful";
                else if (st == DownloadManager.STATUS_FAILED) s = "failed";
                o.put("status", s);
                o.put("downloaded", got);
                o.put("total", total);
            } else {
                o.put("status", "missing");
                o.put("downloaded", 0);
                o.put("total", 0);
            }
            call.resolve(o);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        } finally {
            if (c != null) c.close();
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Long id = call.getLong("id");
        if (id != null) dm().remove(id);
        call.resolve();
    }
}
