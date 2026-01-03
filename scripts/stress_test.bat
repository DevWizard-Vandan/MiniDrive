@echo off
REM ============================================================================
REM MiniDrive Stress Test Script (Windows)
REM Purpose: Validate connection pool and concurrent upload capacity
REM Usage: stress_test.bat [BASE_URL] [NUM_CONCURRENT] [FILE_SIZE_MB]
REM ============================================================================

setlocal EnableDelayedExpansion

REM Configuration
set "BASE_URL=%~1"
if "%BASE_URL%"=="" set "BASE_URL=http://localhost:8080"
set "NUM_CONCURRENT=%~2"
if "%NUM_CONCURRENT%"=="" set "NUM_CONCURRENT=5"
set "FILE_SIZE_MB=%~3"
if "%FILE_SIZE_MB%"=="" set "FILE_SIZE_MB=100"

echo ============================================
echo MiniDrive Concurrent Upload Stress Test
echo ============================================
echo Target: %BASE_URL%
echo Concurrent Uploads: %NUM_CONCURRENT%
echo File Size per Upload: %FILE_SIZE_MB%MB
echo.

REM Check for PowerShell
where powershell >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo PowerShell not found. This script requires PowerShell.
    exit /b 1
)

REM Run PowerShell stress test
powershell -ExecutionPolicy Bypass -File "%~dp0stress_test.ps1" -BaseUrl "%BASE_URL%" -NumConcurrent %NUM_CONCURRENT% -FileSizeMB %FILE_SIZE_MB%

exit /b %ERRORLEVEL%
