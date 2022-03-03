export interface ShopifyProductData
{
  title: string;
  handle: string;
  body_html: string;
  vendor: string;
  variants: ShopifyProductVariant[];
  images: ShopifyProductImage[];
}

export interface ShopifyProductVariant
{
  price: string;
}

export interface ShopifyProductImage
{
  src: string;
}
