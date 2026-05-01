package site.insforge.cestapp;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeBrowser")
public class NativeBrowserPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("URL must not be empty");
            return;
        }

        Uri url = Uri.parse(urlString);
        if (url.getScheme() == null) {
            call.reject("URL must include a scheme");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW, url);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);

        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException ex) {
            call.reject("No browser app can open this URL", ex);
        }
    }
}
