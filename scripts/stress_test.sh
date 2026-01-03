#!/usr/bin/env bash
# ============================================================================
# MiniDrive Stress Test Script
# Purpose: Validate connection pool and concurrent upload capacity
# Usage: ./stress_test.sh [BASE_URL] [NUM_CONCURRENT] [FILE_SIZE_MB]
# ============================================================================

set -e

# Configuration
BASE_URL="${1:-http://localhost:8080}"
NUM_CONCURRENT="${2:-5}"       # Number of concurrent uploads
FILE_SIZE_MB="${3:-100}"       # File size in MB per upload
TEST_USER="stresstest_$(date +%s)"
TEST_PASSWORD="testpass123"

echo "============================================"
echo "MiniDrive Concurrent Upload Stress Test"
echo "============================================"
echo "Target: $BASE_URL"
echo "Concurrent Uploads: $NUM_CONCURRENT"
echo "File Size per Upload: ${FILE_SIZE_MB}MB"
echo "Test User: $TEST_USER"
echo ""

# Check dependencies
command -v curl >/dev/null 2>&1 || { echo "curl required but not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1 || { echo "jq required but not installed. Aborting."; exit 1; }

# Generate test file
echo "[1/5] Generating ${FILE_SIZE_MB}MB test file..."
TEST_FILE="/tmp/minidrive_stress_test_${FILE_SIZE_MB}mb.bin"
dd if=/dev/urandom of="$TEST_FILE" bs=1M count=$FILE_SIZE_MB status=progress 2>/dev/null

# Register test user
echo ""
echo "[2/5] Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$TEST_USER\", \"password\": \"$TEST_PASSWORD\"}")

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
  echo "Registration failed. Trying login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\": \"$TEST_USER\", \"password\": \"$TEST_PASSWORD\"}")
  TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
fi

if [ -z "$TOKEN" ]; then
  echo "Failed to authenticate. Response: $REGISTER_RESPONSE"
  exit 1
fi
echo "Authenticated successfully."

# Function to upload file in chunks
upload_file() {
  local UPLOAD_NUM=$1
  local FILENAME="stress_test_file_${UPLOAD_NUM}.bin"
  local START_TIME=$(date +%s.%N)
  
  # Init upload
  local INIT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/drive/init?filename=$FILENAME&size=$((FILE_SIZE_MB * 1024 * 1024))" \
    -H "Authorization: Bearer $TOKEN")
  
  local UPLOAD_ID=$(echo "$INIT_RESPONSE" | tr -d '"')
  
  if [ -z "$UPLOAD_ID" ] || [[ "$UPLOAD_ID" == *"error"* ]]; then
    echo "Upload $UPLOAD_NUM FAILED at init: $INIT_RESPONSE"
    return 1
  fi
  
  # Split and upload chunks
  local CHUNK_SIZE=$((1024 * 1024))  # 1MB chunks
  local CHUNK_INDEX=0
  local OFFSET=0
  local FILE_SIZE=$(stat -c%s "$TEST_FILE" 2>/dev/null || stat -f%z "$TEST_FILE")
  
  while [ $OFFSET -lt $FILE_SIZE ]; do
    local CHUNK_FILE="/tmp/chunk_${UPLOAD_NUM}_${CHUNK_INDEX}.bin"
    dd if="$TEST_FILE" of="$CHUNK_FILE" bs=$CHUNK_SIZE skip=$CHUNK_INDEX count=1 2>/dev/null
    
    # Calculate SHA-256 hash
    local HASH=$(sha256sum "$CHUNK_FILE" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$CHUNK_FILE" | cut -d' ' -f1)
    
    # Upload chunk
    local CHUNK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/drive/upload/chunk" \
      -H "Authorization: Bearer $TOKEN" \
      -F "uploadId=$UPLOAD_ID" \
      -F "index=$CHUNK_INDEX" \
      -F "hash=$HASH" \
      -F "chunk=@$CHUNK_FILE")
    
    rm -f "$CHUNK_FILE"
    
    if [[ "$CHUNK_RESPONSE" == *"error"* ]] || [[ "$CHUNK_RESPONSE" == *"not found"* ]]; then
      echo "Upload $UPLOAD_NUM FAILED at chunk $CHUNK_INDEX: $CHUNK_RESPONSE"
      return 1
    fi
    
    CHUNK_INDEX=$((CHUNK_INDEX + 1))
    OFFSET=$((OFFSET + CHUNK_SIZE))
  done
  
  # Complete upload
  local COMPLETE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/drive/complete?uploadId=$UPLOAD_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  local END_TIME=$(date +%s.%N)
  local DURATION=$(echo "$END_TIME - $START_TIME" | bc)
  local SPEED=$(echo "scale=2; $FILE_SIZE_MB / $DURATION" | bc)
  
  if [[ "$COMPLETE_RESPONSE" == *"error"* ]] || [[ "$COMPLETE_RESPONSE" == *"missing"* ]]; then
    echo "Upload $UPLOAD_NUM FAILED at complete: $COMPLETE_RESPONSE"
    return 1
  fi
  
  echo "Upload $UPLOAD_NUM COMPLETED in ${DURATION}s (${SPEED} MB/s)"
  return 0
}

# Run concurrent uploads
echo ""
echo "[3/5] Starting $NUM_CONCURRENT concurrent uploads..."
START_TIME=$(date +%s.%N)

PIDS=()
RESULTS=()
for i in $(seq 1 $NUM_CONCURRENT); do
  upload_file $i &
  PIDS+=($!)
done

# Wait for all uploads and capture results
SUCCESS_COUNT=0
FAIL_COUNT=0
for pid in "${PIDS[@]}"; do
  if wait $pid; then
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

END_TIME=$(date +%s.%N)
TOTAL_DURATION=$(echo "$END_TIME - $START_TIME" | bc)
TOTAL_DATA=$((NUM_CONCURRENT * FILE_SIZE_MB))
THROUGHPUT=$(echo "scale=2; $TOTAL_DATA / $TOTAL_DURATION" | bc)

# Print results
echo ""
echo "[4/5] Stress Test Results"
echo "============================================"
echo "Total Duration: ${TOTAL_DURATION}s"
echo "Total Data Transferred: ${TOTAL_DATA}MB"
echo "Aggregate Throughput: ${THROUGHPUT} MB/s"
echo "Successful Uploads: $SUCCESS_COUNT / $NUM_CONCURRENT"
echo "Failed Uploads: $FAIL_COUNT / $NUM_CONCURRENT"
echo ""

# Cleanup
echo "[5/5] Cleaning up..."
rm -f "$TEST_FILE"

if [ $FAIL_COUNT -eq 0 ]; then
  echo "============================================"
  echo "✅ STRESS TEST PASSED"
  echo "The system handled $NUM_CONCURRENT concurrent ${FILE_SIZE_MB}MB uploads successfully."
  echo "============================================"
  exit 0
else
  echo "============================================"
  echo "❌ STRESS TEST FAILED"
  echo "$FAIL_COUNT out of $NUM_CONCURRENT uploads failed."
  echo "Check server logs for ConnectionTimeout or pool exhaustion errors."
  echo "============================================"
  exit 1
fi
