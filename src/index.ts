import Express from 'express';
import fetch from 'node-fetch';
import * as url from "url";
import { parse } from 'node-html-parser';
import {Product} from "./product";


import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore} from 'firebase-admin/firestore';

import cors from 'cors';

import * as serviceAccount from '../firebase-service-account.json';
import { ShopifyProductData , ShopifyProductImage} from './shopifyproductdata';
const firebaseServiceAccount = {               //clone json object into new object to make typescript happy
    type: serviceAccount.type,
    projectId: serviceAccount.project_id,
    privateKeyId: serviceAccount.private_key_id,
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
    clientId: serviceAccount.client_id,
    authUri: serviceAccount.auth_uri,
    tokenUri: serviceAccount.token_uri,
    authProviderX509CertUrl: serviceAccount.auth_provider_x509_cert_url,
    clientC509CertUrl: serviceAccount.client_x509_cert_url
}

initializeApp({
    credential: cert(firebaseServiceAccount)
});

const db = getFirestore();

const PORT = 4000;

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
        res.status(400).send("Please specify domain to be added to the scraper list")
    }
    let uri: string = req.body.domainUri.trim();
    uri  = url.parse(uri,true).host || uri;
    if(!uri)
    {
        res.status(400).send("Invalid domain uri.");
    }
    //TODO: abstract for different store types
    //TODO: get store type from uri
    const response = await fetch("https://" + uri + "/products.json"); //TODO: http or https?
    if(!response)
    {
        res.status(500).send("Could not find information for given domain");
    }

    const data = await response.json();
    if(!data || !data.products || data.products.length == 0)
    {
        res.status(500).send("Could not find any products for given domain")
        return;
    }
    let products: Product[] = [];
    data.products.forEach((productData: ShopifyProductData) => {
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
        products.push(product);
    })

    const docRef =  db.collection('products').doc(uri);
    await docRef.set(Object.assign({}, products), {merge: true})

    res.status(200).send("OK");

})

app.get("/products/:domainUri", async (req, res) => {
    if(!req.params.domainUri)
    {
        res.status(400).send("please specify domain to get products for");
        return;
    }
    console.log(req.params.domainUri);
    const docRef: FirebaseFirestore.DocumentReference = db.collection('products').doc(req.params.domainUri);
    const docSnapshot: FirebaseFirestore.DocumentSnapshot = await docRef.get();
    if(!docSnapshot.exists)
    {
        res.status(404).send("Products not found for domain");
    }
    const data: FirebaseFirestore.DocumentData = docSnapshot.data();
    const products: Product[] = Object.values(data); // convert indexed object to array
    console.log(products);
    res.status(200).send(products);
});

app.listen(PORT, () => {
    console.log(`App running on port: ${PORT}`)
})
