package co.turnout.checkin

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.turnout.checkin.data.ApiException
import co.turnout.checkin.data.Attendee
import co.turnout.checkin.data.CheckInApi
import co.turnout.checkin.data.CheckInApi.Companion.normalizeStaffPin as normalizePin
import co.turnout.checkin.data.CheckInSession
import co.turnout.checkin.data.QrPayloadParser
import co.turnout.checkin.data.QrScanError
import co.turnout.checkin.data.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.Dispatchers
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

class CheckInViewModel(application: Application) : AndroidViewModel(application) {
    private val store = SessionStore(application)

    val session: StateFlow<CheckInSession> = store.session.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        CheckInSession(),
    )

    private val _scannerState = MutableStateFlow(ScannerUiState())
    val scannerState: StateFlow<ScannerUiState> = _scannerState.asStateFlow()

    private val _unlocking = MutableStateFlow(false)
    val unlocking: StateFlow<Boolean> = _unlocking.asStateFlow()

    private val _unlockError = MutableStateFlow<String?>(null)
    val unlockError: StateFlow<String?> = _unlockError.asStateFlow()

    private val scanMutex = Mutex()
    private var lastToken: String? = null
    private var cooldownUntil = 0L
    private val cooldownMs = 2800L

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
                    it.copy(status = ScanStatus.IDLE, statusMessage = "Checking in…", lastAttendee = null)
                }

                try {
                    val result = withContext(Dispatchers.IO) {
                        CheckInApi(current.apiBaseUrl).checkIn(
                            current.eventId,
                            current.staffPin,
                            parsed.qrToken,
                        )
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

    fun submitManualToken(token: String) {
        onQrScanned(token)
    }
}
