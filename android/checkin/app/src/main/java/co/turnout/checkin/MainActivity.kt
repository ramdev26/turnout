package co.turnout.checkin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import co.turnout.checkin.ui.screens.ModeSelectScreen
import co.turnout.checkin.ui.screens.OrganizerAttendeesScreen
import co.turnout.checkin.ui.screens.OrganizerBankOrdersScreen
import co.turnout.checkin.ui.screens.OrganizerEventHubScreen
import co.turnout.checkin.ui.screens.OrganizerEventsScreen
import co.turnout.checkin.ui.screens.OrganizerLoginScreen
import co.turnout.checkin.ui.screens.PinScreen
import co.turnout.checkin.ui.screens.ScannerScreen
import co.turnout.checkin.ui.screens.SetupScreen
import co.turnout.checkin.ui.theme.TurnoutCheckInTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val checkInVm: CheckInViewModel = viewModel()
            val organizerVm: OrganizerViewModel = viewModel()
            val session by checkInVm.session.collectAsState()
            val scannerState by checkInVm.scannerState.collectAsState()
            val unlocking by checkInVm.unlocking.collectAsState()
            val unlockError by checkInVm.unlockError.collectAsState()
            val auth by organizerVm.auth.collectAsState()
            val loginState by organizerVm.loginState.collectAsState()
            val eventsState by organizerVm.eventsState.collectAsState()
            val hubState by organizerVm.hubState.collectAsState()
            val attendeesState by organizerVm.attendeesState.collectAsState()
            val bankState by organizerVm.bankState.collectAsState()
            val scannerReady by organizerVm.scannerReady.collectAsState()

            val navController = rememberNavController()
            var staffFromOrganizer by remember { mutableStateOf(false) }
            var organizerReturnEventId by remember { mutableStateOf<String?>(null) }

            LaunchedEffect(scannerReady) {
                val launch = scannerReady ?: return@LaunchedEffect
                checkInVm.unlockDirect(
                    apiBaseUrl = launch.apiBaseUrl,
                    eventId = launch.eventId,
                    staffPin = launch.staffPin,
                    eventTitle = launch.eventTitle,
                )
                staffFromOrganizer = true
                organizerReturnEventId = launch.eventId
                organizerVm.clearScannerLaunch()
                navController.navigate("staff") {
                    launchSingleTop = true
                }
            }

            TurnoutCheckInTheme {
                NavHost(
                    navController = navController,
                    startDestination = "home",
                ) {
                    composable("home") {
                        ModeSelectScreen(
                            auth = auth,
                            onOrganizer = {
                                if (auth.isLoggedIn) {
                                    navController.navigate("organizer_events")
                                } else {
                                    navController.navigate("organizer_login")
                                }
                            },
                            onStaffScanner = {
                                staffFromOrganizer = false
                                organizerReturnEventId = null
                                navController.navigate("staff")
                            },
                        )
                    }

                    composable("organizer_login") {
                        OrganizerLoginScreen(
                            loginState = loginState,
                            onBack = { navController.popBackStack() },
                            onLogin = { email, password ->
                                organizerVm.login(email, password) {
                                    navController.navigate("organizer_events") {
                                        popUpTo("organizer_login") { inclusive = true }
                                    }
                                }
                            },
                        )
                    }

                    composable("organizer_events") {
                        OrganizerEventsScreen(
                            auth = auth,
                            state = eventsState,
                            onBack = {
                                navController.popBackStack("home", inclusive = false)
                            },
                            onRefresh = { organizerVm.loadEvents(force = true) },
                            onLogout = {
                                organizerVm.logout {
                                    navController.popBackStack("home", inclusive = false)
                                }
                            },
                            onOpenEvent = { event ->
                                navController.navigate("organizer_event/${event.id}")
                            },
                        )
                    }

                    composable(
                        route = "organizer_event/{eventId}",
                        arguments = listOf(navArgument("eventId") { type = NavType.StringType }),
                    ) { entry ->
                        val eventId = entry.arguments?.getString("eventId").orEmpty()
                        OrganizerEventHubScreen(
                            eventId = eventId,
                            state = hubState,
                            onBack = { navController.popBackStack() },
                            onLoad = { organizerVm.openEvent(eventId) },
                            onOpenScanner = {
                                val title = hubState.event?.title ?: "Event $eventId"
                                organizerVm.openDoorScanner(eventId, title)
                            },
                            onOpenAttendees = {
                                navController.navigate("organizer_attendees/$eventId")
                            },
                            onOpenBankOrders = {
                                navController.navigate("organizer_bank/$eventId")
                            },
                        )
                    }

                    composable(
                        route = "organizer_attendees/{eventId}",
                        arguments = listOf(navArgument("eventId") { type = NavType.StringType }),
                    ) { entry ->
                        val eventId = entry.arguments?.getString("eventId").orEmpty()
                        OrganizerAttendeesScreen(
                            eventId = eventId,
                            state = attendeesState,
                            onBack = { navController.popBackStack() },
                            onSearch = { q -> organizerVm.loadAttendees(eventId, q) },
                        )
                    }

                    composable(
                        route = "organizer_bank/{eventId}",
                        arguments = listOf(navArgument("eventId") { type = NavType.StringType }),
                    ) { entry ->
                        val eventId = entry.arguments?.getString("eventId").orEmpty()
                        OrganizerBankOrdersScreen(
                            eventId = eventId,
                            state = bankState,
                            onBack = { navController.popBackStack() },
                            onLoad = { status -> organizerVm.loadBankOrders(eventId, status) },
                            onConfirm = { id -> organizerVm.confirmBankOrder(eventId, id) },
                            onReject = { id -> organizerVm.rejectBankOrder(eventId, id) },
                        )
                    }

                    composable("staff") {
                        val offlineState by checkInVm.offlineState.collectAsState()
                        when {
                            !session.isConfigured -> {
                                SetupScreen(
                                    session = session,
                                    onContinue = { api, eventId -> checkInVm.saveSetup(api, eventId) },
                                    onBack = {
                                        checkInVm.resetStaffSession()
                                        navController.popBackStack()
                                    },
                                )
                            }
                            !session.isUnlocked -> {
                                PinScreen(
                                    eventId = session.eventId,
                                    apiBaseUrl = session.apiBaseUrl,
                                    unlocking = unlocking,
                                    unlockError = unlockError,
                                    onUnlock = checkInVm::verifyPin,
                                    onBack = {
                                        if (staffFromOrganizer) {
                                            checkInVm.resetStaffSession()
                                            val returnId = organizerReturnEventId
                                            staffFromOrganizer = false
                                            if (returnId != null) {
                                                navController.popBackStack("organizer_event/$returnId", inclusive = false)
                                            } else {
                                                navController.popBackStack()
                                            }
                                        } else {
                                            checkInVm.saveSetup(session.apiBaseUrl, "")
                                        }
                                    },
                                )
                            }
                            else -> {
                                ScannerScreen(
                                    eventTitle = session.eventTitle,
                                    scannerState = scannerState,
                                    offlineEnabled = session.offlineEnabled,
                                    offlineState = offlineState,
                                    onToggleOffline = checkInVm::setOfflineEnabled,
                                    onDownloadRoster = checkInVm::downloadRoster,
                                    onSyncPending = { checkInVm.syncPending(silent = false) },
                                    onScan = checkInVm::onQrScanned,
                                    onManualSubmit = checkInVm::submitManualToken,
                                    onSignOut = {
                                        checkInVm.signOut()
                                        if (staffFromOrganizer) {
                                            checkInVm.resetStaffSession()
                                            val returnId = organizerReturnEventId
                                            staffFromOrganizer = false
                                            if (returnId != null) {
                                                navController.navigate("organizer_event/$returnId") {
                                                    popUpTo("organizer_events") { inclusive = false }
                                                    launchSingleTop = true
                                                }
                                            } else {
                                                navController.popBackStack("home", inclusive = false)
                                            }
                                        }
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
