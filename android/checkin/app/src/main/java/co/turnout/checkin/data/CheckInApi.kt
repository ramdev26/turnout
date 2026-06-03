package co.turnout.checkin.data

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.net.UnknownHostException
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
    private val apiBase = normalizeApiBaseUrl(baseUrl)
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    fun verifyPin(eventId: String, staffPin: String): String {
        val body = JSONObject().put("staffPin", normalizeStaffPin(staffPin))
        val json = post("/api/events/${eventId.trim()}/checkin/verify-pin", body)
        if (!json.optBoolean("ok", false)) {
            throw ApiException("invalid_response", "Server did not confirm PIN.")
        }
        return json.optString("eventTitle", "Event")
    }

    fun checkIn(eventId: String, staffPin: String, qrToken: String): CheckInResult {
        val body = JSONObject()
            .put("qrToken", qrToken)
            .put("staffPin", normalizeStaffPin(staffPin))
        val json = post("/api/events/${eventId.trim()}/checkin", body)
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

        try {
            client.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (looksLikeHtml(text)) {
                    throw ApiException(
                        "invalid_api_response",
                        "Received a web page instead of API data. Set API URL to your site origin only (e.g. https://turnout-omega.vercel.app) with no /api suffix.",
                    )
                }

                val json = parseJson(text)

                if (!response.isSuccessful) {
                    val code = json.optString("error").ifBlank { "request_failed_${response.code}" }
                    val message = friendlyErrorMessage(code, json, response.code)
                    throw ApiException(code, message)
                }

                return json
            }
        } catch (e: ApiException) {
            throw e
        } catch (e: UnknownHostException) {
            throw ApiException(
                "api_unreachable",
                "Cannot reach server at $apiBase. Check API URL and internet connection.",
            )
        } catch (e: IOException) {
            val hint = if (apiBase.startsWith("http://")) {
                " HTTP is blocked unless you use HTTPS, or a debug build with cleartext allowed."
            } else {
                ""
            }
            throw ApiException(
                "api_unreachable",
                "Network error: ${e.message ?: "connection failed"}.$hint",
            )
        }
    }

    companion object {
        /** Site origin only — same rule as the web app (no trailing /api). */
        fun normalizeApiBaseUrl(raw: String): String {
            var base = raw.trim().trimEnd('/')
            if (base.endsWith("/api", ignoreCase = true)) {
                base = base.dropLast(4).trimEnd('/')
            }
            return base
        }

        fun normalizeStaffPin(pin: String): String {
            val digits = pin.filter { it.isDigit() }
            return digits.take(8)
        }

        private fun parseJson(text: String): JSONObject {
            if (text.isBlank()) return JSONObject()
            return try {
                JSONObject(text)
            } catch (_: Exception) {
                JSONObject()
            }
        }

        private fun looksLikeHtml(text: String): Boolean {
            val t = text.trimStart()
            return t.startsWith("<") || t.contains("<!DOCTYPE", ignoreCase = true) || t.contains("<html", ignoreCase = true)
        }

        private fun friendlyErrorMessage(errorCode: String, json: JSONObject, httpCode: Int): String {
            val serverMessage = json.optString("message").trim()
            if (serverMessage.isNotBlank()) return serverMessage
            return when (errorCode) {
                "invalid_staff_pin" -> "Incorrect PIN for this event. Copy the latest PIN from Event settings → Check-in."
                "event_not_live" -> "This event is not published yet. Publish the event, then try again."
                "event_not_found" -> "Event ID not found on this server. Check Event ID matches your dashboard URL."
                else -> json.optString("error").ifBlank { "Request failed (HTTP $httpCode)" }
            }
        }
    }
}
