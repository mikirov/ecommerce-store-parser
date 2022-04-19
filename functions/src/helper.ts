
import * as functions from "firebase-functions";
import admin from 'firebase-admin';
import {SOProduct} from "./soproduct";

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

    const userSnapshot = await admin.firestore().collection('users').where('phone', '==', userId!).get();
    if(userSnapshot  == null || userSnapshot.docs == null || userSnapshot.docs.length == 0)
    {
        throw new Error(`could not find user data for saved item user id ${userId}`);
    }
    const userDoc: FirebaseFirestore.DocumentSnapshot = userSnapshot.docs.filter(userDoc => userDoc.exists && !userDoc.data().isBrand)[0];

    const userData: FirebaseFirestore.DocumentData = userDoc.data();
    const userRef: FirebaseFirestore.DocumentReference = userDoc.ref;
    //const userData = userSnapshot.docs[0].exists ? userSnapshot.docs[0].data() : null;

    if(userData == null || userRef == null)
    {
        throw new Error("userData could not be set");
    }
    functions.logger.info(userData);
    return [userData, userRef]
}
