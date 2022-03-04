import Express from 'express';
import {Product} from "./product";
import cors from 'cors';
import {IProductParser} from "./productparser";
import {ShopifyProductParser} from "./shopifyproductparser";
import {MetadataProductParser} from "./metadataproductparser";

import * as functions from "firebase-functions";
import admin from 'firebase-admin';
import {DomainParser} from "../../src/domainparser";

admin.initializeApp();


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

        const domainParser: DomainParser = new DomainParser(parsedUrl);
        await domainParser.parse();
        await domainParser.store(admin.firestore());

        res.status(200).send("OK");

    } catch (e)
    {
        console.log(e);
        res.status(400).send("Could not fetch info for domain");
        return;
    }
})


app.get("/parsedDomains", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await admin.firestore().collection('parsedDomains').get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(500).send("There aren't any parsed domains or collection hasn't been created yet.")
        return;
    }
    const domains = snapshot.docs.map(doc => doc.data().domain);

    if(!domains || domains.length === 0)
    {
        res.status(404).send("Could not find any parsed domains");
        return;
    }

    res.status(200).send(domains);
});

app.get("/unparsableDomains", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await admin.firestore().collection('unparsableDomains').get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(500).send("There aren't any unparsable domains or collection hasn't been created yet.")
        return;
    }
    const domains = snapshot.docs.map(doc => doc.data().domain);

    if(!domains)
    {
        res.status(404).send("Could not find any unparsable domains");
        return;
    }

    if(domains.length === 0)
    {
        res.status(404).send("Domains length is zero");
        return;
    }

    res.status(200).send(domains);
})


// app.listen(4000, () => {
//     console.log("app running")
// });
exports.appv2 = functions
    .runWith({
        memory: '8GB',
        timeoutSeconds: 540
    }).https.onRequest(app);
