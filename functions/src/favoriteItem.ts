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

const getUserData = async (docData) => {

    const userSnapshot = await db.collection('users').where('phone', '==', docData.userId).get();
    if(userSnapshot  == null || userSnapshot.docs == null || userSnapshot.docs.length == 0)
    {
        throw new Error("could not find user data for saved item user id");
    }

    const userData = userSnapshot.docs[0].exists ? userSnapshot.docs[0].data() : null;
    if(userData == null)
    {
        throw new Error("userData could not be set");
    }

    functions.logger.info(userData);
    return userData
}

const saveItemData = async (docData, docRef, product, userData) => {

    docData = {
        ...docData,

        author: userData.name,
        authorImage: userData.localPath,
        authorRemoteImage: userData.remotePath,
        score: userData.score,

        title: product.title,
        brand: product.brand,
        domain: product.domain,
        favoriteCount: product.favoriteCount,
        saveCount: product.saveCount,
        productLocalPath: product.localPath,
        productRemotePath: product.remotePath
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

            const userData = await getUserData(docData);

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

            const [product, productRef] = await getProductInfo(docData);

            product.saveCount = product.saveCount + 1;

            await productRef.set(product, {merge: true});

            const userData = await getUserData(docData);

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

            const [product, productRef] = await getProductInfo(docData);

            product.saveCount = product.saveCount - 1;

            await productRef.set(product, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onPostLiked = functions.firestore
    .document('postLikes/{likeId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            const docData = change.data();
            const docRef = change.ref;
            const userData = await getUserData(docData);

            const newData = {
                ...docData,

                author: userData.author,
                authorImage: userData.authorImage,
                authorRemoteImage: userData.authorRemoteImage,
                score: userData.score
            }
            await docRef.set(newData, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })

export const onRecommendationLiked = functions.firestore
    .document('recommendationLikes/{likeId}')
    .onCreate(async (change: QueryDocumentSnapshot, context: EventContext) => {
        try
        {
            const docData = change.data();
            const docRef = change.ref;
            const userData = await getUserData(docData);

            const newData = {
                ...docData,

                author: userData.author,
                authorImage: userData.authorImage,
                authorRemoteImage: userData.authorRemoteImage,
                score: userData.score
            }
            await docRef.set(newData, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message)
        }
    })