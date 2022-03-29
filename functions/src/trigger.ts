import * as functions from 'firebase-functions';
import {DocumentSnapshot, QueryDocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {Change, EventContext} from "firebase-functions";

import admin from 'firebase-admin';
import {SOProduct} from "./soproduct";
const  db = admin.firestore();

const getProductInfo = async (docData): Promise<[SOProduct, FirebaseFirestore.DocumentReference]> => {
    if(docData == null)
    {
        throw new Error("no document data");
    }

    const productsSnapshot: FirebaseFirestore.DocumentData = await db.collection('products').where('externalId', '==', docData.externalProductId).get();
    if(productsSnapshot == null || productsSnapshot.docs == null || productsSnapshot.docs.length == 0)
    {
        throw new Error("couldn't find product");
    }
    const product: SOProduct = productsSnapshot.docs[0].exists ? productsSnapshot.docs[0].data() as SOProduct : null;
    const productRef: FirebaseFirestore.DocumentReference = productsSnapshot.docs[0].exists ? productsSnapshot.docs[0].ref : null;
    if(product == null || productRef == null)
    {
        throw new Error("product or product ref are null");
    }
    functions.logger.info(product);
    functions.logger.info(productRef);

    return [product, productRef];
}

const getRecommendationInfo = async (docData): Promise<[any, FirebaseFirestore.DocumentReference]> => {
    if(docData == null)
    {
        throw new Error("no document data");
    }

    const recommendationRef: FirebaseFirestore.DocumentReference = db.collection('recommendations').doc(docData.recommendationId);

    const recommendationSnapshot: FirebaseFirestore.DocumentData = await recommendationRef.get();
    if(recommendationSnapshot == null || !recommendationSnapshot.exists)
    {
        throw new Error("couldn't find recommendation");
    }
    const recommendation = recommendationSnapshot.data();

    functions.logger.info(recommendation);
    functions.logger.info(recommendationRef);

    return [recommendation, recommendationRef];
}

const getPostInfo = async (docData): Promise<[any, FirebaseFirestore.DocumentReference]> => {
    if(docData == null)
    {
        throw new Error("no document data");
    }

    const postRef = db.collection('posts').doc(docData.postId);

    const postSnapshot: FirebaseFirestore.DocumentData = await postRef.get();
    if(postSnapshot == null || !postSnapshot.exists)
    {
        throw new Error("couldn't find product");
    }
    const post = postSnapshot.data();

    functions.logger.info(post);
    functions.logger.info(postRef);

    return [post, postRef];
}

const getUserData = async (userId) => {

    const userSnapshot = await db.collection('users').where('phone', '==', userId).get();
    if(userSnapshot  == null || userSnapshot.docs == null || userSnapshot.docs.length == 0)
    {
        throw new Error("could not find user data for saved item user id");
    }

    const userData = userSnapshot.docs[0].exists ? userSnapshot.docs[0].data() : null;
    const userRef = userSnapshot.docs[0].exists ? userSnapshot.docs[0].ref : null;
    if(userData == null || userRef == null)
    {
        throw new Error("userData could not be set");
    }
    functions.logger.info(userData);
    return [userData, userRef]
}

const saveItemData = async (docData, docRef, product, userData, recommendation = null, post = null) => {

    docData = {
        ...docData,

        author: userData.name,
        authorImage: userData.localPath,
        authorRemoteImage: userData.remotePath,
        authorScore: userData.score,

        productTitle: product.title,
        productBrand: product.brand,
        productDomain: product.domain,
        productFavoriteCount: product.favoriteCount,
        productSaveCount: product.saveCount,
        productLocalPath: product.localPath,
        productRemotePath: product.remotePath
    }
    if(recommendation)
    {
        docData = {
            ...docData,
            recommendationTitle: recommendation.title,
            recommendationSubtitle: recommendation.subtitle,
            recommendationDetails: recommendation.details,
            recommendationRate: recommendation.rate
        }
    }

    if(post)
    {
        docData = {
            ...docData,
            postTitle: post.title,
            postSubtitle: post.subtitle,
            postDetails: post.details,
            postRate: post.rate
        }
    }

    await docRef.set(docData, {merge: true});
}

export const onItemFavorited = functions.firestore
    .document('favoriteItems/{favoriteItemId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try {
            const docRef = change.ref;
            let docData = change.data();
            const [product, productRef] = await getProductInfo(docData);

            product.favoriteCount = product.favoriteCount + 1;
            await productRef.set(product, {merge: true});

            const userData = await getUserData(docData.userId);

            await saveItemData(docData, docRef, product, userData);
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
            const [product, productRef] = await getProductInfo(docData);

            product.favoriteCount = product.favoriteCount - 1;

            await productRef.set(product, {merge: true});
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

            let [product, productRef] = await getProductInfo(docData);

            product = {
                ...product,
                saveCount: product.saveCount + 1 || 1
            }

            await productRef.set(product, {merge: true});

            const [userData, _] = await getUserData(docData.userId);

            await saveItemData(docData, docRef, product, userData);
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

            let [product, productRef] = await getProductInfo(docData);

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

export const onPostLiked = functions.firestore
    .document('postedItemLikes/{likeId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            const docData = change.data();
            const docRef = change.ref;

            let [post, postRef] = await getPostInfo(docData);

            post = {
                ...post,
                rate: post.rate + 1 || 1
            }

            await postRef.set(post, {merge: true});

            const [userData, _] = await getUserData(docData.userId);

            const [product, productRef] = await getProductInfo(docData);

            await saveItemData(docData, docRef, product, userData, null, post);

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

            let [post, postRef] = await getPostInfo(docData);

            post = {
                ...post,
                rate: post.rate -1 || 0
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

            let [recommendation, recommendationRef] = await getRecommendationInfo(docData);
            recommendation =
                {
                    ...recommendation,
                    rate: recommendation.rate + 1 || 1
                }
            await recommendationRef.set(recommendation, {merge: true});

            const [userData, _] = await getUserData(docData.userId);

            const [product, productRef] = await getProductInfo(docData);

            await saveItemData(docData, docRef, product, userData, recommendation, null);
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

            let [recommendation, recommendationRef] = await getRecommendationInfo(docData);

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

            fromUserData =
            {
                ...fromUserData,
                followingCount: fromUserData.followingCount + 1|| 1
            }

            toUserData =
            {
                ...toUserData,
                followerCount: toUserData.followerCount + 1 || 1
            }

            await fromUserRef.set(fromUserData, {merge: true});
            await toUserRef.set(toUserData, {merge: true});

            const docRef = change.ref;

            docData = {
                ...docData,
                fromAuthor: fromUserData.name,
                fromAuthorImage: fromUserData.localPath,
                fromAuthorRemoteImage: fromUserData.remotePath,
                fromAuthorScore: fromUserData.score,

                toAuthor: toUserData.name,
                toAuthorImage: toUserData.localPath,
                toAuthorRemoteImage: toUserData.remotePath,
                toAuthorScore: toUserData.score
            }

            await docRef.set(docData, {merge: true})
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

            let [fromUserData, fromUserRef] = await getUserData(docData.fromUserId);
            let [toUserData, toUserRef] = await getUserData(docData.toUsedId);

            fromUserData = {
                ...fromUserData,
                followingCount: fromUserData.followingCount - 1 || 0
            }

            toUserData = {
                ...toUserData,
                followerCount: toUserData.followerCount - 1 || 0
            }

            await fromUserRef.set(fromUserData, {merge: true});
            await toUserRef.set(toUserData, {merge: true});

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    });