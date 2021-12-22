import fetch from "node-fetch";
import fs from "fs";
import path from "path";

export default class AssetsDownloader {
    private assets: Map<string, Assets> = new Map();
    private extHandler: Map<string, (src: string, source: Buffer) => string[]> =
        new Map();
    public getAsset(src: string): Assets | null {
        return this.assets.get(src) || null;
    }
    public downloadAsset(src: string): Promise<void> {
        if (this.getAsset(src)) {
            return Promise.resolve();
        }
        const asset = new Assets(src);
        this.assets.set(src, asset);
        return asset.download().then(async (buf) => {
            const urlObj = new URL(src);
            const filename = path.resolve(
                __dirname,
                "../website",
                urlObj.pathname.endsWith("/")
                    ? `${urlObj.pathname.slice(1)}index.html`
                    : urlObj.pathname.slice(1)
            );
            const dirname = path.dirname(filename);
            await Promise.all([
                (async () => {
                    try {
                        await ensureDirExist(dirname);
                    } catch (err) { }
                    await writeFile(filename, buf);
                })(),
                (async () => {
                    const extName = path.extname(urlObj.pathname);
                    const extHandler = this.extHandler.get(
                        extName === "" && urlObj.pathname.endsWith("/") ? ".html" : extName
                    );
                    if (extHandler) {
                        const nextAssets = extHandler(src, buf);
                        await Promise.all(nextAssets.map((src) => this.downloadAsset(src)));
                    }
                })(),
            ]);
        });
    }
    public extHandle(ext: string, fn: (src: string, source: Buffer) => string[]) {
        if (this.extHandler.has(ext)) {
            throw new Error("repeat handler.");
        }
        this.extHandler.set(ext, fn);
    }
}

function timeout(t: number) {
    return new Promise((_, r) => {
        setTimeout(() => {
            r(new Error("timeout"));
        }, t);
    });
}

enum DownloadState {
    Creat,
    Downloading,
    Downloaded,
    Error,
}

class Assets {
    public state: DownloadState = DownloadState.Creat;
    private downloadPromise?: Promise<Buffer>;
    constructor(public readonly src: string) { }
    download(): Promise<Buffer> {
        if (this.downloadPromise) {
            return this.downloadPromise;
        }
        this.state = DownloadState.Downloading;
        this.downloadPromise = Promise.race([
            fetch(this.src, {})
                .then((res) => res.arrayBuffer())
                .then((buf) => Buffer.from(buf)),
            timeout(6000),
        ]) as Promise<Buffer>;
        this.downloadPromise.then(
            () => {
                this.state = DownloadState.Downloaded;
            },
            () => {
                this.state = DownloadState.Error;
            }
        );
        return this.downloadPromise;
    }
    clearState() {
        this.state = DownloadState.Creat;
        this.downloadPromise = undefined;
    }
}

function ensureDirExist(dirname: string): Promise<void> {
    return new Promise((f, r) => {
        fs.exists(dirname, (exists) => {
            if (exists) {
                f();
                return;
            }
            ensureDirExist(path.dirname(dirname))
                .then(() => {
                    fs.mkdir(dirname, (err) => {
                        if (err) {
                            r(err);
                            return;
                        }
                        f();
                    });
                })
                .catch(r);
        });
    });
}

function writeFile(fname: string, buf: string | Buffer): Promise<void> {
    return new Promise((f, r) => {
        fs.writeFile(fname, buf, (err) => {
            if (err) {
                r(err);
                return;
            }
            f();
        });
    });
}
