import AssetsDownloader from "./AssetsDownloader";
import { Parser } from "htmlparser2";
import fs from "fs";
import path from "path";
import url from "url";

const downloader = new AssetsDownloader();

downloader.extHandle(".html", (src, buf) => {
    const html = buf.toString();
    const arr: string[] = [];
    const parser = new Parser({
        onopentag(name, attrs) {
            switch (name) {
                case "script":
                case "img":
                    {
                        if (!attrs.src) {
                            break;
                        }
                        const resolved = url.resolve(src, attrs.src);
                        if (/gamemath\.com/.test(resolved)) {
                            arr.push(resolved);
                        }
                    }
                    break;
                case "link":
                    {
                        if (!attrs.href) {
                            break;
                        }
                        const resolved = url.resolve(src, attrs.href);
                        if (/gamemath\.com/.test(resolved)) {
                            arr.push(resolved);
                        }
                    }
                    break;
            }
        },
    });
    parser.write(html);
    return arr;
});

if (fs.existsSync(path.join(__dirname, "../website"))) {
    fs.unlinkSync(path.join(__dirname, "../website"));
}

const pages = removeDuplicatePage(
    fs
        .readFileSync(path.resolve(__dirname, "../PAGES"))
        .toString()
        .split("\n")
        .filter(Boolean)
);

let count = 0;

function removeDuplicatePage(pages: string[]) {
    const set = new Set<string>();
    pages.forEach((page) => {
        if (page.indexOf("#") !== -1) {
            set.add(page.slice(0, page.indexOf("#")));
        } else {
            set.add(page);
        }
    });
    return Array.from(set.values());
}

console.info(`total[${pages.length}]`);
const downloadAsset = (page: string) => {
    downloader
        .downloadAsset(page)
        .then(() => {
            console.info(`success[${++count}]: ${page}`);
            if (count === pages.length) {
                process.exit();
            }
        })
        .catch((err) => {
            console.error(`failed: ${page}`, err);
            downloader.getAsset(page)!.clearState();
            downloadAsset(page);
        });
};

pages.forEach(downloadAsset);
