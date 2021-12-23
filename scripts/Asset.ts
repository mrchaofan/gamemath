import fetch from "node-fetch";

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
        asset.download();
    }
    private downloadPromise: Promise<Buffer> | null = null;
    private constructor(public readonly src: string) { }
    public download() {
        if (this.downloadPromise) {
            return this.downloadPromise;
        }
        this.downloadPromise = Promise.race([
            fetch(this.src, {})
                .then(res => res.arrayBuffer())
                .then(buf => Buffer.from(buf)),
            timeout(6000),
        ]) as Promise<Buffer>;
        this.downloadPromise.then(
            buf => {
                Asset.onAsset?.(this, buf);
            },
            err => {
                this.downloadPromise = null;
                Asset.onError?.(this, err);
            }
        );
        return this.downloadPromise;
    }
}

function timeout(t: number) {
    return new Promise((_, r) => {
        setTimeout(() => {
            r(new Error("timeout"));
        }, t);
    });
}
