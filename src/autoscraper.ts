import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore} from 'firebase-admin/firestore';

import * as serviceAccount from '../firebase-service-account.json';
import {DomainParser} from "./domainparser";

const firebaseServiceAccount = {               //clone json object into new object to make typescript happy
    type: serviceAccount.type,
    projectId: serviceAccount.project_id,
    privateKeyId: serviceAccount.private_key_id,
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
    clientId: serviceAccount.client_id,
    authUri: serviceAccount.auth_uri,
    tokenUri: serviceAccount.token_uri,
    authProviderX509CertUrl: serviceAccount.auth_provider_x509_cert_url,
    clientC509CertUrl: serviceAccount.client_x509_cert_url
}

initializeApp({
    credential: cert(firebaseServiceAccount)
});

const db = getFirestore();

//TODO: perhaps clear the products collection beforehand?
(async () => {
    // const snapshot = await db.collection('parsedDomains').get();
    //
    // if(!snapshot || !snapshot.docs)
    // {
    //     return;
    // }
    // const domains = snapshot.docs.map(doc => doc.data().domain);
    const domains = [
        "https://consciouscoconut.com/",
        "https://erbaviva.com/",
        "https://cloveandhallow.com/",
        "https://kahina-givingbeauty.com/",
        "https://www.alimapure.com/",
        "https://www.drinkpurerose.com/",
        "https://beutiskincare.com/",
        "https://byroe.com/",
        "https://indielee.com/",
        "https://janeiredale.com/",
        "https://odacite.com/",
        "https://ladysuitebeauty.com/",
        "https://www.laroche-posay.us/",
        "https://www.lorealparisusa.com/"
    ];

    for(const domain of domains)
    {
        try {
            const domainUrl = new URL(domain);
            const domainParser: DomainParser = new DomainParser(domainUrl);
            await domainParser.parse();
            await domainParser.store(db);
        } catch (e) {
            console.log(e);
        }

    }
})();

