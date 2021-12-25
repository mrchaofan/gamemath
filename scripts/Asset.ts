import Locksmith from "./Locksmith";
import fetch from "node-fetch";

const lock = new Locksmith(8);

(global as any).lock = lock;

export default class Asset {
    private static assets: Map<string, Asset> = new Map();
    public static onAsset?: (asset: Asset, buf: Buffer) => void;
    public static onError?: (asset: Asset, error: Error) => void;
    public static create(src: string) {
        let asset = this.assets.get(src);
        if (asset) {
            return;
        }
        asset = new Asset(src);
        asset.download().catch(() => {});
    }
    private downloadPromise: Promise<Buffer> | null = null;
    private constructor(public readonly src: string) { }
    public async download(force?: boolean): Promise<Buffer> {
        if (!force && this.downloadPromise) {
            return this.downloadPromise;
        }
        const l = lock.lock();
        await l;
        const controller = new AbortController();
        this.downloadPromise = fetch(this.src, {
            signal: controller.signal,
        })
            .then((res) => res.arrayBuffer())
            .then((buf) => Buffer.from(buf));
        timeout(10000).then(() => {
            controller.abort();
        })
        this.downloadPromise.then(
            buf => {
                lock.release(l);
                Asset.onAsset?.(this, buf);
            },
            err => {
                lock.release(l);
                Asset.onError?.(this, err);
            }
        );
        return this.downloadPromise;
    }
}

function timeout(t: number) {
    return new Promise<void>((f) => {
        setTimeout(() => {
            f();
        }, t);
    });
}
