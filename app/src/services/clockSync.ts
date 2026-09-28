// app/src/services/clockSync.ts
// NTP-style 4-timestamp clock synchronizer.
// Calculates the offset between client local time and server time,
// so we can schedule coordinated play events across all clients.

import { Socket } from 'socket.io-client';
import { EVENTS, SYNC } from '../utils/constants';

interface PingSample {
  rttMs: number;
  offsetMs: number;
}

export class ClockSynchronizer {
  private offsetMs = 0;
  private rttMs = 0;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private socket: Socket) {}

  /**
   * Perform a burst of NTP pings and set the clock offset from the best sample.
   * Call this immediately after joining a room.
   */
  async initialSync(sampleCount = SYNC.CLOCK_SYNC_SAMPLES): Promise<void> {
    const samples: PingSample[] = [];

    for (let i = 0; i < sampleCount; i++) {
      const sample = await this.ping();
      samples.push(sample);
      // Small delay between pings to avoid burst interference
      await delay(150);
    }

    // Pick the sample with minimum RTT (least queueing delay = most symmetric)
    samples.sort((a, b) => a.rttMs - b.rttMs);
    const best = samples[0];

    this.offsetMs = best.offsetMs;
    this.rttMs = best.rttMs;

    console.log(
      `[Clock] Synced — offset: ${this.offsetMs.toFixed(1)}ms, RTT: ${this.rttMs.toFixed(1)}ms`
    );

    this.startPeriodicSync();
  }

  /**
   * Single NTP ping-pong exchange.
   * Returns { rttMs, offsetMs }
   */
  private ping(): Promise<PingSample> {
    return new Promise((resolve) => {
      const t1 = Date.now();
      this.socket.emit(EVENTS.TIME_PING, { t1 });

      this.socket.once(
        EVENTS.TIME_PONG,
        (pong: { t1: number; t2: number; t3: number }) => {
          const t4 = Date.now();
          // RTT = total round trip minus server processing time
          const rttMs = (t4 - pong.t1) - (pong.t3 - pong.t2);
          // Clock offset: how much to add to local time to get server time
          const offsetMs = ((pong.t2 - pong.t1) + (pong.t3 - t4)) / 2;
          resolve({ rttMs, offsetMs });
        }
      );
    });
  }

  /**
   * Background re-sync every 45s using EWMA to track oscillator drift.
   */
  private startPeriodicSync() {
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);

    this.syncIntervalId = setInterval(async () => {
      try {
        const sample = await this.ping();
        // EWMA: smooth updates to avoid sudden jumps from jitter
        this.offsetMs =
          SYNC.CLOCK_EWMA_ALPHA * sample.offsetMs +
          (1 - SYNC.CLOCK_EWMA_ALPHA) * this.offsetMs;
        this.rttMs =
          SYNC.CLOCK_EWMA_ALPHA * sample.rttMs +
          (1 - SYNC.CLOCK_EWMA_ALPHA) * this.rttMs;
      } catch {
        // Socket might be disconnected — ignore, next reconnect will re-sync
      }
    }, SYNC.CLOCK_RESYNC_INTERVAL_MS);
  }

  /**
   * Estimated current server time in milliseconds.
   * Use this everywhere instead of Date.now() for sync calculations.
   */
  now(): number {
    return Date.now() + this.offsetMs;
  }

  getOffset(): number {
    return this.offsetMs;
  }

  getRTT(): number {
    return this.rttMs;
  }

  destroy() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
