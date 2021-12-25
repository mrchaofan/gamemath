import Asset from "./Asset";
import { Parser } from "htmlparser2";
import fs from "fs";
import path from "path";
import rimraf from 'rimraf';
import url from "url";

const assetSet = new Set<string>();

Asset.onError = (asset, err) => {
    console.error(`FAIL: ${asset.src}`, err);
    asset.download(true).catch(() => {});
};

Asset.onAsset = retryWrap(async (asset, buf) => {
    const { src } = asset;
    if (assetSet.has(src)) {
        return;
    }
    assetSet.add(src);
    const urlObj = new URL(src);
    const filename = path.resolve(
        __dirname,
        "../website",
        urlObj.pathname.endsWith("/") ? `${urlObj.pathname.slice(1)}index.html` : urlObj.pathname.slice(1)
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
            const extName =
                path.extname(urlObj.pathname) === "" && urlObj.pathname.endsWith("/") ? ".html" : path.extname(urlObj.pathname);
            if (extName !== ".html") {
                return;
            }
            const html = buf.toString();
            const arr: string[] = [];
            const parser = new Parser({
                onopentag(name, attrs) {
                    switch (name) {
                        case "script":
                        case "img":
                            {
                                if (!attrs.src) {
                                    return;
                                }
                                const resolved = url.resolve(src, attrs.src);
                                if (/gamemath\.com/.test(resolved)) {
                                    arr.push(resolved);
                                }
                            }
                            break;
                        case "link":
                        case "a":
                            {
                                if (
                                    !attrs.href
                                ) {
                                    return;
                                }

                                const resolved = url.resolve(src, attrs.href);

                                if (/gamemath\.com/.test(resolved) && !resolved.includes('.html')) {
                                    arr.push(resolved);
                                }
                            }
                            break;
                    }
                },
            });
            parser.write(html);
            arr.forEach(src => {
                Asset.create(src);
            });
        })(),
    ]);
    console.info(`SUCCESS: ${src}`)
});

rimraf.sync(path.join(__dirname, "../website"));

const pages = removeDuplicatePage(
    fs.readFileSync(path.resolve(__dirname, "../PAGES")).toString().split("\n").filter(Boolean)
);

function removeDuplicatePage(pages: string[]) {
    const set = new Set<string>();
    pages.forEach(page => {
        if (page.indexOf("#") !== -1) {
            set.add(page.slice(0, page.indexOf("#")));
        } else {
            set.add(page);
        }
    });
    return Array.from(set.values());
}

pages.forEach(src => {
    Asset.create(src);
});

function ensureDirExist(dirname: string): Promise<void> {
    return new Promise((f, r) => {
        fs.exists(dirname, exists => {
            if (exists) {
                f();
                return;
            }
            ensureDirExist(path.dirname(dirname))
                .then(() => {
                    fs.mkdir(dirname, err => {
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
        fs.writeFile(fname, buf, err => {
            if (err) {
                r(err);
                return;
            }
            f();
        });
    });
}

function retryWrap(fn: (...args: any) => any) {
    return async (...args: any[]) => {
        async function doOnce() {
            try {
                await fn(...args);
            } catch (err) {
                await doOnce();
            }
        }
        await doOnce();
    };
}
