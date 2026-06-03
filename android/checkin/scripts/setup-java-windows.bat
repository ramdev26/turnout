@echo off
REM Sets JAVA_HOME and PATH when Gradle cannot find Java (common on fresh Windows installs).
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :done

where java >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%J in ('where java 2^>nul ^| findstr /i "\\bin\\java.exe"') do (
    set "JAVA_BIN=%%~dpJ"
    set "JAVA_HOME=%%~dpJ"
    set "JAVA_HOME=!JAVA_HOME:~0,-5!"
    goto :apply
  )
)

setlocal EnableDelayedExpansion
for %%D in (
  "%ProgramFiles%\Android\Android Studio\jbr"
  "%LOCALAPPDATA%\Programs\Android\Android Studio\jbr"
  "%ProgramFiles%\Android\Android Studio1\jbr"
  "%ProgramFiles%\Java\jdk-21"
  "%ProgramFiles%\Java\jdk-17"
  "%ProgramFiles%\Java\jdk-21.0.5"
  "%ProgramFiles%\Java\jdk-17.0.13"
  "%ProgramFiles%\Eclipse Adoptium\jdk-21.0.5.11-hotspot"
  "%ProgramFiles%\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
  "%ProgramFiles%\Microsoft\jdk-17.0.13.11-hotspot"
) do (
  if exist "%%~D\bin\java.exe" (
    endlocal
    set "JAVA_HOME=%%~D"
    goto :apply
  )
)
endlocal

echo.
echo ERROR: Java not found.
echo.
echo Install ONE of these, then run build-apk.bat again:
echo   1. Android Studio ^(recommended^) - includes Java automatically
echo      https://developer.android.com/studio
echo   2. JDK 17 from https://adoptium.net/
echo.
echo If Android Studio is already installed, set JAVA_HOME manually in PowerShell:
echo   $env:JAVA_HOME = "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr"
echo   $env:Path = "$env:JAVA_HOME\bin;$env:Path"
echo   .\scripts\build-apk.ps1
echo.
exit /b 1

:apply
if not defined JAVA_HOME exit /b 1
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Using Java: %JAVA_HOME%
goto :done

:done
exit /b 0
