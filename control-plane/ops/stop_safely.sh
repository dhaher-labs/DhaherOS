#!/usr/bin/env bash
# ops/stop_safely.sh — Fase 8 slice-1 (run-9): skenario end-to-end stop-safely + recovery.
# Urutan: cancel semua running → state bersih → service stop → start ulang (recovery boot)
#         → crash recovery (kill -9 saat running → uncertain → reconcile → succeeded)
#         → verify_at.sh 33/33.
# Bukti: logs/stop_safely_results.txt (AT-OS-01..07). Exit non-zero bila ada FAIL.
set -u

ROOT="/home/z/my-project/dhaheros"
BASE="http://127.0.0.1:3031"
DB="$ROOT/data/dhaheros.db"
SVC_LOG="$ROOT/logs/service-verify.log"
PIDFILE="$ROOT/logs/stop_safely.pid"
RESULT="$ROOT/logs/stop_safely_results.txt"

mkdir -p "$ROOT/logs" "$ROOT/workspaces"
# Fase 9 slice-1c (run-38): kill-switch daemon — supervisor (ops/start_daemon.sh) tidak
# resurrect :3031 selama skenario stop/verify (health loop exit bersih saat file ada).
mkdir -p "$ROOT/ops"; touch "$ROOT/ops/.daemon.stop"
: > "$RESULT"
PASS=0; FAIL=0
record() {
  echo "$1|$2|$3" >> "$RESULT"
  if [ "$2" = "PASS" ]; then PASS=$((PASS+1)); echo "[PASS] $1 — $3"; else FAIL=$((FAIL+1)); echo "[FAIL] $1 — $3"; fi
}

api() { curl -s -m 20 -w '\n%{http_code}' "$@"; }
split_resp() { RESP_CODE=$(printf '%s' "$RESP" | tail -n1); RESP_BODY=$(printf '%s' "$RESP" | sed '$d'); }

state_of() { curl -s -m 10 "$BASE/api/tasks/$1" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("task",{}).get("state",""))
except Exception: print("")' 2>/dev/null; }

wait_state() { local id="$1" want="$2" tmax="${3:-30}" i=0 st=""
  while [ "$i" -lt $((tmax*4)) ]; do
    st=$(state_of "$id"); [[ "$st" =~ ^($want)$ ]] && return 0
    i=$((i+1)); sleep 0.25
  done; echo "  (timeout wait_state: terakhir=$st want=$want)"; return 1
}

start_service() {
  ( cd "$ROOT" && exec bun src/index.ts >> "$SVC_LOG" 2>&1 ) &
  echo $! > "$PIDFILE"
  local i=0
  while [ "$i" -lt 80 ]; do
    curl -sf -m 2 "$BASE/api/health" >/dev/null 2>&1 && return 0
    i=$((i+1)); sleep 0.25
  done; return 1
}
stop_service_soft() { [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null; sleep 1.2; }
stop_service_hard() { [ -f "$PIDFILE" ] && kill -9 "$(cat "$PIDFILE")" 2>/dev/null; sleep 0.8; }
cleanup_orphans() { pkill -9 -f "ws-os-" 2>/dev/null; pkill -9 -x sleep 2>/dev/null; sleep 0.3; }

db_one() { DB="$DB" python3 -c "$1" 2>/dev/null; }

trap 'stop_service_hard; cleanup_orphans' EXIT

echo "=== DhaherOS stop-safely scenario (Fase 8 slice-1) ==="

# fresh DB milik skenario ini + workspace uji harus sudah ada (deny-by-default)
rm -f "$DB" "$DB-wal" "$DB-shm"
mkdir -p "$ROOT/workspaces/ws-os-a" "$ROOT/workspaces/ws-os-rec"

# ---------- AT-OS-01: start + health ----------
if start_service; then record "AT-OS-01" "PASS" "start service fresh DB → /api/health 200"
else record "AT-OS-01" "FAIL" "service gagal start"; tail -5 "$SVC_LOG"; exit 1; fi

# ---------- AT-OS-02: cancel semua running → state bersih ----------
RESP=$(api -X POST "$BASE/api/tasks" -H 'content-type: application/json' -H 'x-idempotency-key: os-a-1' \
  -d '{"goal":"os-stop-safely tahan 90 dtk","workspace":"'"$ROOT"'/workspaces/ws-os-a","command":"sleep 90","timeout_sec":120}')
split_resp
T1=$(printf '%s' "$RESP_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("task",{}).get("id",""))' 2>/dev/null)
if wait_state "$T1" "running" 15; then
  RESP=$(api -X POST "$BASE/api/tasks/$T1/cancel"); split_resp
  if [ "$RESP_CODE" = "200" ] || [ "$RESP_CODE" = "202" ]; then
    if wait_state "$T1" "cancelled" 20; then
      DIRTY=$(db_one "import sqlite3;d=sqlite3.connect('$DB');print(d.execute(\"select count(*) from tasks where state in ('running','planned')\").fetchone()[0])")
      [ "$DIRTY" = "0" ] && record "AT-OS-02" "PASS" "cancel running → cancelled; DB bersih (0 running/planned)" \
                          || record "AT-OS-02" "FAIL" "state belum bersih: dirty=$DIRTY"
    else record "AT-OS-02" "FAIL" "task tidak mencapai cancelled"; fi
  else record "AT-OS-02" "FAIL" "cancel ditolak: HTTP $RESP_CODE"; fi
else record "AT-OS-02" "FAIL" "task tidak mencapai running"; fi

# ---------- AT-OS-03: stop service (TERM) ----------
stop_service_soft
if curl -sf -m 2 "$BASE/api/health" >/dev/null 2>&1; then
  record "AT-OS-03" "FAIL" "service masih merespons setelah TERM"
else
  record "AT-OS-03" "PASS" "stop TERM → health tidak merespons (port bebas)"
fi

# ---------- AT-OS-04: start ulang (DB sama) → boot bersih ----------
if start_service; then
  BOOT=$(db_one "import sqlite3,json;d=sqlite3.connect('$DB');r=d.execute(\"select payload from events where type='service_boot' order by id desc limit 1\").fetchone();print(json.loads(r[0])['recovered_running_to_uncertain'] if r else 'x')")
  [ "$BOOT" = "0" ] && record "AT-OS-04" "PASS" "start ulang DB sama → health 200; service_boot recovered=0 (stop-safely tanpa korban)" \
                    || record "AT-OS-04" "FAIL" "service_boot recovered=$BOOT (harusnya 0)"
else record "AT-OS-04" "FAIL" "start ulang gagal"; fi

# ---------- AT-OS-05: crash recovery — kill -9 saat task running → uncertain ----------
RESP=$(api -X POST "$BASE/api/tasks" -H 'content-type: application/json' -H 'x-idempotency-key: os-rec-1' \
  -d '{"goal":"os-recovery idempoten","workspace":"'"$ROOT"'/workspaces/ws-os-rec","command":"sleep 8; echo os-rec-ok > hasil.txt","timeout_sec":120}')
split_resp
T2=$(printf '%s' "$RESP_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("task",{}).get("id",""))' 2>/dev/null)
if wait_state "$T2" "running" 15; then
  stop_service_hard; cleanup_orphans
  if start_service; then
    ST=$(state_of "$T2")
    REC=$(db_one "import sqlite3,json;d=sqlite3.connect('$DB');n=d.execute(\"select count(*) from events where type='recovery' and task_id='$T2'\").fetchone()[0];b=d.execute(\"select payload from events where type='service_boot' order by id desc limit 1\").fetchone();print(f'{n}|{json.loads(b[0])[\"recovered_running_to_uncertain\"] if b else \"x\"}')")
    RECN=${REC%%|*}; BOOTN=${REC##*|}
    if [ "$ST" = "uncertain" ] && [ "$RECN" -ge 1 ] && [ "$BOOTN" = "1" ]; then
      record "AT-OS-05" "PASS" "kill -9 saat running → restart → task=uncertain, event recovery=$RECN, service_boot recovered=$BOOTN (tanpa sukses palsu)"
    else record "AT-OS-05" "FAIL" "state=$ST recovery=$RECN boot_recovered=$BOOTN"; fi
  else record "AT-OS-05" "FAIL" "start ulang setelah crash gagal"; fi
else record "AT-OS-05" "FAIL" "task recovery tidak mencapai running"; fi

# ---------- AT-OS-06: reconcile uncertain idempoten → planned → re-run → succeeded ----------
if [ "$(state_of "$T2")" = "uncertain" ]; then
  RESP=$(api -X POST "$BASE/api/tasks/$T2/reconcile"); split_resp
  if [ "$RESP_CODE" = "202" ]; then
    if wait_state "$T2" "succeeded" 40; then
      H=$(tr -d '[:space:]' < "$ROOT/workspaces/ws-os-rec/hasil.txt" 2>/dev/null)
      [ "$H" = "os-rec-ok" ] && record "AT-OS-06" "PASS" "reconcile 202 → re-run idempoten → succeeded; artefak hasil.txt=os-rec-ok" \
                            || record "AT-OS-06" "FAIL" "succeeded tapi artefak salah: '$H'"
    else record "AT-OS-06" "FAIL" "re-run tidak mencapai succeeded"; fi
  else record "AT-OS-06" "FAIL" "reconcile ditolak: HTTP $RESP_CODE $RESP_BODY"; fi
else record "AT-OS-06" "FAIL" "task tidak uncertain — skenario 05 gagal"; fi

# ---------- stop skenario sebelum verify ----------
stop_service_soft; cleanup_orphans

# ---------- AT-OS-07: verify ulang penuh (40 AT) ----------
EV="$ROOT/docs/EVIDENCE.md"
if bash "$ROOT/verify_at.sh" > "$ROOT/logs/stop_safely_verify.log" 2>&1; then
  VP=$(grep -c '^AT-.*|PASS' "$ROOT/logs/at_results.txt" 2>/dev/null || echo "?")
  record "AT-OS-07" "PASS" "verify_at.sh exit 0 — $VP AT PASS (bukti EVIDENCE.md, nested verify)"
else
  VF=$(grep -c '^AT-.*|FAIL' "$ROOT/logs/at_results.txt" 2>/dev/null || echo "?")
  record "AT-OS-07" "FAIL" "verify_at.sh gagal — $VF FAIL; lihat logs/stop_safely_verify.log"
fi

# ---------- append bukti stop-safely ke EVIDENCE.md (dibuat ulang verify_at.sh di atas) ----------
{
  echo ""
  echo "## Stop-safely end-to-end (ops/stop_safely.sh — Fase 8 slice-1; re-run berkala mode maintenance)"
  echo ""
  echo "- Timestamp: $(date -u +%Y-%m-%dT%H:%M:%S+00:00)"
  echo "- Skenario: start fresh → create+cancel running (state bersih) → stop TERM → start ulang DB sama (boot recovered=0) → create running + kill -9 service → restart (recovery running→uncertain) → reconcile idempoten (re-run) → succeeded → verify ulang penuh"
  echo "- Prosedur operasi: docs/RUNBOOK.md (start/stop/restart, recovery, budget, health check, verify ulang, rotasi log)"
  echo "- Hasil: **$PASS PASS / $FAIL FAIL** (AT-OS-01..07)"
  echo ""
  echo "| AT-OS | Hasil | Bukti ringkas |"
  echo "|---|---|---|"
  awk -F'|' '{print "| " $1 " | " $2 " | " $3 " |"}' "$RESULT"
} >> "$EV"

echo "=== Ringkasan: PASS=$PASS FAIL=$FAIL ==="
[ "$FAIL" = "0" ]
