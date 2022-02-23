import * as functions from "firebase-functions";
import Express from 'express';
import fetch from 'node-fetch';
import * as url from "url";
import { parse } from 'node-html-parser';
import {Product} from "./product";
import admin from 'firebase-admin';
import cors from 'cors';
import { ShopifyProductData , ShopifyProductImage} from './shopifyproductdata';

admin.initializeApp();

const fillProductData = (unparsedProductList: ShopifyProductData[], outProducts: Product[], uri: string) => {
    unparsedProductList.forEach((productData: ShopifyProductData) => {
        const product: Product = {
            name: parse(productData.title).text.replace(/\n/g, " ") || "unknown",
            price: productData.variants
                && productData.variants.length > 0
                && productData.variants[0].price
                && parseFloat(productData.variants[0].price) || 0,
            link: productData.handle && uri + "/products/" + productData.handle || "unknown",
            brand: productData.vendor || "unknown",
            description: productData.body_html && parse(productData.body_html).text.replace(/\n/g, " ") || "unknown",
            domain: uri,
            images: productData.images
                && productData.images.length > 0
                && productData.images.map((img: ShopifyProductImage) => img && img.src) || []
        }

        outProducts.push(product);
    })
}

let app: Express.Application = Express();
app.use(Express.urlencoded({ extended: false }));
//TODO: set up cors options
const options: cors.CorsOptions = {
    origin: "*",
};
app.use(cors(options));
app.put("/domain", async (req: Express.Request, res: Express.Response) => {
    if(!req.body || !req.body.domainUri)
    {
        //TODO: set proper response statuses
        res.status(400).send("Please specify domain to be added to the scraper list");
        return;
    }

    let uri = req.body.domainUri.trim().toLowerCase();
    if(!uri || uri === "")
    {
        res.status(400).send("Invalid domain uri.");
        return;
    }

    //TODO: abstract for different store types
    //TODO: get store type from uri
    //TODO: check valid url
    try{
        const uriObject = new URL(uri);
        const initialUri = uriObject.protocol + "//" + uriObject.host + "/products.json";
        console.log(initialUri);
        const finalDomain = await fetch(initialUri, {method: 'GET'});
        console.log(finalDomain);
        if(!finalDomain)
        {
            res.status(400).send("Invalid domain uri. Please send full URI to fetch");
        }
        const response = await fetch(finalDomain.url, {method: 'GET'});
        if(!response)
        {
            res.status(500).send("Could not find information for given domain");
            return;
        }

        const data = await response.json();
        //console.log(data);
        if(!data)
        {
            res.status(500).send("Could not find any products for given domain")
            return;
        }
        let products: Product[] = [];
        if(data.products)
        {
            fillProductData(data.products, products, uri);
        }
        else if(data.length > 0)
        {
            fillProductData(data, products, uri);
        }
        else
        {
            res.status(500).send("Could not parse product data")
            return;
        }

        const hostName = url.parse(uri).hostname;
        if(!hostName)
        {
            res.status(400).send("Couldn't parse domain uri.");
            return;
        }

        const docRef =  admin.firestore().collection('products').doc(hostName);
        await docRef.set(Object.assign({}, products), {merge: true})

        res.status(200).send("OK");

    } catch (e)
    {
        console.log(e);
        res.status(500).send("Could not fetch info for domain");
        return;
    }
})

exports.app = functions.https.onRequest(app)
