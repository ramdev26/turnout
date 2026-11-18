package co.turnout.checkin.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import co.turnout.checkin.AttendeesUiState
import co.turnout.checkin.data.OrganizerAttendee
import co.turnout.checkin.ui.components.TurnoutBackground
import co.turnout.checkin.ui.theme.TurnoutColors

@Composable
fun OrganizerAttendeesScreen(
    eventId: String,
    state: AttendeesUiState,
    onBack: () -> Unit,
    onSearch: (String) -> Unit,
) {
    var query by rememberSaveable { mutableStateOf(state.query) }
    LaunchedEffect(eventId) { onSearch("") }

    TurnoutBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding(),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TurnoutColors.Text)
                }
                Text(
                    text = "Attendees",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = TurnoutColors.Text,
                    modifier = Modifier.weight(1f),
                )
            }

            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                placeholder = { Text("Search name, email, ticket…") },
                singleLine = true,
                leadingIcon = {
                    Icon(Icons.Outlined.Search, contentDescription = null, tint = TurnoutColors.TextMuted)
                },
                colors = turnoutFieldColors(),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { onSearch(query) }),
            )
            Spacer(Modifier.height(8.dp))

            when {
                state.loading && state.attendees.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = TurnoutColors.Lime500)
                    }
                }
                state.error != null && state.attendees.isEmpty() -> {
                    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                        Text(state.error, color = TurnoutColors.Error)
                    }
                }
                state.attendees.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No attendees found", color = TurnoutColors.TextMuted)
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(state.attendees, key = { it.id }) { attendee ->
                            AttendeeRow(attendee)
                        }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun AttendeeRow(attendee: OrganizerAttendee) {
    val checkedIn = !attendee.checkedInAt.isNullOrBlank()
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(TurnoutColors.Ink.copy(alpha = 0.7f), shape)
            .border(1.dp, TurnoutColors.Lime500.copy(alpha = 0.1f), shape)
            .padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = attendee.fullName.ifBlank { "Guest" },
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = TurnoutColors.Text,
                modifier = Modifier.weight(1f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = if (checkedIn) "In" else "Pending",
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = if (checkedIn) TurnoutColors.Success else TurnoutColors.Warning,
                modifier = Modifier
                    .background(
                        (if (checkedIn) TurnoutColors.Success else TurnoutColors.Warning).copy(alpha = 0.15f),
                        RoundedCornerShape(999.dp),
                    )
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
        Text(attendee.email, style = MaterialTheme.typography.bodySmall, color = TurnoutColors.TextMuted)
        Text(
            attendee.ticketName.ifBlank { "Ticket" },
            style = MaterialTheme.typography.labelSmall,
            color = TurnoutColors.TextSubtle,
        )
    }
}
