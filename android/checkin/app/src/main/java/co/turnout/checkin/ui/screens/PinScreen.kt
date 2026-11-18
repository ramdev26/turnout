package co.turnout.checkin.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.turnout.checkin.BuildConfig
import co.turnout.checkin.ui.components.TurnoutScrollColumn
import co.turnout.checkin.ui.theme.TurnoutColors

@Composable
fun PinScreen(
    eventId: String,
    apiBaseUrl: String = "",
    unlocking: Boolean,
    unlockError: String?,
    onUnlock: (pin: String) -> Unit,
    onBack: () -> Unit,
) {
    var pin by rememberSaveable { mutableStateOf("") }
    val focusManager = LocalFocusManager.current

    fun submit() {
        if (unlocking || pin.length < 4) return
        focusManager.clearFocus()
        onUnlock(pin.trim())
    }

    TurnoutScrollColumn(horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(modifier = Modifier.height(24.dp))
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(TurnoutColors.Ink.copy(alpha = 0.65f), RoundedCornerShape(22.dp))
                .padding(22.dp),
            horizontalAlignment = Alignment.Start,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Lock,
                    contentDescription = null,
                    tint = TurnoutColors.Lime500,
                    modifier = Modifier
                        .size(48.dp)
                        .background(TurnoutColors.LimeSoft, RoundedCornerShape(16.dp))
                        .padding(12.dp),
                )
                Column(modifier = Modifier.padding(start = 14.dp).weight(1f)) {
                    Text(
                        text = "Staff check-in",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = TurnoutColors.Text,
                    )
                    Text(
                        text = "Event #$eventId · PIN from organizer",
                        style = MaterialTheme.typography.bodySmall,
                        color = TurnoutColors.TextMuted,
                    )
                }
            }
            Spacer(modifier = Modifier.height(22.dp))
            OutlinedTextField(
                value = pin,
                onValueChange = { pin = it.filter(Char::isDigit).take(8) },
                placeholder = { Text("••••••", letterSpacing = 8.sp) },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.NumberPassword,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                textStyle = MaterialTheme.typography.headlineSmall.copy(
                    fontFamily = FontFamily.Monospace,
                    textAlign = TextAlign.Center,
                    letterSpacing = 6.sp,
                ),
                colors = turnoutFieldColors(),
            )
            if (!unlockError.isNullOrBlank()) {
                Text(
                    text = unlockError,
                    color = TurnoutColors.Error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    textAlign = TextAlign.Center,
                )
            }
            Spacer(modifier = Modifier.height(18.dp))
            Button(
                onClick = { submit() },
                enabled = !unlocking && pin.length >= 4,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TurnoutColors.Lime500,
                    contentColor = TurnoutColors.Teal900,
                ),
            ) {
                Text(if (unlocking) "Verifying…" else "Start scanning", fontWeight = FontWeight.Bold)
            }
        }
        Text(
            text = "Event #$eventId · v${BuildConfig.VERSION_NAME}",
            style = MaterialTheme.typography.labelSmall,
            color = TurnoutColors.TextSubtle,
            modifier = Modifier.padding(top = 14.dp),
            textAlign = TextAlign.Center,
        )
        TextButton(onClick = onBack, modifier = Modifier.padding(top = 4.dp)) {
            Text("Change event", color = TurnoutColors.TextMuted)
        }
        Spacer(modifier = Modifier.height(24.dp))
    }
}
