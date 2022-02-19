import Express from 'express';
import fetch from 'node-fetch';
import * as url from "url";
import { parse } from 'node-html-parser';
import {Product} from "./product";

const PORT = 4000;
//TODO: persist
const products: Product[] = []
const domainsToScrape = []

let app: Express.Application = Express();
app.use(Express.urlencoded({ extended: false }));

app.put("/domain", async (req: Express.Request, res: Express.Response) => {
    if(!req.body.domainUri)
    {
        //TODO: set proper response statuses
        res.status(400).send("Please specify domain to be added to the scraper list")
        return;
    }

    const uri = url.parse(req.body.domainUri.trim() ,true).host;
    console.log(uri);

    const response = await fetch("https://" + uri + "/products.json");
    const data = await response.json();
    console.log(data)
    if(!data || data.products.length == 0)
    {
        return;
    }

    let products: Product[] = [];
    data.products.forEach((productData: any) => {

        //TODO: ask if we want to add a separate product for each variation
        const product: Product = {
            name: parse(productData.title).text.replace(/\n/g, " ") || "",
            price: productData.variants[0].price, // TODO: check if exists
            link: uri + "products/" + productData.handle,
            description: parse(productData.body_html).text.replace(/\n/g, " ") || "", //TODO: parse html
            domain: uri,
            images: [productData.images.map((img: any) => img && img.src)]
        }
        products.push(product)
    })

    console.log(data);
    console.log(products);
    //TODO: trim and parse uri

    //TODO: persist parsed data in a database instead
    domainsToScrape.push(req.body.domainUri)
    //TODO: decide uri store type and scrape product data
    res.status(200).send("OK")

})

app.get("/products/:domainUri", (req, res) => {
    //TODO:
});

// Add 404 handler
app.use(function (_req: Express.Request, res: Express.Response) {
    res.status(404).send("Not found");
});


// Start server (app.listen can also be used)
app.listen(PORT, () =>{
    console.log(`Running at http://localhost:${PORT}/`)
});

