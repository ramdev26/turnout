package co.turnout.checkin.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import co.turnout.checkin.EventsUiState
import co.turnout.checkin.data.OrganizerAuth
import co.turnout.checkin.data.OrganizerEvent
import co.turnout.checkin.ui.components.TurnoutBackground
import co.turnout.checkin.ui.theme.TurnoutColors
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun OrganizerEventsScreen(
    auth: OrganizerAuth,
    state: EventsUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onLogout: () -> Unit,
    onOpenEvent: (OrganizerEvent) -> Unit,
) {
    LaunchedEffect(auth.isLoggedIn) {
        if (auth.isLoggedIn) onRefresh()
    }

    TurnoutBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding(),
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
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Your events",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = TurnoutColors.Text,
                    )
                    Text(
                        text = auth.displayName.ifBlank { auth.email },
                        style = MaterialTheme.typography.bodySmall,
                        color = TurnoutColors.TextMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                IconButton(onClick = onRefresh) {
                    Icon(Icons.Outlined.Refresh, contentDescription = "Refresh", tint = TurnoutColors.Lime400)
                }
                IconButton(onClick = onLogout) {
                    Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = "Sign out", tint = TurnoutColors.TextMuted)
                }
            }

            when {
                state.loading && state.events.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = TurnoutColors.Lime500)
                    }
                }
                state.error != null && state.events.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(32.dp),
                        verticalArrangement = Arrangement.Center,
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(state.error, color = TurnoutColors.Error)
                        Spacer(Modifier.height(12.dp))
                        TextButton(onClick = onRefresh) {
                            Text("Try again", color = TurnoutColors.Lime500)
                        }
                    }
                }
                state.events.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No events yet. Create one on the web dashboard.", color = TurnoutColors.TextMuted)
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        if (state.error != null) {
                            item {
                                Text(state.error, color = TurnoutColors.Warning, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        items(state.events, key = { it.id }) { event ->
                            EventRow(event = event, onClick = { onOpenEvent(event) })
                        }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun EventRow(event: OrganizerEvent, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(TurnoutColors.Ink.copy(alpha = 0.7f))
            .border(1.dp, TurnoutColors.Lime500.copy(alpha = 0.12f), shape)
            .clickable(onClick = onClick)
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = event.title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = TurnoutColors.Text,
                modifier = Modifier.weight(1f),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            StatusChip(status = event.status)
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = formatEventDate(event.date),
            style = MaterialTheme.typography.bodyMedium,
            color = TurnoutColors.TextMuted,
        )
        if (event.location.isNotBlank()) {
            Text(
                text = event.location,
                style = MaterialTheme.typography.bodySmall,
                color = TurnoutColors.TextSubtle,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            text = "ID ${event.id}",
            style = MaterialTheme.typography.labelSmall,
            color = TurnoutColors.TextSubtle,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
}

@Composable
fun StatusChip(status: String) {
    val label = status.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }
    val color = when (status.lowercase()) {
        "published", "live" -> TurnoutColors.Success
        "draft" -> TurnoutColors.Warning
        else -> TurnoutColors.TextMuted
    }
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
        color = color,
        modifier = Modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

private fun formatEventDate(iso: String): String {
    return try {
        val instant = Instant.parse(iso)
        DateTimeFormatter.ofPattern("EEE, d MMM yyyy · h:mm a")
            .withZone(ZoneId.systemDefault())
            .format(instant)
    } catch (_: Exception) {
        iso.ifBlank { "Date TBA" }
    }
}
