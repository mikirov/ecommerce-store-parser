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
            this.fillProductDataFromMetadata(uriToParse, rootDOMObject, metadata);

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

    fillProductDataFromMetadata(uriToParse: string, rootDOMObject: HTMLElement, metadata: Metadata) {
        if (!metadata) {
            console.log("metadata not found");
            return;
        }

        const title = metadata.og.title || metadata.meta.title;
        const siteName = metadata.og.site_name || metadata.meta.site_name;

        if(!title || !siteName)
        {
            console.log("no metadata name or brand, aborting");
            return;
        }

        try {
            const priceString: string = rootDOMObject.querySelector("meta[property='og:price:amount']")?.getAttribute("content") + rootDOMObject.querySelector("meta[property='og:price:currency']")?.getAttribute("content")||
                rootDOMObject.querySelector("meta[property='product:price:amount']")?.getAttribute("content") + rootDOMObject.querySelector("meta[property='product:price:currency']")?.getAttribute("content")

            let description = metadata.og.description ||
                metadata.meta.description ||
                rootDOMObject.querySelector("meta[property='twitter:description']")?.getAttribute("content");

            description = description && description.replace(/\n/g, " ").trim();

            let product: Product = {
                brand: siteName && siteName.toLowerCase().trim() || null,
                description: description || null,
                domain: this.baseUrl.toString(),
                images: [],
                link: uriToParse,
                name: title && title.toLowerCase().trim()  || null,
                price: priceString || null
            }

            product.images = this.getImagesFromMetadata(metadata, rootDOMObject);

            if(product.images.length > 0)
            {
                this.products.add(product);
                console.log("successfully parsed product");
            }

        } catch (e) {
            console.log(e);
        }

    }

    getImagesFromMetadata(metadata: Metadata, rootDOMObject: HTMLElement)
    {
        let imageSet = new Set<string>();
        for(const image of metadata.images)
        {
            const imageSrc = (image as any).src;
            if(!this.isImageUrlAllowed(imageSrc))
            {
                continue;
            }
            try{
                const imageUrl = new URL(imageSrc); //throws on invalid url
                imageSet.add(imageSrc);
            }
            catch (e)
            {
                console.log(e)
            }
        }
        if(this.isImageUrlAllowed(metadata.og.image))
        {
            try {
                const imgSrc = metadata.og.image;
                const ogImageUrl = new URL(imgSrc);
                imageSet.add(imgSrc);

            } catch (e) {

                console.log(e)
            }
        }

        try{
            const twitterImageUrl = rootDOMObject.querySelector("meta[property='twitter:image']")?.getAttribute("content");
            if(this.isImageUrlAllowed(twitterImageUrl))
            {
                const imageUrl = new URL(twitterImageUrl); //throws on invalid url
                imageSet.add(twitterImageUrl);
            }

        }
        catch (e)
        {
            console.log(e)
        }

        return Array.from(imageSet);
    }

    isImageUrlAllowed(url: string) : boolean
    {
        return url && url.includes("product");
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
