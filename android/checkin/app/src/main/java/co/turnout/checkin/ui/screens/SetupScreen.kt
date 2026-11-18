package co.turnout.checkin.ui.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import co.turnout.checkin.BuildConfig
import co.turnout.checkin.data.CheckInSession
import co.turnout.checkin.ui.components.TurnoutLogo
import co.turnout.checkin.ui.components.TurnoutScrollColumn
import co.turnout.checkin.ui.theme.TurnoutColors

@Composable
fun SetupScreen(
    session: CheckInSession,
    onContinue: (apiBaseUrl: String, eventId: String) -> Unit,
    onBack: (() -> Unit)? = null,
) {
    var eventId by rememberSaveable { mutableStateOf(session.eventId) }
    val focusManager = LocalFocusManager.current
    val apiBase = BuildConfig.DEFAULT_API_BASE

    fun submit() {
        if (eventId.isBlank()) return
        focusManager.clearFocus()
        onContinue(apiBase, eventId.trim())
    }

    TurnoutScrollColumn(horizontalAlignment = Alignment.CenterHorizontally) {
        if (onBack != null) {
            IconButton(
                onClick = onBack,
                modifier = Modifier.align(Alignment.Start),
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = TurnoutColors.Text,
                )
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        TurnoutLogo(modifier = Modifier.size(64.dp))
        Spacer(modifier = Modifier.height(18.dp))
        Text(
            text = "Staff scanner",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = TurnoutColors.Text,
        )
        Text(
            text = "Enter the event ID from your organizer",
            style = MaterialTheme.typography.bodyMedium,
            color = TurnoutColors.TextMuted,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(28.dp))

        OutlinedTextField(
            value = eventId,
            onValueChange = { eventId = it.filter { ch -> ch.isDigit() } },
            label = { Text("Event ID") },
            placeholder = { Text("e.g. 42") },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Number,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(onDone = { submit() }),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = turnoutFieldColors(),
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = { submit() },
            enabled = eventId.isNotBlank(),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = TurnoutColors.Lime500,
                contentColor = TurnoutColors.Teal900,
            ),
        ) {
            Text("Continue", fontWeight = FontWeight.Bold)
        }
        Spacer(modifier = Modifier.height(24.dp))
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
