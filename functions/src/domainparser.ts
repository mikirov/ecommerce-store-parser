import {IProductParser} from "./productparser";
import {ShopifyProductParser} from "./shopifyproductparser";
import {MetadataProductParser} from "./metadataproductparser";
import {Product} from "./product";

export class DomainParser
{
    productParsers: IProductParser[] = [];

    productSet: Set<Product> = new Set<Product>()

    baseUrl: URL

    constructor(baseUrl: URL) {
        this.productParsers.push(new ShopifyProductParser());
        this.productParsers.push(new MetadataProductParser());
        this.baseUrl = baseUrl
    }

    async parse()
    {

        for(const productParser of this.productParsers)
        {
            try{
                this.productSet = await productParser.parse(this.baseUrl);
                console.log(this.productSet);
                if(this.productSet.size !== 0) break;
            }
            catch (e){
                console.log(e);
            }
        }
    }

    async store(connection: any)
    {
        const domainData = {domain: this.baseUrl.toString()}
        if(this.productSet.size === 0)
        {
            await connection.collection('unparsableDomains').doc().set(domainData);
            throw new Error("400");
        }

        // Array.from(productSet).forEach(p => console.log(p));
        // console.log(productSet.size)

        const brandSet: Set<string> = new Set<string>();

        const promises = Array.from(this.productSet).map((product: Product) => {
            brandSet.add(product.brand)
            const docRef = connection.collection('products').doc();
            return docRef.set(product)
        })
        await Promise.all(promises);

        await connection.collection('parsedDomains').doc().set(domainData);

        const brandPromises = Array.from(brandSet).map(brandToSet => connection.collection('brands').doc().set({brand: brandToSet}, {merge: true}));
        await Promise.all(brandPromises);
    }
}
