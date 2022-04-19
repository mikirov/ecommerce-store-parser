import Express from 'express';
import cors from 'cors';
import * as functions from "firebase-functions";
import admin, {firestore} from 'firebase-admin';
import {DomainParser} from "./domainparser";
import util from 'util';
admin.initializeApp();

const  db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

export {addAllProductsToAlgolia, indexProduct, unindexProduct, updateProduct,
    indexBrand, updateBrand, unindexBrand, addAllBrandsToAlgolia} from './algolia';

export {onItemFavorited, onItemUnfavorited, onItemSaved, onItemUnsaved,
    onPostLiked, onPostUnliked, onPostCreate, onPostDelete,
    onFollow, onUnfollow,
    onProductUpdate, onUserUpdate, onPostUpdate,
    onRecommendationUpdate, onRecommendationCreate, onRecommendationDelete, onRecommendationLiked, onRecommendationUnliked,
    onActivityCreated, onActivityDelete, } from './trigger';

import passport from 'passport';
import {BasicStrategy} from "passport-http";
import {getPostInfo, getProductInfo, getRecommendationInfo, getUserData } from './helper';
import express from 'express';
passport.use(new BasicStrategy(
    async function(userid: string, password: string, done: any) {
        const adminUserSnapshot = await db.collection('admin').doc(userid).get();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    const snapshot = await db.collection('parsedDomains').get();
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
    const snapshot = await db.collection('unparsableDomains').get();
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


const updateFollowCounts = async (req: Express.Request, res: Express.Response) => {
    try {
        const followingSnapshot = await db.collection('following').get();
        if(!followingSnapshot || !followingSnapshot.docs)
        {
            res.status(500).send("Couldn't get following colelction")
            return;
        }
        const followingDocs = followingSnapshot.docs.map(doc => doc.data());
        const userFollowers = [];
        const userFollowing = [];

        //recalculate followers
        followingDocs.forEach(data => {
            userFollowing[data.fromUserId] = userFollowing[data.fromUserId] + 1 || 1;
            userFollowers[data.toUserId] = userFollowers[data.toUserId] + 1 || 1;
        });

        const snapshot = await db.collection('users').get();
        if(!snapshot || !snapshot.docs)
        {
            res.status(500).send("Couldn't get following colelction")
            return;
        }

        //TODO: iterate over users instead?
        for(const key in userFollowing)
        {
            let [user, userRef] = await getUserData(key);
            user.followingCount = userFollowing[key];
            functions.logger.info(util.inspect(user, {showHidden: false, depth: null}));

            await userRef.set(user, {merge: true, ignoreUndefinedProperties: true});

            functions.logger.info(`user ${key} has following count ${userFollowing[key]}`)
        }

        for(const key in userFollowers)
        {
            let [user, userRef] = await getUserData(key);
            user.followerCount = userFollowers[key];
            functions.logger.info(util.inspect(user, {showHidden: false, depth: null}));

            await userRef.set(user, {merge: true, ignoreUndefinedProperties: true});

            functions.logger.info(`user ${key} has follower count ${userFollowers[key]}`)
        }
    }catch (e) {
        functions.logger.error(e.message)
    }

}


const updateProductCounts = async (req: Express.Request, res: Express.Response) => {
    try{
        const savedSnapshot = await db.collection('savedItems').get();
        const savedDatas = savedSnapshot.docs.filter(doc => doc.exists).map(doc => doc.data());
        const productSaveCount = []
        savedDatas.forEach(s => {
            productSaveCount[s.externalProductId] = productSaveCount[s.externalProductId] + 1 || 1

            functions.logger.info(util.inspect(s, {showHidden: false, depth: null}));
        });

        const favoriteSnapshot = await db.collection('favoriteItems').get();
        const favoriteDatas = savedSnapshot.docs.filter(doc => doc.exists).map(doc => doc.data());
        const productFavoriteCount = []
        favoriteDatas.forEach(s => {
            productFavoriteCount[s.externalProductId] = productFavoriteCount[s.externalProductId] + 1 || 1

            functions.logger.info(util.inspect(s, {showHidden: false, depth: null}));
        });


        for(const key in productSaveCount)
        {
            let [product, productRef] = await getProductInfo(key);
            product.saveCount = productSaveCount[key];

            functions.logger.info(util.inspect(product, {showHidden: false, depth: null}));
            // @ts-ignore
            await productRef.set(product, {merge: true, ignoreUndefinedProperties: true});
            functions.logger.info(`product ${key} has save count ${productSaveCount[key]}`);
        }

        for(const key in productFavoriteCount)
        {
            let [product, productRef] = await getProductInfo(key);
            product.favoriteCount = productFavoriteCount[key];

            functions.logger.info(util.inspect(product, {showHidden: false, depth: null}));
            // @ts-ignore
            await productRef.set(product, {merge:true, ignoreUndefinedProperties: true});
            functions.logger.info(`product ${key} has favorite count ${productFavoriteCount[key]}`);
        }
    }
    catch (e) {
        functions.logger.error(e.message);
    }

}

const updatePostCounts = async (req: Express.Request, res: Express.Response) => {
    try {
        const postSnapshot = await db.collection('postedItemLikes').get();
        const postDatas = postSnapshot.docs.map(doc => doc.data());
        const postRate = []
        postDatas.forEach(pl => postRate[pl.postId] = postRate[pl.postId] + 1 || 1);

        for(const key in postRate)
        {
            let [post, postRef] = await getPostInfo(key);
            post.rate = postRate[key];
            functions.logger.info(util.inspect(post, {showHidden: false, depth: null}));

            // @ts-ignore
            await postRef.set(post, {merge: true, ignoreUndefinedProperties: true});

            functions.logger.info(`product ${key} has favorite count ${postRate[key]}`);
        }
    }
    catch (e) {
        functions.logger.error(e.message);
    }

}

const updateRecommendationCounts = async (req: Express.Request, res: Express.Response) => {
    try {
        const recommendationSnapshot = await db.collection('recommendedItemLikes').get();
        const recDatas = recommendationSnapshot.docs.map(doc => doc.data());
        const recRate = []
        recDatas.forEach(pl => recRate[pl.recommendationId] = recRate[pl.recommendationId] + 1 || 1);

        for(const key in recRate)
        {
            let [recommendation, recommendationRef] = await getRecommendationInfo(key);
            recommendation.rate = recRate[key];
            functions.logger.info(util.inspect(recommendation, {showHidden: false, depth: null}));

            // @ts-ignore
            await recommendationRef.set(recommendation, {merge: true, ignoreUndefinedProperties: true});

            functions.logger.info(`product ${key} has favorite count ${recRate[key]}`);
        }
    }
    catch (e) {
        functions.logger.error(e.message);
    }

}

//TODO: call functions as middleware
app.post("/recalculate", async (req: Express.Request, res: Express.Response) => {
    try
    {
        //TODO: update product counts
        await updateFollowCounts(req, res);
        await updateProductCounts(req, res);
        await updatePostCounts(req, res);
        await updateRecommendationCounts(req, res);
        res.status(200).send("OK");

    } catch (e) {
        functions.logger.error(e.message);
        res.status(500).send(e.message);
    }

})

app.post("/recalculateUser", async (req: Express.Request, res: Express.Response) => {
    try
    {
        let [user, userRef] = await getUserData(req.body.userId);
        user = {
            ...user,
        }
        const followingSnapshot = await db.collection('following').where('fromUserId', '==', req.body.userId).get();
        const followingCount = followingSnapshot.docs.filter(doc => doc.exists).length;

        const followersSnapshot = await db.collection('following').where('toUserId', '==', req.body.userId).get();
        const followerCount = followersSnapshot.docs.filter(doc => doc.exists).length;

        user =
            {
                followerCount,
                followingCount,
                dateUpdated: Date.now()
            }
        //this will trigger user update which will propagate changes to all other collections
        await userRef.set(user, {merge: true});
        res.status(200).send("OK");

    } catch (e) {
        functions.logger.error(e.message);
        res.status(500).send(e.message);
    }
})

app.post("/recalculateProduct", async (req: Express.Request, res: Express.Response) => {
    try
    {
        let [product, productRef] = await getProductInfo(req.body.externalId);

        const savedSnapshot = await db.collection('savedItems').where('externalProductId', '==', product.externalId).get();
        const saveCount = savedSnapshot.docs.filter(doc => doc.exists).length;

        const favoriteSnapshot = await db.collection('favoriteItems').where('externalProductId', '==', product.externalId).get();
        const favoriteCount = favoriteSnapshot.docs.filter(doc => doc.exists).length;

        product = {
            ...product,
            saveCount,
            favoriteCount,
            dateUpdated: Date.now()
        }

        await productRef.set(product, {merge: true});
        res.status(200).send("OK");

    } catch (e) {
        functions.logger.error(e.message);
        res.status(500).send(e.message);
    }
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

    res.status(200).send(Array.from(new Set(brands)));

})

exports.appv2 = functions
    .runWith({
        memory: '8GB',
        timeoutSeconds: 540
    }).https.onRequest(app);
