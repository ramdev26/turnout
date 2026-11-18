package co.turnout.checkin.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Size
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import co.turnout.checkin.OfflineUiState
import co.turnout.checkin.ScanStatus
import co.turnout.checkin.ScannerUiState
import co.turnout.checkin.ui.theme.TurnoutColors
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

@Composable
fun ScannerScreen(
    eventTitle: String,
    scannerState: ScannerUiState,
    offlineEnabled: Boolean,
    offlineState: OfflineUiState,
    onToggleOffline: (Boolean) -> Unit,
    onDownloadRoster: () -> Unit,
    onSyncPending: () -> Unit,
    onScan: (String) -> Unit,
    onManualSubmit: (String) -> Unit,
    onSignOut: () -> Unit,
) {
    val context = LocalContext.current
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    var showTools by rememberSaveable { mutableStateOf(false) }
    var showManual by rememberSaveable { mutableStateOf(false) }
    var manualToken by remember { mutableStateOf("") }
    val focusManager = LocalFocusManager.current

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) {
            showTools = true
            showManual = true
        }
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    LaunchedEffect(scannerState.status) {
        if (scannerState.status == ScanStatus.SUCCESS) {
            vibrateSuccess(context)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TurnoutColors.Teal900),
    ) {
        // Camera fills the screen
        if (hasCameraPermission) {
            QrCameraPreview(onScan = onScan)
        } else {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.QrCodeScanner,
                        contentDescription = null,
                        tint = TurnoutColors.Lime500,
                        modifier = Modifier.size(48.dp),
                    )
                    Text(
                        text = "Camera permission needed",
                        color = TurnoutColors.TextMuted,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                    TextButton(onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) }) {
                        Text("Allow camera", color = TurnoutColors.Lime500)
                    }
                }
            }
        }

        // Top + bottom scrims for readability
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(140.dp)
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Black.copy(alpha = 0.72f), Color.Transparent),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(280.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, Color.Black.copy(alpha = 0.82f)),
                    ),
                ),
        )

        // Scan frame
        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .size(240.dp)
                .border(2.dp, TurnoutColors.Lime500.copy(alpha = 0.9f), RoundedCornerShape(28.dp)),
        )

        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Staff scanner",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = TurnoutColors.Lime500,
                )
                Text(
                    text = eventTitle.ifBlank { "Event" },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = TurnoutColors.Text,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (offlineEnabled) {
                Text(
                    text = "Offline",
                    color = TurnoutColors.Teal900,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .padding(end = 8.dp)
                        .background(TurnoutColors.Lime500, RoundedCornerShape(999.dp))
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
            TextButton(onClick = onSignOut) {
                Text("Exit", color = TurnoutColors.Text)
            }
        }

        // Bottom stack: status + tools
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            StatusBanner(scannerState)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedButton(
                    onClick = {
                        showTools = !showTools
                        if (!showTools) showManual = false
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Icon(
                        imageVector = if (showTools) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = null,
                        tint = TurnoutColors.Text,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = if (showTools) "Hide tools" else "Tools",
                        color = TurnoutColors.Text,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
                OutlinedButton(
                    onClick = {
                        showTools = true
                        showManual = !showManual
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Icon(
                        Icons.Default.Keyboard,
                        contentDescription = null,
                        tint = TurnoutColors.Text,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = "Manual",
                        color = TurnoutColors.Text,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
            }

            AnimatedVisibility(
                visible = showTools,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically(),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(TurnoutColors.Ink.copy(alpha = 0.92f))
                        .border(1.dp, TurnoutColors.Lime500.copy(alpha = 0.15f), RoundedCornerShape(18.dp))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OfflineToolsRow(
                        offlineEnabled = offlineEnabled,
                        state = offlineState,
                        onToggle = onToggleOffline,
                        onDownload = onDownloadRoster,
                        onSync = onSyncPending,
                    )

                    AnimatedVisibility(visible = showManual) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            OutlinedTextField(
                                value = manualToken,
                                onValueChange = { manualToken = it },
                                placeholder = { Text("Paste ticket code") },
                                singleLine = true,
                                modifier = Modifier.weight(1f),
                                colors = turnoutFieldColors(),
                                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                                keyboardActions = KeyboardActions(
                                    onDone = {
                                        if (manualToken.isNotBlank()) {
                                            onManualSubmit(manualToken)
                                            manualToken = ""
                                            focusManager.clearFocus()
                                        }
                                    },
                                ),
                            )
                            Button(
                                onClick = {
                                    if (manualToken.isNotBlank()) {
                                        onManualSubmit(manualToken)
                                        manualToken = ""
                                        focusManager.clearFocus()
                                    }
                                },
                                enabled = manualToken.isNotBlank(),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = TurnoutColors.Lime500,
                                    contentColor = TurnoutColors.Teal900,
                                ),
                            ) {
                                Text("Go", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusBanner(state: ScannerUiState) {
    val (accent, bg, icon) = when (state.status) {
        ScanStatus.SUCCESS -> Triple(TurnoutColors.Success, TurnoutColors.Success.copy(0.18f), Icons.Default.CheckCircle)
        ScanStatus.WARNING -> Triple(TurnoutColors.Warning, TurnoutColors.Warning.copy(0.18f), Icons.Default.Warning)
        ScanStatus.ERROR -> Triple(TurnoutColors.Error, TurnoutColors.Error.copy(0.18f), Icons.Default.Close)
        ScanStatus.IDLE -> Triple(TurnoutColors.Lime500, TurnoutColors.Ink.copy(0.75f), Icons.Default.QrCodeScanner)
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp)
            .clip(RoundedCornerShape(18.dp))
            .background(bg)
            .border(1.dp, accent.copy(alpha = 0.4f), RoundedCornerShape(18.dp))
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = accent,
            modifier = Modifier
                .size(40.dp)
                .background(accent.copy(alpha = 0.15f), CircleShape)
                .padding(8.dp),
        )
        Column(modifier = Modifier.padding(start = 12.dp).weight(1f)) {
            Text(
                text = state.statusMessage,
                color = TurnoutColors.Text,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            state.lastAttendee?.let { attendee ->
                Text(
                    text = attendee.fullName,
                    color = TurnoutColors.Text,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Text(
                    text = listOfNotNull(
                        attendee.ticketName.takeIf { it.isNotBlank() },
                        attendee.email.takeIf { it.isNotBlank() },
                    ).joinToString(" · "),
                    color = TurnoutColors.TextMuted,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun OfflineToolsRow(
    offlineEnabled: Boolean,
    state: OfflineUiState,
    onToggle: (Boolean) -> Unit,
    onDownload: () -> Unit,
    onSync: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Default.CloudOff, contentDescription = null, tint = TurnoutColors.Lime500)
            Column(modifier = Modifier.padding(start = 10.dp).weight(1f)) {
                Text("Offline mode", color = TurnoutColors.Text, fontWeight = FontWeight.SemiBold)
                Text(
                    text = if (offlineEnabled) {
                        buildString {
                            append("Roster ${state.rosterCount}")
                            if (state.rosterTotal > 0) append(" / ${state.rosterTotal}")
                            append(" · Pending ${state.pendingCount}")
                        }
                    } else {
                        "Turn on for venues with weak signal"
                    },
                    color = TurnoutColors.TextMuted,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            TextButton(onClick = { onToggle(!offlineEnabled) }) {
                Text(
                    text = if (offlineEnabled) "On" else "Off",
                    color = if (offlineEnabled) TurnoutColors.Lime500 else TurnoutColors.TextMuted,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        if (offlineEnabled) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onDownload,
                    enabled = !state.downloading,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TurnoutColors.Lime500,
                        contentColor = TurnoutColors.Teal900,
                    ),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        when {
                            state.downloading -> "Downloading…"
                            state.hasRoster -> "Refresh"
                            else -> "Download"
                        },
                        maxLines = 1,
                    )
                }
                OutlinedButton(
                    onClick = onSync,
                    enabled = !state.syncing && state.pendingCount > 0,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        when {
                            state.syncing -> "Syncing…"
                            state.pendingCount > 0 -> "Sync ${state.pendingCount}"
                            else -> "Synced"
                        },
                        color = TurnoutColors.Text,
                        maxLines = 1,
                    )
                }
            }
            state.statusMessage?.let {
                Text(it, color = TurnoutColors.Lime400, style = MaterialTheme.typography.bodySmall)
            }
            state.error?.let {
                Text(it, color = TurnoutColors.Error, style = MaterialTheme.typography.bodySmall)
            }
            if (!state.hasRoster) {
                Text(
                    "Download the roster while you have signal.",
                    color = TurnoutColors.Warning,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun QrCameraPreview(onScan: (String) -> Unit) {
    val context = LocalContext.current
    val previewView = remember { PreviewView(context) }
    val executor = remember { Executors.newSingleThreadExecutor() }
    val scanner = remember { BarcodeScanning.getClient() }
    var lastRaw by remember { mutableStateOf<String?>(null) }

    DisposableEffect(Unit) {
        onDispose {
            executor.shutdown()
            scanner.close()
        }
    }

    LaunchedEffect(previewView) {
        val cameraProvider = ProcessCameraProvider.getInstance(context).get()
        val preview = Preview.Builder().build().also {
            it.surfaceProvider = previewView.surfaceProvider
        }
        val analysis = ImageAnalysis.Builder()
            .setTargetResolution(Size(1280, 720))
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()

        analysis.setAnalyzer(executor) { imageProxy ->
            val mediaImage = imageProxy.image
            if (mediaImage == null) {
                imageProxy.close()
                return@setAnalyzer
            }
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            scanner.process(image)
                .addOnSuccessListener { barcodes ->
                    val raw = barcodes.firstOrNull { !it.rawValue.isNullOrBlank() }?.rawValue
                    if (!raw.isNullOrBlank() && raw != lastRaw) {
                        lastRaw = raw
                        onScan(raw)
                    }
                }
                .addOnCompleteListener { imageProxy.close() }
        }

        try {
            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(
                context as androidx.lifecycle.LifecycleOwner,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                analysis,
            )
        } catch (_: Exception) {
            try {
                cameraProvider.bindToLifecycle(
                    context as androidx.lifecycle.LifecycleOwner,
                    CameraSelector.DEFAULT_FRONT_CAMERA,
                    preview,
                    analysis,
                )
            } catch (_: Exception) {
                // Camera bind failed — manual entry still works
            }
        }
    }

    AndroidView(
        factory = { previewView },
        modifier = Modifier.fillMaxSize(),
    )
}

private fun vibrateSuccess(context: android.content.Context) {
    try {
        val vibrator = if (android.os.Build.VERSION.SDK_INT >= 31) {
            val manager = context.getSystemService(VibratorManager::class.java)
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Vibrator::class.java)
        }
        vibrator?.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
    } catch (_: Exception) {
        // ignore
    }
}
