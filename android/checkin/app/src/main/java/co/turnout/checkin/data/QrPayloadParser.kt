package co.turnout.checkin.data

import org.json.JSONObject
import java.net.URL

data class ParsedQrScan(
    val qrToken: String,
    val scannedEventId: String? = null,
    val error: QrScanError? = null,
)

enum class QrScanError {
    EMPTY,
    INVALID,
    WRONG_EVENT,
}

/** Mirrors web `parseQrCheckInPayload` for ticket QR codes. */
object QrPayloadParser {
    fun parse(raw: String, expectedEventId: String): ParsedQrScan {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) {
            return ParsedQrScan(qrToken = "", error = QrScanError.EMPTY)
        }

        var scannedEventId: String? = null
        if (trimmed.startsWith("{")) {
            try {
                val json = JSONObject(trimmed)
                if (json.has("eventId")) {
                    scannedEventId = json.getString("eventId")
                }
            } catch (_: Exception) {
                // continue
            }
        }

        val qrToken = normalizeQrToken(trimmed)
        if (qrToken.isEmpty()) {
            return ParsedQrScan(qrToken = "", error = QrScanError.INVALID)
        }

        if (
            expectedEventId.isNotBlank() &&
            !scannedEventId.isNullOrBlank() &&
            scannedEventId != expectedEventId
        ) {
            return ParsedQrScan(qrToken = qrToken, scannedEventId = scannedEventId, error = QrScanError.WRONG_EVENT)
        }

        return ParsedQrScan(qrToken = qrToken, scannedEventId = scannedEventId)
    }

    private fun normalizeQrToken(raw: String): String {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) return ""

        if (trimmed.startsWith("{")) {
            try {
                val json = JSONObject(trimmed)
                val fromJson = (json.optString("qrToken").ifBlank { json.optString("token") }).trim()
                extractHexToken(fromJson)?.let { return it }
            } catch (_: Exception) {
                // fall through
            }
        }

        if (trimmed.contains("://") || trimmed.contains("qrToken=") || trimmed.contains("token=")) {
            try {
                val url = if (trimmed.contains("://")) {
                    URL(trimmed)
                } else {
                    URL("https://local/?${trimmed.removePrefix("?")}")
                }
                val qp = url.query?.split("&").orEmpty().associate {
                    val parts = it.split("=", limit = 2)
                    parts[0] to (parts.getOrNull(1) ?: "")
                }
                val token = (qp["qrToken"] ?: qp["token"] ?: "").trim()
                extractHexToken(token)?.let { return it }
            } catch (_: Exception) {
                // fall through
            }
        }

        return extractHexToken(trimmed) ?: ""
    }

    private fun extractHexToken(value: String): String? {
        val hexOnly = value.replace(Regex("[^a-fA-F0-9]"), "")
        if (hexOnly.length == 32) return hexOnly.lowercase()
        val match = Regex("[a-fA-F0-9]{32}").find(value)
        return match?.value?.lowercase()
    }
}
