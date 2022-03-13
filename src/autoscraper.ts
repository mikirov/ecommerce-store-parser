import {initializeApp, cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';

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

    // const snapshot = await db.collection('unparsableDomains').get();
    // if (!snapshot || !snapshot.docs) {
    //     return;
    // }
    // const domains: string[] = snapshot.docs.map(doc => doc.data().domain);
    // console.log(domains)
    //
    const domains: string[] = [
        "https://www.ahyes.org/",
        "http://www.alaffia.com",
        "https://everydayforfuture.it/en/prodotti/",
        "http://www.AlteyaOrganics.com",
        "https://www.aromanaturals.com/",
        "https://attitudeliving.com/",
        "https://www.auracacia.com/",
        "https://www.auromere.com/",
        "https://www.badgerbalm.com/",
        "https://www.balancedhealthbotanicals.com/",
        "https://bambonatureusa.com/",
        "https://beautybyearth.com/product-category/oily-skin",
        "https://www.beeandyou.com/",
        "https://www.naturesanswer.com/",
        "http://www.blumnaturals.com/",
        "https://brittaniesthyme.com/",
        "https://www.bulldogskincare.com/uk/",
        "https://www.bulldogskincare.com/uk/",
        "https://www.sacredbiology.com/",
        "https://cbdfx.com/",
        "https://www.cliganic.com/",
        "https://www.cocokind.com/",
        "https://www.cornbreadhemp.com/",
        "https://www.tonicproducts.com/",
        "https://daninaturals.com/",
        "https://www.lipbang.com/",
        "https://drnaturalusa.com/",
        "https://drbotanicals.com/",
        "https://www.drbronner.com/",
        "https://drtusk.com/",
        "https://earthsciencebeauty.com/",
        "https://ecolips.com/",
        "https://emani.com/",
        "https://thisisembody.com/",
        "https://www.eoproducts.com/",
        "https://www.evanhealy.com/",
        "http://www.everymanjack.co",
        "https://fairytaleshaircare.com/",
        "http://www.fineusatrading.co",
        "https://www.urbanspa.ca/",
        "http://www.giovannicosmetics.co",
        "https://greenandlovelyproducts.com/",
        "http://www.ilovegreengorilla.co",
        "http://www.frenchtop.co",
        "https://www.handinhandsoap.com/",
        "https://hollywood-jp.com/en/",
        "https://humphreysusa.com/",
        "https://hyalogic.com/",
        "http://ilavahemp.co",
        "https://www.ilavacbd.com/",
        "https://www.indigowild.com/skin-care.html",
        "https://en.innaorganic.com",
        "https://instanatural.com/",

        "https://intelligenceofnature.com/products/skin-health-spray?variant=39683721592886",

        "https://wellbeingisland.com.au/",

        "https://littletwig.com/",

        "https://koicbd.com/",

        "https://www.phergal.com/yacel-for-men-cuidado-hombre/",

        "https://lafes.com/",

        "https://www.lazarusnaturals.com/products/all-products",

        "https://littlemoonessentials.com/",

        "https://www.magsol.us/",

        "https://www.makes3organics.com/",

        "https://www.nzmanukagroup.com/",

        "http://mountainroseherbs.co",

        "https://www.muditaearth.com/",

        "https://canusgoatsmilk.com/",

        "http://www.murphysnaturals.co",

        "https://naturoil.com/",

        "https://www.novascotiafisherman.com/",

        "http://www.noyah.co",

        "https://www.okaypurenaturals.com/",

        "https://olikalife.com/",

        "https://olitashop.com/",

        "https://www.olividasoap.com/",

        "https://oregonsoapcompany.com/pages/soap-collections",

        "https://originalsprout.com/",

        "https://pachasoap.com/",

        "https://www.shoppri.com/",

        "https://www.pacificabeauty.com/",

        "https://parissa.com/",

        "https://phillipadam.com/",

        "http://www.piggypaint.com",

        "https://www.planttherapy.com/body",

        "http://www.portlandbeebalm.co",

        "https://pranarom.us/products/",

        "http://www.primematterlabs.co",

        "https://www.purenesshealth.com/",

        "https://www.revivalabs.com/",

        "http://www.beautyrnd.co",

        "https://www.routinecream.com/",

        "https://seedlegend.com/",

        "https://shikai.com/",

        "https://silverbiotics.com/skin-care/",

        "https://skyorganics.com/",

        "https://www.spadesoleil.com/",

        "https://www.sparoom.com/",

        "https://spinstersistersco.com/collections/best-seller-internal-use",

        "https://www.styx.at/en/",

        "https://www.sunchlorellausa.com/",

        "https://teatreetherapy.com/",

        "https://www.thayers.com/",

        "https://seaweedbathco.com/",

        "https://thursdayplantation.com/",

        "https://www.travertinespa.com/",

        "https://www.unfiwellness.com/",

        "https://belasoap.com/",

        "https://vegajelly.com/",

        "https://theveritasfarms.com/",
    ]
    for (const domain of domains) {
        try {
            const domainUrl = new URL(domain);
            const domainParser: DomainParser = new DomainParser(domainUrl, true);
            await domainParser.parse();
            await domainParser.store(db);
        } catch (e) {
            console.log(e);
        }
    }
})();

