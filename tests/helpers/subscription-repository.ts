import type { SubscriptionRepository, LeaseKind } from "@/lib/subscription-chat/repository";

export class MemorySubscriptionRepository implements SubscriptionRepository {
  rows = new Map<string, string>();
  leases = new Map<string, { token: string; expires: number }>();
  now = 0;
  async read(owner: string) {
    return this.rows.get(owner) ?? null;
  }
  async acquire(owner: string, kind: LeaseKind, token: string) {
    const key = owner + ":" + kind;
    const old = this.leases.get(key);
    if (old && old.expires >= this.now) return false;
    this.leases.set(key, { token, expires: this.now + 180_000 });
    return true;
  }
  async write(owner: string, token: string, ciphertext: string) {
    const lease = this.leases.get(owner + ":connection");
    if (!lease || lease.token !== token || lease.expires <= this.now)
      throw new Error("Expired lease");
    this.rows.set(owner, ciphertext);
  }
  async release(owner: string, kind: LeaseKind, token: string) {
    const key = owner + ":" + kind;
    if (this.leases.get(key)?.token === token) this.leases.delete(key);
  }
}
