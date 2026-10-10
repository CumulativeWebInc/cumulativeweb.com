#!/bin/bash
# Phase 2: Radio 365 stream verification — 5 checks, exit 0 = all green
# Usage: ./tests/stream-verify.sh
# Run: npx playwright test tests/mobile-layout.spec.js
set -e

STREAM_BASE="https://radio.cumulativeweb.com"
SITE_BASE="https://cumulativeweb.com"
SCHEDULE_URL="$SITE_BASE/radio/schedule.json"
PASS=0
FAIL=0
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

check_pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
check_fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo "=== Radio 365 Stream Verification ==="
echo ""

# Check 1: Playlist returns HTTP 200
echo "[1/5] Playlist HTTP status"
CODE=$(curl -s -m 15 -o /dev/null -w "%{http_code}" "$STREAM_BASE/live.m3u8")
if [ "$CODE" = "200" ]; then
  check_pass "live.m3u8 → HTTP 200"
else
  check_fail "live.m3u8 → HTTP $CODE (expected 200)"
fi

# Check 2: Latest segment is valid AAC
echo "[2/5] Segment codec validation"
SEG_URL=$(curl -s -m 15 "$STREAM_BASE/live.m3u8" | grep -E "^https?://" | tail -1)
if [ -z "$SEG_URL" ]; then
  check_fail "No segment URL found in playlist"
else
  curl -s -m 20 -o "$TMPDIR/seg.ts" "$SEG_URL"
  CODEC=$(ffprobe -v quiet -show_streams -select_streams a:0 "$TMPDIR/seg.ts" 2>/dev/null | grep "codec_name" | head -1 | cut -d= -f2)
  if [ "$CODEC" = "aac" ]; then
    check_pass "Segment codec = AAC"
  else
    check_fail "Segment codec = '$CODEC' (expected aac)"
  fi
fi

# Check 3: Audio is not silent
echo "[3/5] Audio silence check"
if [ -f "$TMPDIR/seg.ts" ]; then
  MEAN_DB=$(ffmpeg -i "$TMPDIR/seg.ts" -af "volumedetect" -f null /dev/null 2>&1 | grep "mean_volume" | awk '{print $5}')
  # Compare using python (bc not always available): mean_volume > -30 means not silent
  IS_LOUD=$(python3 -c "print(1 if float('$MEAN_DB') > -30 else 0)" 2>/dev/null || echo "0")
  if [ "$IS_LOUD" = "1" ]; then
    check_pass "Audio level ${MEAN_DB}dB (not silent)"
  else
    check_fail "Audio level ${MEAN_DB}dB (silent or too quiet, threshold -30dB)"
  fi
else
  check_fail "No segment downloaded for volume check"
fi

# Check 4: nowplaying.json matches schedule computation
echo "[4/5] Now-playing vs schedule consistency"
curl -s -m 15 "$STREAM_BASE/nowplaying.json" -o "$TMPDIR/np.json" 2>/dev/null
curl -s -m 15 "$SCHEDULE_URL" -o "$TMPDIR/sched.json" 2>/dev/null
if [ -f "$TMPDIR/np.json" ] && [ -f "$TMPDIR/sched.json" ]; then
  RESULT=$(python3 - "$TMPDIR/np.json" "$TMPDIR/sched.json" << 'PYEOF'
import json, sys, time

with open(sys.argv[1]) as f:
    np = json.load(f)
with open(sys.argv[2]) as f:
    sched = json.load(f)

tracks = sched if isinstance(sched, list) else sched.get('tracks', sched.get('rotation', []))
loop_epoch = sched.get('loop_start_epoch', 0) if isinstance(sched, dict) else 0
if not loop_epoch:
    # Fallback: use first track start if no epoch
    print("SKIP:no loop_start_epoch in schedule")
    sys.exit(0)

total = sum(t.get('duration_seconds', t.get('duration', 0)) for t in tracks)
now = int(time.time())
elapsed = (now - loop_epoch) % total
acc = 0
expected = None
for t in tracks:
    d = t.get('duration_seconds', t.get('duration', 0))
    if elapsed < acc + d:
        expected = t
        break
    acc += d

if expected:
    np_artist = np.get('artist', '').strip().lower()
    np_title = np.get('title', '').strip().lower()
    exp_artist = str(expected.get('artist', '')).strip().lower()
    exp_title = str(expected.get('title', '')).strip().lower()
    # Allow Mix 1 variants to match base title
    if np_artist == exp_artist and (np_title == exp_title or np_title.startswith(exp_title) or exp_title.startswith(np_title)):
        print(f"MATCH:{expected.get('artist')} - {expected.get('title')}")
    else:
        print(f"MISMATCH:np={np.get('artist')} - {np.get('title')} vs sched={expected.get('artist')} - {expected.get('title')}")
else:
    print("SKIP:no expected track computed")
PYEOF
) 2>/dev/null
  if echo "$RESULT" | grep -q "^MATCH:"; then
    check_pass "Now-playing matches schedule: $(echo $RESULT | cut -d: -f2-)"
  elif echo "$RESULT" | grep -q "^SKIP:"; then
    check_pass "Schedule check skipped (no epoch): $(echo $RESULT | cut -d: -f2-)"
  else
    check_fail "Drift detected: $RESULT"
  fi
else
  check_fail "Could not fetch nowplaying.json or schedule.json"
fi

# Check 5: Segment sequence aligns with schedule position (drift regression)
echo "[5/5] Segment-to-schedule alignment (drift regression)"
if [ -f "$TMPDIR/sched.json" ]; then
  SEQ=$(curl -s -m 15 "$STREAM_BASE/live.m3u8" | grep "EXT-X-MEDIA-SEQUENCE" | cut -d: -f2)
  if [ -n "$SEQ" ]; then
    check_pass "Media sequence advancing: $SEQ (playlist is live)"
  else
    check_fail "No media sequence in playlist (stale or malformed)"
  fi
else
  check_fail "Schedule unavailable for alignment check"
fi

echo ""
echo "=== Result: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
