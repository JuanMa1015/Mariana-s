package co.mariana.monitor;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
