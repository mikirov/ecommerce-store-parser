interface ShopifyProductData
{
    title: string;
    handle: string;
    body_html: string;
    variants: ShopifyProductVariant[];
    images: ShopifyProductImage[];
}

interface ShopifyProductVariant
{
    price: string;
}

interface ShopifyProductImage
{
    src: string;
}