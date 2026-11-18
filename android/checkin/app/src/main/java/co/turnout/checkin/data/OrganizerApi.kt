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

data class OrganizerUser(
    val uid: String,
    val email: String,
    val displayName: String,
    val role: String,
)

data class OrganizerLoginResult(
    val authToken: String,
    val user: OrganizerUser,
)

data class OrganizerEvent(
    val id: String,
    val slug: String,
    val title: String,
    val description: String,
    val date: String,
    val location: String,
    val status: String,
    val bannerUrl: String?,
)

data class EventStats(
    val soldTickets: Int,
    val totalRevenue: Double,
    val totalCapacity: Int,
    val attendeeTotal: Int,
    val checkedInCount: Int,
)

data class OrganizerAttendee(
    val id: String,
    val fullName: String,
    val email: String,
    val phone: String?,
    val ticketName: String,
    val checkedInAt: String?,
)

data class CheckInConfig(
    val staffPin: String,
    val staffUrl: String?,
)

data class BankTransferOrder(
    val id: String,
    val buyerName: String?,
    val buyerEmail: String,
    val buyerPhone: String?,
    val totalAmount: Double,
    val status: String,
    val createdAt: String,
    val slipUrl: String?,
)

class OrganizerApi(
    baseUrl: String,
    private val authToken: String? = null,
) {
    private val apiBase = CheckInApi.normalizeApiBaseUrl(baseUrl)
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    fun login(email: String, password: String): OrganizerLoginResult {
        val body = JSONObject()
            .put("email", email.trim().lowercase())
            .put("password", password)
        val json = post("/api/auth/login", body, authed = false)
        val token = json.optString("authToken")
            .ifBlank { json.optString("sessionToken") }
        if (token.isBlank()) {
            throw ApiException("invalid_response", "Login succeeded but no auth token was returned.")
        }
        val userJson = json.optJSONObject("user")
            ?: throw ApiException("invalid_response", "Login response missing user.")
        val user = parseUser(userJson)
        if (user.role != "organizer") {
            throw ApiException(
                "forbidden",
                "This account is not an organizer. Use Staff scanner with an event PIN instead.",
            )
        }
        return OrganizerLoginResult(authToken = token, user = user)
    }

    fun listEvents(): List<OrganizerEvent> {
        val json = get("/api/events")
        val arr = json.optJSONArray("events") ?: JSONArray()
        val out = mutableListOf<OrganizerEvent>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(
                OrganizerEvent(
                    id = o.optString("id"),
                    slug = o.optString("slug"),
                    title = o.optString("title"),
                    description = o.optString("description"),
                    date = o.optString("date"),
                    location = o.optString("location"),
                    status = o.optString("status"),
                    bannerUrl = o.optString("bannerUrl").ifBlank { null },
                ),
            )
        }
        return out
    }

    fun eventStats(eventId: String): EventStats {
        val json = get("/api/events/${eventId.trim()}/stats")
        val s = json.optJSONObject("stats") ?: JSONObject()
        return EventStats(
            soldTickets = s.optInt("soldTickets"),
            totalRevenue = s.optDouble("totalRevenue", 0.0),
            totalCapacity = s.optInt("totalCapacity"),
            attendeeTotal = s.optInt("attendeeTotal"),
            checkedInCount = s.optInt("checkedInCount"),
        )
    }

    fun listAttendees(eventId: String, query: String = "", status: String = "all"): List<OrganizerAttendee> {
        val path = buildString {
            append("/api/events/${eventId.trim()}/attendees?limit=500&status=")
            append(status)
            if (query.isNotBlank()) {
                append("&q=")
                append(java.net.URLEncoder.encode(query.trim(), Charsets.UTF_8.name()))
            }
        }
        val json = get(path)
        val arr = json.optJSONArray("attendees") ?: JSONArray()
        val out = mutableListOf<OrganizerAttendee>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(
                OrganizerAttendee(
                    id = o.optString("id"),
                    fullName = o.optString("fullName"),
                    email = o.optString("email"),
                    phone = o.optString("phone").ifBlank { null },
                    ticketName = o.optString("ticketName"),
                    checkedInAt = o.optString("checkedInAt").ifBlank { null },
                ),
            )
        }
        return out
    }

    fun checkInConfig(eventId: String): CheckInConfig {
        val json = get("/api/events/${eventId.trim()}/checkin-config")
        val pin = json.optString("staffPin")
        if (pin.isBlank()) {
            throw ApiException("invalid_response", "No staff PIN returned for this event.")
        }
        return CheckInConfig(
            staffPin = pin,
            staffUrl = json.optString("staffUrl").ifBlank { null },
        )
    }

    fun listBankTransferOrders(eventId: String, status: String = "pending"): List<BankTransferOrder> {
        val json = get("/api/events/${eventId.trim()}/bank-transfer-orders?status=$status")
        val arr = json.optJSONArray("orders") ?: JSONArray()
        val out = mutableListOf<BankTransferOrder>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            out.add(
                BankTransferOrder(
                    id = o.optString("id"),
                    buyerName = o.optString("buyerName").ifBlank { null },
                    buyerEmail = o.optString("buyerEmail"),
                    buyerPhone = o.optString("buyerPhone").ifBlank { null },
                    totalAmount = o.optDouble("totalAmount", 0.0),
                    status = o.optString("status"),
                    createdAt = o.optString("createdAt"),
                    slipUrl = o.optString("bankTransferSlipUrl")
                        .ifBlank { o.optString("slipUrl") }
                        .ifBlank { null },
                ),
            )
        }
        return out
    }

    fun confirmBankTransfer(orderId: String) {
        post("/api/orders/${orderId.trim()}/confirm-bank-transfer", JSONObject())
    }

    fun rejectBankTransfer(orderId: String) {
        post("/api/orders/${orderId.trim()}/reject-bank-transfer", JSONObject())
    }

    private fun parseUser(o: JSONObject): OrganizerUser {
        return OrganizerUser(
            uid = o.optString("uid"),
            email = o.optString("email"),
            displayName = o.optString("displayName").ifBlank { o.optString("email") },
            role = o.optString("role"),
        )
    }

    private fun get(path: String): JSONObject = request(path, method = "GET", body = null, authed = true)

    private fun post(path: String, body: JSONObject, authed: Boolean = true): JSONObject =
        request(path, method = "POST", body = body, authed = authed)

    private fun request(path: String, method: String, body: JSONObject?, authed: Boolean): JSONObject {
        val url = "$apiBase$path"
        val builder = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
        if (authed) {
            val token = authToken?.trim().orEmpty()
            if (token.isBlank()) {
                throw ApiException("unauthorized", "Please sign in again.")
            }
            builder.header("Authorization", "Bearer $token")
        }
        when (method) {
            "GET" -> builder.get()
            "POST" -> {
                builder.header("Content-Type", "application/json")
                builder.post((body ?: JSONObject()).toString().toRequestBody(jsonType))
            }
            else -> throw IllegalArgumentException("Unsupported method $method")
        }

        try {
            client.newCall(builder.build()).execute().use { response ->
                val text = response.body?.string().orEmpty()
                if (looksLikeHtml(text)) {
                    throw ApiException(
                        "invalid_api_response",
                        "Received a web page instead of API data. Set API URL to your site origin only (no /api suffix).",
                    )
                }
                val json = parseJson(text)
                if (!response.isSuccessful) {
                    val code = json.optString("error").ifBlank { "request_failed_${response.code}" }
                    throw ApiException(code, friendlyError(code, json, response.code))
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
            throw ApiException("api_unreachable", "Network error: ${e.message ?: "connection failed"}")
        }
    }

    companion object {
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

        private fun friendlyError(errorCode: String, json: JSONObject, httpCode: Int): String {
            val serverMessage = json.optString("message").trim()
            if (serverMessage.isNotBlank()) return serverMessage
            return when (errorCode) {
                "invalid_credentials" -> "Invalid email or password."
                "email_not_verified" -> "Verify your email before signing in."
                "user_blocked", "user_suspended" -> "This account is not allowed to sign in."
                "forbidden" -> "Organizer access required."
                "unauthorized" -> "Session expired. Please sign in again."
                "csrf_origin_mismatch" -> "Server blocked this request. Update the API, then try again."
                else -> json.optString("error").ifBlank { "Request failed (HTTP $httpCode)" }
            }
        }
    }
}
