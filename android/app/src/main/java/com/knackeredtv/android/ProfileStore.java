package com.knackeredtv.android;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.JSONArray;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class ProfileStore {
    private static final String KEY = "knackeredtv_profiles_v1";
    private final SharedPreferences preferences;

    ProfileStore(Context context) {
        preferences = context.getSharedPreferences("profiles", Context.MODE_PRIVATE);
    }

    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(KEY)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY, null);
    }

    List<Profile> load() throws Exception {
        String encoded = preferences.getString("data", null);
        List<Profile> profiles = new ArrayList<>();
        if (encoded == null) return profiles;
        byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
        if (bytes.length <= 12) throw new IllegalStateException("Profile data is invalid");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, bytes, 0, 12));
        JSONArray array = new JSONArray(new String(cipher.doFinal(bytes, 12, bytes.length - 12), StandardCharsets.UTF_8));
        for (int i = 0; i < array.length(); i++) profiles.add(Profile.fromJson(array.getJSONObject(i)));
        return profiles;
    }

    void save(List<Profile> profiles) throws Exception {
        JSONArray array = new JSONArray();
        for (Profile profile : profiles) array.put(profile.toJson());
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] iv = cipher.getIV();
        byte[] encrypted = cipher.doFinal(array.toString().getBytes(StandardCharsets.UTF_8));
        byte[] result = new byte[iv.length + encrypted.length];
        System.arraycopy(iv, 0, result, 0, iv.length);
        System.arraycopy(encrypted, 0, result, iv.length, encrypted.length);
        if (!preferences.edit().putString("data", Base64.encodeToString(result, Base64.NO_WRAP)).commit()) {
            throw new IllegalStateException("Could not save profiles");
        }
    }
}
