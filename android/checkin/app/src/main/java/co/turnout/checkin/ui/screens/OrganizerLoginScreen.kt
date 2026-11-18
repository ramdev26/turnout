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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import co.turnout.checkin.LoginUiState
import co.turnout.checkin.ui.components.TurnoutLogo
import co.turnout.checkin.ui.components.TurnoutScrollColumn
import co.turnout.checkin.ui.theme.TurnoutColors

@Composable
fun OrganizerLoginScreen(
    loginState: LoginUiState,
    onBack: () -> Unit,
    onLogin: (email: String, password: String) -> Unit,
) {
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    val focusManager = LocalFocusManager.current

    val canSubmit = email.contains("@") &&
        password.length >= 6 &&
        !loginState.loading

    fun submit() {
        if (!canSubmit) return
        focusManager.clearFocus()
        onLogin(email.trim(), password)
    }

    TurnoutScrollColumn(horizontalAlignment = Alignment.CenterHorizontally) {
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
        Spacer(modifier = Modifier.height(8.dp))
        TurnoutLogo(modifier = Modifier.size(56.dp))
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Organizer login",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = TurnoutColors.Text,
        )
        Text(
            text = "Sign in with your Turnout account",
            style = MaterialTheme.typography.bodyMedium,
            color = TurnoutColors.TextMuted,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(28.dp))

        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            label = { Text("Email") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = turnoutFieldColors(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Email,
                imeAction = ImeAction.Next,
            ),
        )
        Spacer(modifier = Modifier.height(12.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            colors = turnoutFieldColors(),
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Password,
                imeAction = ImeAction.Done,
            ),
            keyboardActions = KeyboardActions(onDone = { submit() }),
        )

        if (loginState.error != null) {
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = loginState.error,
                color = TurnoutColors.Error,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Start,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = { submit() },
            enabled = canSubmit,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = TurnoutColors.Lime500,
                contentColor = TurnoutColors.Teal900,
                disabledContainerColor = TurnoutColors.Lime500.copy(alpha = 0.35f),
                disabledContentColor = TurnoutColors.Teal900.copy(alpha = 0.5f),
            ),
        ) {
            if (loginState.loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(22.dp),
                    color = TurnoutColors.Teal900,
                    strokeWidth = 2.dp,
                )
            } else {
                Text("Sign in", fontWeight = FontWeight.Bold)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Same email and password as the Turnout dashboard.",
            style = MaterialTheme.typography.bodySmall,
            color = TurnoutColors.TextSubtle,
            textAlign = TextAlign.Center,
        )
        Spacer(modifier = Modifier.height(24.dp))
    }
}
