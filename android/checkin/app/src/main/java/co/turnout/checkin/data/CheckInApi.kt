package co.turnout.checkin.data

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
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

data class RosterPage(
    val attendees: List<OfflineRosterAttendee>,
    val nextAfterId: String?,
    val hasMore: Boolean,
    val total: Int,
    val downloadedAt: String,
)

data class BatchScanResult(
    val clientScanId: String?,
    val ok: Boolean,
    val alreadyCheckedIn: Boolean,
    val error: String?,
    val message: String?,
    val attendee: Attendee?,
)

data class BatchSyncResult(
    val results: List<BatchScanResult>,
    val synced: Int,
    val failed: Int,
)

data class RosterDelta(
    val updates: List<OfflineRosterAttendee>,
    val serverTime: String,
)

class ApiException(val errorCode: String?, override val message: String) : Exception(message)

class CheckInApi(baseUrl: String) {
    private val apiBase = normalizeApiBaseUrl(baseUrl)
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
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
        return parseCheckInResult(json)
    }

    fun downloadRosterPage(
        eventId: String,
        staffPin: String,
        afterId: Long? = null,
        limit: Int = 1000,
    ): RosterPage {
        val body = JSONObject()
            .put("staffPin", normalizeStaffPin(staffPin))
            .put("limit", limit)
        if (afterId != null && afterId > 0) body.put("afterId", afterId)
        val json = post("/api/events/${eventId.trim()}/checkin/roster", body)
        val attendees = mutableListOf<OfflineRosterAttendee>()
        val arr = json.optJSONArray("attendees") ?: JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            attendees.add(parseRosterAttendee(o, eventId))
        }
        val next = json.optString("nextAfterId").ifBlank { null }
        return RosterPage(
            attendees = attendees,
            nextAfterId = next,
            hasMore = json.optBoolean("hasMore", next != null),
            total = json.optInt("total"),
            downloadedAt = json.optString("downloadedAt").ifBlank {
                java.time.Instant.now().toString()
            },
        )
    }

    fun rosterDelta(eventId: String, staffPin: String, since: String): RosterDelta {
        val body = JSONObject()
            .put("staffPin", normalizeStaffPin(staffPin))
            .put("since", since)
        val json = post("/api/events/${eventId.trim()}/checkin/roster/delta", body)
        val updates = mutableListOf<OfflineRosterAttendee>()
        val arr = json.optJSONArray("updates") ?: JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            updates.add(parseRosterAttendee(o, eventId))
        }
        return RosterDelta(
            updates = updates,
            serverTime = json.optString("serverTime").ifBlank { java.time.Instant.now().toString() },
        )
    }

    fun syncBatch(
        eventId: String,
        staffPin: String,
        scans: List<PendingOfflineScan>,
    ): BatchSyncResult {
        val arr = JSONArray()
        for (s in scans) {
            arr.put(
                JSONObject()
                    .put("clientScanId", s.clientScanId)
                    .put("qrToken", s.qrToken)
                    .put("scannedAt", s.scannedAt),
            )
        }
        val body = JSONObject()
            .put("staffPin", normalizeStaffPin(staffPin))
            .put("scans", arr)
        val json = post("/api/events/${eventId.trim()}/checkin/batch", body)
        val results = mutableListOf<BatchScanResult>()
        val resultArr = json.optJSONArray("results") ?: JSONArray()
        for (i in 0 until resultArr.length()) {
            val o = resultArr.optJSONObject(i) ?: continue
            val attendeeJson = o.optJSONObject("attendee")
            results.add(
                BatchScanResult(
                    clientScanId = o.optString("clientScanId").ifBlank { null },
                    ok = o.optBoolean("ok", false),
                    alreadyCheckedIn = o.optBoolean("alreadyCheckedIn", false),
                    error = o.optString("error").ifBlank { null },
                    message = o.optString("message").ifBlank { null },
                    attendee = attendeeJson?.let { parseAttendee(it) },
                ),
            )
        }
        return BatchSyncResult(
            results = results,
            synced = json.optInt("synced"),
            failed = json.optInt("failed"),
        )
    }

    private fun parseRosterAttendee(o: JSONObject, eventId: String): OfflineRosterAttendee {
        return OfflineRosterAttendee(
            id = o.optString("id"),
            eventId = o.optString("eventId", eventId),
            qrToken = o.optString("qrToken").lowercase(),
            fullName = o.optString("fullName"),
            email = o.optString("email"),
            ticketName = o.optString("ticketName"),
            checkedInAt = o.optString("checkedInAt").ifBlank { null },
        )
    }

    private fun parseCheckInResult(json: JSONObject): CheckInResult {
        val attendeeJson = json.optJSONObject("attendee")
        return CheckInResult(
            ok = json.optBoolean("ok", false),
            alreadyCheckedIn = json.optBoolean("alreadyCheckedIn", false),
            message = json.optString("message", "Checked in"),
            attendee = attendeeJson?.let { parseAttendee(it) },
        )
    }

    private fun parseAttendee(it: JSONObject): Attendee {
        return Attendee(
            id = it.optString("id"),
            fullName = it.optString("fullName"),
            email = it.optString("email"),
            ticketName = it.optString("ticketName"),
            checkedInAt = it.optString("checkedInAt").ifBlank { null },
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
