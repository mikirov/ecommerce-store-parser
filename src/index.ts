import Express from 'express';
import {Product} from "./product";
import cors from 'cors';
import {IProductParser} from "./productparser";
import {ShopifyProductParser} from "./shopifyproductparser";
import {MetadataProductParser} from "./metadataproductparser";

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore} from 'firebase-admin/firestore';

import * as serviceAccount from '../firebase-service-account.json';
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


const productParsers: IProductParser[] = [];
productParsers.push(new ShopifyProductParser());
productParsers.push(new MetadataProductParser());

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

    try{
        const parsedUrl = new URL(req.body.domainUri.trim().toLowerCase());
        const hostName = parsedUrl.host.split("/")[0];
        const baseUrl = new URL(parsedUrl.protocol + "//" + hostName);

        let productSet: Set<Product> = new Set<Product>();

        for(const productParser of productParsers)
        {
            try{
                // let _temp;
                // [productSet, _temp] = await Promise.all([productParser.parse(baseUrl), new Promise((resolve, reject) => setTimeout(reject, 10 * 60 * 1000))]); // fail after 10 mins
                productSet = await productParser.parse(baseUrl);
                console.log(productSet);
                if(productSet.size !== 0) break;

            }
            catch (e){
                console.log(e);
                continue;
            }
        }
        if(productSet.size === 0)
        {
            await db.collection('unparsableDomains').doc(hostName).set({domain: hostName});
            res.status(400).send("Could not fetch info for domain");
            return;
        }

        // Array.from(productSet).forEach(p => console.log(p));
        // console.log(productSet.size)

        await db.collection('parsedDomains').doc(hostName).set({domain: hostName});

        const promises = Array.from(productSet).map((product: Product) => {
            const docRef = db.collection('products').doc();
            return docRef.set(product)
        })
        await Promise.all(promises);

        res.status(200).send("OK");

    } catch (e)
    {
        console.log(e);
        res.status(400).send("Could not fetch info for domain");
        return;
    }
})

app.get("/parsedDomains", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await db.collection('parsedDomains').get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(500).send("There aren't any unparsable domains or collection hasn't been created yet.")
        return;
    }
    const domains = snapshot.docs.map(doc => doc.data().domain);

    if(!domains || domains.length == 0)
    {
        res.status(404).send("Could not find any unparsable domains");
        return;
    }

    res.status(200).send(domains);
});

app.get("/unparsableDomains", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await db.collection('unparsableDomains').get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(500).send("There aren't any unparsable domains or collection hasn't been created yet.")
        return;
    }
    const domains = snapshot.docs.map(doc => doc.data().domain);

    if(!domains || domains.length == 0)
    {
        res.status(404).send("Could not find any unparsable domains");
        return;
    }

    res.status(200).send(domains);
})

app.listen(4000, () => {
    console.log("app running")
});
//exports.appv2 = functions.https.onRequest(app);
