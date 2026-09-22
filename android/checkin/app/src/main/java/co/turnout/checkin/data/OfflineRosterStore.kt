package co.turnout.checkin.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

data class OfflineRosterAttendee(
    val id: String,
    val eventId: String,
    val qrToken: String,
    val fullName: String,
    val email: String,
    val ticketName: String,
    val checkedInAt: String?,
)

data class PendingOfflineScan(
    val clientScanId: String,
    val eventId: String,
    val qrToken: String,
    val scannedAt: String,
    val fullName: String,
    val email: String,
    val ticketName: String,
)

data class OfflineRosterMeta(
    val eventId: String,
    val total: Int,
    val downloadedAt: String,
    val lastDeltaAt: String?,
)

/**
 * Lightweight file-backed roster + scan queue for door devices with weak signal.
 * Avoids Room so large events (10k+) stay simple to ship.
 */
class OfflineRosterStore(context: Context) {
    private val root = File(context.filesDir, "offline_checkin").also { it.mkdirs() }

    private fun rosterFile(eventId: String) = File(root, "roster_${eventId.trim()}.json")
    private fun queueFile(eventId: String) = File(root, "queue_${eventId.trim()}.json")
    private fun metaFile(eventId: String) = File(root, "meta_${eventId.trim()}.json")

    @Synchronized
    fun getMeta(eventId: String): OfflineRosterMeta? {
        val file = metaFile(eventId)
        if (!file.exists()) return null
        return try {
            val json = JSONObject(file.readText())
            OfflineRosterMeta(
                eventId = json.optString("eventId", eventId),
                total = json.optInt("total"),
                downloadedAt = json.optString("downloadedAt"),
                lastDeltaAt = json.optString("lastDeltaAt").ifBlank { null },
            )
        } catch (_: Exception) {
            null
        }
    }

    @Synchronized
    fun setMeta(meta: OfflineRosterMeta) {
        val json = JSONObject()
            .put("eventId", meta.eventId)
            .put("total", meta.total)
            .put("downloadedAt", meta.downloadedAt)
            .put("lastDeltaAt", meta.lastDeltaAt)
        metaFile(meta.eventId).writeText(json.toString())
    }

    @Synchronized
    fun loadRosterMap(eventId: String): MutableMap<String, OfflineRosterAttendee> {
        val file = rosterFile(eventId)
        val map = linkedMapOf<String, OfflineRosterAttendee>()
        if (!file.exists()) return map
        return try {
            val arr = JSONArray(file.readText())
            for (i in 0 until arr.length()) {
                val o = arr.optJSONObject(i) ?: continue
                val token = o.optString("qrToken").lowercase()
                if (token.isBlank()) continue
                map[token] = OfflineRosterAttendee(
                    id = o.optString("id"),
                    eventId = o.optString("eventId", eventId),
                    qrToken = token,
                    fullName = o.optString("fullName"),
                    email = o.optString("email"),
                    ticketName = o.optString("ticketName"),
                    checkedInAt = o.optString("checkedInAt").ifBlank { null },
                )
            }
            map
        } catch (_: Exception) {
            linkedMapOf()
        }
    }

    @Synchronized
    fun saveRosterMap(eventId: String, map: Map<String, OfflineRosterAttendee>) {
        val arr = JSONArray()
        for (a in map.values) {
            arr.put(
                JSONObject()
                    .put("id", a.id)
                    .put("eventId", a.eventId)
                    .put("qrToken", a.qrToken.lowercase())
                    .put("fullName", a.fullName)
                    .put("email", a.email)
                    .put("ticketName", a.ticketName)
                    .put("checkedInAt", a.checkedInAt),
            )
        }
        rosterFile(eventId).writeText(arr.toString())
    }

    @Synchronized
    fun replaceRoster(eventId: String, attendees: List<OfflineRosterAttendee>, total: Int, downloadedAt: String) {
        val map = linkedMapOf<String, OfflineRosterAttendee>()
        for (a in attendees) {
            map[a.qrToken.lowercase()] = a.copy(qrToken = a.qrToken.lowercase(), eventId = eventId)
        }
        saveRosterMap(eventId, map)
        setMeta(
            OfflineRosterMeta(
                eventId = eventId,
                total = total,
                downloadedAt = downloadedAt,
                lastDeltaAt = downloadedAt,
            ),
        )
    }

    @Synchronized
    fun mergeRoster(eventId: String, attendees: List<OfflineRosterAttendee>, total: Int? = null) {
        val map = loadRosterMap(eventId)
        for (a in attendees) {
            map[a.qrToken.lowercase()] = a.copy(qrToken = a.qrToken.lowercase(), eventId = eventId)
        }
        saveRosterMap(eventId, map)
        val existing = getMeta(eventId)
        if (existing != null && total != null) {
            setMeta(existing.copy(total = total))
        }
    }

    @Synchronized
    fun applyUpdates(eventId: String, updates: List<OfflineRosterAttendee>, serverTime: String) {
        val map = loadRosterMap(eventId)
        for (a in updates) {
            val token = a.qrToken.lowercase()
            val prev = map[token]
            map[token] = (prev ?: a).copy(
                id = a.id.ifBlank { prev?.id.orEmpty() },
                eventId = eventId,
                qrToken = token,
                fullName = a.fullName.ifBlank { prev?.fullName.orEmpty() },
                email = a.email.ifBlank { prev?.email.orEmpty() },
                ticketName = a.ticketName.ifBlank { prev?.ticketName.orEmpty() },
                checkedInAt = a.checkedInAt ?: prev?.checkedInAt,
            )
        }
        saveRosterMap(eventId, map)
        val meta = getMeta(eventId)
        if (meta != null) {
            setMeta(meta.copy(lastDeltaAt = serverTime))
        }
    }

    @Synchronized
    fun lookup(eventId: String, qrToken: String): OfflineRosterAttendee? {
        return loadRosterMap(eventId)[qrToken.lowercase()]
    }

    @Synchronized
    fun markCheckedIn(eventId: String, qrToken: String, checkedInAt: String): OfflineRosterAttendee? {
        val map = loadRosterMap(eventId)
        val token = qrToken.lowercase()
        val existing = map[token] ?: return null
        val updated = existing.copy(checkedInAt = checkedInAt)
        map[token] = updated
        saveRosterMap(eventId, map)
        return updated
    }

    @Synchronized
    fun rosterCount(eventId: String): Int = loadRosterMap(eventId).size

    @Synchronized
    fun listPending(eventId: String): List<PendingOfflineScan> {
        val file = queueFile(eventId)
        if (!file.exists()) return emptyList()
        return try {
            val arr = JSONArray(file.readText())
            buildList {
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    add(
                        PendingOfflineScan(
                            clientScanId = o.optString("clientScanId"),
                            eventId = o.optString("eventId", eventId),
                            qrToken = o.optString("qrToken").lowercase(),
                            scannedAt = o.optString("scannedAt"),
                            fullName = o.optString("fullName"),
                            email = o.optString("email"),
                            ticketName = o.optString("ticketName"),
                        ),
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun enqueue(scan: PendingOfflineScan) {
        val pending = listPending(scan.eventId).toMutableList()
        pending.add(scan.copy(qrToken = scan.qrToken.lowercase()))
        savePending(scan.eventId, pending)
    }

    @Synchronized
    fun removePending(eventId: String, clientScanIds: Collection<String>) {
        if (clientScanIds.isEmpty()) return
        val keep = listPending(eventId).filterNot { it.clientScanId in clientScanIds }
        savePending(eventId, keep)
    }

    @Synchronized
    fun pendingCount(eventId: String): Int = listPending(eventId).size

    private fun savePending(eventId: String, pending: List<PendingOfflineScan>) {
        val arr = JSONArray()
        for (s in pending) {
            arr.put(
                JSONObject()
                    .put("clientScanId", s.clientScanId)
                    .put("eventId", s.eventId)
                    .put("qrToken", s.qrToken)
                    .put("scannedAt", s.scannedAt)
                    .put("fullName", s.fullName)
                    .put("email", s.email)
                    .put("ticketName", s.ticketName),
            )
        }
        queueFile(eventId).writeText(arr.toString())
    }

    companion object {
        fun newClientScanId(): String = UUID.randomUUID().toString()
    }
}
