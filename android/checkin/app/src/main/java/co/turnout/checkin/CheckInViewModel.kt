package co.turnout.checkin

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.turnout.checkin.data.ApiException
import co.turnout.checkin.data.Attendee
import co.turnout.checkin.data.CheckInApi
import co.turnout.checkin.data.CheckInApi.Companion.normalizeStaffPin as normalizePin
import co.turnout.checkin.data.CheckInSession
import co.turnout.checkin.data.OfflineRosterStore
import co.turnout.checkin.data.PendingOfflineScan
import co.turnout.checkin.data.QrPayloadParser
import co.turnout.checkin.data.QrScanError
import co.turnout.checkin.data.SessionStore
import java.time.Instant
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

enum class ScanStatus {
    IDLE,
    SUCCESS,
    WARNING,
    ERROR,
}

data class ScannerUiState(
    val status: ScanStatus = ScanStatus.IDLE,
    val statusMessage: String = "Align QR inside the frame",
    val lastAttendee: Attendee? = null,
)

data class OfflineUiState(
    val rosterCount: Int = 0,
    val rosterTotal: Int = 0,
    val pendingCount: Int = 0,
    val downloadedAt: String? = null,
    val downloading: Boolean = false,
    val syncing: Boolean = false,
    val statusMessage: String? = null,
    val error: String? = null,
) {
    val hasRoster: Boolean get() = rosterCount > 0
}

class CheckInViewModel(application: Application) : AndroidViewModel(application) {
    private val store = SessionStore(application)
    private val offlineStore = OfflineRosterStore(application)

    val session: StateFlow<CheckInSession> = store.session.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        CheckInSession(),
    )

    private val _scannerState = MutableStateFlow(ScannerUiState())
    val scannerState: StateFlow<ScannerUiState> = _scannerState.asStateFlow()

    private val _offlineState = MutableStateFlow(OfflineUiState())
    val offlineState: StateFlow<OfflineUiState> = _offlineState.asStateFlow()

    private val _unlocking = MutableStateFlow(false)
    val unlocking: StateFlow<Boolean> = _unlocking.asStateFlow()

    private val _unlockError = MutableStateFlow<String?>(null)
    val unlockError: StateFlow<String?> = _unlockError.asStateFlow()

    private val scanMutex = Mutex()
    private val syncMutex = Mutex()
    private var lastToken: String? = null
    private var cooldownUntil = 0L
    private val cooldownMs = 2800L

    init {
        viewModelScope.launch {
            session.collect { current ->
                if (current.isUnlocked) {
                    refreshOfflineStats(current.eventId)
                }
            }
        }
        viewModelScope.launch {
            while (isActive) {
                delay(20_000)
                val current = session.value
                if (current.isUnlocked && current.offlineEnabled) {
                    syncPending(silent = true)
                }
            }
        }
    }

    fun saveSetup(apiBaseUrl: String, eventId: String) {
        viewModelScope.launch {
            store.saveSetup(apiBaseUrl, eventId)
        }
    }

    fun verifyPin(pin: String) {
        val current = session.value
        if (current.eventId.isBlank()) {
            _unlockError.value = "Set event ID first"
            return
        }
        viewModelScope.launch {
            _unlocking.value = true
            _unlockError.value = null
            try {
                val normalizedPin = normalizePin(pin)
                if (normalizedPin.length < 4) {
                    _unlockError.value = "PIN must be 4–8 digits."
                    return@launch
                }
                val title = withContext(Dispatchers.IO) {
                    CheckInApi(current.apiBaseUrl).verifyPin(current.eventId, normalizedPin)
                }
                store.saveUnlock(normalizedPin, title)
                refreshOfflineStats(current.eventId)
            } catch (e: ApiException) {
                _unlockError.value = e.message
                store.clearUnlock()
            } catch (e: Exception) {
                _unlockError.value = e.message?.takeIf { it.isNotBlank() }
                    ?: e.javaClass.simpleName
                    ?: "Could not verify PIN"
            } finally {
                _unlocking.value = false
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            store.clearUnlock()
            _scannerState.value = ScannerUiState()
            _offlineState.value = OfflineUiState()
        }
    }

    fun setOfflineEnabled(enabled: Boolean) {
        viewModelScope.launch {
            store.setOfflineEnabled(enabled)
            _offlineState.update {
                it.copy(
                    statusMessage = if (enabled) {
                        "Offline mode on — download the roster before doors open."
                    } else {
                        "Online check-in restored"
                    },
                    error = null,
                )
            }
            if (enabled) {
                syncPending(silent = true)
            }
        }
    }

    fun downloadRoster() {
        val current = session.value
        if (!current.isUnlocked) return
        viewModelScope.launch {
            _offlineState.update { it.copy(downloading = true, error = null, statusMessage = "Downloading roster…") }
            try {
                withContext(Dispatchers.IO) {
                    val api = CheckInApi(current.apiBaseUrl)
                    var afterId: Long? = null
                    var first = true
                    var total = 0
                    var downloadedAt = Instant.now().toString()
                    var page = 0
                    do {
                        val pageResult = api.downloadRosterPage(
                            eventId = current.eventId,
                            staffPin = current.staffPin,
                            afterId = afterId,
                            limit = 1000,
                        )
                        total = pageResult.total
                        downloadedAt = pageResult.downloadedAt
                        if (first) {
                            offlineStore.replaceRoster(
                                current.eventId,
                                pageResult.attendees,
                                total,
                                downloadedAt,
                            )
                            first = false
                        } else {
                            offlineStore.mergeRoster(current.eventId, pageResult.attendees, total)
                        }
                        afterId = pageResult.nextAfterId?.toLongOrNull()
                        page += 1
                        _offlineState.update {
                            it.copy(statusMessage = "Downloaded page $page · ${minOf(page * 1000, total)} / $total")
                        }
                    } while (afterId != null)
                }
                refreshOfflineStats(current.eventId)
                _offlineState.update {
                    it.copy(statusMessage = "Roster ready — ${it.rosterCount} attendees on this phone")
                }
            } catch (e: Exception) {
                _offlineState.update {
                    it.copy(error = e.message ?: "Could not download roster", statusMessage = null)
                }
            } finally {
                _offlineState.update { it.copy(downloading = false) }
            }
        }
    }

    fun syncPending(silent: Boolean = false) {
        val current = session.value
        if (!current.isUnlocked) return
        viewModelScope.launch {
            syncMutex.withLock {
                val pending = withContext(Dispatchers.IO) { offlineStore.listPending(current.eventId) }
                if (pending.isEmpty()) {
                    pullDelta(current)
                    return@withLock
                }
                if (!silent) {
                    _offlineState.update {
                        it.copy(syncing = true, error = null, statusMessage = "Syncing ${pending.size} scans…")
                    }
                } else {
                    _offlineState.update { it.copy(syncing = true) }
                }
                try {
                    withContext(Dispatchers.IO) {
                        val api = CheckInApi(current.apiBaseUrl)
                        val chunkSize = 100
                        var syncedTotal = 0
                        var failedTotal = 0
                        var i = 0
                        while (i < pending.size) {
                            val chunk = pending.subList(i, minOf(i + chunkSize, pending.size))
                            val result = api.syncBatch(current.eventId, current.staffPin, chunk)
                            val doneIds = mutableListOf<String>()
                            for (item in result.results) {
                                val id = item.clientScanId ?: continue
                                val original = chunk.firstOrNull { it.clientScanId == id }
                                if (item.ok) {
                                    doneIds.add(id)
                                    val token = original?.qrToken
                                    if (!token.isNullOrBlank()) {
                                        offlineStore.markCheckedIn(
                                            current.eventId,
                                            token,
                                            item.attendee?.checkedInAt ?: original.scannedAt,
                                        )
                                    }
                                } else if (item.error == "attendee_not_found") {
                                    doneIds.add(id)
                                    failedTotal += 1
                                } else {
                                    failedTotal += 1
                                }
                            }
                            offlineStore.removePending(current.eventId, doneIds)
                            syncedTotal += result.synced
                            i += chunkSize
                        }
                        pullDelta(current)
                        syncedTotal to failedTotal
                    }.also { (syncedTotal, failedTotal) ->
                        refreshOfflineStats(current.eventId)
                        if (!silent || failedTotal > 0) {
                            _offlineState.update {
                                it.copy(
                                    statusMessage = if (failedTotal > 0) {
                                        "Synced $syncedTotal · $failedTotal need attention"
                                    } else {
                                        "All offline scans synced ($syncedTotal)"
                                    },
                                )
                            }
                        }
                    }
                } catch (e: Exception) {
                    if (!silent) {
                        _offlineState.update {
                            it.copy(error = e.message ?: "Sync failed", statusMessage = null)
                        }
                    }
                } finally {
                    _offlineState.update { it.copy(syncing = false) }
                }
            }
        }
    }

    private suspend fun pullDelta(current: CheckInSession) {
        val meta = withContext(Dispatchers.IO) { offlineStore.getMeta(current.eventId) } ?: return
        val since = meta.lastDeltaAt ?: meta.downloadedAt
        try {
            val delta = withContext(Dispatchers.IO) {
                CheckInApi(current.apiBaseUrl).rosterDelta(current.eventId, current.staffPin, since)
            }
            withContext(Dispatchers.IO) {
                offlineStore.applyUpdates(current.eventId, delta.updates, delta.serverTime)
            }
            refreshOfflineStats(current.eventId)
        } catch (_: Exception) {
            // best-effort
        }
    }

    private fun refreshOfflineStats(eventId: String) {
        if (eventId.isBlank()) return
        viewModelScope.launch(Dispatchers.IO) {
            val count = offlineStore.rosterCount(eventId)
            val pending = offlineStore.pendingCount(eventId)
            val meta = offlineStore.getMeta(eventId)
            _offlineState.update {
                it.copy(
                    rosterCount = count,
                    rosterTotal = meta?.total ?: count,
                    pendingCount = pending,
                    downloadedAt = meta?.downloadedAt,
                )
            }
        }
    }

    fun onQrScanned(raw: String) {
        val current = session.value
        if (!current.isUnlocked) return

        viewModelScope.launch {
            scanMutex.withLock {
                val parsed = QrPayloadParser.parse(raw, current.eventId)
                when (parsed.error) {
                    QrScanError.EMPTY, QrScanError.INVALID -> {
                        _scannerState.update {
                            it.copy(
                                status = ScanStatus.ERROR,
                                statusMessage = "Unrecognized QR code. Scan the ticket QR from the confirmation page.",
                                lastAttendee = null,
                            )
                        }
                        return@withLock
                    }
                    QrScanError.WRONG_EVENT -> {
                        _scannerState.update {
                            it.copy(
                                status = ScanStatus.ERROR,
                                statusMessage = "This ticket belongs to a different event.",
                                lastAttendee = null,
                            )
                        }
                        return@withLock
                    }
                    null -> Unit
                }

                val now = System.currentTimeMillis()
                if (parsed.qrToken == lastToken && now < cooldownUntil) {
                    return@withLock
                }

                lastToken = parsed.qrToken
                cooldownUntil = now + cooldownMs
                _scannerState.update {
                    it.copy(
                        status = ScanStatus.IDLE,
                        statusMessage = if (current.offlineEnabled) "Checking in (offline)…" else "Checking in…",
                        lastAttendee = null,
                    )
                }

                try {
                    val result = if (current.offlineEnabled) {
                        performOfflineCheckIn(current, parsed.qrToken)
                    } else {
                        withContext(Dispatchers.IO) {
                            CheckInApi(current.apiBaseUrl).checkIn(
                                current.eventId,
                                current.staffPin,
                                parsed.qrToken,
                            )
                        }
                    }
                    if (result.alreadyCheckedIn) {
                        _scannerState.update {
                            it.copy(
                                status = ScanStatus.WARNING,
                                statusMessage = result.message,
                                lastAttendee = result.attendee,
                            )
                        }
                    } else {
                        _scannerState.update {
                            it.copy(
                                status = ScanStatus.SUCCESS,
                                statusMessage = result.message,
                                lastAttendee = result.attendee,
                            )
                        }
                    }
                } catch (e: ApiException) {
                    lastToken = null
                    _scannerState.update {
                        it.copy(
                            status = ScanStatus.ERROR,
                            statusMessage = e.message,
                            lastAttendee = null,
                        )
                    }
                } catch (e: Exception) {
                    lastToken = null
                    _scannerState.update {
                        it.copy(
                            status = ScanStatus.ERROR,
                            statusMessage = e.message ?: "Check-in failed",
                            lastAttendee = null,
                        )
                    }
                }
            }
        }
    }

    private suspend fun performOfflineCheckIn(current: CheckInSession, qrToken: String): co.turnout.checkin.data.CheckInResult {
        return withContext(Dispatchers.IO) {
            val row = offlineStore.lookup(current.eventId, qrToken)
                ?: throw ApiException(
                    "attendee_not_found",
                    "Ticket not in the offline roster. Re-download the roster when you have signal.",
                )
            if (!row.checkedInAt.isNullOrBlank()) {
                return@withContext co.turnout.checkin.data.CheckInResult(
                    ok = true,
                    alreadyCheckedIn = true,
                    message = "${row.fullName} was already checked in.",
                    attendee = Attendee(row.id, row.fullName, row.email, row.ticketName, row.checkedInAt),
                )
            }
            val scannedAt = Instant.now().toString()
            val updated = offlineStore.markCheckedIn(current.eventId, qrToken, scannedAt)
            offlineStore.enqueue(
                PendingOfflineScan(
                    clientScanId = OfflineRosterStore.newClientScanId(),
                    eventId = current.eventId,
                    qrToken = qrToken,
                    scannedAt = scannedAt,
                    fullName = row.fullName,
                    email = row.email,
                    ticketName = row.ticketName,
                ),
            )
            refreshOfflineStats(current.eventId)
            viewModelScope.launch { syncPending(silent = true) }
            co.turnout.checkin.data.CheckInResult(
                ok = true,
                alreadyCheckedIn = false,
                message = "Welcome, ${row.fullName}! Saved offline — will sync when online.",
                attendee = Attendee(
                    id = updated?.id ?: row.id,
                    fullName = row.fullName,
                    email = row.email,
                    ticketName = row.ticketName,
                    checkedInAt = scannedAt,
                ),
            )
        }
    }

    fun submitManualToken(token: String) {
        onQrScanned(token)
    }
}
