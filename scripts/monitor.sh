#!/bin/bash
# Tony Knowledge Garden - Health & SEO Monitor
set -e

PORT="${1:-8080}"
URL="http://localhost:${PORT}"
CURL_BIN="${CURL_BIN:-curl}"
STATUS=0
WARNINGS=0

echo "=== Tony Knowledge Garden Monitor ==="
echo "URL: ${URL}"
echo ""

# 1. HTTP check
echo "[1/5] HTTP Status Check..."
if ! HTTP_CODE=$("${CURL_BIN}" -s -o /dev/null -w "%{http_code}" "${URL}" 2>/dev/null); then
  HTTP_CODE="000"
fi
if [ "${HTTP_CODE}" = "200" ]; then
  echo "  OK - HTTP ${HTTP_CODE}"
else
  echo "  FAIL - HTTP ${HTTP_CODE}"
  STATUS=1
fi

# 2. Response time
echo "[2/5] Response Time..."
if ! RESPONSE_TIME=$("${CURL_BIN}" -s -o /dev/null -w "%{time_total}" "${URL}" 2>/dev/null); then
  RESPONSE_TIME="N/A"
fi
echo "  Time: ${RESPONSE_TIME}s"

# 3. SEO meta tags
echo "[3/5] SEO Meta Tags..."
if ! CONTENT=$("${CURL_BIN}" -s "${URL}" 2>/dev/null); then
  CONTENT=""
fi
TITLE=$(echo "${CONTENT}" | grep -o '<title>[^<]*' | sed 's/<title>//' | head -1)
if [ -n "${TITLE}" ]; then
  echo "  Title: ${TITLE}"
else
  echo "  WARN - Missing title tag"
  WARNINGS=$((WARNINGS + 1))
fi

# 4. Structured data
echo "[4/5] JSON-LD Structured Data..."
if echo "${CONTENT}" | grep -q "application/ld+json"; then
  echo "  OK - JSON-LD found"
else
  echo "  WARN - Missing structured data"
  WARNINGS=$((WARNINGS + 1))
fi

# 5. Content categories
echo "[5/5] Content Structure..."
CATEGORIES=0
for dir in "AI与技术" "中文教学" "计算机科学" "数学" "投资商业" "人物思想" "学科"; do
  if [ -d "content/${dir}" ]; then
    CATEGORIES=$((CATEGORIES + 1))
  fi
done
echo "  Categories: ${CATEGORIES}/7"

# 6. Note count
NOTE_COUNT=$(find content -name "*.md" ! -name ".gitkeep" 2>/dev/null | wc -l | tr -d ' ')
echo "  Total Notes: ${NOTE_COUNT}"

echo ""
if [ "${STATUS}" -ne 0 ]; then
  echo "=== Monitor Failed (${WARNINGS} warning(s)) ==="
elif [ "${WARNINGS}" -gt 0 ]; then
  echo "=== Monitor Complete with ${WARNINGS} warning(s) ==="
else
  echo "=== Monitor Complete ==="
fi

exit "${STATUS}"
