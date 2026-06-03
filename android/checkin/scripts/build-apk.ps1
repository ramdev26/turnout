# Build Turnout Check-in debug APK on Windows (PowerShell).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Building APK from: $PWD"

if (-not (Test-Path ".\gradlew.bat")) {
    Write-Error "gradlew.bat not found. Open the android\checkin folder in Android Studio and sync Gradle first."
}

& .\gradlew.bat :app:assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$src = "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $src)) {
    Write-Error "Build finished but APK not found at $src"
}

New-Item -ItemType Directory -Force -Path "dist" | Out-Null
Copy-Item -Force $src ".\TurnoutCheckIn-debug.apk"
Copy-Item -Force $src ".\dist\TurnoutCheckIn-debug.apk"

$full = (Resolve-Path ".\TurnoutCheckIn-debug.apk").Path
Write-Host ""
Write-Host "=============================================="
Write-Host "APK ready:"
Write-Host $full
Write-Host "=============================================="
Get-Item $full | Format-List Name, Length, FullName
