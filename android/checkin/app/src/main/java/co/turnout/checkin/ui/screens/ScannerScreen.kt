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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudOff
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
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
    var showManual by remember { mutableStateOf(false) }
    var manualToken by remember { mutableStateOf("") }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) showManual = true
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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TurnoutColors.Teal900)
            .verticalScroll(rememberScrollState()),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text(
                    text = if (offlineEnabled) "DOOR CHECK-IN · OFFLINE" else "DOOR CHECK-IN",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = TurnoutColors.Lime500,
                )
                Text(
                    text = eventTitle.ifBlank { "Event" },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = TurnoutColors.Text,
                )
            }
            TextButton(onClick = onSignOut) {
                Text("Exit", color = TurnoutColors.TextMuted)
            }
        }

        OfflinePanel(
            offlineEnabled = offlineEnabled,
            state = offlineState,
            onToggle = onToggleOffline,
            onDownload = onDownloadRoster,
            onSync = onSyncPending,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 12.dp),
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(320.dp)
                .padding(horizontal = 16.dp)
                .background(TurnoutColors.Ink, RoundedCornerShape(24.dp)),
        ) {
            if (hasCameraPermission) {
                QrCameraPreview(onScan = onScan)
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .height(224.dp)
                        .fillMaxWidth(0.72f)
                        .border(2.dp, TurnoutColors.Lime500.copy(alpha = 0.85f), RoundedCornerShape(20.dp)),
                )
            } else {
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Icon(Icons.Default.QrCodeScanner, null, tint = TurnoutColors.Lime500)
                    Text(
                        text = "Camera permission required",
                        color = TurnoutColors.TextMuted,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
        }

        StatusCard(scannerState, modifier = Modifier.padding(16.dp))

        TextButton(
            onClick = { showManual = !showManual },
            modifier = Modifier.align(Alignment.CenterHorizontally),
        ) {
            Icon(Icons.Default.Keyboard, contentDescription = null, tint = TurnoutColors.TextMuted)
            Text(
                text = if (showManual) "Hide manual entry" else "Enter code manually",
                color = TurnoutColors.TextMuted,
                modifier = Modifier.padding(start = 8.dp),
            )
        }

        if (showManual) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = manualToken,
                    onValueChange = { manualToken = it },
                    placeholder = { Text("Paste token") },
                    modifier = Modifier.weight(1f),
                    colors = turnoutFieldColors(),
                )
                TextButton(
                    onClick = {
                        onManualSubmit(manualToken)
                        manualToken = ""
                    },
                ) {
                    Text("Go", color = TurnoutColors.Lime500, fontWeight = FontWeight.Bold)
                }
            }
        } else {
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun OfflinePanel(
    offlineEnabled: Boolean,
    state: OfflineUiState,
    onToggle: (Boolean) -> Unit,
    onDownload: () -> Unit,
    onSync: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(TurnoutColors.Ink.copy(alpha = 0.55f), RoundedCornerShape(20.dp))
            .border(1.dp, TurnoutColors.TextSubtle.copy(alpha = 0.35f), RoundedCornerShape(20.dp))
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.CloudOff, contentDescription = null, tint = TurnoutColors.Lime500)
                Column(modifier = Modifier.padding(start = 10.dp)) {
                    Text(
                        text = "Offline scans",
                        color = TurnoutColors.Text,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        text = "Download once, scan without signal, sync later",
                        color = TurnoutColors.TextMuted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
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
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "Roster ${state.rosterCount}" +
                    if (state.rosterTotal > 0 && state.rosterTotal != state.rosterCount) {
                        " / ${state.rosterTotal}"
                    } else {
                        ""
                    } +
                    " · Pending ${state.pendingCount}",
                color = TurnoutColors.TextMuted,
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onDownload,
                    enabled = !state.downloading,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TurnoutColors.Lime500,
                        contentColor = TurnoutColors.Teal900,
                    ),
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        if (state.downloading) "Downloading…"
                        else if (state.hasRoster) "Refresh roster"
                        else "Download roster",
                    )
                }
                OutlinedButton(
                    onClick = onSync,
                    enabled = !state.syncing && state.pendingCount > 0,
                    modifier = Modifier.weight(1f),
                ) {
                    Text(
                        if (state.syncing) "Syncing…"
                        else if (state.pendingCount > 0) "Sync ${state.pendingCount}"
                        else "Synced",
                        color = TurnoutColors.Text,
                    )
                }
            }
            state.statusMessage?.let {
                Text(
                    text = it,
                    color = TurnoutColors.Lime500,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            state.error?.let {
                Text(
                    text = it,
                    color = TurnoutColors.Error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            if (!state.hasRoster) {
                Text(
                    text = "Download the roster while you still have signal.",
                    color = TurnoutColors.Warning,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

@Composable
private fun StatusCard(state: ScannerUiState, modifier: Modifier = Modifier) {
    val (borderColor, bgColor, icon) = when (state.status) {
        ScanStatus.SUCCESS -> Triple(TurnoutColors.Success, TurnoutColors.Success.copy(0.12f), Icons.Default.CheckCircle)
        ScanStatus.WARNING -> Triple(TurnoutColors.Warning, TurnoutColors.Warning.copy(0.12f), Icons.Default.Warning)
        ScanStatus.ERROR -> Triple(TurnoutColors.Error, TurnoutColors.Error.copy(0.12f), Icons.Default.Close)
        ScanStatus.IDLE -> Triple(TurnoutColors.TextSubtle, TurnoutColors.Ink.copy(0.5f), Icons.Default.QrCodeScanner)
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(bgColor, RoundedCornerShape(20.dp))
            .border(1.dp, borderColor.copy(alpha = 0.45f), RoundedCornerShape(20.dp))
            .padding(20.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Icon(icon, contentDescription = null, tint = borderColor)
            Column(modifier = Modifier.padding(start = 12.dp)) {
                Text(text = state.statusMessage, color = TurnoutColors.Text, style = MaterialTheme.typography.bodyLarge)
                state.lastAttendee?.let { attendee ->
                    Text(
                        text = attendee.fullName,
                        color = TurnoutColors.Text,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Text(
                        text = "${attendee.ticketName} · ${attendee.email}",
                        color = TurnoutColors.TextMuted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
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
