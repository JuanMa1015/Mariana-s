package co.mariana.monitor;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.IOException;

@CapacitorPlugin(
    name = "DownloadNotifications",
    permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
)
public class DownloadNotificationsPlugin extends Plugin {
    private static final String CHANNEL_ID = "documentos_descargados";

    @PluginMethod
    public void showDownload(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
            return;
        }
        postDownload(call);
    }

    @PermissionCallback
    private void notificationPermissionResult(PluginCall call) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) postDownload(call);
        else resolvePosted(call, false);
    }

    private void postDownload(PluginCall call) {
        String value = call.getString("uri");
        String filename = call.getString("filename", "Documento PDF");
        if (value == null) {
            resolvePosted(call, false);
            return;
        }
        try {
            Uri uri = downloadedUri(value);
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(new NotificationChannel(
                    CHANNEL_ID, "Documentos descargados", NotificationManager.IMPORTANCE_DEFAULT
                ));
                if (manager.getNotificationChannel(CHANNEL_ID).getImportance() == NotificationManager.IMPORTANCE_NONE) {
                    resolvePosted(call, false);
                    return;
                }
            }
            if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
                resolvePosted(call, false);
                return;
            }
            Intent open = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/pdf")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            open.setClipData(ClipData.newRawUri("Documento PDF", uri));
            Intent chooser = Intent.createChooser(open, "Abrir documento");
            chooser.setClipData(open.getClipData());
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            int id = value.hashCode();
            PendingIntent action = PendingIntent.getActivity(
                getContext(), id, chooser, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            manager.notify(id, new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle("Descarga completada")
                .setContentText(filename)
                .setSubText("Toca para abrir el documento")
                .setContentIntent(action)
                .addAction(android.R.drawable.ic_menu_view, "Abrir", action)
                .setAutoCancel(true)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .build());
            resolvePosted(call, true);
        } catch (SecurityException | IllegalArgumentException | IOException error) {
            // El archivo ya está guardado aunque el sistema no permita mostrar el aviso.
            resolvePosted(call, false);
        }
    }

    private Uri downloadedUri(String value) throws IOException {
        Uri uri = Uri.parse(value);
        if ("content".equals(uri.getScheme()) && "media".equals(uri.getAuthority())
            && uri.getPath() != null && uri.getPath().matches("/[^/]+/downloads/[0-9]+")) return uri;
        if ("file".equals(uri.getScheme()) && uri.getPath() != null) {
            File file = new File(uri.getPath()).getCanonicalFile();
            File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).getCanonicalFile();
            if (downloads.equals(file.getParentFile())) {
                return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            }
        }
        throw new IllegalArgumentException("El archivo no pertenece a Descargas.");
    }

    private void resolvePosted(PluginCall call, boolean posted) {
        JSObject result = new JSObject();
        result.put("posted", posted);
        call.resolve(result);
    }
}
