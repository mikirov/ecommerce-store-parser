import fetch from "node-fetch";
import parser, {Metadata} from "html-metadata-parser";
import {parse, HTMLElement} from "node-html-parser";
import {Product} from "./product";
import {IProductParser} from "./productparser";
export class MetadataProductParser implements IProductParser {

    parsedUrls: Set<string> = new Set<string>();

    baseUrl: URL;

    hostName: string;

    products: Set<Product> = new Set<Product>();

    productImageSet: Set<string> = new Set<string>();

    //because we can't do equals comparison with object types since they check by reference instead of by value
    productTrackerSet: Set<string> = new Set<string>();

    MAX_DEPTH = 4;

    MAX_TIME = 5 * 60 * 1000;

    isRecursive: boolean = false;

    constructor(recursive = false) {
        this.isRecursive = recursive;
    }

    async parse(baseUrl: URL): Promise<Set<Product>> {
        this.baseUrl = baseUrl;
        this.hostName = baseUrl.host.split("/")[0];
        try {
            await this.findProducts(baseUrl.toString(), 0, Date.now())
        }
        catch (e) {
            console.log(e);
        }
        console.log("FINISHED")
        return this.products;
    }

    async findProducts(uriToParse: string, depth: number, startTimeMillis: number): Promise<void> {
        try {
            if(depth > this.MAX_DEPTH)
            {
                //console.log("tried to parse past max depth, returning");
                return new Promise(((resolve, reject) => resolve()));
            }

            if(Date.now() > startTimeMillis + this.MAX_TIME)
            {
                console.log("stopping algorithm after time limit");
                return new Promise(((resolve, reject) => reject("time limit")))
            }

            if (this.parsedUrls.has(uriToParse)) {
                return new Promise(((resolve, reject) => resolve()));
            }
            console.log("trying to parse url: " + uriToParse);

            this.parsedUrls.add(uriToParse);

            const unparsedRootDomainData = await fetch(uriToParse);
            const unparsedRootHtml = await unparsedRootDomainData.text();
            const rootDOMObject = parse(unparsedRootHtml);
            const metadata: Metadata = await parser(uriToParse);
            this.fillProductDataFromMetadata(rootDOMObject, metadata);

            const allUrls: string[] = this.getUrls(this.baseUrl, rootDOMObject);
            if(this.isRecursive)
            {
                const promises: Promise<void>[] = Array.from(new Set(allUrls)).map(url => this.findProducts(url, depth + 1, startTimeMillis));
                await Promise.allSettled(promises);
            }
            else
            {
                const urls = Array.from(new Set(allUrls));
                for(const url of urls)
                {
                    await this.findProducts(url, depth + 1, startTimeMillis)
                }
            }


            return new Promise((resolve, reject) => resolve());
        }
        catch (e) {
            console.log(e)
            if(e.reason === "time limit")
            {
                return new Promise(((resolve, reject) => reject("time limit")))
            }
        }


    }

    fillProductDataFromMetadata(rootDOMObject: HTMLElement, metadata: Metadata) {
        if (!metadata || !metadata.og || !metadata.og.type || metadata.og.type !== "product" || !metadata.og.url) {
            return;
        }

        try {
            const priceString: string = rootDOMObject.querySelector("meta[property='og:price:amount']")?.getAttribute("content") + rootDOMObject.querySelector("meta[property='og:price:currency']")?.getAttribute("content")||
                rootDOMObject.querySelector("meta[property='product:price:amount']")?.getAttribute("content") + rootDOMObject.querySelector("meta[property='product:price:currency']")?.getAttribute("content")

            let description = metadata.og.description ||
                metadata.meta.description ||
                rootDOMObject.querySelector("meta[property='twitter:description']")?.getAttribute("content");
            description = description.replace(/\n/g, " ").trim();
            const product: Product = {
                brand: metadata.og.site_name || "unknown",
                description: description ||"unknown",
                domain: this.baseUrl.toString(),
                images: [],
                link: metadata.og.url,
                name: metadata.og.title || "unknown",
                price: priceString || "unknown"
            }

            this.productImageSet.clear();

            for(const image of metadata.images)
            {
                const imageSrc = (image as any).src;
                if(!imageSrc || !imageSrc.includes("products"))
                {
                    continue;
                }
                try{
                    const imageUrl = new URL(imageSrc); //throws on invalid url
                    if(!this.productImageSet.has(imageSrc))
                    {
                        this.productImageSet.add(imageSrc);
                        product.images.push(imageSrc);
                    }
                }
                catch (e)
                {
                    console.log("found non url image in metadata")
                }
            }
            if(product.images.length == 0 && metadata.og.image)
            {
                try {
                    const imgSrc = metadata.og.image;
                    const ogImageUrl = new URL(imgSrc);
                    if(!this.productImageSet.has(imgSrc))
                    {
                        this.productImageSet.add(imgSrc);
                        product.images.push(imgSrc);
                    }

                } catch (e) {

                    console.log("found non url image in metadata")
                }
            }

            //product.images = product.images.slice(0, product.images.length/2); // remove duplicates, seems like the second half of fetched images are the same with different size

            if (!this.productTrackerSet.has(JSON.stringify(product))) {
                this.productTrackerSet.add(JSON.stringify(product));
                this.products.add(product);
                console.log("successfully parsed product");
            }
        } catch (e) {
            console.log(e);
        }

    }

    getUrls(baseUrl: URL, rootDOMObject: HTMLElement): string[] {
        return rootDOMObject.querySelectorAll("a").map((a: HTMLElement): string => {
            const href = a.getAttribute("href");
            try {
                const uriObject = new URL(href); //throws on malformed url
                if (uriObject.host === baseUrl.host) {
                    return (uriObject.protocol + "//" + uriObject.host + uriObject.pathname).split(/[?#]/)[0];
                }
            } catch (e) { //relative href
                return (baseUrl.protocol + "//" + baseUrl.host + href).split(/[?#]/)[0];
            }
        })
    }
}
