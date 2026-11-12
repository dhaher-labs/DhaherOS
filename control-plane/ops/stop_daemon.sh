#!/usr/bin/env bash
# ops/stop_daemon.sh — Fase 9 slice-1c (run-38): stop daemon supervisor + control plane anak.
# Urutan (spesifikasi slice-1c): touch ops/.daemon.stop (kill-switch — supervisor loop
# exit TANPA resurrect) → kill supervisor → kill control plane anak → fallback fuser
# :3031 → VERIFIKASI port bebas. Exit non-zero bila :3031 masih merespons.
#
# Fase 10 (task 58-b) — AT-GR-01 (plan AT-23: Penghentian worker/proses, nilai grace):
#   env DHOS_STOP_GRACE_MS (default 1500 = perilaku lama PERSIS) — jeda grace antara SIGTERM
#   ke control plane anak dan eskalasi SIGKILL/fuser. Selama grace, port dipoll (50ms) —
#   bila child berhenti sendiri sebelum deadline, eskalasi KILL di-skip (shutdown bersih).
#   Setelah deadline: kill -9 + fuser fallback tetap dijalankan (tidak ada orphan yang lolos).
set -u

ROOT="/home/z/my-project/dhaheros"
BASE="http://127.0.0.1:3031"
PIDFILE="$ROOT/ops/.daemon.pid"
CHILD_PID="$ROOT/logs/daemon-cp.pid"
STOP_FILE="$ROOT/ops/.daemon.stop"
LOG="$ROOT/ops/daemon_health.log"

GRACE_MS="${DHOS_STOP_GRACE_MS:-1500}"   # AT-GR-01: knob grace (ms); default = perilaku lama
ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
mkdir -p "$ROOT/ops" "$ROOT/logs"

port_busy() { curl -sf -m 1 "$BASE/api/health" >/dev/null 2>&1; }

# 1) kill-switch dulu — supervisor yang masih jalan akan exit bersih di iterasi berikutnya
touch "$STOP_FILE"
echo "$(ts) stop_daemon: kill-switch dipasang (ops/.daemon.stop) grace_ms=$GRACE_MS" >> "$LOG"

# 2) stop supervisor
if [ -f "$PIDFILE" ]; then
  DPID="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "$DPID" ] && kill -0 "$DPID" 2>/dev/null; then
    kill "$DPID" 2>/dev/null
    echo "stop_daemon: supervisor (pid $DPID) dihentikan"
  fi
fi

# 3) stop control plane anak (jika ada pidfile) — TERM, lalu tunggu grace period AT-GR-01
if [ -f "$CHILD_PID" ]; then
  CPID="$(cat "$CHILD_PID" 2>/dev/null || true)"
  if [ -n "$CPID" ] && kill -0 "$CPID" 2>/dev/null; then
    kill "$CPID" 2>/dev/null
    echo "stop_daemon: control plane (pid $CPID) dihentikan (TERM; grace ${GRACE_MS}ms)"
  fi
fi

# 4) grace period (AT-GR-01): tunggu sampai port bebas ATAU deadline grace —
#    berhenti sendiri dalam grace → shutdown bersih tanpa KILL; lewat deadline → eskalasi.
DEADLINE=$(( $(date +%s%3N) + GRACE_MS ))
while port_busy && [ "$(date +%s%3N)" -lt "$DEADLINE" ]; do
  sleep 0.05
done
if port_busy; then
  echo "stop_daemon: grace ${GRACE_MS}ms habis — eskalasi kill/fuser"
  if [ -f "$CHILD_PID" ]; then
    CPID="$(cat "$CHILD_PID" 2>/dev/null || true)"
    [ -n "$CPID" ] && kill -9 "$CPID" 2>/dev/null || true
  fi
  fuser -k -9 3031/tcp >/dev/null 2>&1 || true
fi

# 5) verifikasi port bebas (maks ~10 dtk) — tidak ada orphan yang lolos
i=0
while port_busy && [ "$i" -lt 20 ]; do
  i=$((i+1)); sleep 0.5
done
if port_busy; then
  echo "stop_daemon: GAGAL — :3031 masih merespons setelah stop (periksa manual)"
  exit 1
fi

rm -f "$PIDFILE" "$CHILD_PID"
echo "$(ts) stop_daemon: OK — supervisor+control plane berhenti, :3031 bebas, kill-switch terpasang, grace_ms=$GRACE_MS" >> "$LOG"
echo "stop_daemon: OK — :3031 bebas; ops/.daemon.stop terpasang (jalankan ops/start_daemon.sh untuk start lagi — file tsb di-rm otomatis saat start sah)"
