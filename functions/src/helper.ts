
import * as functions from "firebase-functions";
import admin from 'firebase-admin';
import {SOProduct} from "./soproduct";

export const ACCOUNT_CREATION_CLOUT_POINTS = 50;
export const ADD_BIO_CLOUT_POINTS = 20;
export const ADD_FAVORITE_CLOUT_POINTS = 50;
export const ADD_RECOMMENDATION_CLOUT_POINTS = 75;
export const ADD_POST_CLOUT_POINTS = 75;
export const ADD_SAVE_CLOUT_POINTS = 25;
export const PREFERRED_USER_FAVORITE_THRESHOLD = 7;

export const getProductInfo = async (externalProductId:string): Promise<[any, FirebaseFirestore.DocumentReference]> => {

    const productsSnapshot: FirebaseFirestore.DocumentData = await admin.firestore().collection('products').where('externalId', '==', externalProductId).get();
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

export const getRecommendationInfo = async (recommendationId: string): Promise<[any, FirebaseFirestore.DocumentReference]> => {

    const recommendationRef: FirebaseFirestore.DocumentReference = admin.firestore().collection('recommendations').doc(recommendationId);

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

export const getBrandInfo = async (brandId: string): Promise<[any, FirebaseFirestore.DocumentReference]> => {

    const brandRef: FirebaseFirestore.DocumentReference = admin.firestore().collection('brands').doc(brandId);

    const brandSnapshot: FirebaseFirestore.DocumentData = await brandRef.get();
    if(brandSnapshot == null || !brandSnapshot.exists)
    {
        throw new Error("couldn't find recommendation");
    }
    const brand = brandSnapshot.data();

    functions.logger.info(brand);
    functions.logger.info(brand);

    return [brand, brandRef];
}

export const getPostInfo = async (postId:string): Promise<[any, FirebaseFirestore.DocumentReference]> => {

    const postRef = admin.firestore().collection('posts').doc(postId);

    const postSnapshot: FirebaseFirestore.DocumentData = await postRef.get();
    if(postSnapshot == null || !postSnapshot.exists)
    {
        throw new Error(`couldn't find post ${postId}`);
    }
    const post = postSnapshot.data();

    functions.logger.info(post);
    functions.logger.info(postRef);

    return [post, postRef];
}

export const getUserData = async (userId: string) => {

    const userSnapshot: FirebaseFirestore.DocumentSnapshot = await admin.firestore().collection('users').doc(userId).get();
    if(userSnapshot  == null || !userSnapshot.exists)
    {
        throw new Error(`could not find user data for saved item user id ${userId}`);
    }

    const userData: FirebaseFirestore.DocumentData = userSnapshot.data();
    const userRef: FirebaseFirestore.DocumentReference = userSnapshot.ref;
    if(userData == null || userRef == null)
    {
        throw new Error("userData could not be set");
    }

    functions.logger.info(userData);
    return [userData, userRef];
}

export const sendPushNotification = async (token: string, body: string) => {
    const notification = {
        token,
        notification: {
            title: 'Social Ocean Notification.',
            body
        },
        data: {
            body
        }
    }
    await admin.messaging().send(notification, false);
}

export const updateUserCounters = async(db: any, userId: string) => {
    let [user, userRef] = await getUserData(userId);

    const followingSnapshot = await db.collection('following').where('fromUserId', '==', userId).get();
    const followingCount = followingSnapshot.docs.filter(doc => doc.exists).length;

    const followersSnapshot = await db.collection('following').where('toUserId', '==', userId).get();
    const followerCount = followersSnapshot.docs.filter(doc => doc.exists).length;

    const savedSnapshot = await db.collection('savedItems').where('userId', '==', userId).get();
    const savedCount = savedSnapshot.docs.filter(doc => doc.exists).length;

    const postSnapshot = await db.collection('posts').where('userId', '==', userId).get();
    const postCount = postSnapshot.docs.filter(doc => doc.exists).length;

    const favoriteSnapshot = await db.collection('favoriteItems').where('userId', '==', userId).get();
    const favoriteCount = favoriteSnapshot.docs.filter(doc => doc.exists).length;

    const recommendationSnapshot = await db.collection('recommendations').where('userId', '==', userId).get();
    const recommendationCount = recommendationSnapshot.docs.filter(doc => doc.exists).length;

    let clout = ACCOUNT_CREATION_CLOUT_POINTS;
    if(user.bio)
    {
        clout += ADD_BIO_CLOUT_POINTS;
    }

    if(savedCount > 0)
    {
        clout += savedCount * ADD_SAVE_CLOUT_POINTS;
    }

    if(postCount > 0)
    {
        clout += postCount * ADD_POST_CLOUT_POINTS;
    }

    if(recommendationCount > 0)
    {
        clout += recommendationCount * ADD_RECOMMENDATION_CLOUT_POINTS;
    }

    if(favoriteCount > 0)
    {
        clout += favoriteCount * ADD_FAVORITE_CLOUT_POINTS;
    }

    const productsFavoritedByUser: number = await getNumberProductsFavoritedByUser(db, userId);

    if(productsFavoritedByUser == PREFERRED_USER_FAVORITE_THRESHOLD)
    {
        user = {
            ...user,
            isPreferred: true
        };

        await addProUserActivity(db, userId);
    }

    user =
        {
            ...user,
            followerCount,
            followingCount,
            clout
            //dateUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
    //this will trigger user update which will propagate changes to all other collections
    await userRef.set(user, {merge: true});
}

export const updateProductCounters = async (db: any, externalId: string) => {

    let [product, productRef] = await getProductInfo(externalId);

    const savedSnapshot = await db.collection('savedItems').where('externalProductId', '==', product.externalId).get();
    const saveCount: number = savedSnapshot.docs.filter(doc => doc.exists).length;

    const favoriteSnapshot = await db.collection('favoriteItems').where('externalProductId', '==', product.externalId).get();
    const favoriteCount: number = favoriteSnapshot.docs.filter(doc => doc.exists).length;

    const postSnapshot = await db.collection('posts').where('externalProductId', '==', product.externalId).get();
    const postCount: number = postSnapshot.docs.filter(doc => doc.exists).length;

    const recommendationSnapshot = await db.collection('recommendations').where('externalProductId', '==', product.externalId).get();
    const recommendationCount: number = recommendationSnapshot.docs.filter(doc => doc.exists).length;

    const postLikesSnapshot = await db.collection('postedItemLikes').where('externalProductId', '==', product.externalId).get();
    const totalPostLikes: number = postLikesSnapshot.docs.filter(doc => doc.exists).length;

    const recommendationLikesSnapshot = await db.collection('recommendedItemLikes').where('externalProductId', '==', product.externalId).get();
    const totalRecommendationLikes: number = recommendationLikesSnapshot.docs.filter(doc => doc.exists).length;


    product = {
        ...product,
        saveCount,
        favoriteCount,
        postCount,
        recommendationCount,
        totalPostLikes,
        totalRecommendationLikes
    }

    await productRef.set(product, {merge: true});
}

export const updateRecommendationCounters = async (db: any, recommendationId: string) => {

    let [recommendation, recommendationRef] = await getRecommendationInfo(recommendationId);

    const savedSnapshot = await db.collection('recommendedItemLikes').where('recommendationId', '==', recommendationId).get();
    const rate: number = savedSnapshot.docs.filter(doc => doc.exists).length;

    recommendation = {
        ...recommendation,
        rate,
    }

    await recommendationRef.set(recommendation, {merge: true});
}

export const updatePostCounters = async (db: any, postId: string) => {

    let [post, postRef] = await getPostInfo(postId);

    const savedSnapshot = await db.collection('postedItemLikes').where('postId', '==', postId).get();
    const rate: number = savedSnapshot.docs.filter(doc => doc.exists).length;

    post = {
        ...post,
        rate,
    }

    await postRef.set(post, {merge: true});
}

export const updateProductFieldsInCollection = async(db, collectionName: string, productData) => {

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

export const hasUserLikedRecommendation = async (db, recommendationId: string, userId: string) : Promise<boolean> => {
    const snapshots = await db.collection('recommendedItemLikes').where('recommendationId', '==', recommendationId).get();
    const datas: FirebaseFirestore.DocumentData[] = snapshots.docs.filter(doc => doc.exists).map(doc => doc.data);
    return datas.find((data: FirebaseFirestore.DocumentData) => data.userId == userId) != undefined;
}

export const hasUserLikedPost = async (db, postId: string, userId: string) : Promise<boolean> => {
    const snapshots = await db.collection('postedItemLikes').where('postId', '==', postId).get();
    const datas: FirebaseFirestore.DocumentData[] = snapshots.docs.filter(doc => doc.exists).map(doc => doc.data);
    return datas.find((data: FirebaseFirestore.DocumentData) => data.userId == userId) != undefined;
}

export const getNumberProductsFavoritedByUser = async (db: any, userId: string) => {
    const snapshots = await db.collection('favoriteItems').where('userId', '==', userId).get();
    return snapshots.docs.filter(doc => doc.exists).length;

}

export const updateRecommendationFieldsInCollection = async(db, collectionName: string, recommendationData: any, recommendationId: string) => {

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

export const deleteAllLikesForRecommendation = async (db, recommendationId: string) => {
    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection('recommendedItemLikes').where('recommendationId', '==', recommendationId).get();
    snapshot.forEach(documentSnapshot => {
        if(!documentSnapshot.exists) return;

        batchArray[batchIndex].delete(documentSnapshot.ref);
        operationCounter++;

        if (operationCounter === 499) {
            batchArray.push(db.batch());
            batchIndex++;
            operationCounter = 0;
        }
    });
    await Promise.all(batchArray.map(batch => batch.commit()))
}

export const addFollowActivity = async (db, fromUserRef, toUserRef, fromUserData: any) => {
    const activityDocRef = db.collection('activityItems').doc();
    const followActivityData = {
        fromUserId: fromUserRef.id,
        toUserId: toUserRef.id,
        message: "started following you.",
        type: "User",
        dateAdded: admin.firestore.FieldValue.serverTimestamp()
    };

    await activityDocRef.set(followActivityData, {merge: true});
}

const addProUserActivity = async(db, toUserRef) => {
    const activityDocRef = db.collection('activityItems').doc();
    const followActivityData = {
        toUserId: toUserRef.id,
        message: "Congrats. You’ve unlocked Pro features and benefits 💕",
        type: "Message",
        dateAdded: admin.firestore.FieldValue.serverTimestamp()
    };

    await activityDocRef.set(followActivityData, {merge: true});
}