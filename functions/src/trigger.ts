import * as functions from 'firebase-functions';
import {DocumentSnapshot, QueryDocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {Change, EventContext} from "firebase-functions";

import admin from 'firebase-admin';
import {SOProduct} from "./soproduct";
import {ACCOUNT_CREATION_CLOUT_POINTS, addFollowActivity, ADD_BIO_CLOUT_POINTS, ADD_FAVORITE_CLOUT_POINTS,
    ADD_POST_CLOUT_POINTS,
    ADD_RECOMMENDATION_CLOUT_POINTS,
    ADD_SAVE_CLOUT_POINTS, deleteAllLikesForRecommendation, getBrandInfo,
    getNumberProductsFavoritedByUser, getPostInfo, getProductInfo, getRecommendationInfo, getUserData,
    hasUserLikedRecommendation,
    PREFERRED_USER_FAVORITE_THRESHOLD,
    sendPushNotification,
    updatePostCounters,
    updateProductCounters, updateProductFieldsInCollection, updateRecommendationCounters, updateUserCounters } from './helper';
const  db = admin.firestore();
//db.settings({ ignoreUndefinedProperties: true });


const saveItemData = async (docData, docRef, product, userData, recommendation = null, post = null) => {

    docData = {
        ...docData,

        author: userData.name || "",
        authorImage: userData.localPath || "",
        authorRemoteImage: userData.remotePath || "",
        authorScore: userData.clout || "",
        authorIsBrand: userData.isBrand,
        authorIsApproved: userData.isApproved,
        authorIsPreferred: userData.isPreferred,

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
        const docRef = change.ref;
        let docData = change.data();

        try
        {
            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);

            let [userData, userRef] = await getUserData(docData.userId);
            let [product, productRef] = await getProductInfo(docData.externalProductId);
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
            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onItemSaved = functions.firestore
    .document('savedItems/{savedItemId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        let docData = change.data();
        let docRef = change.ref;

        try
        {
            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);

            const [userData, userRef] = await getUserData(docData.userId);
            let [product, productRef] = await getProductInfo(docData.externalProductId);
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

            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);

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
            await updateUserCounters(db, docData.userId)
            await updateProductCounters(db, docData.externalProductId);

            //TODO:
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
            await updateUserCounters(db, docData.userId)
            await updateProductCounters(db, docData.externalProductId);
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onPostLiked = functions.firestore
    .document('postedItemLikes/{likeId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        const docData = change.data();
        const docRef = change.ref;

        try
        {
            let [post, postRef] = await getPostInfo(docData.postId);
            const [userData, _] = await getUserData(docData.userId);
            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await saveItemData(docData, docRef, product, userData, null, post);

            await updateProductCounters(db, docData.externalProductId);
            await updatePostCounters(db, docData.postId);
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

            await updateProductCounters(db, docData.externalProductId);
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

            const hasLikedRecommendation: boolean = await hasUserLikedRecommendation(db, docData.recommendationId, docData.userId);
            if(hasLikedRecommendation)
            {
                functions.logger.error("User " + docData.userId + "cannot like recommendation " + docData.recommendationId + " twice");
                await docRef.delete();
                return;
            }

            const [userData, _] = await getUserData(docData.userId);
            const [product, productRef] = await getProductInfo(docData.externalProductId);
            let [recommendation, recommendationRef] = await getRecommendationInfo(docData.recommendationId);
            await saveItemData(docData, docRef, product, userData, recommendation, null);

            await updateProductCounters(db, docData.externalProductId);
            await updateRecommendationCounters(db, docData.recommendationId);

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

            const hasLikedRecommendation: boolean = await hasUserLikedRecommendation(db, docData.recommendationId, docData.userId);
            if(!hasLikedRecommendation)
            {
                functions.logger.error("User " + docData.userId + "has not liked recommendation " + docData.recommendationId + "that they're trying to unlike")
                return;
            }

            await updateRecommendationCounters(db, docData.recommendationId);
            await updateProductCounters(db, docData.externalProductId);
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

            if(docData.fromUserId === docData.toUserId)
            {
                throw new Error("fromUserId and toUserId cannot be the same");
            }

            await updateUserCounters(db, docData.fromUserId);
            await updateUserCounters(db, docData.toUserId);

            let [fromUserData, fromUserRef] = await getUserData(docData.fromUserId);
            let [toUserData, toUserRef] = await getUserData(docData.toUserId);

            await addFollowActivity(db, fromUserRef, toUserRef, fromUserData);

            const pushNotificationMessage = fromUserData.name + " started following you.";
            await sendPushNotification(toUserData.fcmToken, pushNotificationMessage);

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

export const onProductUpdate = functions.firestore
    .document('products/{productId}')
    .onUpdate(async (change: Change<QueryDocumentSnapshot>, context: EventContext) => {
        try{
            const current = change.after.data();
            const prev = change.before.data();
            if(JSON.stringify(prev) !== JSON.stringify(current))
            {
                await updateProductCounters(db, current.externalId);
                await updateProductFieldsInCollection(db, 'favoriteItems', current);
                await updateProductFieldsInCollection(db, 'savedItems', current);
                await updateProductFieldsInCollection(db, 'recommendations', current);
                await updateProductFieldsInCollection(db, 'recommendedItemLikes', current);
                await updateProductFieldsInCollection(db, 'postedItemLikes', current);
            }
        }
        catch (e) {
            functions.logger.error(e.message);
        }
    })

const updateUserFieldsInCollection = async(collectionName: string, idToCheck: string, id: string, userData) => {

    const batchArray = [];
    batchArray.push(db.batch());
    let operationCounter = 0;
    let batchIndex = 0;

    const snapshot = await db.collection(collectionName).where(idToCheck, '==', id).get();
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
                    authorRemoteImage: userData.remotePath,
                    authorIsBrand: userData.isBrand,
                    authorIsApproved: userData.isApproved,
                    authorIsPreferred: userData.isPreferred
                }
            }
            break;
            case 'fromUserId':
            {
                dataToUpdate =
                {
                    fromAuthor: userData.name,
                    fromAuthorScore: userData.clout,
                    fromAuthorImage: userData.localPath,
                    fromAuthorRemoteImage: userData.remotePath,
                    fromAuthorIsBrand: userData.isBrand,
                    fromAuthorIsApproved: userData.isApproved,
                    fromAuthorIsPreferred: userData.isPreferred
                }
            }
            break;
            case 'toUserId':
            {
                dataToUpdate =
                {
                    toAuthor: userData.name,
                    toAuthorScore: userData.clout,
                    toAuthorImage: userData.localPath,
                    toAuthorRemoteImage: userData.remotePath,
                    toAuthorIsBrand: userData.isBrand,
                    toAuthorIsApproved: userData.isApproved,
                    toAuthorIsPreferred: userData.isPreferred
                }
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
            const docId = change.after.id;
            const prev = change.before.data();
            const userRef = change.after.ref;
            if(current.isBrand)
            {
                functions.logger.info("Brand info changed, we don't want to propagate to other collections");
                return;
            }
            if(JSON.stringify(prev) !== JSON.stringify(current)) //HACK: check by value instead of by reference
            {
                await updateUserCounters(db, docId);

                await updateUserFieldsInCollection('favoriteItems', 'userId',docId, current);
                await updateUserFieldsInCollection('savedItems', 'userId',docId, current);
                await updateUserFieldsInCollection('following', 'fromUserId', docId, current);
                await updateUserFieldsInCollection('following', 'toUserId', docId, current);
                await updateUserFieldsInCollection('recommendedItemLikes', 'userId', docId, current);
                await updateUserFieldsInCollection('postedItemLikes', 'userId', docId, current);
                await updateUserFieldsInCollection('posts', 'userId', docId, current);
                await updateUserFieldsInCollection('recommendations', 'userId', docId, current);
                await updateUserFieldsInCollection('activityItems', 'fromUserId', docId, current);
                await updateUserFieldsInCollection('recommendations', 'toUserId', docId, current);

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
            let data = snap.data();
            const toUserId = snap.id;
            const userRef = snap.ref;
            functions.logger.info("User id: " + toUserId);
            data = {
                ...data,
                clout: ACCOUNT_CREATION_CLOUT_POINTS,
                dateAdded: admin.firestore.FieldValue.serverTimestamp()
            }

            const fromUserIds =
                [
                    "iuPSTErBDTMhH7MIjU3G", // Mihail
                    "LL68KTDxGltU560nV8eF", //Tor
                    "GV22E5KrJ4IdDQhITvs6", //Jane
                ]
            const promises = fromUserIds.map((fromUserId: string) => {
                const followDocRef = db.collection('following').doc();
                const followDocData = {
                    fromUserId,
                    toUserId
                };
            });

            await Promise.all(promises);

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
            postTitle: postData.title,
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
            if(JSON.stringify(prev) === JSON.stringify(current))
            {
                functions.logger.error("Shouldn't do anything when data is not updated");
                return;
            }

            const docRef = change.after.ref;

            const [userData, _] = await getUserData(current.userId);
            const [product, productRef] = await getProductInfo(current.externalProductId);
            await saveItemData(current, docRef, product, userData);


            const currentId: string = change.after.id;
            await updateProductCounters(db, current.externalProductId);
            await updatePostCounters(db, change.after.id);

            await updatePostFieldsInCollection('postedItemLikes', current, currentId);

        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationUpdate = functions.firestore
    .document('recommendations/{recommendationId}')
    .onUpdate(async (change: Change<QueryDocumentSnapshot>, context: EventContext) => {
        try{


            const current = change.after.data();
            const prev = change.before.data();
            if(JSON.stringify(prev) === JSON.stringify(current))
            {
                functions.logger.error("Shouldn't do anything when data is not updated");
                return;
            }

            const docRef = change.after.ref;
            const currentId: string = change.after.id;

            await updateProductCounters(db, current.externalProductId);
            await updateRecommendationCounters(db, change.after.id);
            await updateUserCounters(db, current.userId);

            const [userData, _] = await getUserData(current.userId);
            const [product, productRef] = await getProductInfo(current.externalProductId);
            await saveItemData(current, docRef, product, userData);

            await updatePostFieldsInCollection('recommendedItemLikes', current, currentId);
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
            const docRef = change.ref;
            const currentId: string = docRef.id;

            //Update counters
            await updateUserCounters(db, docData.userId);
            await updateProductCounters(db, docData.externalProductId);
            await updateRecommendationCounters(db, currentId);


            //save all data
            const [userData, _] = await getUserData(docData.userId);
            const [product, productRef] = await getProductInfo(docData.externalProductId);
            await saveItemData(docData, docRef, product, userData);

            //propagate data changes
            await updatePostFieldsInCollection('recommendedItemLikes', docData, currentId);

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
            await updateUserCounters(db, docData.userId);

            await deleteAllLikesForRecommendation(db, snapshot.id);
            //TODO: delete recommendation likes as well
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
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

// import { Twilio } from 'twilio';
// const client = new Twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
//
// export const sendRegCode = functions.https.onCall(async (data, context) => {
//     try
//     {
//         // Message text passed from the client.
//         const to = data.to;
//         const codeText = data.code;
//
//         const message = await client.messages
//             .create({
//                 body: codeText,
//                 from: '+14158549371',
//                 to: to
//             });
//
//         functions.logger.info("Sucess: " + codeText + " to " + to, {structuredData: true});
//         functions.logger.info(message.sid, {structuredData: true})
//
//         return {
//             result: "success"
//         };
//     } catch (e) {
//
//         functions.logger.error("Could not send SMS to user ");
//         functions.logger.error(e.message);
//
//         return {
//             result: "failure"
//         };
//     }
// });