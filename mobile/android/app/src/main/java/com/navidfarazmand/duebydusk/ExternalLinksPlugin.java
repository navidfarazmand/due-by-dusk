package com.navidfarazmand.duebydusk;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The report's email (0.15.2). Report a problem opens the phone's email app with a mailto: link. Capacitor opened it
 * from the game's own screen, so the email app's compose window joined the game's task and sat on top of it: a tester
 * who switched to another app and back (a Samsung phone, 18 Nov) found the game's Report card frozen, Cancel and Open
 * email both dead, until he closed the game, and then his email app had the message. Here the email app opens in its
 * own task, beside the game, and the game stays the game.
 */
@CapacitorPlugin(name = "ExternalLinks")
public class ExternalLinksPlugin extends Plugin {

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url == null || url.getScheme() == null || !"mailto".equalsIgnoreCase(url.getScheme())) {
            // every other address goes the bridge's usual way
            return null;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, url);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            // no email app: nothing opens, and the game goes on
        }
        return true;
    }
}
