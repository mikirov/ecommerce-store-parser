import { Product } from "./product";
import {IProductParser} from "./productparser";
import Sitemapper from 'sitemapper';

import fetch from "node-fetch";
import parser, {Metadata} from "html-metadata-parser";
import {parse, HTMLElement} from "node-html-parser";

export class SitemapParser implements IProductParser {

    products: Set<Product> = new Set<Product>();

    baseUrl: URL;

    async parse(baseUrl: URL): Promise<Set<Product>> {

        try
        {

            this.baseUrl = baseUrl;
            const sitemapper = new Sitemapper({url: baseUrl.toString() + "sitemap.xml", timeout: 15000});
            const data = await sitemapper.fetch();
            const productUrls = data.sites.filter(siteUrl => siteUrl.includes("products/"));
            for(const productUrl of productUrls)
            {
               await this.parseProductUrl(productUrl)
            }
            //await Promise.all(productUrls.map(url => this.parseProductUrl(url)));

            //console.log(productUrls);
            if(productUrls.length === Array.from(this.products).length)
            {
                console.log("got all product info");
                //return all products or nothing
                return this.products;
            }
        } catch (e) {
            console.log(e)
        }

        console.log("couldn't get all product info");
        return new Set<Product>();
    }

    async parseProductUrl(uriToParse: string)
    {
        const unparsedRootDomainData = await fetch(uriToParse);
        const unparsedRootHtml = await unparsedRootDomainData.text();
        const rootDOMObject = parse(unparsedRootHtml);
        const metadata: Metadata = await parser(uriToParse);
        this.fillProductDataFromMetadata(uriToParse, rootDOMObject, metadata);
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

}
