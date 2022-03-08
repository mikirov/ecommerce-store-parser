import {IProductParser} from "./productparser";
import {ShopifyProductParser} from "./shopifyproductparser";
import {MetadataProductParser} from "./metadataproductparser";
import {Product} from "./product";

export class DomainParser
{
    productParsers: IProductParser[] = [];

    productSet: Set<Product> = new Set<Product>()

    baseUrl: URL

    constructor(baseUrl: URL, recursive: boolean) {
        this.productParsers.push(new ShopifyProductParser());
        this.productParsers.push(new MetadataProductParser(recursive));

        this.baseUrl = baseUrl
    }


    async deleteCurrentProductsForDomain(connection: any)
    {
        const productsToDeleteSnapshot = await connection.collection('products').where('domain', '==', this.baseUrl.toString()).get()
        if(productsToDeleteSnapshot.size !== 0)
        {
            const batch = connection.batch();
            productsToDeleteSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
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
            const snapshots = await connection.collection('unparsableDomains').where('domain', '==', this.baseUrl.toString()).get();
            if(!snapshots.docs || snapshots.docs.length == 0)
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

        const snapshots = await connection.collection('parsedDomains').where('domain', '==', this.baseUrl.toString()).get();
        if(!snapshots.docs || snapshots.docs.length == 0)
        {
            await connection.collection('parsedDomains').doc().set(domainData);
        }

        const brandsArray = Array.from(brandSet);
        console.log(brandsArray);
        const brandsInDatabasePromises = brandsArray.map((brand: string) => {
            return connection.collection('brands').where('brand', '==', brand).get();
        })
        const results = await Promise.all(brandsInDatabasePromises);
        console.log(results);
        //const validResults = results.filter(result => result.docs.exists);
        const brandsInDatabase: string[] = results.flatMap(result => result.docs.map((doc: any) => doc.data().brand));
        console.log(brandsInDatabase);
        const uniqueBrandsNotInDatabase: string[] = brandsArray.filter(brand => !brandsInDatabase.includes(brand))
        console.log(uniqueBrandsNotInDatabase);
        const brandPromises = uniqueBrandsNotInDatabase.map(brandToSet => connection.collection('brands').doc().set({ brand: brandToSet, domain: this.baseUrl.toString() }, { merge: true }));
        await Promise.all(brandPromises);
    }
}
