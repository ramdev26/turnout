package co.turnout.checkin.data

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class Attendee(
    val id: String,
    val fullName: String,
    val email: String,
    val ticketName: String,
    val checkedInAt: String?,
)

data class CheckInResult(
    val ok: Boolean,
    val alreadyCheckedIn: Boolean,
    val message: String,
    val attendee: Attendee?,
)

class ApiException(val errorCode: String?, override val message: String) : Exception(message)

class CheckInApi(baseUrl: String) {
    private val apiBase = baseUrl.trim().trimEnd('/')
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    fun verifyPin(eventId: String, staffPin: String): String {
        val body = JSONObject().put("staffPin", staffPin)
        val json = post("/api/events/$eventId/checkin/verify-pin", body)
        return json.optString("eventTitle", "Event")
    }

    fun checkIn(eventId: String, staffPin: String, qrToken: String): CheckInResult {
        val body = JSONObject()
            .put("qrToken", qrToken)
            .put("staffPin", staffPin)
        val json = post("/api/events/$eventId/checkin", body)
        val attendeeJson = json.optJSONObject("attendee")
        val attendee = attendeeJson?.let {
            Attendee(
                id = it.optString("id"),
                fullName = it.optString("fullName"),
                email = it.optString("email"),
                ticketName = it.optString("ticketName"),
                checkedInAt = it.optString("checkedInAt").ifBlank { null },
            )
        }
        return CheckInResult(
            ok = json.optBoolean("ok", false),
            alreadyCheckedIn = json.optBoolean("alreadyCheckedIn", false),
            message = json.optString("message", "Checked in"),
            attendee = attendee,
        )
    }

    private fun post(path: String, body: JSONObject): JSONObject {
        val url = "$apiBase$path"
        val request = Request.Builder()
            .url(url)
            .post(body.toString().toRequestBody(jsonType))
            .header("Accept", "application/json")
            .header("Content-Type", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            val json = if (text.isNotBlank()) {
                try {
                    JSONObject(text)
                } catch (_: Exception) {
                    JSONObject()
                }
            } else {
                JSONObject()
            }

            if (!response.isSuccessful) {
                val code = json.optString("error").ifBlank { "request_failed_${response.code}" }
                val message = json.optString("message").ifBlank {
                    json.optString("error").ifBlank { "Request failed (${response.code})" }
                }
                throw ApiException(code, message)
            }

            return json
        }
    }
}
