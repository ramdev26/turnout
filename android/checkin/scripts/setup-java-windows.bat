@echo off
REM Sets JAVA_HOME and PATH when Gradle cannot find Java (common on fresh Windows installs).
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :apply_path

where java >nul 2>&1
if %errorlevel% equ 0 (
  for /f "delims=" %%J in ('where java 2^>nul') do (
    if exist "%%~J" (
      set "JAVA_HOME=%%~dpJ"
      set "JAVA_HOME=%JAVA_HOME:~0,-5%"
      goto :apply_path
    )
  )
)

set "_FOUND="
for %%D in (
  "%ProgramFiles%\Android\Android Studio\jbr"
  "%LOCALAPPDATA%\Programs\Android\Android Studio\jbr"
  "%ProgramFiles%\Android\Android Studio1\jbr"
  "%ProgramFiles%\Java\jdk-21"
  "%ProgramFiles%\Java\jdk-17"
  "%ProgramFiles%\Microsoft\jdk-17.0.13.11-hotspot"
  "%ProgramFiles%\Eclipse Adoptium\jdk-21.0.5.11-hotspot"
  "%ProgramFiles%\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
) do (
  if not defined _FOUND if exist "%%~D\bin\java.exe" set "_FOUND=%%~D"
)

if not defined _FOUND (
  echo.
  echo ERROR: Java not found.
  echo.
  echo Install ONE of these, then run build-apk.bat again:
  echo   1. Android Studio ^(recommended^) - https://developer.android.com/studio
  echo   2. JDK 17 - https://adoptium.net/
  echo.
  echo If Android Studio is already installed, in PowerShell run:
  echo   $env:JAVA_HOME = "$env:LOCALAPPDATA\Programs\Android\Android Studio\jbr"
  echo   $env:Path = "$env:JAVA_HOME\bin;$env:Path"
  echo   .\scripts\build-apk.ps1
  echo.
  exit /b 1
)

set "JAVA_HOME=%_FOUND%"
set "_FOUND="

:apply_path
if not defined JAVA_HOME exit /b 1
if not exist "%JAVA_HOME%\bin\java.exe" exit /b 1
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo Using Java: %JAVA_HOME%
exit /b 0
