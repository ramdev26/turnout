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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import co.turnout.checkin.BankOrdersUiState
import co.turnout.checkin.data.BankTransferOrder
import co.turnout.checkin.ui.components.TurnoutBackground
import co.turnout.checkin.ui.theme.TurnoutColors

@Composable
fun OrganizerBankOrdersScreen(
    eventId: String,
    state: BankOrdersUiState,
    onBack: () -> Unit,
    onLoad: (status: String) -> Unit,
    onConfirm: (orderId: String) -> Unit,
    onReject: (orderId: String) -> Unit,
) {
    LaunchedEffect(eventId) { onLoad("pending") }

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
                    text = "Bank transfers",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    color = TurnoutColors.Text,
                    modifier = Modifier.weight(1f),
                )
            }

            Row(
                modifier = Modifier.padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                FilterChip(
                    label = "Pending",
                    selected = state.statusFilter == "pending",
                    onClick = { onLoad("pending") },
                )
                FilterChip(
                    label = "Paid",
                    selected = state.statusFilter == "paid",
                    onClick = { onLoad("paid") },
                )
                FilterChip(
                    label = "All",
                    selected = state.statusFilter == "all",
                    onClick = { onLoad("all") },
                )
            }
            Spacer(Modifier.height(8.dp))

            when {
                state.loading && state.orders.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = TurnoutColors.Lime500)
                    }
                }
                state.error != null && state.orders.isEmpty() -> {
                    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                        Text(state.error, color = TurnoutColors.Error)
                    }
                }
                state.orders.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("No ${state.statusFilter} bank transfer orders", color = TurnoutColors.TextMuted)
                    }
                }
                else -> {
                    LazyColumn(
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        if (state.error != null) {
                            item {
                                Text(state.error, color = TurnoutColors.Warning, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        items(state.orders, key = { it.id }) { order ->
                            BankOrderRow(
                                order = order,
                                acting = state.actingOrderId == order.id,
                                onConfirm = { onConfirm(order.id) },
                                onReject = { onReject(order.id) },
                            )
                        }
                        item { Spacer(Modifier.height(24.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Text(
            text = label,
            color = if (selected) TurnoutColors.Lime500 else TurnoutColors.TextMuted,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
        )
    }
}

@Composable
private fun BankOrderRow(
    order: BankTransferOrder,
    acting: Boolean,
    onConfirm: () -> Unit,
    onReject: () -> Unit,
) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(TurnoutColors.Ink.copy(alpha = 0.7f), shape)
            .border(1.dp, TurnoutColors.Lime500.copy(alpha = 0.1f), shape)
            .padding(16.dp),
    ) {
        Text(
            text = order.buyerName?.ifBlank { null } ?: order.buyerEmail,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = TurnoutColors.Text,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(order.buyerEmail, style = MaterialTheme.typography.bodySmall, color = TurnoutColors.TextMuted)
        Row(
            modifier = Modifier.padding(top = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "%,.2f".format(order.totalAmount),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = TurnoutColors.Lime400,
            )
            StatusChip(status = order.status)
        }
        if (order.status == "pending") {
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = onConfirm,
                    enabled = !acting,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TurnoutColors.Lime500,
                        contentColor = TurnoutColors.Teal900,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(if (acting) "…" else "Confirm")
                }
                OutlinedButton(
                    onClick = onReject,
                    enabled = !acting,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Text("Reject", color = TurnoutColors.Error)
                }
            }
        }
    }
}
