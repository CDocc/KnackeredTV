package com.knackeredtv.android;

import org.json.JSONException;
import org.json.JSONObject;
import java.util.UUID;

final class Profile {
    final String id, name, type, location, username, password;

    Profile(String id, String name, String type, String location, String username, String password) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.location = location;
        this.username = username;
        this.password = password;
    }

    static Profile create(String name, String type, String location, String username, String password) {
        return new Profile(UUID.randomUUID().toString(), name, type, location, username, password);
    }

    boolean isXtream() { return "xtream".equals(type); }

    JSONObject toJson() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("id", id);
        obj.put("name", name);
        obj.put("type", type);
        obj.put("location", location);
        obj.put("username", username);
        obj.put("password", password);
        return obj;
    }

    static Profile fromJson(JSONObject obj) throws JSONException {
        return new Profile(obj.getString("id"), obj.getString("name"), obj.getString("type"),
                obj.getString("location"), obj.getString("username"), obj.getString("password"));
    }
}
