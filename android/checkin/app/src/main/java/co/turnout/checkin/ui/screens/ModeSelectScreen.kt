package co.turnout.checkin.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import co.turnout.checkin.data.OrganizerAuth
import co.turnout.checkin.ui.components.TurnoutBackground
import co.turnout.checkin.ui.components.TurnoutLogo
import co.turnout.checkin.ui.theme.TurnoutColors
import kotlinx.coroutines.delay

@Composable
fun ModeSelectScreen(
    auth: OrganizerAuth,
    onOrganizer: () -> Unit,
    onStaffScanner: () -> Unit,
) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        delay(40)
        visible = true
    }

    TurnoutBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .padding(horizontal = 24.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            AnimatedVisibility(
                visible = visible,
                enter = fadeIn() + slideInVertically { it / 6 },
            ) {
                Column(horizontalAlignment = Alignment.Start) {
                    TurnoutLogo(modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(20.dp))
                    Text(
                        text = "Turnout",
                        style = MaterialTheme.typography.displaySmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = (-0.5).sp,
                        ),
                        color = TurnoutColors.Text,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Manage your events or scan tickets at the door.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = TurnoutColors.TextMuted,
                    )
                }
            }

            AnimatedVisibility(
                visible = visible,
                enter = fadeIn() + slideInVertically { it / 4 },
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    ModeCard(
                        title = if (auth.isLoggedIn) "Organizer console" else "Organizer login",
                        subtitle = if (auth.isLoggedIn) {
                            "Continue as ${auth.displayName.ifBlank { auth.email }}"
                        } else {
                            "Events, attendees, bank transfers & door scan"
                        },
                        icon = Icons.Outlined.Badge,
                        emphasized = true,
                        onClick = onOrganizer,
                    )
                    ModeCard(
                        title = "Staff scanner",
                        subtitle = "Enter event ID + staff PIN to check guests in",
                        icon = Icons.Outlined.QrCodeScanner,
                        emphasized = false,
                        onClick = onStaffScanner,
                    )
                }
            }

            Text(
                text = "Door-ready · Offline capable · Live sync",
                style = MaterialTheme.typography.labelMedium,
                color = TurnoutColors.TextSubtle,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
        }
    }
}

@Composable
private fun ModeCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    emphasized: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(22.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(
                if (emphasized) TurnoutColors.Lime500.copy(alpha = 0.14f)
                else TurnoutColors.Ink.copy(alpha = 0.72f),
            )
            .border(
                width = 1.dp,
                color = if (emphasized) TurnoutColors.Lime500.copy(alpha = 0.45f)
                else TurnoutColors.Lime500.copy(alpha = 0.12f),
                shape = shape,
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = onClick,
            )
            .padding(20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (emphasized) TurnoutColors.Lime500 else TurnoutColors.Lime400,
            modifier = Modifier
                .size(52.dp)
                .background(TurnoutColors.LimeSoft, RoundedCornerShape(16.dp))
                .padding(12.dp),
        )
        Column(modifier = Modifier.padding(start = 16.dp).weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = TurnoutColors.Text,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = TurnoutColors.TextMuted,
            )
        }
    }
}
