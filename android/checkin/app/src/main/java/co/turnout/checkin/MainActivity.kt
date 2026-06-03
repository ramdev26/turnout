package co.turnout.checkin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import co.turnout.checkin.ui.screens.PinScreen
import co.turnout.checkin.ui.screens.ScannerScreen
import co.turnout.checkin.ui.screens.SetupScreen
import co.turnout.checkin.ui.theme.TurnoutCheckInTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val vm: CheckInViewModel = viewModel()
            val session by vm.session.collectAsState()
            val scannerState by vm.scannerState.collectAsState()
            val unlocking by vm.unlocking.collectAsState()
            val unlockError by vm.unlockError.collectAsState()

            TurnoutCheckInTheme {
                when {
                    !session.isConfigured -> {
                        SetupScreen(
                            session = session,
                            onContinue = { api, eventId -> vm.saveSetup(api, eventId) },
                        )
                    }
                    !session.isUnlocked -> {
                        PinScreen(
                            eventId = session.eventId,
                            apiBaseUrl = session.apiBaseUrl,
                            unlocking = unlocking,
                            unlockError = unlockError,
                            onUnlock = vm::verifyPin,
                            onBack = {
                                vm.saveSetup(session.apiBaseUrl, "")
                            },
                        )
                    }
                    else -> {
                        ScannerScreen(
                            eventTitle = session.eventTitle,
                            scannerState = scannerState,
                            onScan = vm::onQrScanned,
                            onManualSubmit = vm::submitManualToken,
                            onSignOut = vm::signOut,
                        )
                    }
                }
            }
        }
    }
}
