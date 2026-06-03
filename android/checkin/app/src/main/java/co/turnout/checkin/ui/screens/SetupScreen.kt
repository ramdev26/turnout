package co.turnout.checkin.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import co.turnout.checkin.BuildConfig
import co.turnout.checkin.data.CheckInSession
import co.turnout.checkin.ui.components.TurnoutLogo
import co.turnout.checkin.ui.theme.TurnoutColors

@Composable
fun SetupScreen(
    session: CheckInSession,
    onContinue: (apiBaseUrl: String, eventId: String) -> Unit,
) {
    var apiBase by rememberSaveable { mutableStateOf(session.apiBaseUrl.ifBlank { BuildConfig.DEFAULT_API_BASE }) }
    var eventId by rememberSaveable { mutableStateOf(session.eventId) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        TurnoutLogo(modifier = Modifier.size(72.dp))
        Spacer(modifier = Modifier.height(20.dp))
        Text(
            text = "Turnout Check-in",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = TurnoutColors.Text,
        )
        Text(
            text = "Door scanner for your event",
            style = MaterialTheme.typography.bodyMedium,
            color = TurnoutColors.TextMuted,
        )
        Text(
            text = "API URL = your Turnout site only (no /api at the end)",
            style = MaterialTheme.typography.labelSmall,
            color = TurnoutColors.TextSubtle,
            modifier = Modifier.padding(top = 8.dp),
        )
        Spacer(modifier = Modifier.height(32.dp))

        OutlinedTextField(
            value = apiBase,
            onValueChange = { apiBase = it },
            label = { Text("API URL") },
            placeholder = { Text(BuildConfig.DEFAULT_API_BASE) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = turnoutFieldColors(),
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = eventId,
            onValueChange = { eventId = it.filter { ch -> ch.isDigit() } },
            label = { Text("Event ID") },
            placeholder = { Text("e.g. 42") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = turnoutFieldColors(),
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = { onContinue(apiBase.trim(), eventId.trim()) },
            enabled = apiBase.isNotBlank() && eventId.isNotBlank(),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = TurnoutColors.Lime500,
                contentColor = TurnoutColors.Teal900,
            ),
        ) {
            Text("Continue", fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun turnoutFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedTextColor = TurnoutColors.Text,
    unfocusedTextColor = TurnoutColors.Text,
    focusedBorderColor = TurnoutColors.Lime500,
    unfocusedBorderColor = TurnoutColors.TextSubtle,
    focusedLabelColor = TurnoutColors.Lime400,
    unfocusedLabelColor = TurnoutColors.TextMuted,
    cursorColor = TurnoutColors.Lime500,
)
