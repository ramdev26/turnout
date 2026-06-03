@echo off
cd /d "%~dp0.."
echo Building from %CD%
call "%~dp0setup-java-windows.bat"
if errorlevel 1 exit /b 1
if not exist gradlew.bat (
  echo ERROR: gradlew.bat not found. Open android\checkin in Android Studio first.
  exit /b 1
)
call gradlew.bat :app:assembleDebug --no-daemon
if errorlevel 1 exit /b 1
if not exist "app\build\outputs\apk\debug\app-debug.apk" (
  echo ERROR: APK not found after build.
  exit /b 1
)
if not exist dist mkdir dist
copy /Y "app\build\outputs\apk\debug\app-debug.apk" "TurnoutCheckIn-debug.apk"
copy /Y "app\build\outputs\apk\debug\app-debug.apk" "dist\TurnoutCheckIn-debug.apk"
echo.
echo ==============================================
echo APK ready:
echo %CD%\TurnoutCheckIn-debug.apk
echo ==============================================
pause
