package com.mldapps.cloudstorage;

import android.Manifest;
import android.content.ContentUris;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.ConnectivityManager;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/** Finds new camera photos/videos and uploads them to the vault in 4 MB chunks. */
public class BackupEngine {
    static final String PREFS = "vault_backup";
    static final AtomicBoolean running = new AtomicBoolean(false);
    static volatile String currentName = "";
    static volatile int runDone = 0;
    static volatile int runTotal = 0;
    static volatile String lastError = "";

    static class Media {
        Uri uri;
        String key;
        String name;
        long size;
    }

    static class HttpEx extends Exception {
        final int code;
        HttpEx(int code, String msg) {
            super(msg);
            this.code = code;
        }
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean hasPermission(Context c) {
        String perm = Build.VERSION.SDK_INT >= 33 ? Manifest.permission.READ_MEDIA_IMAGES : Manifest.permission.READ_EXTERNAL_STORAGE;
        return c.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean metered(Context c) {
        ConnectivityManager cm = (ConnectivityManager) c.getSystemService(Context.CONNECTIVITY_SERVICE);
        return cm == null || cm.isActiveNetworkMetered();
    }

    static List<Media> pending(Context c) {
        SharedPreferences p = prefs(c);
        long since = p.getLong("since", 0);
        Set<String> done = new HashSet<>(p.getStringSet("done", new HashSet<String>()));
        boolean cameraOnly = p.getBoolean("cameraOnly", true);
        List<Media> out = new ArrayList<>();
        for (int k = 0; k < 2; k++) {
            boolean video = k == 1;
            Uri col = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            String[] proj = {MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.SIZE};
            String sel = MediaStore.MediaColumns.DATE_ADDED + " >= ?";
            List<String> args = new ArrayList<>();
            args.add(String.valueOf(since));
            if (cameraOnly) {
                if (Build.VERSION.SDK_INT >= 29) {
                    sel += " AND " + MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?";
                    args.add("DCIM/%");
                } else {
                    sel += " AND " + MediaStore.MediaColumns.DATA + " LIKE ?";
                    args.add("%/DCIM/%");
                }
            }
            Cursor cur = null;
            try {
                cur = c.getContentResolver().query(col, proj, sel, args.toArray(new String[0]), MediaStore.MediaColumns.DATE_ADDED + " ASC");
                if (cur == null) continue;
                int iId = cur.getColumnIndexOrThrow(MediaStore.MediaColumns._ID);
                int iName = cur.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME);
                int iSize = cur.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE);
                while (cur.moveToNext() && out.size() < 500) {
                    long id = cur.getLong(iId);
                    String key = (video ? "v" : "i") + id;
                    if (done.contains(key)) continue;
                    long size = cur.getLong(iSize);
                    if (size <= 0) continue;
                    Media m = new Media();
                    m.uri = ContentUris.withAppendedId(col, id);
                    m.key = key;
                    m.name = cur.getString(iName);
                    m.size = size;
                    out.add(m);
                }
            } catch (Exception e) {
                lastError = String.valueOf(e.getMessage());
            } finally {
                if (cur != null) cur.close();
            }
        }
        return out;
    }

    static void run(Context c, boolean force) {
        if (!running.compareAndSet(false, true)) return;
        try {
            SharedPreferences p = prefs(c);
            if (!p.getBoolean("enabled", false) && !force) return;
            String base = p.getString("baseUrl", "");
            String key = p.getString("apiKey", "");
            String dir = p.getString("dir", "/Photos");
            if (base.isEmpty() || key.isEmpty()) return;
            if (!hasPermission(c)) {
                lastError = "Photo access is not allowed";
                return;
            }
            if (!force && p.getBoolean("wifiOnly", true) && metered(c)) return;

            List<Media> list = pending(c);
            runTotal = list.size();
            runDone = 0;
            lastError = "";
            for (Media m : list) {
                currentName = m.name;
                try {
                    InputStream in = c.getContentResolver().openInputStream(m.uri);
                    if (in == null) throw new IOException("cannot open " + m.name);
                    try {
                        upload(base, key, dir, m.name, m.size, in);
                    } finally {
                        in.close();
                    }
                    markDone(p, m.key, true);
                } catch (IOException e) {
                    lastError = "Network problem: " + e.getMessage();
                    break; // try again on the next run
                } catch (Exception e) {
                    lastError = m.name + ": " + e.getMessage();
                    int fails = p.getInt("f_" + m.key, 0) + 1;
                    p.edit().putInt("f_" + m.key, fails).apply();
                    if (fails >= 3) markDone(p, m.key, false); // give up so it never blocks the rest
                }
                runDone++;
            }
        } finally {
            currentName = "";
            prefs(c).edit().putLong("lastRun", System.currentTimeMillis()).apply();
            running.set(false);
        }
    }

    static void markDone(SharedPreferences p, String key, boolean ok) {
        Set<String> s = new HashSet<>(p.getStringSet("done", new HashSet<String>()));
        s.add(key);
        SharedPreferences.Editor e = p.edit().putStringSet("done", s);
        if (ok) e.putInt("uploaded", p.getInt("uploaded", 0) + 1);
        else e.putInt("failed", p.getInt("failed", 0) + 1);
        e.apply();
    }

    static void upload(String base, String apiKey, String dir, String name, long size, InputStream in) throws Exception {
        JSONObject init = new JSONObject();
        init.put("filename", name);
        init.put("size", size);
        init.put("dir", dir);
        JSONObject r = http("POST", base + "/v1/fs/uploads", apiKey, "application/json", init.toString().getBytes("UTF-8"), -1);
        String id = r.getString("uploadId");
        int chunk = r.getInt("chunkSize");
        int total = r.getInt("totalChunks");
        byte[] buf = new byte[chunk];
        for (int i = 0; i < total; i++) {
            int want = (i == total - 1) ? (int) (size - (long) i * chunk) : chunk;
            int got = 0;
            while (got < want) {
                int n = in.read(buf, got, want - got);
                if (n < 0) throw new IOException("file ended early");
                got += n;
            }
            for (int attempt = 1; ; attempt++) {
                try {
                    http("PUT", base + "/v1/fs/uploads/" + id + "/" + i, apiKey, "application/octet-stream", buf, want);
                    break;
                } catch (HttpEx e) {
                    boolean retry = e.code == 408 || e.code == 429 || e.code >= 500;
                    if (!retry || attempt >= 4) throw e;
                    Thread.sleep(1000L << (attempt - 1));
                } catch (IOException e) {
                    if (attempt >= 4) throw e;
                    Thread.sleep(1000L << (attempt - 1));
                }
            }
        }
        http("POST", base + "/v1/fs/uploads/" + id + "/complete", apiKey, null, null, -1);
        long deadline = System.currentTimeMillis() + 40L * 60 * 1000;
        while (System.currentTimeMillis() < deadline) {
            Thread.sleep(2000);
            JSONObject st = http("GET", base + "/v1/fs/uploads/" + id, apiKey, null, null, -1);
            String state = st.optString("state");
            if ("error".equals(state)) throw new HttpEx(500, st.optString("error", "TeraBox rejected the upload"));
            if ("done".equals(state)) return;
        }
        throw new IOException("upload is taking too long");
    }

    /** body length: -1 = whole array. */
    static JSONObject http(String method, String url, String apiKey, String contentType, byte[] body, int len) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(30000);
        c.setReadTimeout(180000);
        c.setRequestProperty("X-Api-Key", apiKey);
        if (body != null) {
            int n = len < 0 ? body.length : len;
            c.setDoOutput(true);
            if (contentType != null) c.setRequestProperty("Content-Type", contentType);
            c.setFixedLengthStreamingMode(n);
            OutputStream os = c.getOutputStream();
            os.write(body, 0, n);
            os.flush();
            os.close();
        }
        int code = c.getResponseCode();
        InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
        String text = "";
        if (is != null) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            byte[] b = new byte[4096];
            int n;
            while ((n = is.read(b)) > 0) bo.write(b, 0, n);
            is.close();
            text = bo.toString("UTF-8");
        }
        c.disconnect();
        if (code < 200 || code >= 300) {
            String msg = text;
            try {
                msg = new JSONObject(text).optString("error", text);
            } catch (Exception ignored) {
            }
            if (msg.length() > 160) msg = msg.substring(0, 160);
            throw new HttpEx(code, "HTTP " + code + " " + msg);
        }
        try {
            return text.isEmpty() ? new JSONObject() : new JSONObject(text);
        } catch (Exception e) {
            return new JSONObject();
        }
    }
}
