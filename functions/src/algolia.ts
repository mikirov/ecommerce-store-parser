import * as functions from 'firebase-functions';
import algoliasearch from 'algoliasearch';
import {Product} from "./product";
import {QueryDocumentSnapshot} from "firebase-functions/lib/providers/firestore";
import {Change, EventContext} from "firebase-functions";
import admin from "firebase-admin";

// Initialize the Algolia Client
const client = algoliasearch(process.env.ALGOLIA_APPID, process.env.ALGOLIA_PRIVATE_KEY);
const index = client.initIndex('product_search');

const saveToAlgolia = (snapshot: QueryDocumentSnapshot) => {
    const data: Product = snapshot.data() as Product;
    const searchableData = {brand: data.brand, name: data.name}
    const objectID = snapshot.id;

    // Add the data to the algolia index
    return index.saveObject({
        objectID,
        ...searchableData
    });
}

export const indexProduct = functions.firestore
    .document('products/{productId}')
    .onCreate((snap: QueryDocumentSnapshot) => {
        return saveToAlgolia(snap)
    });

export const updateProduct = functions.firestore
    .document('products/{productId}')
    .onUpdate((snapshotChange: Change<QueryDocumentSnapshot>) => {
        const snap = snapshotChange.after;
        return saveToAlgolia(snap);
    });

export const unindexProduct = functions.firestore
    .document('products/{productId}')
    .onDelete((snapshot: QueryDocumentSnapshot) => {
        const objectId = snapshot.id;
        return index.deleteObject(objectId);
    });

export const addAllProductsToAlgolia = functions.https.onRequest(async (req, res) => {
    const collectionSnapshot = await admin.firestore().collection('products').get();
    const products = collectionSnapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {return {objectID: doc.id, brand: doc.data().brand, name: doc.data().name}})
    await index.saveObjects(products);
})