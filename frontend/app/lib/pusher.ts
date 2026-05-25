import Pusher from "pusher-js";

let pusherInstance: Pusher | null = null;

export function getPusherClient(): Pusher | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!pusherInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || "a8181d4fa5ffcb6797f0";
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap1";

    console.log(`Initializing Pusher Client with key: ${key}, cluster: ${cluster}`);
    pusherInstance = new Pusher(key, {
      cluster,
      forceTLS: true,
    });
  }

  return pusherInstance;
}
