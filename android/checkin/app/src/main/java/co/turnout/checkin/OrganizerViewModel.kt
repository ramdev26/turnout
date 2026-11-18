package co.turnout.checkin

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.turnout.checkin.data.ApiException
import co.turnout.checkin.data.AuthStore
import co.turnout.checkin.data.BankTransferOrder
import co.turnout.checkin.data.CheckInApi
import co.turnout.checkin.data.EventStats
import co.turnout.checkin.data.OrganizerApi
import co.turnout.checkin.data.OrganizerAttendee
import co.turnout.checkin.data.OrganizerAuth
import co.turnout.checkin.data.OrganizerEvent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class LoginUiState(
    val loading: Boolean = false,
    val error: String? = null,
)

data class EventsUiState(
    val loading: Boolean = false,
    val refreshing: Boolean = false,
    val error: String? = null,
    val events: List<OrganizerEvent> = emptyList(),
)

data class EventHubUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val event: OrganizerEvent? = null,
    val stats: EventStats? = null,
    val staffPin: String? = null,
    val openingScanner: Boolean = false,
)

data class AttendeesUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val query: String = "",
    val attendees: List<OrganizerAttendee> = emptyList(),
)

data class BankOrdersUiState(
    val loading: Boolean = false,
    val error: String? = null,
    val statusFilter: String = "pending",
    val orders: List<BankTransferOrder> = emptyList(),
    val actingOrderId: String? = null,
)

class OrganizerViewModel(application: Application) : AndroidViewModel(application) {
    private val authStore = AuthStore(application)

    val auth: StateFlow<OrganizerAuth> = authStore.auth.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        OrganizerAuth(),
    )

    private val _loginState = MutableStateFlow(LoginUiState())
    val loginState: StateFlow<LoginUiState> = _loginState.asStateFlow()

    private val _eventsState = MutableStateFlow(EventsUiState())
    val eventsState: StateFlow<EventsUiState> = _eventsState.asStateFlow()

    private val _hubState = MutableStateFlow(EventHubUiState())
    val hubState: StateFlow<EventHubUiState> = _hubState.asStateFlow()

    private val _attendeesState = MutableStateFlow(AttendeesUiState())
    val attendeesState: StateFlow<AttendeesUiState> = _attendeesState.asStateFlow()

    private val _bankState = MutableStateFlow(BankOrdersUiState())
    val bankState: StateFlow<BankOrdersUiState> = _bankState.asStateFlow()

    private val _scannerReady = MutableStateFlow<ScannerLaunch?>(null)
    val scannerReady: StateFlow<ScannerLaunch?> = _scannerReady.asStateFlow()

    data class ScannerLaunch(
        val apiBaseUrl: String,
        val eventId: String,
        val staffPin: String,
        val eventTitle: String,
    )

    fun clearScannerLaunch() {
        _scannerReady.value = null
    }

    fun login(apiBaseUrl: String, email: String, password: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _loginState.value = LoginUiState(loading = true)
            try {
                val normalizedBase = CheckInApi.normalizeApiBaseUrl(apiBaseUrl)
                val result = withContext(Dispatchers.IO) {
                    OrganizerApi(normalizedBase).login(email, password)
                }
                authStore.saveLogin(
                    apiBaseUrl = normalizedBase,
                    authToken = result.authToken,
                    userId = result.user.uid,
                    email = result.user.email,
                    displayName = result.user.displayName,
                    role = result.user.role,
                )
                _loginState.value = LoginUiState()
                onSuccess()
            } catch (e: ApiException) {
                _loginState.value = LoginUiState(error = e.message)
            } catch (e: Exception) {
                _loginState.value = LoginUiState(
                    error = e.message?.takeIf { it.isNotBlank() } ?: "Could not sign in",
                )
            }
        }
    }

    fun logout(onDone: () -> Unit = {}) {
        viewModelScope.launch {
            authStore.clear()
            _eventsState.value = EventsUiState()
            _hubState.value = EventHubUiState()
            _attendeesState.value = AttendeesUiState()
            _bankState.value = BankOrdersUiState()
            onDone()
        }
    }

    fun loadEvents(force: Boolean = false) {
        val current = auth.value
        if (!current.isLoggedIn) return
        viewModelScope.launch {
            val hasData = _eventsState.value.events.isNotEmpty()
            _eventsState.update {
                it.copy(
                    loading = !hasData,
                    refreshing = hasData || force,
                    error = null,
                )
            }
            try {
                val events = withContext(Dispatchers.IO) {
                    api().listEvents()
                }
                _eventsState.value = EventsUiState(events = events)
            } catch (e: ApiException) {
                if (e.errorCode == "unauthorized") {
                    authStore.clear()
                }
                _eventsState.update {
                    it.copy(loading = false, refreshing = false, error = e.message)
                }
            } catch (e: Exception) {
                _eventsState.update {
                    it.copy(
                        loading = false,
                        refreshing = false,
                        error = e.message ?: "Could not load events",
                    )
                }
            }
        }
    }

    fun openEvent(eventId: String) {
        val cached = _eventsState.value.events.find { it.id == eventId }
        _hubState.value = EventHubUiState(loading = true, event = cached)
        viewModelScope.launch {
            try {
                val stats = withContext(Dispatchers.IO) { api().eventStats(eventId) }
                val config = withContext(Dispatchers.IO) {
                    runCatching { api().checkInConfig(eventId) }.getOrNull()
                }
                val event = cached ?: _eventsState.value.events.find { it.id == eventId }
                _hubState.value = EventHubUiState(
                    event = event,
                    stats = stats,
                    staffPin = config?.staffPin,
                )
            } catch (e: ApiException) {
                _hubState.update { it.copy(loading = false, error = e.message) }
            } catch (e: Exception) {
                _hubState.update {
                    it.copy(loading = false, error = e.message ?: "Could not load event")
                }
            }
        }
    }

    fun openDoorScanner(eventId: String, eventTitle: String) {
        val current = auth.value
        if (!current.isLoggedIn) return
        viewModelScope.launch {
            _hubState.update { it.copy(openingScanner = true, error = null) }
            try {
                val config = withContext(Dispatchers.IO) { api().checkInConfig(eventId) }
                _scannerReady.value = ScannerLaunch(
                    apiBaseUrl = current.apiBaseUrl,
                    eventId = eventId,
                    staffPin = config.staffPin,
                    eventTitle = eventTitle.ifBlank { "Event $eventId" },
                )
                _hubState.update { it.copy(openingScanner = false, staffPin = config.staffPin) }
            } catch (e: ApiException) {
                _hubState.update { it.copy(openingScanner = false, error = e.message) }
            } catch (e: Exception) {
                _hubState.update {
                    it.copy(openingScanner = false, error = e.message ?: "Could not open scanner")
                }
            }
        }
    }

    fun loadAttendees(eventId: String, query: String = _attendeesState.value.query) {
        viewModelScope.launch {
            _attendeesState.update { it.copy(loading = true, error = null, query = query) }
            try {
                val list = withContext(Dispatchers.IO) {
                    api().listAttendees(eventId, query = query)
                }
                _attendeesState.update { it.copy(loading = false, attendees = list) }
            } catch (e: ApiException) {
                _attendeesState.update { it.copy(loading = false, error = e.message) }
            } catch (e: Exception) {
                _attendeesState.update {
                    it.copy(loading = false, error = e.message ?: "Could not load attendees")
                }
            }
        }
    }

    fun loadBankOrders(eventId: String, status: String = _bankState.value.statusFilter) {
        viewModelScope.launch {
            _bankState.update {
                it.copy(loading = true, error = null, statusFilter = status)
            }
            try {
                val orders = withContext(Dispatchers.IO) {
                    api().listBankTransferOrders(eventId, status = status)
                }
                _bankState.update { it.copy(loading = false, orders = orders) }
            } catch (e: ApiException) {
                _bankState.update { it.copy(loading = false, error = e.message) }
            } catch (e: Exception) {
                _bankState.update {
                    it.copy(loading = false, error = e.message ?: "Could not load orders")
                }
            }
        }
    }

    fun confirmBankOrder(eventId: String, orderId: String) {
        viewModelScope.launch {
            _bankState.update { it.copy(actingOrderId = orderId, error = null) }
            try {
                withContext(Dispatchers.IO) { api().confirmBankTransfer(orderId) }
                _bankState.update { it.copy(actingOrderId = null) }
                loadBankOrders(eventId)
            } catch (e: ApiException) {
                _bankState.update { it.copy(actingOrderId = null, error = e.message) }
            } catch (e: Exception) {
                _bankState.update {
                    it.copy(actingOrderId = null, error = e.message ?: "Confirm failed")
                }
            }
        }
    }

    fun rejectBankOrder(eventId: String, orderId: String) {
        viewModelScope.launch {
            _bankState.update { it.copy(actingOrderId = orderId, error = null) }
            try {
                withContext(Dispatchers.IO) { api().rejectBankTransfer(orderId) }
                _bankState.update { it.copy(actingOrderId = null) }
                loadBankOrders(eventId)
            } catch (e: ApiException) {
                _bankState.update { it.copy(actingOrderId = null, error = e.message) }
            } catch (e: Exception) {
                _bankState.update {
                    it.copy(actingOrderId = null, error = e.message ?: "Reject failed")
                }
            }
        }
    }

    private fun api(): OrganizerApi {
        val current = auth.value
        return OrganizerApi(current.apiBaseUrl, current.authToken)
    }
}
