package co.turnout.checkin.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object TurnoutColors {
    val Teal900 = Color(0xFF052E30)
    val Teal800 = Color(0xFF074143)
    val Teal700 = Color(0xFF0D585B)
    val Lime500 = Color(0xFFC0FF72)
    val Lime400 = Color(0xFFD7FF9E)
    val LimeSoft = Color(0x1FC0FF72)
    val Ink = Color(0xFF0A2426)
    val Text = Color(0xFFE9F4EE)
    val TextMuted = Color(0xFF93B5B7)
    val TextSubtle = Color(0xFF5C8285)
    val Success = Color(0xFF34D399)
    val Warning = Color(0xFFFBBF24)
    val Error = Color(0xFFF87171)
}

private val TurnoutDarkScheme = darkColorScheme(
    primary = TurnoutColors.Lime500,
    onPrimary = TurnoutColors.Teal900,
    primaryContainer = TurnoutColors.LimeSoft,
    onPrimaryContainer = TurnoutColors.Lime400,
    background = TurnoutColors.Teal900,
    onBackground = TurnoutColors.Text,
    surface = TurnoutColors.Ink,
    onSurface = TurnoutColors.Text,
    surfaceVariant = TurnoutColors.Teal800,
    onSurfaceVariant = TurnoutColors.TextMuted,
    outline = Color(0x2EC0FF72),
    error = TurnoutColors.Error,
)

@Composable
fun TurnoutCheckInTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TurnoutDarkScheme,
        content = content,
    )
}
