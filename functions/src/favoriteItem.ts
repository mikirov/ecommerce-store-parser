import * as functions from 'firebase-functions';
import {DocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {Change, EventContext} from "firebase-functions";

import admin from 'firebase-admin';
import {SOProduct} from "./soproduct";
const  db = admin.firestore();

export const onItemFavorited = functions.firestore
    .document('favoriteItems/{favoriteItemId}')
    .onWrite(async (change: Change<DocumentSnapshot>, context: EventContext) => {
        try {
            const docRef = change.after.ref;
            let docData = change.after.data();
            if(!docRef || !docData)
            {
                functions.logger.error("no document ref or data")
                return;
            }

            const productsSnapshot = await db.collection('products').where('externalId', '==', docData.externalProductId).limit(1).get();
            let product: SOProduct = productsSnapshot.docs[0].exists ? productsSnapshot.docs[0].data() as SOProduct : null;
            const productRef = productsSnapshot.docs[0].exists ? productsSnapshot.docs[0].ref : null;
            if(!product || !productRef)
            {
                functions.logger.error("couldn't find product");
                return;
            }

            product.saveCount = product.saveCount + 1;

            await productRef.set(product, {merge: true});


            const userSnapshot = await db.collection('users').where('phone', '==', docData.userId).limit(1).get();
            if(!userSnapshot.docs || userSnapshot.docs.length == 0)
            {
                functions.logger.error("could not find user data for saved item user id");
                return;
            }

            const userData = userSnapshot.docs[0].exists ? userSnapshot.docs[0].data() : null;
            if(!userData)
            {
                functions.logger.error("could not find user data for saved item user id");
                return;
            }

            const userImageSnapshot = await db.collection('userImages').where('userId', '==', docData.userId).limit(1).get();
            if(!userImageSnapshot.docs || userImageSnapshot.docs.length == 0)
            {
                functions.logger.error("could not find user image for saved item user id");
                return;
            }

            const userImageData = userImageSnapshot.docs[0].exists ? userImageSnapshot.docs[0].data() : null;
            if(!userImageData)
            {
                functions.logger.error("could not find user image for saved item user id");
                return;
            }


            docData = {
                ...docData,

                author: userData.name,
                authorImage: userImageData.localPath,
                authorRemoteImage: userImageData.remotePath,
                score: userData.score,

                title: product.title,
                brand: product.brand,
                domain: product.domain,
                favoriteCount: product.favouriteCount,
                saveCount: product.saveCount,
                productLocalPath: product.localPath,
                productRemotePath: product.remotePath
            }

            await docRef.set(docData, {merge: true});
        }
        catch (e) {
            functions.logger.error(e.message);
        }
    })


