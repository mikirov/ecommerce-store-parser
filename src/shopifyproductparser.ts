import fetch from "node-fetch";
import {ShopifyProductData, ShopifyProductImage} from "./shopifyproductdata";
import {IProductParser} from "./productparser";
import {parse} from 'node-html-parser';
import {Product} from "./product";

export class ShopifyProductParser implements IProductParser {

    includeList: string[] =
        [
            "butter",
            "oil",
            "mask",
            "face",
            "hair",
            "beauty",
            "candle",
            "serum",
            "lavender",
            "ginger",
            "aloe",
            "clarify",
            "cleanser",
            "wash",
            "bath",
            "diffuse",
            "water",
            "rose",
            "vitamin",
            "mg",
            "eye",
            "mouth",
            "lip",
            "lotion",
            "body",
            "coconut",
            "facial",
            "flower"
        ]

    excludeList: string[] = [
        "gift",
        "card",
        "custom",
        "monthly",
        "subscr",
        "reward",
        "free",
        "sample",
        "kit"
    ]

    async parse(baseUrl: URL): Promise<Set<Product>> {
        const finalDomain = await fetch(baseUrl.toString() + "/products.json", {method: 'GET'});
        const response = await fetch(finalDomain.url, {method: 'GET'});
        const data = await response.json();
        if (!data || !data.products) throw new Error("500");
        return this.getProductData(data.products ? data.products : data, baseUrl.toString());

    }

    getProductData(unparsedProductList: ShopifyProductData[], uri: string): Set<Product> {
        const products: Set<Product> = new Set<Product>();

        unparsedProductList.forEach((productData: ShopifyProductData) => {
            console.log((productData as any).variants)
            let product: Product = {
                name: parse(productData.title).text.replace(/\n/g, " ").trim().toLowerCase() || "unknown",
                price: "unknown",
                link: productData.handle && uri + "/products/" + productData.handle || "unknown",
                brand: productData.vendor || "unknown",
                description: productData.body_html && parse(productData.body_html).text.replace(/\n/g, " ") || "unknown",
                domain: uri,
                images: []
            }

            let allowed = true;

            this.excludeList.forEach(disallowedValue => {
                if(product.name.includes(disallowedValue))
                {
                    allowed = false;
                    return;
                }
            })

            if(!allowed) return;

            allowed = false;

            this.includeList.forEach(allowedValue => {
                if(product.name.includes(allowedValue))
                {
                    allowed = true;
                }
            })

            if(!allowed) return;

            if(productData.variants
                && productData.variants.length > 0
                && productData.variants[0].price)
            {
                product.price = productData.variants[0].price
            }

            const productImageSet = new Set<string>();
            for(const image of productData.images)
            {
                const imageSrc = (image as any).src;
                if(!imageSrc.includes("products"))
                {
                    continue;
                }
                try{
                    const imageUrl = new URL(imageSrc); //throws on invalid url

                    if(!productImageSet.has(imageUrl.toString()))
                    {
                        productImageSet.add(imageUrl.toString());
                    }
                }
                catch (e)
                {
                    console.log("found non url image in metadata")
                }
            }

            product.images = Array.from(productImageSet);

            products.add(product);
        });

        return products;
    }
}
