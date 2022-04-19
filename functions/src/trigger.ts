import * as functions from 'firebase-functions';
import {DocumentSnapshot, QueryDocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {Change, EventContext} from "firebase-functions";

import admin from 'firebase-admin';
import {SOProduct} from "./soproduct";
import {getBrandInfo, getPostInfo, getProductInfo, getRecommendationInfo, getUserData } from './helper';
const  db = admin.firestore();
//db.settings({ ignoreUndefinedProperties: true });

const ADD_BIO_CLOUT_POINTS = 20;
const CREATE_ACCOUNT_CLOUT_POINTS = 50;
const ADD_FAVORITE_CLOUT_POINTS = 50;
const ADD_RECOMMENDATION_CLOUT_POINTS = 75;
const ADD_POST_CLOUT_POINTS = 75;
const ADD_SAVE_CLOUT_POINTS = 25;

const saveItemData = async (docData, docRef, product, userData, recommendation = null, post = null) => {

    docData = {
        ...docData,

        author: userData.name || "",
        authorImage: userData.localPath || "",
        authorRemoteImage: userData.remotePath || "",
        authorScore: userData.clout || "",

        productTitle: product.title || "",
        productBrand: product.brand || "",
        productDomain: product.domain || "",
        productFavoriteCount: product.favoriteCount || 0,
        productSaveCount: product.saveCount || 0,
        productLocalPath: product.localPath || "",
        productRemotePath: product.remotePath || ""
    }
    if(recommendation)
    {
        docData = {
            ...docData,
            recommendationTitle: recommendation.title || "",
            recommendationSubtitle: recommendation.subtitle || "",
            recommendationDetails: recommendation.details || "",
            recommendationRate: recommendation.rate || ""
        }
    }

    if(post)
    {
        docData = {
            ...docData,
            postTitle: post.title || "",
            postSubtitle: post.subtitle || "",
            postDetails: post.details || "",
            postRate: post.rate || 0
        }
    }
    functions.logger.info(docData);

    await docRef.set(docData, {merge: true});
}

export const onItemFavorited = functions.firestore
    .document('favoriteItems/{favoriteItemId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try {
            const docRef = change.ref;
            let docData = change.data();
            let [product, productRef] = await getProductInfo(docData.externalProductId);

            product =
                {...product,
                favoriteCount: product.favoriteCount + 1 || 1
                }

            const [userData, userRef] = await getUserData(docData.userId as string);
            userData.clout = userData.clout + ADD_FAVORITE_CLOUT_POINTS;
            userRef.set(userData, {merge: true});

            await saveItemData(docData, docRef, product, userData);

            await productRef.set(product, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message);
        }
    })

export const onItemUnfavorited = functions.firestore
    .document('favoriteItems/{favoriteItemId}')
    .onDelete(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try{
            let docData = change.data();
            let [product, productRef] = await getProductInfo(docData.externalProductId);

            const [userData, userRef] = await getUserData(docData.userId as string);
            userData.clout = userData.clout - ADD_FAVORITE_CLOUT_POINTS;
            userRef.set(userData, {merge: true});

            product =
                {...product,
                    favoriteCount: product.favoriteCount - 1 || 0}

            await productRef.set(product, {merge: false});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onItemSaved = functions.firestore
    .document('savedItems/{savedItemId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try {

            let docData = change.data();
            let docRef = change.ref;

            let [product, productRef] = await getProductInfo(docData.externalProductId);

            product = {
                ...product,
                saveCount: product.saveCount + 1 || 1
            }

            const [userData, userRef] = await getUserData(docData.userId as string);
            userData.clout = userData.clout + ADD_SAVE_CLOUT_POINTS;
            userRef.set(userData, {merge: true});

            await saveItemData(docData, docRef, product, userData);

            await productRef.set(product, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message);
        }

    })

export const onItemUnsaved = functions.firestore
    .document('savedItems/{savedItemId}')
    .onDelete(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try{
            let docData = change.data();

            const [userData, userRef] = await getUserData(docData.userId as string);
            userData.clout = userData.clout - ADD_SAVE_CLOUT_POINTS;
            userRef.set(userData, {merge: true});

            let [product, productRef] = await getProductInfo(docData.externalProductId);

            product = {
                ...product,
                saveCount: product.saveCount - 1 || 0
            }

            await productRef.set(product, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onPostCreate = functions.firestore
    .document('posts/{postId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try {

            const docData = change.data();
            const [userData, userRef] = await getUserData(docData.userId as string);
            userData.clout = userData.clout + ADD_POST_CLOUT_POINTS;
            userRef.set(userData, {merge: true});

        }
        catch (e) {
            functions.logger.error(e.message);
        }

    })

export const onPostDelete = functions.firestore
    .document('posts/{postId}')
    .onDelete(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            const docData = change.data();
            const [userData, userRef] = await getUserData(docData.userId as string);
            userData.clout = userData.clout + ADD_POST_CLOUT_POINTS;
            userRef.set(userData, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onPostLiked = functions.firestore
    .document('postedItemLikes/{likeId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            const docData = change.data();
            const docRef = change.ref;

            let [post, postRef] = await getPostInfo(docData.postId);

            post = {
                ...post,
                rate: post.rate + 1 || 0
            }

            const [userData, _] = await getUserData(docData.userId);

            const [product, productRef] = await getProductInfo(docData.externalProductId);

            await saveItemData(docData, docRef, product, userData, null, post);

            await postRef.set(post, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onPostUnliked = functions.firestore
    .document('postedItemLikes/{likeId}')
    .onDelete(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            const docData = change.data();

            let [post, postRef] = await getPostInfo(docData.postId);

            post = {
                ...post,
                rate: post.rate - 1 || 0
            }

            await postRef.set(post, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })


export const onRecommendationLiked = functions.firestore
    .document('recommendedItemLikes/{likeId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            const docData = change.data();
            const docRef = change.ref;

            let [recommendation, recommendationRef] = await getRecommendationInfo(docData.recommendationId);
            recommendation =
                {
                    ...recommendation,
                    rate: recommendation.rate + 1 || 0
                }

            const [userData, _] = await getUserData(docData.userId);

            const [product, productRef] = await getProductInfo(docData.externalProductId);

            await saveItemData(docData, docRef, product, userData, recommendation, null);

            await recommendationRef.set(recommendation, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationUnliked = functions.firestore
    .document('recommendedItemLikes/{likeId}')
    .onDelete(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            const docData = change.data();

            let [recommendation, recommendationRef] = await getRecommendationInfo(docData.recommendationId);

            recommendation =
                {
                    ...recommendation,
                    rate: recommendation.rate - 1 || 0
                }

            await recommendationRef.set(recommendation, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onFollow = functions.firestore
    .document('following/{followId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try {
            let docData = change.data();


            let [fromUserData, fromUserRef] = await getUserData(docData.fromUserId);
            let [toUserData, toUserRef] = await getUserData(docData.toUserId);

            if (docData.fromUserId === docData.toUserId) {
                //TEMP, REMOVE FOR PRODUCTION:

                fromUserData =
                    {
                        ...fromUserData,
                        followingCount: fromUserData.followingCount + 1 || 0,
                        followerCount: fromUserData.followerCount + 1 || 0
                    }
                // throw new Error("A uesr cannot follow themselves");
            } else
            {

                fromUserData =
                    {
                        ...fromUserData,
                        followingCount: fromUserData.followingCount + 1 || 0
                    }

                toUserData =
                    {
                        ...toUserData,
                        followerCount: toUserData.followerCount + 1 || 0
                    }
            }

            const docRef = change.ref;

            docData = {
                ...docData,
                fromAuthor: fromUserData.name || "",
                fromAuthorImage: fromUserData.localPath || "",
                fromAuthorRemoteImage: fromUserData.remotePath || "",
                fromAuthorScore: fromUserData.clout || 0,

                toAuthor: toUserData.name || "",
                toAuthorImage: toUserData.localPath || "",
                toAuthorRemoteImage: toUserData.remotePath || "",
                toAuthorScore: toUserData.clout || 0
            }

            await docRef.set(docData, {merge: true})

            await fromUserRef.set(fromUserData, {merge: true});

            if(docData.fromUserId !== docData.toUserId)
            {
                await toUserRef.set(toUserData, {merge: true});
            }
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onUnfollow = functions.firestore
    .document('following/{followId}')
    .onDelete(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try{
            let docData = change.data();

            if(docData.fromUserId === docData.toUserId)
            {
                throw new Error("A uesr cannot follow themselves");
            }

            let [fromUserData, fromUserRef] = await getUserData(docData.fromUserId);
            let [toUserData, toUserRef] = await getUserData(docData.toUserId);

            if (docData.fromUserId === docData.toUserId) {
                //TEMP, REMOVE FOR PRODUCTION:

                fromUserData =
                    {
                        ...fromUserData,
                        followingCount: fromUserData.followingCount - 1 || 0,
                        followerCount: fromUserData.followerCount - 1 || 0
                    }
                // throw new Error("A uesr cannot follow themselves");
            } else
            {

                fromUserData =
                    {
                        ...fromUserData,
                        followingCount: fromUserData.followingCount - 1 || 0
                    }

                toUserData =
                    {
                        ...toUserData,
                        followerCount: toUserData.followerCount - 1 || 0
                    }
            }

            await fromUserRef.set(fromUserData, {merge: true});

            if(docData.fromUserId !== docData.toUserId)
            {
                await toUserRef.set(toUserData, {merge: true});
            }
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    });

const updateProductFieldsInCollection = async(collectionName: string, productData) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where('externalProductId', '==', productData.externalId).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        const dataToUpdate = {
            productBrand: productData.brand,
            productDomain: productData.domain,
            productLocalPath: productData.localPath,
            productRemotePath: productData.remotePath,
            productTitle: productData.title,
            productSaveCount: productData.saveCount,
            productFavoriteCount: productData.favoriteCount}

        batchArray[batchIndex].update(documentSnapshot.ref, dataToUpdate);
        operationCounter++;

        if (operationCounter === 499) {
            batchArray.push(db.batch());
            batchIndex++;
            operationCounter = 0;
        }
    });
    await Promise.all(batchArray.map(batch => batch.commit()))
    //batchArray.forEach(async batch => await batch.commit());
}

export const onProductUpdate = functions.firestore
    .document('products/{productId}')
    .onUpdate(async (change: Change<QueryDocumentSnapshot>, context: EventContext) => {
        try{
            const current = change.after.data();
            const prev = change.before.data();
            if(JSON.stringify(prev) !== JSON.stringify(current))
            {
                await updateProductFieldsInCollection('favoriteItems', current);
                await updateProductFieldsInCollection('savedItems', current);
                await updateProductFieldsInCollection('recommendations', current);
                await updateProductFieldsInCollection('recommendedItemLikes', current);
                await updateProductFieldsInCollection('postedItemLikes', current);
            }
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

const updateUserFieldsInCollection = async(collectionName: string, idToCheck: string, userData) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where(idToCheck, '==', userData.phone).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        let dataToUpdate = null;
        switch (idToCheck) {
            case 'userId':
            {
                dataToUpdate = {
                    author: userData.name,
                    authorScore: userData.clout,
                    authorImage: userData.localPath,
                    authorRemoteImage: userData.remotePath}
            }
            break;
            case 'fromUserId':
            {
                dataToUpdate = {
                    fromAuthor: userData.name,
                    fromAuthorScore: userData.clout,
                    fromAuthorImage: userData.localPath,
                    fromAuthorRemoteImage: userData.remotePath}
            }
            break;
            case 'toUserId':
            {
                dataToUpdate = {
                    toAuthor: userData.name,
                    toAuthorScore: userData.clout,
                    toAuthorImage: userData.localPath,
                    toAuthorRemoteImage: userData.remotePath}
            }
            break;
        }


        batchArray[batchIndex].update(documentSnapshot.ref, dataToUpdate);
        operationCounter++;

        if (operationCounter === 499) {
            batchArray.push(db.batch());
            batchIndex++;
            operationCounter = 0;
        }
    });
    await Promise.all(batchArray.map(batch => batch.commit()))
    //batchArray.forEach(async batch => await batch.commit());
}

export const onUserUpdate = functions.firestore
    .document('users/{userId}')
    .onUpdate(async (change: Change<QueryDocumentSnapshot>, context: EventContext) => {
        try{
            const current = change.after.data();
            const prev = change.before.data();
            const userRef = change.after.ref;
            if(current.isBrand)
            {
                functions.logger.info("Brand info changed, we don't want to propagate to other collections");
                return;
            }
            if(JSON.stringify(prev) !== JSON.stringify(current)) //HACK: check by value instead of by reference
            {
                //clout points when bio set
                if(current.bio && !prev.bio)
                {
                    current.clout = current.clout + ADD_BIO_CLOUT_POINTS || ADD_BIO_CLOUT_POINTS;
                    userRef.set(current, {merge: true})
                }
                // remove bio points when removed
                else if(!current.bio && prev.bio)
                {
                    current.clout = current.clout - ADD_BIO_CLOUT_POINTS || 0;
                    userRef.set(current, {merge: true})
                }

                await updateUserFieldsInCollection('favoriteItems', 'userId', current);
                await updateUserFieldsInCollection('savedItems', 'userId', current);
                await updateUserFieldsInCollection('following', 'fromUserId', current);
                await updateUserFieldsInCollection('following', 'toUserId', current);
                await updateUserFieldsInCollection('recommendedItemLikes', 'userId', current);
                await updateUserFieldsInCollection('postedItemLikes', 'userId', current);
                await updateUserFieldsInCollection('posts', 'userId', current);
                await updateUserFieldsInCollection('recommendations', 'userId', current);
                await updateUserFieldsInCollection('activityItems', 'fromUserId', current);
                await updateUserFieldsInCollection('recommendations', 'toUserId', current);

            }
            else
            {
                functions.logger.info("No change detected, skipping propagation updates");
            }
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    });

export const onUserCreate = functions.firestore
    .document('users/{userId}')
    .onCreate(async (snap: QueryDocumentSnapshot, context: EventContext) => {
        try{
            const data = snap.data();
            const userRef = snap.ref;
            data.clout = 50;
            await userRef.set(data, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    });



const updatePostFieldsInCollection = async(collectionName: string, postData: any, postId: string) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where('postId', '==', postId).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        const dataToUpdate = {
            postRate: postData.rate,
            postTile: postData.title,
            postsSubtitle: postData.subtitle
        }

        batchArray[batchIndex].update(documentSnapshot.ref, dataToUpdate);
        operationCounter++;

        if (operationCounter === 499) {
            batchArray.push(db.batch());
            batchIndex++;
            operationCounter = 0;
        }
    });
    await Promise.all(batchArray.map(batch => batch.commit()))
    //batchArray.forEach(async batch => await batch.commit());
}


export const onPostUpdate = functions.firestore
    .document('posts/{postId}')
    .onWrite(async (change: Change<QueryDocumentSnapshot>, context: EventContext) => {
        try{

            const current = change.after.data();
            const prev = change.before.data();

            const docRef = change.after.ref;

            const [userData, _] = await getUserData(current.userId);

            const [product, productRef] = await getProductInfo(current.externalProductId);

            await saveItemData(current, docRef, product, userData);

            if(JSON.stringify(prev) !== JSON.stringify(current))
            {
                const currentId: string = change.after.ref.id;
                await updatePostFieldsInCollection('postedItemLikes', current, currentId);
            }
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

const updateRecommendationFieldsInCollection = async(collectionName: string, recommendationData: any, recommendationId: string) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where('recommendationId', '==', recommendationId).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        const dataToUpdate = {
            recommendationRate: recommendationData.rate,
            recommendationTile: recommendationData.title,
            recommendationSubtitle: recommendationData.subtitle,
            recommendationDetails: recommendationData.details
        }

        batchArray[batchIndex].update(documentSnapshot.ref, dataToUpdate);
        operationCounter++;

        if (operationCounter === 499) {
            batchArray.push(db.batch());
            batchIndex++;
            operationCounter = 0;
        }
    });
    await Promise.all(batchArray.map(batch => batch.commit()))
    //batchArray.forEach(async batch => await batch.commit());
}

export const onRecommendationUpdate = functions.firestore
    .document('recommendations/{recommendationId}')
    .onWrite(async (change: Change<QueryDocumentSnapshot>, context: EventContext) => {
        try{
            const current = change.after.data();
            const prev = change.before.data();

            const docRef = change.after.ref;

            const [userData, _] = await getUserData(current.userId);

            const [product, productRef] = await getProductInfo(current.externalProductId);

            await saveItemData(current, docRef, product, userData);

            if(JSON.stringify(prev) !== JSON.stringify(current))
            {
                const currentId: string = change.after.ref.id;
                await updateRecommendationFieldsInCollection('recommendedItemLikes', current, currentId);
            }
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationCreate = functions.firestore
    .document('recommendations/{recommendationId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try{
            let docData = change.data();

            const [userData, userRef] = await getUserData(docData.userId as string);
            userData.clout = userData.clout + ADD_RECOMMENDATION_CLOUT_POINTS;
            userRef.set(userData, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationDelete = functions.firestore
    .document('recommendations/{recommendationId}')
    .onDelete(async (snapshot: QueryDocumentSnapshot, context: EventContext) =>{
        try{
            let docData = snapshot.data();

            const [userData, userRef] = await getUserData(docData.userId);
            userData.clout = userData.clout - ADD_RECOMMENDATION_CLOUT_POINTS || 0;
            userRef.set(userData, {merge: true});

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onActivityCreated = functions.firestore
    .document('activityItems/{activityId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            let docData = change.data();
            const docRef = change.ref;

            if(docData.fromUserId)
            {
                const [fromUserData, fromUserRef] = await getUserData(docData.fromUserId);
                docData = {
                    ...docData,

                    fromAuthor: fromUserData.name || "",
                    fromAuthorImage: fromUserData.localPath || "",
                    fromAuthorRemoteImage: fromUserData.remotePath || "",
                    fromAuthorScore: fromUserData.clout || 0,
                }
            }

            if(docData.productId)
            {
                const [product, productRef] = await getProductInfo(docData.productId);
                docData = {
                    ...docData,

                    productTitle: product.title || "",
                    productBrand: product.brand || "",
                    productLocalPath: product.localPath || "",
                    productRemotePath: product.remotePath || ""

                }
            }

            if(docData.toUserId)
            {
                const [toUserData, toUserRef] = await getUserData(docData.toUserId);
                docData = {
                    ...docData,
                    toAuthor: toUserData.name,
                    toAuthorScore: toUserData.clout,
                    toAuthorImage: toUserData.localPath,
                    toAuthorRemoteImage: toUserData.remotePath
                }

            }

            if(docData.brandId)
            {
                const [brand, brandRef] = await getBrandInfo(docData.brandId);
                docData =
                    {
                        ...docData,
                        brandTitle: brand.title,
                        brandLocalPath: brand.localPath || "",
                        brandRemotePath: brand.remotePath || ""
                    }
            }

            await docRef.set(docData, {merge: true});

            //TODO: give clout on activity

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })


export const onActivityDelete = functions.firestore
    .document('activityItems/{activityId}')
    .onDelete(async (snapshot: QueryDocumentSnapshot, context: EventContext) =>{
        try{
            let docData = snapshot.data();

            //const [userData, userRef] = await getUserData(docData.fromUserId);
            //TODO:
            //userData.clout = userData.clout + ;
            //userRef.set(userData, {merge: true});

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })