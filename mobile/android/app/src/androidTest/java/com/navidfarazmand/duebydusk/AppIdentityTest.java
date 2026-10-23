package com.navidfarazmand.duebydusk;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Verifies instrumentation targets the game package rather than the shell template. */
@RunWith(AndroidJUnit4.class)
public class AppIdentityTest {
    @Test
    public void targetsDueByDusk() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.navidfarazmand.duebydusk.testing", context.getPackageName());
    }
}
