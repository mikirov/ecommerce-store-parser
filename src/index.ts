import Express from 'express';
import cors from 'cors';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore} from 'firebase-admin/firestore';

import passport from "passport"
import {BasicStrategy} from "passport-http";
import * as serviceAccount from '../firebase-service-account.json';
import {DomainParser} from "./domainparser";
import {firestore} from "firebase-admin";
import DocumentSnapshot = firestore.DocumentSnapshot;
import firebase from "firebase/compat";
import DocumentData = firebase.firestore.DocumentData;
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

passport.use(new BasicStrategy(
    async function(userid: string, password: string, done: any) {
        const adminUserSnapshot = await db.collection('users').doc(userid).get();

        console.log("1");
        if(!adminUserSnapshot.exists)
        {
            return done(null, false);
        }
        const adminUserData = adminUserSnapshot.data();

        if (!adminUserData)
        {
            return done(null, false);
        }
        console.log("2")
        if (adminUserData.password !== password)
        {
            return done(null, false);
        }
        console.log("3")
        return done(null, adminUserData);
    }
));


let app: Express.Application = Express();
app.use(Express.urlencoded({ extended: false }));
//TODO: set up cors options
const options: cors.CorsOptions = {
    origin: "*",
};
app.use(cors(options));
app.use(passport.authenticate('basic', { session: false }));

const handleParsing = async (req: Express.Request, res: Express.Response, recursive: boolean) => {
    if(!req.body || !req.body.domainUri)
    {
        //TODO: set proper response statuses
        res.status(400).send("Please specify domain to be added to the scraper list");
        return;
    }

    try{
        const parsedUrl = new URL(req.body.domainUri.trim().toLowerCase());

        const domainParser: DomainParser = new DomainParser(parsedUrl, recursive);
        await domainParser.parse();
        await domainParser.store(db);

        res.status(200).send("OK");

    } catch (e)
    {
        console.log(e);
        res.status(400).send("Could not fetch info for domain");
        return;
    }
}

app.put("/domain", async (req: Express.Request, res: Express.Response) => {
    await handleParsing(req, res, false);
})

app.put("/domainRecursive", async (req: Express.Request, res: Express.Response) => {
    await handleParsing(req, res, true);
})
app.get('/products', async (req: Express.Request, res: Express.Response) => {
    if(!req.query || !req.query.url)
    {
        res.status(400).send("Please specify domain to get products for");
        return;
    }

    //console.log(req.query.url)
    const domain: string = req.query.url as string;
    console.log(domain);
    const snapshot = await db.collection('products').where('domain', '==', domain).get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(400).send("There aren't any products for domain or collection hasn't been created yet.")
        return;
    }
    const products = snapshot.docs.map(doc => doc.data());

    if(!products || products.length == 0)
    {
        res.status(404).send("Could not find any products for domain");
        return;
    }

    res.status(200).send(products);
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

    res.status(200).send(Array.from(new Set(domains)));
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

app.get("/brands", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await db.collection('brands').get();
    if(!snapshot || !snapshot.docs)
    {
        res.status(500).send("There aren't any brands or collection hasn't been created yet.")
        return;
    }
    const brands = snapshot.docs.map(doc => doc.data().brand);

    if(!brands || brands.length == 0)
    {
        res.status(404).send("Could not find any brands");
        return;
    }

    res.status(200).send(brands);

})

app.listen(4000, () => {
    console.log("app running")
});
//exports.appv2 = functions.https.onRequest(app);
