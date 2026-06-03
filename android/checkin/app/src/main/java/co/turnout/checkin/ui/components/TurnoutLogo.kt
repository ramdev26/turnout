package co.turnout.checkin.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.foundation.Image
import co.turnout.checkin.R

@Composable
fun TurnoutLogo(modifier: Modifier = Modifier) {
    Image(
        painter = painterResource(id = R.drawable.ic_turnout_logo),
        contentDescription = "Turnout",
        modifier = modifier,
    )
}
