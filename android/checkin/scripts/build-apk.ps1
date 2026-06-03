# Build Turnout Check-in debug APK on Windows (PowerShell).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

function Resolve-WindowsJavaHome {
    if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
        return $env:JAVA_HOME
    }
    $javaCmd = Get-Command java -ErrorAction SilentlyContinue
    if ($javaCmd) {
        return (Split-Path (Split-Path $javaCmd.Source -Parent) -Parent)
    }
    $candidates = @(
        "${env:ProgramFiles}\Android\Android Studio\jbr"
        "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr"
        "${env:ProgramFiles}\Android\Android Studio1\jbr"
        "${env:ProgramFiles}\Java\jdk-21"
        "${env:ProgramFiles}\Java\jdk-17"
        "${env:ProgramFiles}\Eclipse Adoptium\jdk-21.0.5.11-hotspot"
        "${env:ProgramFiles}\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
        "${env:ProgramFiles}\Microsoft\jdk-17.0.13.11-hotspot"
    )
    foreach ($dir in $candidates) {
        if ($dir -and (Test-Path "$dir\bin\java.exe")) { return $dir }
    }
    $adoptium = Get-ChildItem "${env:ProgramFiles}\Eclipse Adoptium" -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path "$($_.FullName)\bin\java.exe" } |
        Select-Object -First 1
    if ($adoptium) { return $adoptium.FullName }
    return $null
}

Write-Host "Building APK from: $PWD"

$javaHome = Resolve-WindowsJavaHome
if (-not $javaHome) {
    Write-Host ""
    Write-Host "ERROR: Java not found (JAVA_HOME unset and no java on PATH)."
    Write-Host ""
    Write-Host "Install Android Studio (recommended): https://developer.android.com/studio"
    Write-Host "Or JDK 17: https://adoptium.net/"
    Write-Host ""
    Write-Host "If Android Studio is installed, run:"
    Write-Host '  $env:JAVA_HOME = "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr"'
    Write-Host '  $env:Path = "$env:JAVA_HOME\bin;$env:Path"'
    Write-Host "  .\scripts\build-apk.ps1"
    exit 1
}
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;" + $env:Path
Write-Host "Using Java: $javaHome"

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
