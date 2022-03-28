import Express from 'express';
import cors from 'cors';
import * as functions from "firebase-functions";
import admin, {firestore} from 'firebase-admin';
import {DomainParser} from "./domainparser";

admin.initializeApp();

export {addAllProductsToAlgolia, indexProduct, unindexProduct, updateProduct,
    indexBrand, updateBrand, unindexBrand, addAllBrandsToAlgolia} from './algolia';

export {onItemFavorited, onItemUnfavorited, onItemSaved, onItemUnsaved,
    onRecommendationLiked, onRecommendationUnliked, onPostLiked, onPostUnliked} from './trigger';

import passport from 'passport';
import {BasicStrategy} from "passport-http";
passport.use(new BasicStrategy(
    async function(userid: string, password: string, done: any) {
        const adminUserSnapshot = await admin.firestore().collection('users').doc(userid).get();

        if(!adminUserSnapshot.exists)
        {
            return done(null, false);
        }
        const adminUserData = adminUserSnapshot.data();

        if (!adminUserData || adminUserData.password !== password)
        {
            return done(null, false);
        }
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
        await domainParser.store(admin.firestore());

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
    const snapshot = await admin.firestore().collection('products').where('domain', '==', domain).get();
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

    res.status(200).send(Array.from(new Set(domains)));
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

    res.status(200).send(Array.from(new Set(domains)));
})

app.get("/brands", async (req: Express.Request, res: Express.Response) => {
    const snapshot = await admin.firestore().collection('brands').get();
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

    res.status(200).send(Array.from(new Set(brands)));

})

exports.appv2 = functions
    .runWith({
        memory: '8GB',
        timeoutSeconds: 540
    }).https.onRequest(app);
