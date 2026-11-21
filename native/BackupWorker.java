package com.mldapps.cloudstorage;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/** Runs the photo backup in the background every ~30 minutes, even when the app is closed. */
public class BackupWorker extends Worker {
    public BackupWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        BackupEngine.run(getApplicationContext(), false);
        return Result.success();
    }
}
