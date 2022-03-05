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


    async deleteCurrentProductsForDomain(connection: any)
    {
        const productsToDeleteSnapshot = await connection.collection('products').where('domain', '==', this.baseUrl).get()
        if(productsToDeleteSnapshot.size !== 0)
        {
            const batch = connection.batch();
            productsToDeleteSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            await this.deleteCurrentProductsForDomain(connection);
        }
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
            const snapshots = connection.collection('unparsableDomains').where('domain', '==', this.baseUrl.toString()).get();
            if(snapshots.length == 0 || !snapshots.exists)
            {
                await connection.collection('unparsableDomains').doc().set(domainData);
            }
            throw new Error("400");
        }

        // Array.from(productSet).forEach(p => console.log(p));
        // console.log(productSet.size)

        await this.deleteCurrentProductsForDomain(connection)

        const brandSet: Set<string> = new Set<string>();

        const promises = Array.from(this.productSet).map((product: Product) => {
            brandSet.add(product.brand)
            const docRef = connection.collection('products').doc();
            return docRef.set(product)
        })
        await Promise.all(promises);

        const snapshots = connection.collection('parsedDomains').where('domain', '==', this.baseUrl.toString()).get();
        if(snapshots.length == 0 || !snapshots.exists)
        {
            await connection.collection('parsedDomains').doc().set(domainData);
        }

        const brandDocs = await connection.collection('brands').where('brand', 'in', Array.from(brandSet)).get();
        brandDocs.forEach((brandDoc: FirebaseFirestore.QueryDocumentSnapshot) => {
            const databaseBrandEntry = brandDoc.data().brand;
            //filter out only brands not added to database yet.
            if(brandSet.has(databaseBrandEntry))
            {
                brandSet.delete(databaseBrandEntry)
            }
        })

        const brandPromises = Array.from(brandSet).map(brandToSet => connection.collection('brands').doc().set({brand: brandToSet, domain: this.baseUrl.toString()}, {merge: true}));
        await Promise.all(brandPromises);
    }
}
