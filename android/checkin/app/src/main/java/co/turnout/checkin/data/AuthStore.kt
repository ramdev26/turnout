package co.turnout.checkin.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import co.turnout.checkin.BuildConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.authDataStore: DataStore<Preferences> by preferencesDataStore(name = "turnout_organizer_auth")

data class OrganizerAuth(
    val apiBaseUrl: String = BuildConfig.DEFAULT_API_BASE,
    val authToken: String = "",
    val userId: String = "",
    val email: String = "",
    val displayName: String = "",
    val role: String = "",
) {
    val isLoggedIn: Boolean
        get() = authToken.isNotBlank() && role == "organizer"
}

class AuthStore(private val context: Context) {
    private val apiBaseKey = stringPreferencesKey("api_base_url")
    private val tokenKey = stringPreferencesKey("auth_token")
    private val userIdKey = stringPreferencesKey("user_id")
    private val emailKey = stringPreferencesKey("email")
    private val displayNameKey = stringPreferencesKey("display_name")
    private val roleKey = stringPreferencesKey("role")

    val auth: Flow<OrganizerAuth> = context.authDataStore.data.map { prefs ->
        OrganizerAuth(
            apiBaseUrl = prefs[apiBaseKey] ?: BuildConfig.DEFAULT_API_BASE,
            authToken = prefs[tokenKey].orEmpty(),
            userId = prefs[userIdKey].orEmpty(),
            email = prefs[emailKey].orEmpty(),
            displayName = prefs[displayNameKey].orEmpty(),
            role = prefs[roleKey].orEmpty(),
        )
    }

    suspend fun saveLogin(
        apiBaseUrl: String,
        authToken: String,
        userId: String,
        email: String,
        displayName: String,
        role: String,
    ) {
        context.authDataStore.edit { prefs ->
            prefs[apiBaseKey] = CheckInApi.normalizeApiBaseUrl(apiBaseUrl)
            prefs[tokenKey] = authToken.trim()
            prefs[userIdKey] = userId.trim()
            prefs[emailKey] = email.trim()
            prefs[displayNameKey] = displayName.trim()
            prefs[roleKey] = role.trim()
        }
    }

    suspend fun saveApiBase(apiBaseUrl: String) {
        context.authDataStore.edit { prefs ->
            prefs[apiBaseKey] = CheckInApi.normalizeApiBaseUrl(apiBaseUrl)
        }
    }

    suspend fun clear() {
        context.authDataStore.edit { prefs ->
            prefs.remove(tokenKey)
            prefs.remove(userIdKey)
            prefs.remove(emailKey)
            prefs.remove(displayNameKey)
            prefs.remove(roleKey)
        }
    }
}
