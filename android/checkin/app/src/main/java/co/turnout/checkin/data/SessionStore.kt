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

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "turnout_checkin")

data class CheckInSession(
    val apiBaseUrl: String = BuildConfig.DEFAULT_API_BASE,
    val eventId: String = "",
    val staffPin: String = "",
    val eventTitle: String = "",
) {
    val isConfigured: Boolean get() = apiBaseUrl.isNotBlank() && eventId.isNotBlank()
    val isUnlocked: Boolean get() = isConfigured && staffPin.length >= 4
}

class SessionStore(private val context: Context) {
    private val apiBaseKey = stringPreferencesKey("api_base_url")
    private val eventIdKey = stringPreferencesKey("event_id")
    private val staffPinKey = stringPreferencesKey("staff_pin")
    private val eventTitleKey = stringPreferencesKey("event_title")

    val session: Flow<CheckInSession> = context.dataStore.data.map { prefs ->
        CheckInSession(
            apiBaseUrl = prefs[apiBaseKey] ?: BuildConfig.DEFAULT_API_BASE,
            eventId = prefs[eventIdKey].orEmpty(),
            staffPin = prefs[staffPinKey].orEmpty(),
            eventTitle = prefs[eventTitleKey].orEmpty(),
        )
    }

    suspend fun saveSetup(apiBaseUrl: String, eventId: String) {
        context.dataStore.edit { prefs ->
            prefs[apiBaseKey] = apiBaseUrl.trim().trimEnd('/')
            prefs[eventIdKey] = eventId.trim()
            prefs[staffPinKey] = ""
            prefs[eventTitleKey] = ""
        }
    }

    suspend fun saveUnlock(staffPin: String, eventTitle: String) {
        context.dataStore.edit { prefs ->
            prefs[staffPinKey] = staffPin
            prefs[eventTitleKey] = eventTitle
        }
    }

    suspend fun clearUnlock() {
        context.dataStore.edit { prefs ->
            prefs[staffPinKey] = ""
            prefs[eventTitleKey] = ""
        }
    }
}
