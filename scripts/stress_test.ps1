# ============================================================================
# MiniDrive Stress Test Script (PowerShell)
# Purpose: Validate connection pool and concurrent upload capacity
# Usage: .\stress_test.ps1 -BaseUrl "http://localhost:8080" -NumConcurrent 5 -FileSizeMB 100
# ============================================================================

param(
    [string]$BaseUrl = "http://localhost:8080",
    [int]$NumConcurrent = 5,
    [int]$FileSizeMB = 100
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "MiniDrive Concurrent Upload Stress Test" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl"
Write-Host "Concurrent Uploads: $NumConcurrent"
Write-Host "File Size per Upload: ${FileSizeMB}MB"
Write-Host ""

# Generate test user credentials
$timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$testUser = "stresstest_$timestamp"
$testPassword = "testpass123"

# Generate test file
Write-Host "[1/5] Generating ${FileSizeMB}MB test file..." -ForegroundColor Yellow
$testFile = Join-Path $env:TEMP "minidrive_stress_test_${FileSizeMB}mb.bin"
$random = [System.Random]::new()
$buffer = New-Object byte[] (1MB)
$stream = [System.IO.File]::Create($testFile)
try {
    for ($i = 0; $i -lt $FileSizeMB; $i++) {
        $random.NextBytes($buffer)
        $stream.Write($buffer, 0, $buffer.Length)
    }
} finally {
    $stream.Close()
}
Write-Host "Test file created: $testFile"

# Register test user
Write-Host ""
Write-Host "[2/5] Registering test user..." -ForegroundColor Yellow
$body = @{ username = $testUser; password = $testPassword } | ConvertTo-Json
try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/register" -Method Post -Body $body -ContentType "application/json"
    $token = $response.token
} catch {
    Write-Host "Registration failed. Trying login..."
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body -ContentType "application/json"
        $token = $response.token
    } catch {
        Write-Host "Failed to authenticate: $_" -ForegroundColor Red
        exit 1
    }
}
Write-Host "Authenticated successfully."

# Upload function
$uploadScript = {
    param($BaseUrl, $Token, $TestFile, $UploadNum, $FileSizeMB)
    
    $filename = "stress_test_file_${UploadNum}.bin"
    $startTime = Get-Date
    
    try {
        # Init upload
        $fileSizeBytes = $FileSizeMB * 1024 * 1024
        $headers = @{ Authorization = "Bearer $Token" }
        $initResponse = Invoke-RestMethod -Uri "$BaseUrl/api/drive/init?filename=$filename&size=$fileSizeBytes" -Method Post -Headers $headers
        $uploadId = $initResponse
        
        if (-not $uploadId) {
            return @{ Success = $false; Message = "Init failed"; UploadNum = $UploadNum }
        }
        
        # Upload chunks
        $chunkSize = 1MB
        $fileStream = [System.IO.File]::OpenRead($TestFile)
        $buffer = New-Object byte[] $chunkSize
        $chunkIndex = 0
        
        try {
            while (($bytesRead = $fileStream.Read($buffer, 0, $chunkSize)) -gt 0) {
                # Calculate hash
                $sha256 = [System.Security.Cryptography.SHA256]::Create()
                $actualChunk = if ($bytesRead -eq $chunkSize) { $buffer } else { $buffer[0..($bytesRead-1)] }
                $hashBytes = $sha256.ComputeHash($actualChunk)
                $hash = [BitConverter]::ToString($hashBytes) -replace '-', ''
                $hash = $hash.ToLower()
                
                # Save temp chunk
                $tempChunk = [System.IO.Path]::GetTempFileName()
                [System.IO.File]::WriteAllBytes($tempChunk, $actualChunk)
                
                # Upload chunk
                $form = @{
                    uploadId = $uploadId
                    index = $chunkIndex
                    hash = $hash
                    chunk = Get-Item -Path $tempChunk
                }
                
                $chunkResponse = Invoke-RestMethod -Uri "$BaseUrl/api/drive/upload/chunk" -Method Post -Headers $headers -Form $form
                Remove-Item $tempChunk -Force
                
                $chunkIndex++
            }
        } finally {
            $fileStream.Close()
        }
        
        # Complete upload
        $completeResponse = Invoke-RestMethod -Uri "$BaseUrl/api/drive/complete?uploadId=$uploadId" -Method Post -Headers $headers
        
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        $speed = [math]::Round($FileSizeMB / $duration, 2)
        
        return @{ 
            Success = $true 
            Message = "Completed in ${duration}s (${speed} MB/s)"
            UploadNum = $UploadNum
            Duration = $duration
        }
    } catch {
        return @{ 
            Success = $false 
            Message = $_.Exception.Message
            UploadNum = $UploadNum
        }
    }
}

# Run concurrent uploads
Write-Host ""
Write-Host "[3/5] Starting $NumConcurrent concurrent uploads..." -ForegroundColor Yellow
$startTime = Get-Date

$jobs = @()
for ($i = 1; $i -le $NumConcurrent; $i++) {
    $jobs += Start-Job -ScriptBlock $uploadScript -ArgumentList $BaseUrl, $token, $testFile, $i, $FileSizeMB
}

# Wait for all jobs
$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$endTime = Get-Date
$totalDuration = [math]::Round(($endTime - $startTime).TotalSeconds, 2)

# Analyze results
$successCount = ($results | Where-Object { $_.Success }).Count
$failCount = $NumConcurrent - $successCount
$totalData = $NumConcurrent * $FileSizeMB
$throughput = [math]::Round($totalData / $totalDuration, 2)

# Print results
Write-Host ""
Write-Host "[4/5] Stress Test Results" -ForegroundColor Yellow
Write-Host "============================================"
Write-Host "Total Duration: ${totalDuration}s"
Write-Host "Total Data Transferred: ${totalData}MB"
Write-Host "Aggregate Throughput: $throughput MB/s"
Write-Host "Successful Uploads: $successCount / $NumConcurrent"
Write-Host "Failed Uploads: $failCount / $NumConcurrent"
Write-Host ""

foreach ($result in $results) {
    if ($result.Success) {
        Write-Host "  Upload $($result.UploadNum): $($result.Message)" -ForegroundColor Green
    } else {
        Write-Host "  Upload $($result.UploadNum): FAILED - $($result.Message)" -ForegroundColor Red
    }
}

# Cleanup
Write-Host ""
Write-Host "[5/5] Cleaning up..." -ForegroundColor Yellow
Remove-Item $testFile -Force -ErrorAction SilentlyContinue

if ($failCount -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "✅ STRESS TEST PASSED" -ForegroundColor Green
    Write-Host "The system handled $NumConcurrent concurrent ${FileSizeMB}MB uploads successfully."
    Write-Host "============================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "❌ STRESS TEST FAILED" -ForegroundColor Red
    Write-Host "$failCount out of $NumConcurrent uploads failed."
    Write-Host "Check server logs for ConnectionTimeout or pool exhaustion errors."
    Write-Host "============================================" -ForegroundColor Red
    exit 1
}
