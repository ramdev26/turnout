package co.turnout.checkin.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.turnout.checkin.EventHubUiState
import co.turnout.checkin.ui.components.TurnoutBackground
import co.turnout.checkin.ui.theme.TurnoutColors

@Composable
fun OrganizerEventHubScreen(
    eventId: String,
    state: EventHubUiState,
    onBack: () -> Unit,
    onLoad: () -> Unit,
    onOpenScanner: () -> Unit,
    onOpenAttendees: () -> Unit,
    onOpenBankOrders: () -> Unit,
) {
    LaunchedEffect(eventId) { onLoad() }

    TurnoutBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding(),
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
                Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                    Text(
                        text = state.event?.title ?: "Event $eventId",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = TurnoutColors.Text,
                        maxLines = 2,
                    )
                    if (state.event != null) {
                        StatusChip(status = state.event.status)
                    }
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                if (state.loading && state.stats == null) {
                    CircularProgressIndicator(
                        color = TurnoutColors.Lime500,
                        modifier = Modifier
                            .align(Alignment.CenterHorizontally)
                            .padding(32.dp),
                    )
                }

                if (state.error != null) {
                    Text(state.error, color = TurnoutColors.Error, style = MaterialTheme.typography.bodyMedium)
                }

                state.stats?.let { stats ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        StatTile(
                            label = "Checked in",
                            value = "${stats.checkedInCount}",
                            hint = "of ${stats.attendeeTotal}",
                            modifier = Modifier.weight(1f),
                        )
                        StatTile(
                            label = "Sold",
                            value = "${stats.soldTickets}",
                            hint = "cap ${stats.totalCapacity}",
                            modifier = Modifier.weight(1f),
                        )
                        StatTile(
                            label = "Revenue",
                            value = formatMoney(stats.totalRevenue),
                            hint = "paid",
                            modifier = Modifier.weight(1f),
                        )
                    }
                }

                Button(
                    onClick = onOpenScanner,
                    enabled = !state.openingScanner,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TurnoutColors.Lime500,
                        contentColor = TurnoutColors.Teal900,
                    ),
                ) {
                    if (state.openingScanner) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(22.dp),
                            color = TurnoutColors.Teal900,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Icon(Icons.Outlined.QrCodeScanner, contentDescription = null)
                        Spacer(Modifier.size(10.dp))
                        Text("Open door scanner", fontWeight = FontWeight.Bold)
                    }
                }

                HubAction(
                    title = "Attendees",
                    subtitle = "Search guest list and check-in status",
                    icon = Icons.Outlined.Groups,
                    onClick = onOpenAttendees,
                )
                HubAction(
                    title = "Bank transfers",
                    subtitle = "Confirm or reject pending slip uploads",
                    icon = Icons.Outlined.AccountBalance,
                    onClick = onOpenBankOrders,
                )

                state.staffPin?.let { pin ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(TurnoutColors.Ink.copy(alpha = 0.65f), RoundedCornerShape(18.dp))
                            .border(1.dp, TurnoutColors.Lime500.copy(alpha = 0.12f), RoundedCornerShape(18.dp))
                            .padding(18.dp),
                    ) {
                        Text(
                            text = "Staff PIN",
                            style = MaterialTheme.typography.labelLarge,
                            color = TurnoutColors.TextMuted,
                        )
                        Text(
                            text = pin,
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 4.sp,
                            ),
                            fontWeight = FontWeight.Bold,
                            color = TurnoutColors.Lime400,
                            modifier = Modifier.padding(top = 6.dp),
                        )
                        Text(
                            text = "Share with door staff for the Staff scanner mode.",
                            style = MaterialTheme.typography.bodySmall,
                            color = TurnoutColors.TextSubtle,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }

                Spacer(Modifier.height(28.dp))
            }
        }
    }
}

@Composable
private fun StatTile(
    label: String,
    value: String,
    hint: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(TurnoutColors.Ink.copy(alpha = 0.7f), RoundedCornerShape(16.dp))
            .border(1.dp, TurnoutColors.Lime500.copy(alpha = 0.1f), RoundedCornerShape(16.dp))
            .padding(horizontal = 10.dp, vertical = 12.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = TurnoutColors.TextSubtle,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = TurnoutColors.Text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            hint,
            style = MaterialTheme.typography.labelSmall,
            color = TurnoutColors.TextMuted,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun HubAction(
    title: String,
    subtitle: String,
    icon: ImageVector,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(18.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(TurnoutColors.Ink.copy(alpha = 0.7f))
            .border(1.dp, TurnoutColors.Lime500.copy(alpha = 0.12f), shape)
            .clickable(onClick = onClick)
            .padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = TurnoutColors.Lime500,
            modifier = Modifier
                .size(44.dp)
                .background(TurnoutColors.LimeSoft, RoundedCornerShape(14.dp))
                .padding(10.dp),
        )
        Column(modifier = Modifier.padding(start = 14.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = TurnoutColors.Text)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = TurnoutColors.TextMuted)
        }
    }
}

private fun formatMoney(amount: Double): String {
    return if (amount >= 1000) {
        "%,.0f".format(amount)
    } else {
        "%,.2f".format(amount)
    }
}
